/**
 * migrateNBRAllYears.ts
 *
 * Fetches all available NBR award pages from Wikipedia (1945–2024)
 * and inserts ceremonies, categories, films, people, and nominations.
 *
 * Assumes the NBR org + award already exist (created by migrateNBR.ts).
 * Safe to re-run: all inserts check for existing rows first.
 *
 * After running: re-run migrateCanonicalCategories.ts + migrateCategoryMappings.ts
 * to wire up new categories into the canonical mapping chain.
 */

import { Pool, PoolClient } from 'pg';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
});

const FIRST_YEAR = 1945;
const LAST_YEAR  = 2024;   // 2025 already imported by migrateNBR.ts
const REQUEST_DELAY_MS = 300; // be polite to Wikipedia

// ─── Category name → canonical NBR category ──────────────────────────────────
// Maps every Wikipedia section/label variant we encounter to the canonical
// DB category name. Entries not in this map are silently skipped.
const CATEGORY_MAP: Record<string, string> = {
    // Best Film
    'Best Film':                     'Best Film',
    'Best Picture':                  'Best Film',
    'Best English Language Film':    'Best Film',
    'Best American Film':            'Best Film',

    // Director
    'Best Director':                 'Best Director',
    'Best Directorial Debut':        'Best Directorial Debut',
    'Spotlight Award for Best Directorial Debut': 'Best Directorial Debut',
    'Best First Feature Film':       'Best Directorial Debut',
    'Best First Film':               'Best Directorial Debut',

    // Acting
    'Best Actor':                                    'Best Actor',
    'Best Actor in a Leading Role':                  'Best Actor',
    'Best Male Performance':                         'Best Actor',
    'Best Actress':                                  'Best Actress',
    'Best Actress in a Leading Role':                'Best Actress',
    'Best Female Performance':                       'Best Actress',
    'Best Supporting Actor':                         'Best Supporting Actor',
    'Best Supporting Male Performance':              'Best Supporting Actor',
    'Best Supporting Actress':                       'Best Supporting Actress',
    'Best Supporting Female Performance':            'Best Supporting Actress',

    // Screenplay (only split versions — undivided "Best Screenplay" is skipped)
    'Best Original Screenplay':      'Best Original Screenplay',
    'Best Adapted Screenplay':       'Best Adapted Screenplay',

    // Film categories
    'Best Animated Feature':         'Best Animated Feature',
    'Best Animated Feature Film':    'Best Animated Feature',

    // International
    'Best International Film':       'Best International Film',
    'Best Foreign Language Film':    'Best International Film',
    'Best Foreign Film':             'Best International Film',
    'Best Foreign Language Picture': 'Best International Film',

    // Documentary
    'Best Documentary':              'Best Documentary',
    'Best Documentary Feature':      'Best Documentary',

    // Screenplay (split variants used 2006-2011 on Wikipedia)
    'Best Screenplay – Original':   'Best Original Screenplay',
    'Best Screenplay – Adapted':    'Best Adapted Screenplay',

    // Breakthrough (map all gender-split variants to one category)
    'Breakthrough Performance':                      'Breakthrough Performance',
    'Best Breakthrough Performance':                 'Breakthrough Performance',
    'Breakthrough Performance – Male':               'Breakthrough Performance',
    'Breakthrough Performance – Female':             'Breakthrough Performance',
    'Breakthrough Performance – Male Actor':         'Breakthrough Performance',
    'Breakthrough Performance – Female Actor':       'Breakthrough Performance',
    'Breakthrough Male Performance':                 'Breakthrough Performance',
    'Breakthrough Female Performance':               'Breakthrough Performance',
    'Breakthrough Male Performances':                'Breakthrough Performance',
    'Breakthrough Female Performances':              'Breakthrough Performance',
    'Best Breakthrough Performance – Male':          'Breakthrough Performance',
    'Best Breakthrough Performance – Female':        'Breakthrough Performance',

    // Freedom of Expression (multiple films per year — each becomes its own nomination)
    'NBR Freedom of Expression Award':  'NBR Freedom of Expression Award',
    'Freedom of Expression Award':      'NBR Freedom of Expression Award',
    'NBR Freedom of Expression':        'NBR Freedom of Expression Award',
    'Freedom of Expression':            'NBR Freedom of Expression Award',

    // Craft awards (recent)
    'Outstanding Achievement in Cinematography': 'Outstanding Achievement in Cinematography',
    'Outstanding Achievement in Stunt Artistry': 'Outstanding Achievement in Stunt Artistry',
};

// Maps Top-N list section headings to the canonical category they populate as nominees
const LIST_SECTION_MAP: Record<string, string> = {
    'Top Ten Films':                     'Best Film',
    'Top 10 Films':                      'Best Film',
    'Top Ten English Language Films':    'Best Film',
    'Top Ten American Films':            'Best Film',
    'Top Five Foreign Films':            'Best International Film',
    'Top 5 Foreign Films':               'Best International Film',
    'Top Five Foreign Language Films':   'Best International Film',
    'Top 5 Foreign Language Films':      'Best International Film',
    'Top Five International Films':      'Best International Film',
    'Top 5 International Films':         'Best International Film',
    'Top Five Documentaries':            'Best Documentary',
    'Top 5 Documentaries':              'Best Documentary',
    'Top 6 Documentaries':              'Best Documentary',
    'Top Ten Independent Films':         'Top 10 Independent Films',
    'Top 10 Independent Films':          'Top 10 Independent Films',
    'Top Five Independent Films':        'Top 10 Independent Films',
    'Top Independent Films':             'Top 10 Independent Films',
};

// ─── Map lookup helpers ───────────────────────────────────────────────────────

/** Case-insensitive lookup in a string-keyed map. */
function findInMap<T>(map: Record<string, T>, key: string): T | undefined {
    if (key in map) return map[key];
    const lower = key.toLowerCase();
    if (lower in map) return map[lower];
    for (const [k, v] of Object.entries(map)) {
        if (k.toLowerCase() === lower) return v;
    }
    return undefined;
}

/** Strip trailing tie/co-winner qualifiers before category lookup. */
function normCatName(s: string): string {
    return s.replace(/\s*\((?:tie|co-winner|co-winners)\)\s*$/i, '').trim();
}

// ─── Wikitext helpers ─────────────────────────────────────────────────────────

/** Remove <ref>...</ref> tags (including multiline) */
function stripRefs(s: string): string {
    // Self-closing tags must be removed BEFORE paired tags, otherwise
    // <ref name="foo"/> is misread as an opening tag and everything up
    // to the next </ref> is deleted (wiping out whole sections).
    return s
        .replace(/<ref\b[^>]*\/>/gi, '')
        .replace(/<references\b[^>]*\/>/gi, '')
        .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, '')
        .replace(/<references\b[^>]*>[\s\S]*?<\/references>/gi, '');
}

/** Convert [[Target|Display]] → Display, [[Target]] → Target (strip parens disambiguation) */
function stripWikiLinks(s: string): string {
    return s
        .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_, _t, display) => display)
        .replace(/\[\[([^\]]+)\]\]/g, (_, target) => target.replace(/\s*\([^)]+\)\s*$/, '').trim());
}

/** Strip remaining wiki markup: bold, italic, templates, HTML tags */
function stripMarkup(s: string): string {
    return s
        .replace(/'{2,3}/g, '')              // bold/italic markers
        .replace(/\{\{[^}]*\}\}/g, '')       // inline templates
        .replace(/<[^>]+>/g, '')             // HTML tags
        .replace(/&ndash;/g, '–')
        .replace(/&mdash;/g, '—')
        .replace(/&amp;/g, '&')
        .replace(/&nbsp;/g, ' ')
        .trim();
}

function cleanText(s: string): string {
    return stripMarkup(stripWikiLinks(stripRefs(s))).trim();
}

/** Normalise a title for fuzzy DB matching (lowercase, strip leading "the"/"a"/"an", etc.) */
function normTitle(t: string): string {
    return t.toLowerCase()
            .replace(/^(the|a|an)\s+/i, '')
            .replace(/[^a-z0-9]/g, '')
            .trim();
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface ParsedNom {
    category: string;   // canonical category name
    film: string;       // cleaned film title
    people: string[];   // cleaned person names (may be empty)
    win: boolean;
}

// ─── Wikipedia fetch ──────────────────────────────────────────────────────────

async function fetchWikitext(year: number): Promise<string | null> {
    const title = `National_Board_of_Review_Awards_${year}`;
    const url = `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&redirects=1&titles=${title}`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'NBR-intake-bot/1.0 (migration script)' } });
    if (!resp.ok) return null;
    const json = await resp.json() as any;
    const pages = json?.query?.pages ?? {};
    const page  = Object.values(pages)[0] as any;
    if (!page || page.missing !== undefined) return null;
    return page?.revisions?.[0]?.slots?.main?.['*'] ?? null;
}

// ─── Wikitext parser ──────────────────────────────────────────────────────────

/**
 * Parse a single winner/nominee line from a wikitext award section.
 * Returns { film, people[] } or null if unparseable.
 *
 * Handles patterns like:
 *   [[Person]] – [[Film]]
 *   [[Person]] and [[Person]] – [[Film]]
 *   [[Film]]
 *   Person – ''Film''
 */
function parseLine(raw: string): { film: string; people: string[] } | null {
    const t = cleanText(raw).replace(/^[*#:;]+\s*/, '').trim();
    if (!t || t.startsWith('{{') || t.startsWith('==')) return null;

    // Split on em-dash, en-dash, or " - " to separate people from film
    const sepMatch = t.match(/^(.+?)\s+[–—-]\s+(.+)$/);
    if (sepMatch) {
        const leftRaw  = sepMatch[1].trim();
        const rightRaw = sepMatch[2].trim();
        const people = leftRaw
            .split(/\s+and\s+|\s*&\s*/i)
            .map(n => n.trim())
            .filter(n => n.length > 0 && n.length < 60);
        return { film: rightRaw, people };
    }

    // Parens format used by older pages: "Person (Film Title)"
    // Match if the parens content is long enough to be a film title (not a year / disambig note)
    const parenMatch = t.match(/^([^(]+?)\s+\(([^)]{5,})\)$/);
    if (parenMatch) {
        const leftRaw  = parenMatch[1].trim();
        const innerRaw = parenMatch[2].trim();
        if (!/^\d{4}$/.test(innerRaw)) {
            const people = leftRaw.split(/\s+and\s+|\s*&\s*/i).map(n => n.trim()).filter(n => n.length > 0);
            return { film: innerRaw, people };
        }
    }

    // No separator → assume it's a film title only
    return { film: t, people: [] };
}

/**
 * Main parser. Splits wikitext into sections and extracts nominations.
 * Returns an array of ParsedNom.
 */
function parseWikitext(wikitext: string, year: number): ParsedNom[] {
    const noms: ParsedNom[] = [];
    const text = stripRefs(wikitext);

    // ── Infobox winner extraction ──────────────────────────────────────────
    // The infobox has pairs like:
    //   | award1_type   = Best Film
    //   | award1_winner = ''[[Wicked (2024 film)|Wicked]]''
    const infoboxMatch = text.match(/\{\{Infobox award([\s\S]*?)\}\}/i);
    if (infoboxMatch) {
        const infobox = infoboxMatch[1];
        const typeWinnerPairs = infobox.match(/\|\s*award\d+_type\s*=([^\n|]+)[\s\S]*?\|\s*award\d+_winner\s*=([^\n|]+)/g);
        // This regex is imperfect; skip infobox and rely on section parsing instead
        void typeWinnerPairs;
    }

    // ── Section-based parsing ──────────────────────────────────────────────
    // Split into (header, content) pairs
    // Matches == or === level headers
    const sectionRe = /\n(={2,3})([^=\n]+)\1\s*\n([\s\S]*?)(?=\n={2,3}[^=]|$)/g;
    let m: RegExpExecArray | null;

    while ((m = sectionRe.exec(text)) !== null) {
        const headerRaw   = m[2].trim();
        const headerClean = cleanText(headerRaw);
        const content     = m[3];

        const lines = content.split('\n').filter(l => l.trim().length > 0);

        // ── Winners section ────────────────────────────────────────────────
        // Three Wikipedia formats observed:
        //   Format 1 (1945–1976): *Category: Person (Film)  or  *Category: Film
        //   Format 2 (1977–2005): *Category:\n**Person – Film
        //   Format 3 (2006–2011): '''Category:'''\n*Person – Film  or  *Film
        if (/^winners?$/i.test(headerClean)) {
            let currentCat: string | null = null;
            for (const line of lines) {
                const lTrim = line.trim();
                if (lTrim.startsWith('==')) break;

                // Format 3: '''Bold Category:''' header line (not a bullet)
                if (/'''/.test(lTrim) && !lTrim.startsWith('*')) {
                    const boldContent = cleanText(lTrim);
                    const colonIdx = boldContent.indexOf(':');
                    if (colonIdx === -1) { currentCat = null; continue; }
                    currentCat = findInMap(CATEGORY_MAP, normCatName(boldContent.slice(0, colonIdx).trim())) ?? null;
                    const valRaw = boldContent.slice(colonIdx + 1).trim();
                    if (currentCat && valRaw) {
                        const parsed = parseLine(valRaw);
                        if (parsed?.film) noms.push({ category: currentCat, film: parsed.film, people: parsed.people, win: true });
                    }
                    continue;
                }

                // Format 2: **value nested bullet under a *Category: line
                if (lTrim.startsWith('**') && currentCat) {
                    const parsed = parseLine(lTrim.slice(2).trim());
                    if (parsed?.film) noms.push({ category: currentCat, film: parsed.film, people: parsed.people, win: true });
                    continue;
                }

                // Single-star line — could be:
                //   (a) *Category: [value]  (Format 1 / Format 2 category header)
                //   (b) *value              (Format 3 bullet under a bold header)
                if (lTrim.startsWith('*') && !lTrim.startsWith('**')) {
                    const inner = cleanText(lTrim.slice(1)).trim();
                    const colonIdx = inner.indexOf(':');

                    // Detect (a): colon appears early AND text before it maps to a category
                    if (colonIdx !== -1 && colonIdx < 40) {
                        const catRaw = inner.slice(0, colonIdx).trim();
                        const mapped = findInMap(CATEGORY_MAP, normCatName(catRaw));
                        if (mapped !== undefined) {
                            currentCat = mapped;
                            const valRaw = inner.slice(colonIdx + 1).trim();
                            if (currentCat && valRaw) {
                                const parsed = parseLine(valRaw);
                                if (parsed?.film) noms.push({ category: currentCat, film: parsed.film, people: parsed.people, win: true });
                            }
                            continue;
                        }
                    }

                    // Treat as (b): value under currentCat
                    if (currentCat) {
                        const parsed = parseLine(inner);
                        if (parsed?.film) noms.push({ category: currentCat, film: parsed.film, people: parsed.people, win: true });
                    }
                }
            }
            continue;
        }

        // ── List sections (Top 10 Films, Top 5 Foreign, etc.) ────────────
        const listCat = findInMap(LIST_SECTION_MAP, headerClean);
        if (listCat !== undefined) {
            for (const line of lines) {
                const clean = cleanText(line.replace(/^[*#:;\s\d.]+/, '').trim());
                if (!clean || clean.startsWith('==')) continue;
                // Skip lines that look like prose
                if (clean.split(' ').length > 8 && !clean.includes('–')) continue;
                noms.push({ category: listCat, film: clean, people: [], win: false });
            }
            continue;
        }

        // ── Named award sections (2006+ era) ─────────────────────────────
        const canonCat = findInMap(CATEGORY_MAP, headerClean);
        if (!canonCat) continue;

        let winnerAssigned = false;
        for (const line of lines) {
            const lTrim = line.trim();
            if (lTrim.startsWith('==')) break;

            const isBold   = /'''/.test(lTrim);
            const isBullet = /^[*#]/.test(lTrim);
            const parsed   = parseLine(lTrim);
            if (!parsed || !parsed.film) continue;

            const isWinner = isBold || (!winnerAssigned && lines.filter(l => /^[*#]/.test(l.trim())).length <= 1);

            if (isWinner && !winnerAssigned) {
                noms.push({ category: canonCat, film: parsed.film, people: parsed.people, win: true });
                winnerAssigned = true;
            } else if (isBullet || !isWinner) {
                const isWin = canonCat === 'NBR Freedom of Expression Award';
                noms.push({ category: canonCat, film: parsed.film, people: parsed.people, win: isWin });
            }
        }
    }

    // ── Flat-format fallback (very old pages with no == headers at all) ──
    if (noms.length < 3) {
        const boldRe = /'''([^']+)'''\s*\n([^\n]+)/g;
        let bm: RegExpExecArray | null;
        while ((bm = boldRe.exec(text)) !== null) {
            const catRaw  = cleanText(bm[1]);
            const valRaw  = cleanText(bm[2]);
            const canonCat = findInMap(CATEGORY_MAP, catRaw);
            if (!canonCat || !valRaw) continue;
            const parsed = parseLine(valRaw);
            if (parsed?.film) {
                noms.push({ category: canonCat, film: parsed.film, people: parsed.people, win: true });
            }
        }
    }

    return dedupNoms(noms, year);
}

/** Remove exact duplicates (same category + film + people combo). */
function dedupNoms(noms: ParsedNom[], _year: number): ParsedNom[] {
    const seen = new Set<string>();
    return noms.filter(n => {
        const key = `${n.category}|${n.film.toLowerCase()}|${n.people.join(',')}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

// Module-level caches to avoid repeated queries
const filmCache  = new Map<string, number>();   // normTitle → film_id
const personCache = new Map<string, number>();  // lower name → person_id
let catCache     = new Map<string, number>();   // `${awardId}|${name}` → category_id
let ceremonyCache = new Map<string, number>();  // `${awardId}|${year}` → ceremony_id

async function loadCaches(client: PoolClient, awardId: number): Promise<void> {
    const [films, people, cats, cers] = await Promise.all([
        pool.query('SELECT film_id, title, release_year FROM films'),
        pool.query('SELECT person_id, LOWER(name) AS name FROM people'),
        pool.query('SELECT category_id, name FROM categories WHERE award_id = $1', [awardId]),
        pool.query('SELECT ceremony_id, year FROM ceremonies WHERE award_id = $1', [awardId]),
    ]);
    for (const r of films.rows) {
        filmCache.set(normTitle(r.title), r.film_id);
        // Also key by "normTitle|year" for precision
        filmCache.set(`${normTitle(r.title)}|${r.release_year}`, r.film_id);
    }
    for (const r of people.rows) personCache.set(r.name, r.person_id);
    for (const r of cats.rows) catCache.set(`${awardId}|${r.name}`, r.category_id);
    for (const r of cers.rows) ceremonyCache.set(`${awardId}|${r.year}`, r.ceremony_id);
    void client;
}

async function getOrCreateFilm(client: PoolClient, title: string, year: number): Promise<number> {
    // Try exact title + year first
    const byYear = filmCache.get(`${normTitle(title)}|${year}`);
    if (byYear) return byYear;
    // Try title only
    const byTitle = filmCache.get(normTitle(title));
    if (byTitle) return byTitle;

    // Insert new film
    const res = await client.query(
        `INSERT INTO films (title, release_year) VALUES ($1, $2) RETURNING film_id`,
        [title, year]
    );
    const id = res.rows[0].film_id;
    filmCache.set(normTitle(title), id);
    filmCache.set(`${normTitle(title)}|${year}`, id);
    return id;
}

async function getOrCreatePerson(client: PoolClient, name: string): Promise<number> {
    const key = name.toLowerCase();
    const cached = personCache.get(key);
    if (cached) return cached;

    // Try DB (might have been inserted mid-run)
    const res = await client.query(`SELECT person_id FROM people WHERE LOWER(name) = $1 LIMIT 1`, [key]);
    if (res.rows.length > 0) {
        personCache.set(key, res.rows[0].person_id);
        return res.rows[0].person_id;
    }

    // Insert new person
    const ins = await client.query(`INSERT INTO people (name) VALUES ($1) RETURNING person_id`, [name]);
    const id = ins.rows[0].person_id;
    personCache.set(key, id);
    return id;
}

async function getOrCreateCategory(client: PoolClient, awardId: number, name: string): Promise<number> {
    const key = `${awardId}|${name}`;
    const cached = catCache.get(key);
    if (cached) return cached;

    const res = await client.query(`SELECT category_id FROM categories WHERE award_id = $1 AND name = $2`, [awardId, name]);
    if (res.rows.length > 0) {
        catCache.set(key, res.rows[0].category_id);
        return res.rows[0].category_id;
    }

    const ins = await client.query(`INSERT INTO categories (award_id, name) VALUES ($1, $2) RETURNING category_id`, [awardId, name]);
    const id = ins.rows[0].category_id;
    catCache.set(key, id);
    return id;
}

async function getOrCreateCeremony(client: PoolClient, awardId: number, year: number): Promise<number> {
    const key = `${awardId}|${year}`;
    const cached = ceremonyCache.get(key);
    if (cached) return cached;

    const res = await client.query(`SELECT ceremony_id FROM ceremonies WHERE award_id = $1 AND year = $2`, [awardId, year]);
    if (res.rows.length > 0) {
        ceremonyCache.set(key, res.rows[0].ceremony_id);
        return res.rows[0].ceremony_id;
    }

    const ins = await client.query(
        `INSERT INTO ceremonies (award_id, year) VALUES ($1, $2) ON CONFLICT (award_id, year) DO NOTHING RETURNING ceremony_id`,
        [awardId, year]
    );
    const id = ins.rows.length > 0 ? ins.rows[0].ceremony_id
        : (await client.query(`SELECT ceremony_id FROM ceremonies WHERE award_id = $1 AND year = $2`, [awardId, year])).rows[0].ceremony_id;
    ceremonyCache.set(key, id);
    return id;
}

async function insertNomination(
    client: PoolClient,
    ceremonyId: number, categoryId: number, filmId: number,
    win: boolean, people: Array<{ id: number; name: string }>,
): Promise<'inserted' | 'exists'> {
    const existing = await client.query(
        `SELECT nomination_id FROM nominations WHERE ceremony_id=$1 AND category_id=$2 AND film_id=$3`,
        [ceremonyId, categoryId, filmId]
    );
    let nomId: number;
    if (existing.rows.length > 0) {
        nomId = existing.rows[0].nomination_id;
        await client.query(`UPDATE nominations SET win=$1 WHERE nomination_id=$2`, [win, nomId]);
        return 'exists';
    }

    const res = await client.query(
        `INSERT INTO nominations (ceremony_id, category_id, film_id, win) VALUES ($1,$2,$3,$4) RETURNING nomination_id`,
        [ceremonyId, categoryId, filmId, win]
    );
    nomId = res.rows[0].nomination_id;

    for (let i = 0; i < people.length; i++) {
        await client.query(
            `INSERT INTO nomination_people (nomination_id, person_id, credit_order) VALUES ($1,$2,$3)
             ON CONFLICT (nomination_id, person_id, role_id) DO NOTHING`,
            [nomId, people[i].id, i + 1]
        );
    }
    return 'inserted';
}

// ─── Main ──────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    const client = await pool.connect();

    try {
        // Resolve NBR org + award (must already exist from migrateNBR.ts)
        const orgRes = await client.query(`SELECT organization_id FROM organizations WHERE short_name = 'NBR'`);
        if (orgRes.rows.length === 0) {
            throw new Error('NBR organization not found — run migrateNBR.ts first');
        }
        const orgId = orgRes.rows[0].organization_id;

        const awardRes = await client.query(`SELECT award_id FROM awards WHERE organization_id = $1`, [orgId]);
        if (awardRes.rows.length === 0) {
            throw new Error('NBR award not found — run migrateNBR.ts first');
        }
        const awardId = awardRes.rows[0].award_id;

        console.log(`NBR org_id=${orgId}  award_id=${awardId}`);
        console.log('Loading caches...');
        await loadCaches(client, awardId);
        console.log(`  films=${filmCache.size}  people=${personCache.size}  cats=${catCache.size}  ceremonies=${ceremonyCache.size}`);

        // ── Per-year loop ──────────────────────────────────────────────────
        let totalInserted = 0;
        let totalSkipped  = 0;
        let pagesFound    = 0;
        let pagesMissing  = 0;
        const warnings: string[] = [];

        for (let year = LAST_YEAR; year >= FIRST_YEAR; year--) {
            await sleep(REQUEST_DELAY_MS);

            // Fetch wikitext
            const wikitext = await fetchWikitext(year);
            if (!wikitext) {
                pagesMissing++;
                continue;
            }
            pagesFound++;

            // Parse into structured nominations
            const parsed = parseWikitext(wikitext, year);

            if (parsed.length === 0) {
                warnings.push(`${year}: parsed 0 nominations — page may have unexpected format`);
                continue;
            }

            // Get or create ceremony
            const ceremonyId = await getOrCreateCeremony(client, awardId, year);

            // Winner flags: mark the first win=true entry per category as winner
            // (dedup already handles exact duplicates; here we just proceed)

            let yearInserted = 0;
            let yearSkipped  = 0;

            for (const nom of parsed) {
                // Resolve film
                let filmId: number;
                try {
                    filmId = await getOrCreateFilm(client, nom.film, year);
                } catch (e: any) {
                    warnings.push(`${year} [${nom.category}]: film insert failed for "${nom.film}": ${e.message}`);
                    continue;
                }

                // Resolve category
                const categoryId = await getOrCreateCategory(client, awardId, nom.category);

                // Resolve people
                const people: Array<{ id: number; name: string }> = [];
                for (const pName of nom.people) {
                    if (!pName || pName.length < 2 || pName.length > 80) continue;
                    try {
                        const pid = await getOrCreatePerson(client, pName);
                        people.push({ id: pid, name: pName });
                    } catch (e: any) {
                        warnings.push(`${year}: person insert failed for "${pName}": ${e.message}`);
                    }
                }

                // Insert nomination
                const result = await insertNomination(client, ceremonyId, categoryId, filmId, nom.win, people);
                if (result === 'inserted') yearInserted++;
                else yearSkipped++;
            }

            console.log(`${year}: +${yearInserted} noms  (${yearSkipped} existed)  [${parsed.length} parsed]`);
            totalInserted += yearInserted;
            totalSkipped  += yearSkipped;
        }

        // ── Summary ────────────────────────────────────────────────────────
        console.log('\n─── Summary ───────────────────────────────────────');
        console.log(`Pages found   : ${pagesFound}`);
        console.log(`Pages missing : ${pagesMissing}`);
        console.log(`Noms inserted : ${totalInserted}`);
        console.log(`Noms existed  : ${totalSkipped}`);
        if (warnings.length > 0) {
            console.log(`\nWarnings (${warnings.length}):`);
            for (const w of warnings) console.log(' ', w);
        }
        console.log('\nNext steps:');
        console.log('  npx tsx scripts/migrateCanonicalCategories.ts');
        console.log('  npx tsx scripts/migrateCategoryMappings.ts');

    } finally {
        client.release();
        await pool.end();
    }
}

main().catch(async e => {
    console.error('Fatal:', e.message);
    await pool.end();
    process.exit(1);
});
