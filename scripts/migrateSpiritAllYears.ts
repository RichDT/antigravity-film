/**
 * migrateSpiritAllYears.ts
 *
 * Fetches all Film Independent Spirit Award pages from Wikipedia (1st–41st,
 * covering 1985–2025 film years) and inserts ceremonies, categories, films,
 * people, and nominations.
 *
 * Creates the Spirit org + award if they don't already exist.
 * Safe to re-run: all inserts check for existing rows first.
 *
 * After running: re-run migrateCanonicalCategories.ts + migrateCategoryMappings.ts
 * to wire up the new categories into the badge pipeline.
 */

import { Pool } from 'pg';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
});

const FIRST_CEREMONY = 1;
const LAST_CEREMONY  = 41;
const REQUEST_DELAY_MS = 400;

// film year = ceremony number + 1984 (1st = 1985 films, 41st = 2025 films)
const filmYear = (n: number) => n + 1984;

// ─── Category map ──────────────────────────────────────────────────────────────
// Maps every Wikipedia header variant to { canon, type }.
// type:
//   'film'        → extract film only (no people)
//   'person-film' → person before the dash, film in italics after
//   'film-person' → film in italics before dash, person(s) after
//
// NOTE: All categories share the same case-insensitive lookup.

type CatType = 'film' | 'person-film' | 'film-person';
interface CatDef { canon: string; type: CatType; }

const CATEGORY_MAP: Record<string, CatDef> = {
    // ── Best Feature ─────────────────────────────────────────────────────
    'Best Feature':                  { canon: 'Best Feature',            type: 'film' },

    // ── Best Director ────────────────────────────────────────────────────
    'Best Director':                 { canon: 'Best Director',           type: 'person-film' },

    // ── Lead performances ─────────────────────────────────────────────────
    'Best Actor':                    { canon: 'Best Male Lead',          type: 'person-film' },  // early years
    'Best Actress':                  { canon: 'Best Female Lead',        type: 'person-film' },  // early years
    'Best Male Lead':                { canon: 'Best Male Lead',          type: 'person-film' },
    'Best Female Lead':              { canon: 'Best Female Lead',        type: 'person-film' },
    'Best Lead Performance':         { canon: 'Best Lead Performance',   type: 'person-film' },

    // ── Supporting performances ───────────────────────────────────────────
    'Best Supporting Male':          { canon: 'Best Supporting Male',    type: 'person-film' },
    'Best Supporting Female':        { canon: 'Best Supporting Female',  type: 'person-film' },
    'Best Supporting Performance':   { canon: 'Best Supporting Performance', type: 'person-film' },

    // ── Breakthrough / Debut ──────────────────────────────────────────────
    'Debut Performance':             { canon: 'Best Debut Performance',  type: 'person-film' },
    'Best Debut Performance':        { canon: 'Best Debut Performance',  type: 'person-film' },
    'Best Breakthrough Performance': { canon: 'Best Breakthrough Performance', type: 'person-film' },

    // ── Screenplay ────────────────────────────────────────────────────────
    'Best Screenplay':               { canon: 'Best Screenplay',         type: 'film-person' },
    'Best First Screenplay':         { canon: 'Best First Screenplay',   type: 'film-person' },
    'Best First Script':             { canon: 'Best First Screenplay',   type: 'film-person' },

    // ── First Feature ─────────────────────────────────────────────────────
    // Over-budget threshold variants in early years
    'Best First Feature':                        { canon: 'Best First Feature', type: 'film' },
    'Best First Feature (Under $500,000)':       { canon: 'Best First Feature', type: 'film' },
    'Best First Feature (Over $500,000)':        { canon: 'Best First Feature', type: 'film' },
    'Best First Feature (Under $750,000)':       { canon: 'Best First Feature', type: 'film' },
    'Best First Feature ($500,000 and under)':   { canon: 'Best First Feature', type: 'film' },
    'Best First Feature ($500,000 and Over)':    { canon: 'Best First Feature', type: 'film' },

    // ── Documentary ───────────────────────────────────────────────────────
    'Best Documentary Feature':      { canon: 'Best Documentary Feature', type: 'film' },
    'Best Documentary':              { canon: 'Best Documentary Feature', type: 'film' },

    // ── International ─────────────────────────────────────────────────────
    'Best International Film':       { canon: 'Best International Film', type: 'film' },
    'Best Foreign Film':             { canon: 'Best International Film', type: 'film' },
    'Best Foreign Language Film':    { canon: 'Best International Film', type: 'film' },
    'Best Foreign Language Movie':   { canon: 'Best International Film', type: 'film' },
    'Best Foreign Language Feature': { canon: 'Best International Film', type: 'film' },

    // ── Cinematography ────────────────────────────────────────────────────
    // Old years: Film – DP (film-person); newer years: DP – Film (person-film).
    // We extract film from italics regardless, so type only affects people extraction.
    // Use 'person-film' because newer years dominate.
    'Best Cinematography':           { canon: 'Best Cinematography',     type: 'person-film' },

    // ── Editing ───────────────────────────────────────────────────────────
    'Best Editing':                  { canon: 'Best Editing',            type: 'person-film' },
};

// ─── Case-insensitive map lookup ───────────────────────────────────────────────

function findCat(rawHeader: string): CatDef | undefined {
    if (rawHeader in CATEGORY_MAP) return CATEGORY_MAP[rawHeader];
    const lower = rawHeader.toLowerCase();
    for (const [k, v] of Object.entries(CATEGORY_MAP)) {
        if (k.toLowerCase() === lower) return v;
    }
    return undefined;
}

// ─── Wikitext helpers ──────────────────────────────────────────────────────────

function stripRefs(s: string): string {
    return s
        .replace(/<ref\b[^>]*\/>/gi, '')
        .replace(/<references\b[^>]*\/>/gi, '')
        .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, '')
        .replace(/<references\b[^>]*>[\s\S]*?<\/references>/gi, '');
}

function stripWikiLinks(s: string): string {
    return s
        .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_, _t, display) => display)
        .replace(/\[\[([^\]]+)\]\]/g, (_, target) => target.replace(/\s*\([^)]+\)\s*$/, '').trim());
}

function stripMarkup(s: string): string {
    return s
        .replace(/'{2,5}/g, '')
        .replace(/\{\{[^}]*\}\}/g, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&ndash;/g, '–')
        .replace(/&mdash;/g, '—')
        .replace(/&amp;/g, '&')
        .replace(/&nbsp;/g, ' ')
        .trim();
}

function cleanText(s: string): string {
    return stripMarkup(stripWikiLinks(stripRefs(s)));
}

/**
 * Extract the italicised film title from a raw wikitext line.
 * Films are always italicised: ''Title'' or '''''Title'''''
 * Also handles [[Link|Display]] inside the italics.
 */
function extractItalicFilm(raw: string): string | null {
    // '''''[[Link|Display]]''''' or ''[[Link|Display]]'' etc.
    const linkItalic = raw.match(/'{2,}(\[\[([^\]|]+\|)?([^\]|]+)\]\])'{2,}/);
    if (linkItalic) {
        return (linkItalic[3] ?? linkItalic[1])
            .replace(/\s*\([^)]+\)\s*$/, '')
            .trim();
    }
    // ''Plain Title''
    const plainItalic = raw.match(/'{2,}([^'\[\]]+)'{2,}/);
    if (plainItalic) return plainItalic[1].trim();
    return null;
}

/** Normalise a title for fuzzy DB matching. */
function normTitle(t: string): string {
    return t.toLowerCase()
        .replace(/^(the|a|an)\s+/i, '')
        .replace(/[^a-z0-9]/g, '');
}

// ─── Nomination parsing ────────────────────────────────────────────────────────

interface ParsedNom {
    category: string;
    film: string;
    people: string[];
    win: boolean;
}

/**
 * Parse a single nomination line into { film, people }.
 * Film is always in italics. People are on the non-italic side of the dash.
 */
function parseNomLine(rawLine: string): { film: string; people: string[] } | null {
    const film = extractItalicFilm(rawLine);
    if (!film) return null;

    const clean = stripMarkup(stripWikiLinks(stripRefs(rawLine)))
        .replace(/^[*#]+\s*/, '')
        .replace(/\s+as\s+\S.*$/, '')   // strip "as Character"
        .replace(/\s*\([^)]*\)\s*/g, ' ') // strip (director), (producers) etc.
        .trim();

    // Find the dash separator
    const dashIdx = clean.search(/\s+[–—]\s+/);
    if (dashIdx === -1) return { film, people: [] };

    const before = clean.slice(0, dashIdx).trim();
    const after  = clean.slice(dashIdx).replace(/^[–—\s]+/, '').trim();

    // Whichever segment doesn't contain the film title = people
    const personText = before.toLowerCase().includes(film.toLowerCase()) ? after : before;

    const people = personText
        .split(/\s+and\s+|\s*;\s*|\s*,\s*/i)
        .map(n => n.replace(/^(?:and|or)\s+/i, '').replace(/\s*\([^)]*\)\s*/, '').trim())
        .filter(n => n.length > 1 && n.length < 70 && !/^\d+$/.test(n) && !n.startsWith('(') && !n.startsWith('['));

    return { film, people };
}

/** True if the line is bold (winner marker). */
function isBoldLine(raw: string): boolean {
    const trimmed = raw.trim();
    // * '''...''' format (new style) or '''...''' at start (old style)
    return /^[*]*\s*'''/.test(trimmed);
}

/** True if the line is a double-star nominee (new table format). */
function isDoubleStar(raw: string): boolean {
    return /^\s*\*\*[^*]/.test(raw);
}

/**
 * Parse all nominations from a wikitable cell.
 *   New format: * '''winner''' then ** nominees
 *   Old format: '''winner''' at top then * nominees
 */
function parseCellNoms(cellText: string, catDef: CatDef): Array<{ film: string; people: string[]; win: boolean }> {
    const result: Array<{ film: string; people: string[]; win: boolean }> = [];
    const lines = cellText.split('\n');

    // Detect format: if any ** line exists → new format
    const isNewFormat = lines.some(l => isDoubleStar(l));

    let winnerSet = false;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('{|') || trimmed.startsWith('|}') || trimmed.startsWith('|-')) continue;
        if (trimmed.startsWith('[[File:') || trimmed.startsWith('!')) continue;

        if (isNewFormat) {
            // New format: * '''...''' = winner, ** ... = nominee
            if (/^\s*\*[^*]/.test(line) && isBoldLine(trimmed)) {
                const parsed = parseNomLine(trimmed);
                if (parsed) { result.push({ ...parsed, win: true }); winnerSet = true; }
            } else if (isDoubleStar(line)) {
                const parsed = parseNomLine(trimmed.replace(/^\s*\*\*\s*/, ''));
                if (parsed) result.push({ ...parsed, win: false });
            }
        } else {
            // Old format: '''...''' (no star) = winner, * ... = nominee
            if (!trimmed.startsWith('*') && isBoldLine(trimmed)) {
                const parsed = parseNomLine(trimmed);
                if (parsed) { result.push({ ...parsed, win: true }); winnerSet = true; }
            } else if (trimmed.startsWith('*') && !trimmed.startsWith('**')) {
                const parsed = parseNomLine(trimmed.replace(/^\s*\*\s*/, ''));
                if (parsed) result.push({ ...parsed, win: false });
            }
        }
    }

    // If film-only category, drop people
    if (catDef.type === 'film') {
        return result.map(r => ({ ...r, people: [] }));
    }

    return result;
}

// ─── Wikitable parser ──────────────────────────────────────────────────────────

/**
 * Parse all wikitables in a section of wikitext.
 * Returns flat array of ParsedNom.
 */
function parseWikitables(sectionText: string): ParsedNom[] {
    const noms: ParsedNom[] = [];

    // Extract each table block {| ... |}
    // We do this by tracking brace depth
    const tableRe = /\{\|[\s\S]*?\|\}/g;
    let tableMatch: RegExpExecArray | null;

    while ((tableMatch = tableRe.exec(sectionText)) !== null) {
        const tableText = tableMatch[0];

        // Split by |- (row separator)
        const rowBlocks = tableText.split(/\n\s*\|-[^\n]*\n/);

        let headers: string[] = [];

        for (const block of rowBlocks) {
            // Collect header lines (starting with !)
            const headerLines = block.split('\n').filter(l => /^\s*!/.test(l));
            if (headerLines.length > 0) {
                headers = headerLines.map(l => {
                    // Strip style attrs: ! style="..."| Text  or  ! colspan=2 | Text
                    // [^|\[] avoids eating into [[Link|Display]] wiki links
                    const m = l.match(/^\s*!(?:[^|\[]*\|)?\s*(.*)/);
                    const raw = m ? m[1] : l.replace(/^\s*!/, '');
                    return cleanText(raw.trim());
                });
                continue;
            }

            // Collect data cells
            const cells = splitCells(block);

            for (let i = 0; i < cells.length; i++) {
                // Map column to header (if fewer cells than headers, reuse last)
                const headerIdx = Math.min(i, headers.length - 1);
                const catRaw = headers[headerIdx] ?? '';
                if (!catRaw) continue;

                const catDef = findCat(catRaw);
                if (!catDef) continue;

                const cellNoms = parseCellNoms(cells[i], catDef);
                for (const n of cellNoms) {
                    if (n.film) {
                        noms.push({ category: catDef.canon, film: n.film, people: n.people, win: n.win });
                    }
                }
            }
        }
    }

    return noms;
}

/**
 * Split a wikitable row block into individual cell text strings.
 * Handles both single-line cells (|content) and multi-line cells.
 */
function splitCells(rowBlock: string): string[] {
    const lines = rowBlock.split('\n');
    const cells: string[] = [];
    let current: string[] = [];

    const flushCell = () => {
        const text = current.join('\n').trim();
        if (text) cells.push(text);
        current = [];
    };

    for (const line of lines) {
        // Single | at start (not ||, |-) starts a new cell
        if (/^\s*\|[^|\-}]/.test(line) || /^\s*\|\s*$/.test(line)) {
            flushCell();
            // Strip cell opener (| or | valign="top"| etc.)
            // [^|\[] avoids eating into wiki links like [[Film|Display]]
            const content = line.replace(/^\s*\|(?:[^|\[]*\|)?/, '').trim();
            if (content) current.push(content);
        } else if (/^\s*\|\|/.test(line)) {
            // Inline || separator — split and treat each as a cell
            flushCell();
            const parts = line.replace(/^\s*\|\|/, '').split('||');
            for (let i = 0; i < parts.length - 1; i++) {
                cells.push(parts[i].trim());
            }
            current.push(parts[parts.length - 1].trim());
        } else {
            current.push(line);
        }
    }
    flushCell();
    return cells.filter(c => c.trim());
}

// ─── Main page parser ──────────────────────────────────────────────────────────

/**
 * Find and parse the "Winners and nominees" / "Nominees and winners" section,
 * skipping the Television and Special awards subsections.
 */
function parsePage(wikitext: string): ParsedNom[] {
    const text = stripRefs(wikitext);

    // Find the main winners section (== level)
    const mainSectionRe = /\n==\s*(?:Winners and nominees|Nominees and winners)\s*==\s*\n([\s\S]*?)(?=\n==[^=]|$)/i;
    const mainMatch = mainSectionRe.exec(text);
    if (!mainMatch) return [];

    let sectionContent = mainMatch[1];

    // If there's a ===Film=== subsection, use only that (skip ===Television===)
    const filmSubRe = /\n===\s*Film\s*===\s*\n([\s\S]*?)(?=\n===[^=]|$)/i;
    const filmSub = filmSubRe.exec(sectionContent);
    if (filmSub) {
        sectionContent = filmSub[1];
    }

    // Strip the "Films with multiple nominations" table (not nominations)
    sectionContent = sectionContent.replace(/====\s*Films with multiple[\s\S]*?(?=\n===|$)/gi, '');

    const noms = parseWikitables(sectionContent);

    return dedupNoms(noms);
}

function dedupNoms(noms: ParsedNom[]): ParsedNom[] {
    const seen = new Set<string>();
    return noms.filter(n => {
        const key = `${n.category}|${n.film.toLowerCase()}|${n.people.join(',')}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

// ─── Wikipedia fetch ───────────────────────────────────────────────────────────

function ordinal(n: number): string {
    const s = n % 100;
    if (s >= 11 && s <= 13) return `${n}th`;
    const r = n % 10;
    if (r === 1) return `${n}st`;
    if (r === 2) return `${n}nd`;
    if (r === 3) return `${n}rd`;
    return `${n}th`;
}

async function fetchWikitext(ceremonyNum: number): Promise<string | null> {
    const title = `${ordinal(ceremonyNum)}_Independent_Spirit_Awards`;
    const url = `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&redirects=1&titles=${title}`;
    const resp = await fetch(url, {
        headers: { 'User-Agent': 'Spirit-Awards-intake-bot/1.0 (migration script)' },
    });
    if (!resp.ok) return null;
    const json = await resp.json() as any;
    const pages = json?.query?.pages ?? {};
    const page  = Object.values(pages)[0] as any;
    if (!page || page.missing !== undefined) return null;
    return page?.revisions?.[0]?.slots?.main?.['*'] ?? null;
}

// ─── DB helpers ────────────────────────────────────────────────────────────────

async function getOrCreateOrg(): Promise<number> {
    let res = await pool.query(
        `SELECT organization_id FROM organizations WHERE short_name = 'Spirit'`
    );
    if (res.rows.length > 0) return res.rows[0].organization_id;
    res = await pool.query(
        `INSERT INTO organizations (name, short_name)
         VALUES ('Film Independent Spirit Awards', 'Spirit')
         RETURNING organization_id`
    );
    console.log('  Created organization: Spirit');
    return res.rows[0].organization_id;
}

async function getOrCreateAward(orgId: number): Promise<number> {
    let res = await pool.query(
        `SELECT award_id FROM awards WHERE organization_id = $1`, [orgId]
    );
    if (res.rows.length > 0) return res.rows[0].award_id;
    res = await pool.query(
        `INSERT INTO awards (organization_id, name)
         VALUES ($1, 'Spirit Awards')
         RETURNING award_id`,
        [orgId]
    );
    console.log('  Created award: Spirit Awards');
    return res.rows[0].award_id;
}

const ceremonyCache = new Map<string, number>();
async function getOrCreateCeremony(awardId: number, year: number): Promise<number> {
    const key = `${awardId}_${year}`;
    if (ceremonyCache.has(key)) return ceremonyCache.get(key)!;
    let res = await pool.query(
        `SELECT ceremony_id FROM ceremonies WHERE award_id=$1 AND year=$2`, [awardId, year]
    );
    if (res.rows.length === 0) {
        res = await pool.query(
            `INSERT INTO ceremonies (award_id, year) VALUES ($1, $2)
             ON CONFLICT (award_id, year) DO UPDATE SET year=EXCLUDED.year
             RETURNING ceremony_id`,
            [awardId, year]
        );
    }
    const id = res.rows[0].ceremony_id;
    ceremonyCache.set(key, id);
    return id;
}

const categoryCache = new Map<string, number>();
async function getOrCreateCategory(awardId: number, name: string): Promise<number> {
    const key = `${awardId}_${name}`;
    if (categoryCache.has(key)) return categoryCache.get(key)!;
    let res = await pool.query(
        `SELECT category_id FROM categories WHERE award_id=$1 AND name=$2`, [awardId, name]
    );
    if (res.rows.length === 0) {
        res = await pool.query(
            `INSERT INTO categories (award_id, name) VALUES ($1, $2)
             ON CONFLICT DO NOTHING RETURNING category_id`,
            [awardId, name]
        );
        if (res.rows.length === 0) {
            res = await pool.query(
                `SELECT category_id FROM categories WHERE award_id=$1 AND name=$2`, [awardId, name]
            );
        }
    }
    const id = res.rows[0].category_id;
    categoryCache.set(key, id);
    return id;
}

let filmMap = new Map<string, number>(); // key: norm(title) → film_id (most recent year wins)
let filmMapByYear = new Map<string, number>(); // key: norm(title)_year → film_id

async function loadFilmMap() {
    const { rows } = await pool.query(
        `SELECT film_id, LOWER(title) as title, release_year FROM films`
    );
    for (const f of rows) {
        const norm = normTitle(f.title);
        filmMap.set(norm, f.film_id);
        filmMapByYear.set(`${norm}_${f.release_year}`, f.film_id);
    }
}

async function resolveFilm(title: string, year: number): Promise<number> {
    const norm = normTitle(title);
    // Try exact year match first
    let id = filmMapByYear.get(`${norm}_${year}`) ?? filmMapByYear.get(`${norm}_${year - 1}`);
    // Fall back to any-year match
    if (!id) id = filmMap.get(norm);
    if (!id) {
        const res = await pool.query(
            `INSERT INTO films (title, release_year) VALUES ($1, $2) RETURNING film_id`,
            [title, year]
        );
        id = res.rows[0].film_id;
        filmMap.set(norm, id);
        filmMapByYear.set(`${norm}_${year}`, id);
    }
    return id;
}

let peopleMap = new Map<string, number>(); // key: lower(name)

async function loadPeopleMap() {
    const { rows } = await pool.query(`SELECT person_id, LOWER(name) as name FROM people`);
    for (const p of rows) {
        if (!peopleMap.has(p.name)) peopleMap.set(p.name, p.person_id);
    }
}

async function resolvePerson(name: string): Promise<number> {
    const lower = name.trim().toLowerCase();
    let id = peopleMap.get(lower);
    if (!id) {
        const res = await pool.query(
            `INSERT INTO people (name) VALUES ($1) ON CONFLICT DO NOTHING RETURNING person_id`,
            [name.trim()]
        );
        if (res.rows.length > 0) {
            id = res.rows[0].person_id;
        } else {
            const r2 = await pool.query(`SELECT person_id FROM people WHERE LOWER(name)=$1`, [lower]);
            id = r2.rows[0]?.person_id;
        }
        if (id) peopleMap.set(lower, id);
    }
    return id!;
}

// ─── Per-ceremony import ───────────────────────────────────────────────────────

async function importCeremony(
    awardId: number,
    ceremonyNum: number,
    wikitext: string
): Promise<{ inserted: number; existed: number }> {
    const year = filmYear(ceremonyNum);
    const ceremonyId = await getOrCreateCeremony(awardId, year);
    const noms = parsePage(wikitext);

    let inserted = 0;
    let existed  = 0;

    for (const nom of noms) {
        const categoryId = await getOrCreateCategory(awardId, nom.category);
        const filmId     = await resolveFilm(nom.film, year);

        // Check for existing nomination
        const existing = await pool.query(
            `SELECT nomination_id FROM nominations
             WHERE ceremony_id=$1 AND category_id=$2 AND film_id=$3`,
            [ceremonyId, categoryId, filmId]
        );
        if (existing.rows.length > 0) {
            existed++;
            continue;
        }

        const nomRes = await pool.query(
            `INSERT INTO nominations (ceremony_id, category_id, film_id, win)
             VALUES ($1, $2, $3, $4) RETURNING nomination_id`,
            [ceremonyId, categoryId, filmId, nom.win]
        );
        const nominationId = nomRes.rows[0].nomination_id;
        inserted++;

        for (const personName of nom.people) {
            try {
                const personId = await resolvePerson(personName);
                if (personId) {
                    await pool.query(
                        `INSERT INTO nomination_people (nomination_id, person_id)
                         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                        [nominationId, personId]
                    );
                }
            } catch { /* skip */ }
        }
    }

    return { inserted, existed };
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    console.log('Setting up Spirit org + award...');
    const orgId   = await getOrCreateOrg();
    const awardId = await getOrCreateAward(orgId);
    console.log(`  org_id=${orgId}  award_id=${awardId}`);

    console.log('Loading film + people maps...');
    await loadFilmMap();
    await loadPeopleMap();
    console.log(`  ${filmMap.size} films, ${peopleMap.size} people in DB`);

    let totalInserted = 0;
    let totalExisted  = 0;
    let pagesMissing  = 0;
    let pagesFound    = 0;

    for (let n = FIRST_CEREMONY; n <= LAST_CEREMONY; n++) {
        const year = filmYear(n);
        process.stdout.write(`  [${ordinal(n)}] (${year} films) ... `);

        const wikitext = await fetchWikitext(n);
        if (!wikitext) {
            console.log('MISSING');
            pagesMissing++;
            await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
            continue;
        }
        pagesFound++;

        const { inserted, existed } = await importCeremony(awardId, n, wikitext);
        console.log(`inserted=${inserted}  existed=${existed}`);
        totalInserted += inserted;
        totalExisted  += existed;

        await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
    }

    console.log('\n✓ Done.');
    console.log(`  Pages found   : ${pagesFound}`);
    console.log(`  Pages missing : ${pagesMissing}`);
    console.log(`  Noms inserted : ${totalInserted}`);
    console.log(`  Noms existed  : ${totalExisted}`);

    // Category summary
    const { rows: cats } = await pool.query(
        `SELECT c.name, COUNT(n.nomination_id)::int as cnt
         FROM categories c
         JOIN nominations n USING (category_id)
         WHERE c.award_id = $1
         GROUP BY c.name ORDER BY cnt DESC`,
        [awardId]
    );
    console.log('\n  Category breakdown:');
    for (const r of cats) console.log(`    ${r.name}: ${r.cnt}`);

    await pool.end();
}

main().catch(async e => {
    console.error('Fatal:', e);
    await pool.end();
    process.exit(1);
});
