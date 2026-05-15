/**
 * importOscarsAllYears.ts
 *
 * Fetches all Academy Awards pages from Wikipedia (1st–77th ceremonies, films 1928–2004)
 * and inserts ceremonies, categories, films, people, and nominations into the DB.
 *
 * Film year convention: film_year = ceremony_number + 1927
 *   77th → 2004, 2nd → 1929, 1st → 1928
 *
 * Wikipedia format: ceremonies 5–77 use {{Award category|…|[[Link|Display]]}} templates
 * inside a wikitable; ceremonies 1–4 use a flat section-header format.
 *
 * Safe to re-run: existing nominations are skipped, new ones inserted.
 *
 * After running, re-run:
 *   npx tsx scripts/migrateCanonicalCategories.ts
 *   npx tsx scripts/migrateCategoryMappings.ts
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

const LAST_CEREMONY  = 77;  // 77th = films of 2004
const FIRST_CEREMONY = 1;   // 1st  = films of 1928
const REQUEST_DELAY_MS = 800;  // be polite – Wikipedia rate-limits quickly

// film_year = ceremony_number + 1927  (77 → 2004, 1 → 1928)
function ceremonyToFilmYear(n: number): number {
    return n + 1927;
}

function ordinalSuffix(n: number): string {
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) return 'th';
    const mod10 = n % 10;
    if (mod10 === 1) return 'st';
    if (mod10 === 2) return 'nd';
    if (mod10 === 3) return 'rd';
    return 'th';
}
function ordinal(n: number): string { return `${n}${ordinalSuffix(n)}`; }
function wikiTitle(n: number): string { return `${ordinal(n)}_Academy_Awards`; }

// ─── Category name map ────────────────────────────────────────────────────────
// Maps the {{Award category}} display text (or == section header ==) seen on
// Wikipedia Oscar pages → canonical DB category name.
const CATEGORY_MAP: Record<string, string> = {

    // ── Best Picture ─────────────────────────────────────────────────────────
    'Best Picture':                  'Best Picture',
    'Best Motion Picture':           'Best Picture',
    'Outstanding Picture':           'Best Picture',
    'Outstanding Motion Picture':    'Best Picture',
    'Outstanding Production':        'Best Picture',
    'Outstanding Film':              'Best Picture',

    // ── Directing ────────────────────────────────────────────────────────────
    'Best Directing':  'Directing',
    'Best Director':   'Directing',
    'Directing':       'Directing',
    'Direction':       'Directing',
    'Best Direction':  'Directing',

    // ── Acting ───────────────────────────────────────────────────────────────
    'Best Actor in a Leading Role':      'Actor in a Leading Role',
    'Actor in a Leading Role':           'Actor in a Leading Role',
    'Best Actor':                        'Actor in a Leading Role',
    'Best Actress in a Leading Role':    'Actress in a Leading Role',
    'Actress in a Leading Role':         'Actress in a Leading Role',
    'Best Actress':                      'Actress in a Leading Role',
    'Best Actor in a Supporting Role':   'Actor in a Supporting Role',
    'Actor in a Supporting Role':        'Actor in a Supporting Role',
    'Best Supporting Actor':             'Actor in a Supporting Role',
    'Best Actress in a Supporting Role': 'Actress in a Supporting Role',
    'Actress in a Supporting Role':      'Actress in a Supporting Role',
    'Best Supporting Actress':           'Actress in a Supporting Role',

    // ── Writing – Original ───────────────────────────────────────────────────
    'Best Writing (Original Screenplay)':    'Writing (Original Screenplay)',
    'Writing (Original Screenplay)':         'Writing (Original Screenplay)',
    'Best Original Screenplay':              'Writing (Original Screenplay)',
    'Original Screenplay':                   'Writing (Original Screenplay)',
    'Best Writing (Screenplay Written Directly for the Screen)': 'Writing (Original Screenplay)',
    'Best Writing (Screenplay Written Directly for the Screen -- Based on Factual Material or on Story Material Not Previously Published or Produced)': 'Writing (Original Screenplay)',
    'Writing (Story and Screenplay Written Directly for the Screen)': 'Writing (Original Screenplay)',
    'Writing (Story and Screenplay – Written Directly for the Screen)': 'Writing (Original Screenplay)',
    'Writing (Screenplay Written Directly for the Screen)': 'Writing (Original Screenplay)',
    'Writing (Story and Screenplay Based on Material Not Previously Produced or Published)': 'Writing (Original Screenplay)',
    'Writing (Story and Screenplay Based on Material Not Previously Published or Produced)': 'Writing (Original Screenplay)',
    'Writing (Motion Picture Story)':        'Writing (Original Screenplay)',
    'Writing (Original Motion Picture Story)': 'Writing (Original Screenplay)',
    'Writing (Original Story)':              'Writing (Original Screenplay)',
    'Best Motion Picture Story':             'Writing (Original Screenplay)',
    'Best Original Story':                   'Writing (Original Screenplay)',
    'Best Story':                            'Writing (Original Screenplay)',
    'Original Story':                        'Writing (Original Screenplay)',

    // ── Writing – Adapted ────────────────────────────────────────────────────
    'Best Writing (Adapted Screenplay)':     'Writing (Adapted Screenplay)',
    'Writing (Adapted Screenplay)':          'Writing (Adapted Screenplay)',
    'Best Adapted Screenplay':               'Writing (Adapted Screenplay)',
    'Adapted Screenplay':                    'Writing (Adapted Screenplay)',
    'Best Writing (Screenplay Based on Material Previously Produced or Published)': 'Writing (Adapted Screenplay)',
    'Best Writing (Screenplay Based on Material from Another Medium)': 'Writing (Adapted Screenplay)',
    'Writing (Screenplay Based on Material from Another Medium)': 'Writing (Adapted Screenplay)',
    'Writing (Screenplay Adapted from Other Material)': 'Writing (Adapted Screenplay)',
    'Writing (Screenplay—Adaptation)':       'Writing (Adapted Screenplay)',
    'Writing (Screenplay – Adaptation)':     'Writing (Adapted Screenplay)',
    'Writing (Adaptation)':                  'Writing (Adapted Screenplay)',
    'Writing (Screenplay)':                  'Writing (Adapted Screenplay)',
    'Best Screenplay—Adaptation':            'Writing (Adapted Screenplay)',

    // ── Animated Feature (from 74th / 2001 films) ────────────────────────────
    'Best Animated Feature Film': 'Animated Feature Film',
    'Animated Feature Film':      'Animated Feature Film',
    'Best Animated Feature':      'Animated Feature Film',

    // ── International / Foreign Language ─────────────────────────────────────
    'Best Foreign Language Film':     'Foreign Language Film',
    'Foreign Language Film':          'Foreign Language Film',
    'Best International Feature Film':'International Feature Film',
    'International Feature Film':     'International Feature Film',

    // ── Documentary – Feature ────────────────────────────────────────────────
    'Best Documentary (Feature)':    'Documentary Feature Film',
    'Documentary Feature Film':      'Documentary Feature Film',
    'Best Documentary Feature Film': 'Documentary Feature Film',
    'Documentary Feature':           'Documentary Feature Film',
    'Best Documentary Feature':      'Documentary Feature Film',
    'Best Documentary, Features':    'Documentary Feature Film',

    // ── Documentary – Short ──────────────────────────────────────────────────
    'Best Documentary (Short Subject)':  'Documentary Short Film',
    'Documentary Short Film':            'Documentary Short Film',
    'Best Documentary Short Film':       'Documentary Short Film',
    'Documentary Short Subject':         'Documentary Short Film',
    'Best Documentary Short Subject':    'Documentary Short Film',
    'Best Documentary, Short Subjects':  'Documentary Short Film',

    // ── Short – Live Action ──────────────────────────────────────────────────
    'Best Short Film (Live Action)':      'Live Action Short Film',
    'Live Action Short Film':             'Live Action Short Film',
    'Best Live Action Short Film':        'Live Action Short Film',
    'Short Film (Live Action)':           'Live Action Short Film',
    'Best Short Film, Live Action':       'Live Action Short Film',
    'Live Action Short':                  'Live Action Short Film',
    'Short Subject (Live Action)':        'Live Action Short Film',
    'Best Short Subject, Live Action':    'Live Action Short Film',
    'Short Subject (Two-Reel)':           'Live Action Short Film',
    'Best Short Subject, Two-Reel':       'Live Action Short Film',
    'Short Subject (One-Reel)':           'Live Action Short Film',

    // ── Short – Animated ────────────────────────────────────────────────────
    'Best Short Film (Animated)':        'Animated Short Film',
    'Animated Short Film':               'Animated Short Film',
    'Best Animated Short Film':          'Animated Short Film',
    'Short Film (Animated)':             'Animated Short Film',
    'Best Short Film, Animated':         'Animated Short Film',
    'Animated Short':                    'Animated Short Film',
    'Short Subject (Animated)':          'Animated Short Film',
    'Best Short Subject, Animated':      'Animated Short Film',
    'Short Subject (Cartoon)':           'Animated Short Film',
    'Best Short Subject, Cartoon':       'Animated Short Film',

    // ── Music – Score ────────────────────────────────────────────────────────
    'Best Music (Original Score)':           'Music (Original Score)',
    'Music (Original Score)':                'Music (Original Score)',
    'Best Original Score':                   'Music (Original Score)',
    'Original Score':                        'Music (Original Score)',
    'Best Music (Original Dramatic Score)':  'Music (Original Score)',
    'Best Music (Original Musical or Comedy Score)': 'Music (Original Score)',
    'Best Music (Original Song Score and Its Adaptation or Adaptation Score)': 'Music (Original Score)',
    'Best Music (Original Song Score and Its Adaptation -or- Adaptation Score)': 'Music (Original Score)',
    'Best Original Dramatic Score':          'Music (Original Score)',
    'Best Original Musical or Comedy Score': 'Music (Original Score)',
    'Music (Scoring)':                       'Music (Original Score)',
    'Music (Music Score of a Dramatic or Comedy Picture)': 'Music (Original Score)',
    'Music (Original Music Score)':          'Music (Original Score)',
    'Music (Scoring of a Musical Picture)':  'Music (Original Score)',
    'Music (Scoring of a Dramatic/Comedy Picture)': 'Music (Original Score)',
    'Music (Scoring: Adaptation or Treatment)': 'Music (Original Score)',
    'Music (Scoring: Original Song Score or Adaptation Score)': 'Music (Original Score)',
    'Music (Score of a Musical Picture—Original or Adaptation)': 'Music (Original Score)',
    'Music (Original Dramatic Score)':       'Music (Original Score)',
    'Music (Original Song Score or Adaptation Score)': 'Music (Original Score)',
    'Best Scoring':                          'Music (Original Score)',
    'Best Music Scoring':                    'Music (Original Score)',
    'Best Scoring of a Musical Picture':     'Music (Original Score)',

    // ── Music – Song ────────────────────────────────────────────────────────
    'Best Music (Original Song)':            'Music (Original Song)',
    'Music (Original Song)':                 'Music (Original Song)',
    'Best Original Song':                    'Music (Original Song)',
    'Original Song':                         'Music (Original Song)',
    'Best Song from a Motion Picture':       'Music (Original Song)',
    'Best Music, Original Song':             'Music (Original Song)',
    'Music (Song Written Directly for the Picture)': 'Music (Original Song)',
    'Music (Best Song Written Specifically for the Picture)': 'Music (Original Song)',
    'Music (Best Original Song Written for the Picture)': 'Music (Original Song)',

    // ── Sound ────────────────────────────────────────────────────────────────
    'Best Sound':             'Sound Mixing',   // pre-split unified category
    'Sound':                  'Sound',
    'Best Sound Mixing':      'Sound Mixing',
    'Sound Mixing':           'Sound Mixing',
    'Best Sound Recording':   'Sound Mixing',
    'Sound Recording':        'Sound Mixing',
    'Best Sound Editing':     'Sound Editing',
    'Sound Editing':          'Sound Editing',
    'Best Sound Effects Editing': 'Sound Editing',

    // ── Production Design / Art Direction ────────────────────────────────────
    'Best Art Direction':              'Production Design',
    'Art Direction':                   'Production Design',
    'Best Art Direction-Set Decoration': 'Production Design',
    'Art Direction-Set Decoration':    'Production Design',
    'Art Direction–Set Decoration':    'Production Design',
    'Production Design':               'Production Design',
    'Best Production Design':          'Production Design',

    // ── Cinematography ───────────────────────────────────────────────────────
    'Best Cinematography':                    'Cinematography',
    'Cinematography':                         'Cinematography',
    'Cinematography (Black-and-White)':       'Cinematography',
    'Cinematography (Color)':                 'Cinematography',
    'Best Cinematography, Black-and-White':   'Cinematography',
    'Best Cinematography, Color':             'Cinematography',
    'Cinematography (Black and White)':       'Cinematography',
    'Cinematography (Color Photography)':     'Cinematography',

    // ── Makeup ──────────────────────────────────────────────────────────────
    'Best Makeup':                 'Makeup and Hairstyling',
    'Makeup':                      'Makeup and Hairstyling',
    'Makeup and Hairstyling':      'Makeup and Hairstyling',
    'Best Makeup and Hairstyling': 'Makeup and Hairstyling',

    // ── Costume Design ──────────────────────────────────────────────────────
    'Best Costume Design':              'Costume Design',
    'Costume Design':                   'Costume Design',
    'Costume Design (Black-and-White)': 'Costume Design',
    'Costume Design (Color)':           'Costume Design',
    'Best Costume Design, Black-and-White': 'Costume Design',
    'Best Costume Design, Color':       'Costume Design',

    // ── Editing ─────────────────────────────────────────────────────────────
    'Best Film Editing': 'Film Editing',
    'Film Editing':      'Film Editing',
    'Editing':           'Film Editing',
    'Film Editing (best edited film)': 'Film Editing',

    // ── Visual Effects ──────────────────────────────────────────────────────
    'Best Visual Effects':         'Visual Effects',
    'Visual Effects':              'Visual Effects',
    'Best Special Visual Effects': 'Visual Effects',
    'Special Visual Effects':      'Visual Effects',
    'Best Special Effects':        'Visual Effects',
    'Special Effects':             'Visual Effects',
};

// ─── Category type helpers ────────────────────────────────────────────────────

function isPersonPrimaryCategory(catName: string): boolean {
    // acting, directing, writing → person is listed first, film comes after dash
    return /actor|actress|directing|director|writing|screenplay/i.test(catName);
}

function isSongCategory(catName: string): boolean {
    return /original song|best song/i.test(catName);
}

// ─── Wikitext helpers ─────────────────────────────────────────────────────────

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
        .replace(/\[\[([^\]]+)\]\]/g, (_, target) =>
            target.replace(/\s*\([^)]+\)\s*$/, '').trim()
        );
}

function stripMarkup(s: string): string {
    return s
        .replace(/'{2,3}/g, '')
        .replace(/\{\{[^}]*\}\}/g, '')       // inline templates
        .replace(/<[^>]+>/g, '')
        .replace(/&ndash;/g, '–')
        .replace(/&mdash;/g, '—')
        .replace(/&amp;/g, '&')
        .replace(/&nbsp;/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/\[\[File:[^\]]*\]\]/g, '') // File: links
        .trim();
}

function cleanText(s: string): string {
    return stripMarkup(stripWikiLinks(stripRefs(s))).trim();
}

function normTitle(t: string): string {
    return t.toLowerCase()
        .replace(/^(the|a|an)\s+/i, '')
        .replace(/[^a-z0-9]/g, '')
        .trim();
}

// Strip trailing role labels: "producer", "for Studio", etc.
function cleanPersonName(name: string): string {
    return name
        .replace(/,?\s*\(.*?\)\s*$/, '')       // trailing (anything)
        .replace(/,?\s+(?:producer|director|screenplay|writer|composer)s?\s*$/i, '')
        .replace(/\s+for\s+.+$/i, '')           // "for Studio Name"
        .trim();
}

// Standalone role words that end up as "people" entries after splitting
const ROLE_WORDS = /^(?:producer|producers|director|writer|writers|composer|editor|designer|cinematographer)s?$/i;

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface ParsedNom {
    category: string;
    film: string;
    people: string[];
    songTitle?: string;
    win: boolean;
}

// ─── Film title cleaner ──────────────────────────────────────────────────────

function cleanFilmTitle(raw: string): string {
    let t = raw.trim();
    // Strip " (Country) in Language" suffix (Foreign Language Film format)
    t = t.replace(/\s+\([A-Z][^)]{0,30}\)\s+in\s+[\w\s,]+$/, '');
    // Strip " in Language" suffix alone
    t = t.replace(/\s+in\s+(?:Spanish|French|Italian|German|Japanese|Chinese|Portuguese|Korean|Arabic|Swedish|Norwegian|Danish|Dutch|Polish|Russian|Hebrew|Hindi|Turkish|Finnish|Czech|Hungarian)\b.*$/i, '');
    // Strip trailing disambiguation like "(film)" or "(1957 film)" or "(Country)"
    t = t.replace(/\s*\([^)]{1,40}\)\s*$/, '').trim();
    // Reject garbage: year navigation links, honorary award text, blank
    if (!t || t.length < 2) return '';
    if (/^\d{4}\s+in\s+film$/i.test(t)) return '';
    if (/^To\s+/i.test(t)) return '';    // "To Walt Disney for..."
    if (t.length > 120) return '';         // suspiciously long
    return t;
}

// ─── Per-line parser ──────────────────────────────────────────────────────────

function parseLine(
    rawLine: string,
    catName: string
): { film: string; people: string[]; songTitle?: string } | null {

    const t = cleanText(rawLine.replace(/^[*#:;\s]+/, '')).trim();
    if (!t || t.length < 2 || t.startsWith('==') || t.startsWith('{|') || t.startsWith('|}')) return null;

    const isSong      = isSongCategory(catName);
    const isPersonPri = isPersonPrimaryCategory(catName);

    // ── Original Song ──────────────────────────────────────────────────────
    if (isSong) {
        // Pattern: "Song Title" from Film – Composer
        const songQuoteRe = /^[""""](.+?)[""""]\s+(?:from\s+)?(.+?)(?:\s*[-–—]\s*(.+))?$/i;
        const sq = t.match(songQuoteRe);
        if (sq) {
            const songTitle = sq[1].trim();
            const filmRaw   = sq[2].replace(/\s*[-–—]\s*.+$/, '').trim();
            const film      = filmRaw.replace(/\s*\([^)]{1,30}\)\s*$/, '').trim();
            const peopleRaw = sq[3] ?? '';
            const people    = splitPeople(peopleRaw);
            if (!film) return null;
            return { film, people, songTitle };
        }
        // Fallthrough to generic dash split
    }

    // ── Dash separator ────────────────────────────────────────────────────
    // Use non-greedy first-dash split to handle "Film – Person1, Person2 – extra"
    const dashRe = /^(.+?)\s+[-–—]\s+(.+)$/;
    const dm     = t.match(dashRe);

    if (dm) {
        const left  = dm[1].trim();
        const right = dm[2].trim();

        if (isPersonPri) {
            // Person(s) – Film [as Character]
            const film = right
                .replace(/\s+as\s+.+$/i, '')           // strip " as Character"
                .replace(/\s*\([^)]{1,30}\)\s*$/, '')  // strip "(film)"
                .replace(/^[""""]|[""""]\s*$/g, '')     // strip quotes
                .trim();
            const people = splitPeople(left);
            if (!film) return null;
            return { film, people };
        } else {
            // Film – Person(s) / Producer(s)
            const film = cleanFilmTitle(left);
            const people = splitPeople(right);
            if (!film) return null;
            return { film, people };
        }
    }

    // ── No dash → film or person only ────────────────────────────────────
    if (isPersonPri) {
        // Acting/directing entry without a film listed — can't store without film_id
        return null;
    }

    const film = cleanFilmTitle(t);
    if (!film) return null;
    return { film, people: [] };
}

function splitPeople(raw: string): string[] {
    return raw
        .split(/[,;]\s*(?:and\s+)?|\s+and\s+/i)
        .map(s => cleanPersonName(s.trim()))
        .filter(s => s.length > 1 && s.length < 80 && !/^\d{4}$/.test(s) && !ROLE_WORDS.test(s));
}

// ─── Category lookup (case-insensitive) ──────────────────────────────────────

function lookupCategory(header: string): string | undefined {
    const trimmed = header.trim();
    if (trimmed in CATEGORY_MAP) return CATEGORY_MAP[trimmed];
    const lower = trimmed.toLowerCase();
    for (const [k, v] of Object.entries(CATEGORY_MAP)) {
        if (k.toLowerCase() === lower) return v;
    }
    return undefined;
}

// ─── Main wikitext parser ─────────────────────────────────────────────────────

function parseWikitext(wikitext: string, _year: number): ParsedNom[] {
    const noms: ParsedNom[] = [];
    const text  = stripRefs(wikitext);

    // ── Strategy 1: {{Award category}} template blocks ─────────────────────
    // Used by ceremonies 5–77; each {{Award category|color|[[link|display]]}}
    // header is immediately followed by bullet lines (* = winner, ** = nominee).
    // Matches {{Award category|COLOR|[[Target|Display]]}} where COLOR can be
    // a plain hex string (#F9EFAA) or a nested template ({{Academy Awards/color}}).
    // Optional whitespace after the second pipe handles " [[..." variants.
    const awardCatRe = /\{\{Award[ _]?category\|(?:[^|{}]|\{\{[^}]*\}\})+\|\s*\[\[(?:[^\]|]+\|)?([^\]]+)\]\]\}\}/gi;
    const markers: Array<{ catName: string; pos: number }> = [];

    let m: RegExpExecArray | null;
    while ((m = awardCatRe.exec(text)) !== null) {
        const display = m[1].trim().replace(/\s*\([^)]+\)\s*$/, '');
        const catName = lookupCategory(display);
        if (catName) markers.push({ catName, pos: m.index + m[0].length });
    }

    if (markers.length > 0) {
        for (let i = 0; i < markers.length; i++) {
            const { catName, pos: startPos } = markers[i];
            const endPos = i + 1 < markers.length ? markers[i + 1].pos : text.length;
            const segment = text.substring(startPos, endPos);

            const lines = segment.split('\n');

            for (const line of lines) {
                const lTrim = line.trim();
                if (!lTrim.startsWith('*')) continue;

                const isDouble = lTrim.startsWith('**');
                const isBold   = /'''/.test(lTrim);
                const hasDagger = lTrim.includes('{{double-dagger}}') || lTrim.includes('‡');

                const isWin = hasDagger || (!isDouble && isBold);

                const parsed = parseLine(lTrim, catName);
                if (!parsed || !parsed.film) continue;

                noms.push({
                    category: catName,
                    film:     parsed.film,
                    people:   parsed.people,
                    songTitle: parsed.songTitle,
                    win:      isWin,
                });
            }
        }

        return dedupNoms(noms);
    }

    // ── Strategy 2: == Section headers == fallback ─────────────────────────
    // Used by very old ceremonies (1st–4th) that predate the wikitable format.
    const sectionRe = /\n(={2,4})([^=\n]+)\1\s*\n([\s\S]*?)(?=\n={2,4}[^=]|$)/g;
    while ((m = sectionRe.exec(text)) !== null) {
        const headerClean = cleanText(m[2].trim());
        const content     = m[3];
        const catName     = lookupCategory(headerClean);
        if (!catName) continue;

        const bullets = content.split('\n').filter(l => l.trim().startsWith('*'));
        let winnerFound = false;

        for (const line of bullets) {
            const lTrim  = line.trim();
            const isBold = /'''/.test(lTrim);
            const hasDagger = lTrim.includes('{{double-dagger}}') || lTrim.includes('‡');
            const isDouble = lTrim.startsWith('**');
            const isWin = hasDagger || (!isDouble && isBold) ||
                          (!winnerFound && !bullets.some(l => /'''/.test(l)));

            const parsed = parseLine(lTrim, catName);
            if (!parsed || !parsed.film) continue;

            if (isWin && !winnerFound) winnerFound = true;
            noms.push({ category: catName, film: parsed.film, people: parsed.people,
                        songTitle: parsed.songTitle, win: isWin });
        }
    }

    return dedupNoms(noms);
}

function dedupNoms(noms: ParsedNom[]): ParsedNom[] {
    const seen = new Set<string>();
    return noms.filter(n => {
        const key = `${n.category}|${n.film.toLowerCase()}|${n.people.join(',').toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

// ─── Wikipedia fetch ──────────────────────────────────────────────────────────

async function fetchWikitext(ceremony: number): Promise<string | null> {
    const title = wikiTitle(ceremony);
    const url = `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&redirects=1&titles=${encodeURIComponent(title)}`;
    const resp = await fetch(url, {
        headers: { 'User-Agent': 'OscarImport/1.0 (data migration)' },
    });
    if (!resp.ok) return null;
    const json = await resp.json() as any;
    const pages = json?.query?.pages ?? {};
    const page  = Object.values(pages)[0] as any;
    if (!page || page.missing !== undefined) return null;
    return page?.revisions?.[0]?.slots?.main?.['*'] ?? null;
}

// ─── DB caches ────────────────────────────────────────────────────────────────

const filmCache   = new Map<string, number>();
const personCache = new Map<string, number>();
const catCache    = new Map<string, number>();
const cerCache    = new Map<string, number>();

async function loadCaches(awardId: number): Promise<void> {
    const [films, people, cats, cers] = await Promise.all([
        pool.query('SELECT film_id, title, release_year FROM films'),
        pool.query('SELECT person_id, LOWER(name) AS name FROM people'),
        pool.query('SELECT category_id, name FROM categories WHERE award_id = $1', [awardId]),
        pool.query('SELECT ceremony_id, year FROM ceremonies WHERE award_id = $1', [awardId]),
    ]);
    for (const r of films.rows) {
        filmCache.set(normTitle(r.title), r.film_id);
        filmCache.set(`${normTitle(r.title)}|${r.release_year}`, r.film_id);
    }
    for (const r of people.rows) {
        if (!personCache.has(r.name)) personCache.set(r.name, r.person_id);
    }
    for (const r of cats.rows)
        catCache.set(`${awardId}|${r.name}`, r.category_id);
    for (const r of cers.rows)
        cerCache.set(`${awardId}|${r.year}`, r.ceremony_id);
}

async function getOrCreateFilm(client: PoolClient, title: string, year: number): Promise<number> {
    const byYear  = filmCache.get(`${normTitle(title)}|${year}`);
    if (byYear) return byYear;
    const byTitle = filmCache.get(normTitle(title));
    if (byTitle) return byTitle;

    const res = await client.query(
        `INSERT INTO films (title, release_year) VALUES ($1, $2) RETURNING film_id`, [title, year]
    );
    const id = res.rows[0].film_id as number;
    filmCache.set(normTitle(title), id);
    filmCache.set(`${normTitle(title)}|${year}`, id);
    return id;
}

async function getOrCreatePerson(client: PoolClient, name: string): Promise<number> {
    const key = name.toLowerCase();
    const cached = personCache.get(key);
    if (cached) return cached;

    const res = await client.query(
        `SELECT person_id FROM people WHERE LOWER(name) = $1 LIMIT 1`, [key]
    );
    if (res.rows.length > 0) {
        personCache.set(key, res.rows[0].person_id);
        return res.rows[0].person_id;
    }

    const ins = await client.query(
        `INSERT INTO people (name) VALUES ($1) RETURNING person_id`, [name]
    );
    const id = ins.rows[0].person_id as number;
    personCache.set(key, id);
    return id;
}

async function getOrCreateCategory(client: PoolClient, awardId: number, name: string): Promise<number> {
    const key = `${awardId}|${name}`;
    const cached = catCache.get(key);
    if (cached) return cached;

    const res = await client.query(
        `SELECT category_id FROM categories WHERE award_id = $1 AND name = $2 LIMIT 1`,
        [awardId, name]
    );
    if (res.rows.length > 0) {
        catCache.set(key, res.rows[0].category_id);
        return res.rows[0].category_id;
    }

    const ins = await client.query(
        `INSERT INTO categories (award_id, name) VALUES ($1, $2) RETURNING category_id`,
        [awardId, name]
    );
    const id = ins.rows[0].category_id as number;
    catCache.set(key, id);
    return id;
}

async function getOrCreateCeremony(client: PoolClient, awardId: number, year: number): Promise<number> {
    const key = `${awardId}|${year}`;
    const cached = cerCache.get(key);
    if (cached) return cached;

    const res = await client.query(
        `SELECT ceremony_id FROM ceremonies WHERE award_id = $1 AND year = $2`, [awardId, year]
    );
    if (res.rows.length > 0) {
        cerCache.set(key, res.rows[0].ceremony_id);
        return res.rows[0].ceremony_id;
    }

    const ins = await client.query(
        `INSERT INTO ceremonies (award_id, year) VALUES ($1, $2)
         ON CONFLICT (award_id, year) DO NOTHING RETURNING ceremony_id`,
        [awardId, year]
    );
    const id = ins.rows.length > 0
        ? (ins.rows[0].ceremony_id as number)
        : (await client.query(
              `SELECT ceremony_id FROM ceremonies WHERE award_id = $1 AND year = $2`,
              [awardId, year]
          )).rows[0].ceremony_id;
    cerCache.set(key, id);
    return id;
}

async function insertNomination(
    client: PoolClient,
    ceremonyId: number, categoryId: number, filmId: number,
    win: boolean,
    people: Array<{ id: number }>,
    songTitle?: string,
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
    nomId = res.rows[0].nomination_id as number;

    for (let i = 0; i < people.length; i++) {
        await client.query(
            `INSERT INTO nomination_people (nomination_id, person_id, credit_order)
             VALUES ($1,$2,$3)
             ON CONFLICT (nomination_id, person_id, role_id) DO NOTHING`,
            [nomId, people[i].id, i + 1]
        );
    }

    if (songTitle) {
        try {
            const sRes = await client.query(
                `INSERT INTO songs (title) VALUES ($1)
                 ON CONFLICT (title) DO UPDATE SET title=EXCLUDED.title RETURNING song_id`,
                [songTitle]
            );
            const songId = sRes.rows[0].song_id as number;
            await client.query(
                `INSERT INTO nomination_songs (nomination_id, song_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
                [nomId, songId]
            );
        } catch (_) { /* ignore */ }
    }

    return 'inserted';
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    const client = await pool.connect();

    try {
        const orgRes = await client.query(
            `SELECT organization_id FROM organizations WHERE short_name = 'Oscars'`
        );
        if (orgRes.rows.length === 0) throw new Error('Oscars organization not found');
        const orgId = orgRes.rows[0].organization_id as number;

        const awardRes = await client.query(
            `SELECT award_id FROM awards WHERE organization_id = $1`, [orgId]
        );
        if (awardRes.rows.length === 0) throw new Error('Oscars award not found');
        const awardId = awardRes.rows[0].award_id as number;

        console.log(`Oscars org_id=${orgId}  award_id=${awardId}`);
        console.log('Loading caches...');
        await loadCaches(awardId);
        console.log(`  films=${filmCache.size}  people=${personCache.size}  cats=${catCache.size}  ceremonies=${cerCache.size}`);

        let totalInserted = 0;
        let totalSkipped  = 0;
        let pagesFound    = 0;
        let pagesMissing  = 0;
        const warnings: string[] = [];

        for (let ceremony = LAST_CEREMONY; ceremony >= FIRST_CEREMONY; ceremony--) {
            await sleep(REQUEST_DELAY_MS);

            const filmYear = ceremonyToFilmYear(ceremony);

            const brokenYears = [1948, 1956, 1957, 1993];

            // Check if year already has data
            const existing = await client.query(
                `SELECT COUNT(*)::int AS cnt
                   FROM nominations n
                   JOIN ceremonies c ON n.ceremony_id = c.ceremony_id
                  WHERE c.award_id = $1 AND c.year = $2`,
                [awardId, filmYear]
            );
            if ((existing.rows[0].cnt as number) > 0 && !brokenYears.includes(filmYear)) {
                console.log(`${filmYear} (${ordinal(ceremony)}): already has data, skipping`);
                continue;
            }
            if (brokenYears.includes(filmYear)) {
                // Delete existing data for this year
                await client.query(`
                    DELETE FROM nomination_people WHERE nomination_id IN (
                        SELECT nomination_id FROM nominations n
                        JOIN ceremonies c ON n.ceremony_id = c.ceremony_id
                        WHERE c.award_id = $1 AND c.year = $2
                    )
                `, [awardId, filmYear]);
                await client.query(`
                    DELETE FROM nominations WHERE ceremony_id IN (
                        SELECT ceremony_id FROM ceremonies WHERE award_id = $1 AND year = $2
                    )
                `, [awardId, filmYear]);
                console.log(`Deleted partial data for broken year ${filmYear}`);
            }

            const wikitext = await fetchWikitext(ceremony);
            if (!wikitext) {
                pagesMissing++;
                console.log(`${filmYear} (${ordinal(ceremony)}): ⚠  Wikipedia page not found`);
                continue;
            }
            pagesFound++;

            const parsed = parseWikitext(wikitext, filmYear);

            if (parsed.length === 0) {
                warnings.push(`${filmYear} (${ordinal(ceremony)}): parsed 0 nominations`);
                console.log(`${filmYear} (${ordinal(ceremony)}): ⚠  0 nominations parsed`);
                continue;
            }

            const ceremonyId = await getOrCreateCeremony(client, awardId, filmYear);

            let yearInserted = 0;
            let yearExisted  = 0;

            for (const nom of parsed) {
                let filmId: number;
                try {
                    filmId = await getOrCreateFilm(client, nom.film, filmYear);
                } catch (e: any) {
                    warnings.push(`${filmYear} [${nom.category}]: film insert failed for "${nom.film}": ${e.message}`);
                    continue;
                }

                const categoryId = await getOrCreateCategory(client, awardId, nom.category);

                const people: Array<{ id: number }> = [];
                for (const pName of nom.people) {
                    if (!pName || pName.length < 2 || pName.length > 80) continue;
                    try {
                        const pid = await getOrCreatePerson(client, pName);
                        people.push({ id: pid });
                    } catch (e: any) {
                        warnings.push(`${filmYear}: person insert failed for "${pName}": ${e.message}`);
                    }
                }

                const result = await insertNomination(
                    client, ceremonyId, categoryId, filmId, nom.win, people, nom.songTitle
                );
                if (result === 'inserted') yearInserted++;
                else yearExisted++;
            }

            console.log(
                `${filmYear} (${ordinal(ceremony)}): +${yearInserted} noms  (${yearExisted} existed)  [${parsed.length} parsed]`
            );
            totalInserted += yearInserted;
            totalSkipped  += yearExisted;
        }

        console.log('\n─── Summary ───────────────────────────────────────');
        console.log(`Pages found   : ${pagesFound}`);
        console.log(`Pages missing : ${pagesMissing}`);
        console.log(`Noms inserted : ${totalInserted}`);
        console.log(`Noms skipped  : ${totalSkipped}`);
        if (warnings.length > 0) {
            console.log(`\nWarnings (${warnings.length}):`);
            for (const w of warnings) console.log('  ', w);
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
