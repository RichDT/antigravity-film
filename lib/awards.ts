import { queryCached as query } from './db';

// TYPES
export type AwardStatus = "won" | "nominated" | "won_slant" | "nominated_slant" | "considered" | "considered_slant" | null;

export interface OtherAwards {
    rich?: AwardStatus;
    oscar?: AwardStatus;
    globe?: AwardStatus;
    nbr?: AwardStatus;
    sag?: AwardStatus;
    dga?: AwardStatus;
    bafta?: AwardStatus;
    pga?: AwardStatus;
    wga?: AwardStatus;
    ace?: AwardStatus;
    adg?: AwardStatus;
    asc?: AwardStatus;
    cdg?: AwardStatus;
    muah?: AwardStatus;
    scl?: AwardStatus;
    ves?: AwardStatus;
    cas?: AwardStatus;
    mpse?: AwardStatus;
    annie?: AwardStatus;
    grammy?: AwardStatus;
    spirit?: AwardStatus;
}

export interface NomineeContributor {
    id?: number;
    name: string;
    nickname?: string | null;
    role?: string;
    lastName?: string;
    isInverted?: boolean;
    /** For Sound categories: names from Oscar/BAFTA nominations to prioritize in the headline */
    isOscarBaftaName?: boolean;
}

export function personDisplayName(p: { name: string; nickname?: string | null }): string {
    if (!p.nickname) return p.name;
    const spaceIdx = p.name.indexOf(' ');
    if (spaceIdx < 0) return `${p.name} ('${p.nickname}')`;
    return `${p.name.slice(0, spaceIdx)} ('${p.nickname}') ${p.name.slice(spaceIdx + 1)}`;
}

export interface Nominee {
    id?: number;
    name: string;
    lastName?: string;
    isInverted?: boolean;
    film: string;
    film_id?: number;
    character?: string;
    songTitle?: string;
    adaptedSource?: string;
    role?: string;
    otherOtherAwards?: OtherAwards;
    isWinner?: boolean;
    contributors?: NomineeContributor[];
    /** For acting nominees: one entry per film; includes per-film badge data for unambiguous display. */
    performances?: { film: string; character?: string; film_id: number; nomination_id: number; badges?: OtherAwards }[];
    /** False for guild-only nominees not picked by Rich Picks. */
    hasRichPick?: boolean;
}

export interface YearData {
    year: number;
    winner: Nominee | null;
    nominees: Nominee[];
    guildOnlyNominees?: Nominee[];
    awardContexts?: Record<string, AwardPopoverContext>;
}

export interface Category {
    name: string;
    slug?: string;
    icon: string;
    group: string;
    description?: string;
    winner: (Nominee & { isWinner: true }) | null;
    nominees: Nominee[];
    awardContexts?: Record<string, AwardPopoverContext>;
}

export interface HallOfFameEntry {
    name: string;
    wins: number;
    nominations: number;
}

// MAPPINGS & UTILS
export const CATEGORY_GROUPS_MAPPING: Record<string, string> = {
    "Live-Action Feature": "film", "International Feature": "film", "Animated Feature": "film", "Documentary": "film",
    "Director": "directing", "Directing": "directing", "Film Editing": "directing", "Editing": "directing",
    "Actor in a Leading Role": "acting", "Actress in a Leading Role": "acting", "Actor in a Supporting Role": "acting", "Actress in a Supporting Role": "acting",
    "Screenplay (Original)": "writing", "Screenplay (Adapted)": "writing",
    "Cinematography": "visual", "Art Direction": "visual", "Costuming": "visual", "Make-Up & Hairstyling": "visual", "Effects": "visual",
    "Original Score": "sound", "Original Song": "sound", "Sound Mixing": "sound", "Sound Editing": "sound"
};

export const CATEGORY_ICON_MAPPING: Record<string, string> = {
    "Live-Action Feature": "film", "Live-Action Short": "filevideo", "International Feature": "globe", "Animated Feature": "wand", "Animated Short": "brush", "Documentary": "file",
    "Director": "clapperboard", "Directing": "clapperboard", "Film Editing": "scissors", "Editing": "scissors",
    "Actor in a Leading Role": "userstar", "Actress in a Leading Role": "userstar", "Actor in a Supporting Role": "user", "Actress in a Supporting Role": "user",
    "Screenplay (Original)": "pentool", "Screenplay (Adapted)": "bookopen",
    "Cinematography": "camera", "Art Direction": "theater", "Costuming": "shirt", "Make-Up & Hairstyling": "mirror", "Effects": "sparkles",
    "Original Score": "piano", "Original Song": "micvocal", "Sound Mixing": "sliders", "Sound Editing": "headphones"
};

export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
    "Live-Action Feature": "Outstanding live-action feature", "International Feature": "Outstanding feature from outside the United States",
    "Animated Feature": "Outstanding animated feature", "Documentary": "Outstanding documentary feature or short",
    "Directing": "Outstanding achievement in directing", "Editing": "Outstanding achievement in film editing",
    "Actor in a Leading Role": "Outstanding performance by a leading actor", "Actress in a Leading Role": "Outstanding performance by a leading actress",
    "Actor in a Supporting Role": "Outstanding performance by a supporting actor", "Actress in a Supporting Role": "Outstanding performance by a supporting actress",
    "Screenplay (Original)": "Outstanding original screenplay", "Screenplay (Adapted)": "Outstanding adapted screenplay",
    "Cinematography": "Outstanding achievement in cinematography", "Art Direction": "Outstanding achievement in production design",
    "Costuming": "Outstanding achievement in costume design", "Make-Up & Hairstyling": "Outstanding achievement in make-up and hairstyling",
    "Effects": "Outstanding achievement in visual effects",
    "Original Score": "Outstanding original score", "Original Song": "Outstanding original song", "Sound Mixing": "Outstanding achievement in sound mixing", "Sound Editing": "Outstanding achievement in sound editing"
};

export function slugify(text: string) {
    return text.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
}

export function formatNamesList(people: NomineeContributor[]): string {
    if (!people || people.length === 0) return "";

    // Deduplicate by name before sorting
    const uniquePeopleMap = new Map<string, NomineeContributor>();
    people.forEach(p => uniquePeopleMap.set(p.name, p));
    const uniquePeople = Array.from(uniquePeopleMap.values());

    const sortedPeople = [...uniquePeople].sort((a, b) => {
        const aLast = (a.lastName || a.name.trim().split(/\s+/).pop() || '').toLowerCase();
        const bLast = (b.lastName || b.name.trim().split(/\s+/).pop() || '').toLowerCase();
        return aLast.localeCompare(bLast);
    });

    const names = sortedPeople.map(p => personDisplayName(p));
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

// MAIN QUERIES
export async function getAllCategories() {
    const res = await query(`
        SELECT DISTINCT c.name 
        FROM categories c
        JOIN awards a USING (award_id)
        JOIN organizations o USING (organization_id)
        WHERE o.short_name = 'Rich Picks'
        ORDER BY c.name
    `);
    return res.rows.map((row: any) => {
        const cat = row.name;
        return {
            name: cat,
            slug: slugify(cat),
            icon: CATEGORY_ICON_MAPPING[cat] || "trophy",
            group: CATEGORY_GROUPS_MAPPING[cat] || "film",
            description: CATEGORY_DESCRIPTIONS[cat] || `Outstanding achievement in ${cat.toLowerCase()}`
        };
    });
}

export async function getCategoryBySlug(slug: string) {
    const categories = await getAllCategories();
    return categories.find((c: any) => c.slug === slug) || null;
}

// ---------------------------------------------------------------------------
// CANONICAL CATEGORY MAPPING CACHE
// Loaded once at module init; maps "orgShortName|externalCategoryName" → match_type
// for every external category that has a mapping to an RP canonical.
// ---------------------------------------------------------------------------

/**
 * Keyed by "rpCategoryName|orgShortName|externalCategoryName"
 * Value: 'exact' | 'slant'
 */
let _mappingCache: Map<string, 'exact' | 'slant'> | null = null;

async function getMappingCache(): Promise<Map<string, 'exact' | 'slant'>> {
    if (_mappingCache) return _mappingCache;
    const res = await query(`
        SELECT
            rp_cc.name        AS rp_name,
            o.short_name      AS org,
            ext_cc.name       AS ext_canonical_name,
            m.match_type
        FROM category_mappings m
        JOIN canonical_categories rp_cc  ON m.rp_canonical_id   = rp_cc.canonical_category_id
        JOIN canonical_categories ext_cc ON m.other_canonical_id = ext_cc.canonical_category_id
        JOIN organizations o             ON ext_cc.organization_id = o.organization_id
    `);
    // Build a second lookup: "orgShortName|externalCategoryName" → set of {rpName, matchType}
    // and the combined key "rpName|orgShortName|extCategoryName" → matchType
    const cache = new Map<string, 'exact' | 'slant'>();
    // Also build a reverse lookup for the batch queries:
    // "orgShortName|extCanonicalName" → Map<rpName, matchType>
    const reverseCache = new Map<string, Map<string, 'exact' | 'slant'>>();

    for (const r of res.rows) {
        cache.set(`${r.rp_name}|${r.org}|${r.ext_canonical_name}`, r.match_type);
        const rk = `${r.org}|${r.ext_canonical_name}`;
        if (!reverseCache.has(rk)) reverseCache.set(rk, new Map());
        reverseCache.get(rk)!.set(r.rp_name, r.match_type);
    }

    _mappingCache = cache;
    (_mappingCache as any)._reverse = reverseCache;
    return _mappingCache;
}

/**
 * Given an external category name and org, return a map of
 * rpCategoryName → match_type for all RP categories it maps to.
 * Returns an empty map when no mappings exist.
 * Relies on the canonical_categories → category_canonical_map join loaded in cache.
 */
async function getMatchesForExternalCategory(
    orgShortName: string,
    externalCategoryName: string,
): Promise<Map<string, 'exact' | 'slant'>> {
    const cache = await getMappingCache();
    const reverse = (cache as any)._reverse as Map<string, Map<string, 'exact' | 'slant'>>;

    // The external category name may not exactly equal a canonical name — we need
    // to resolve through category_canonical_map. We do this lazily: on first miss,
    // fall back to a direct DB lookup for the exact category row.
    const directKey = `${orgShortName}|${externalCategoryName}`;
    if (reverse.has(directKey)) return reverse.get(directKey)!;

    // The category name might not be a canonical name itself — look up its canonical
    // (e.g. a per-year duplicate row whose name matches a canonical that was renamed).
    // In practice all category names in the batch queries ARE the category.name values,
    // which are mapped through category_canonical_map to canonical_categories.
    // Fetch the canonical name for this (org, category name) pair once.
    const canonRes = await query(`
        SELECT cc.name AS canonical_name
        FROM categories c
        JOIN awards a ON c.award_id = a.award_id
        JOIN organizations o ON a.organization_id = o.organization_id
        JOIN category_canonical_map m ON m.category_id = c.category_id
        JOIN canonical_categories cc ON m.canonical_category_id = cc.canonical_category_id
        WHERE o.short_name = $1 AND c.name = $2
        LIMIT 1
    `, [orgShortName, externalCategoryName]);

    if (canonRes.rows.length === 0) {
        // No canonical for this category — cache the empty result
        reverse.set(directKey, new Map());
        return new Map();
    }

    const canonName = canonRes.rows[0].canonical_name;
    const canonKey = `${orgShortName}|${canonName}`;
    const result = reverse.get(canonKey) ?? new Map<string, 'exact' | 'slant'>();
    // Cache under the original category name too so we don't re-query
    reverse.set(directKey, result);
    return result;
}

/**
 * Returns the match type between an RP category and an external org category,
 * resolved via the DB canonical mapping tables.
 *
 * 'exact'  — open competition equivalent
 * 'slant'  — restricted/subsidiary or cross-tier acting match
 * null     — no mapping exists
 */
export async function categoryMatchStrengthDB(
    rpCategoryName: string,
    orgShortName: string,
    externalCategoryName: string,
): Promise<'exact' | 'slant' | null> {
    const matches = await getMatchesForExternalCategory(orgShortName, externalCategoryName);
    return matches.get(rpCategoryName) ?? null;
}

/**
 * @deprecated Use categoryMatchStrengthDB for new code.
 * Kept for reference during transition; not called by any live path.
 */
export function isSameCategory(rpCat: string, otherCat: string, orgShortName?: string): boolean {
    void rpCat; void otherCat; void orgShortName;
    return false;
}

/**
 * @deprecated Use categoryMatchStrengthDB for new code.
 * Kept for reference during transition; not called by any live path.
 */
export function categoryMatchStrength(
    rpCat: string,
    otherCat: string,
    orgShortName?: string,
): 'exact' | 'slant' | null {
    void rpCat; void otherCat; void orgShortName;
    return null;
}

// ---------------------------------------------------------------------------
// BATCH BADGE LOGIC (replaces per-nominee getBadgeData calls)
// ---------------------------------------------------------------------------

// Shape of a single row returned by the batch external-award queries.
interface ExternalAwardRow {
    short_name: string;
    win: boolean;
    film_id: number;
    film_title: string;
    person_id: number | null;
    other_person_name: string | null;
    other_category_name: string;
    /** canonical_category_id of this external category row — used by the mapping lookup */
    other_canonical_id: number | null;
    other_song_title: string | null;
    /** Present when fetched via getExternalAwardsForCategory (all-years batch). */
    year?: number;
}

/**
 * Fetch ALL non-Rich-Picks nominations for a given year in ONE query.
 * Includes other_canonical_id so in-memory matching can use the DB mapping tables.
 */
export async function getExternalAwardsForYear(year: number): Promise<ExternalAwardRow[]> {
    const res = await query(`
        SELECT o.short_name, n.win, n.film_id, f.title as film_title, np.person_id,
               p.name as other_person_name,
               cat.name as other_category_name,
               ccm.canonical_category_id as other_canonical_id,
               (SELECT title FROM songs cs
                JOIN nomination_songs ns ON cs.song_id = ns.song_id
                WHERE ns.nomination_id = n.nomination_id LIMIT 1) as other_song_title
        FROM nominations n
        JOIN films f USING (film_id)
        JOIN ceremonies c USING (ceremony_id)
        JOIN awards a ON c.award_id = a.award_id
        JOIN categories cat ON n.category_id = cat.category_id
        JOIN organizations o ON a.organization_id = o.organization_id
        LEFT JOIN category_canonical_map ccm ON ccm.category_id = cat.category_id
        LEFT JOIN nomination_people np USING (nomination_id)
        LEFT JOIN people p ON np.person_id = p.person_id
        WHERE c.year = $1 AND o.short_name != 'Rich Picks'
    `, [year]);
    return res.rows as ExternalAwardRow[];
}

/**
 * Fetch ALL non-Rich-Picks nominations for a set of years in ONE query.
 * Equivalent to calling getExternalAwardsForYear once per year, but in a single round trip.
 * Includes c.year in the result so callers can split into per-year maps.
 */
export async function getExternalAwardsForYears(years: number[]): Promise<ExternalAwardRow[]> {
    if (years.length === 0) return [];
    const res = await query(`
        SELECT o.short_name, n.win, n.film_id, f.title as film_title, np.person_id,
               p.name as other_person_name,
               cat.name as other_category_name,
               ccm.canonical_category_id as other_canonical_id,
               c.year,
               (SELECT title FROM songs cs
                JOIN nomination_songs ns ON cs.song_id = ns.song_id
                WHERE ns.nomination_id = n.nomination_id LIMIT 1) as other_song_title
        FROM nominations n
        JOIN films f USING (film_id)
        JOIN ceremonies c USING (ceremony_id)
        JOIN awards a ON c.award_id = a.award_id
        JOIN categories cat ON n.category_id = cat.category_id
        JOIN organizations o ON a.organization_id = o.organization_id
        LEFT JOIN category_canonical_map ccm ON ccm.category_id = cat.category_id
        LEFT JOIN nomination_people np USING (nomination_id)
        LEFT JOIN people p ON np.person_id = p.person_id
        WHERE c.year = ANY($1) AND o.short_name != 'Rich Picks'
    `, [years]);
    return res.rows as ExternalAwardRow[];
}

/**
 * Fetch ALL non-Rich-Picks nominations for a given category name (all years) in ONE query.
 * Includes other_canonical_id so in-memory matching can use the DB mapping tables.
 */
export async function getExternalAwardsForCategory(categoryName: string): Promise<ExternalAwardRow[]> {
    const res = await query(`
        SELECT o.short_name, n.win, n.film_id, f.title as film_title, np.person_id,
               p.name as other_person_name,
               cat.name as other_category_name,
               ccm.canonical_category_id as other_canonical_id,
               c.year,
               (SELECT title FROM songs cs
                JOIN nomination_songs ns ON cs.song_id = ns.song_id
                WHERE ns.nomination_id = n.nomination_id LIMIT 1) as other_song_title
        FROM nominations n
        JOIN films f USING (film_id)
        JOIN ceremonies c USING (ceremony_id)
        JOIN awards a ON c.award_id = a.award_id
        JOIN categories cat ON n.category_id = cat.category_id
        JOIN organizations o ON a.organization_id = o.organization_id
        LEFT JOIN category_canonical_map ccm ON ccm.category_id = cat.category_id
        LEFT JOIN nomination_people np USING (nomination_id)
        LEFT JOIN people p ON np.person_id = p.person_id
        WHERE o.short_name != 'Rich Picks'
    `);
    return res.rows as ExternalAwardRow[];
}

/**
 * Returns a Map<extCanonicalId, rpCategoryName> covering all exact matches
 * across all RP categories. Used by the person and film pages to resolve any
 * external nomination's canonical ID back to its RP category bucket.
 * Only 'exact' matches are included — slant matches are intentionally excluded
 * so they don't hijack the display grouping.
 */
let _reverseMapCache: Map<number, string> | null = null;
export async function getReverseCanonicalMap(): Promise<Map<number, string>> {
    if (_reverseMapCache) return _reverseMapCache;
    const res = await query(`
        SELECT m.other_canonical_id, rp.name AS rp_name
        FROM category_mappings m
        JOIN canonical_categories rp ON rp.canonical_category_id = m.rp_canonical_id
        JOIN organizations o ON rp.organization_id = o.organization_id
        WHERE o.short_name = 'Rich Picks' AND m.match_type = 'exact'
    `);
    const map = new Map<number, string>();
    for (const r of res.rows) {
        // If multiple RP categories map to the same external canonical (e.g. Globes
        // Screenplay maps to both Adapted and Original), the last write wins —
        // acceptable since those will be resolved correctly by the RP row itself.
        map.set(r.other_canonical_id, r.rp_name);
    }
    _reverseMapCache = map;
    return map;
}

/**
 * Returns a Map<extCanonicalId, matchType> for a given RP category name.
 * Loaded from the in-memory mapping cache (populated on first call).
 * Call this once per RP category and pass the result to buildAwardContextsFromBatch
 * and computeBadgesFromBatch.
 */
export async function getRPCategoryMappings(
    rpCategoryName: string,
): Promise<Map<number, 'exact' | 'slant'>> {
    const cache = await getMappingCache();
    const reverse = (cache as any)._reverse as Map<string, Map<string, 'exact' | 'slant'>>;
    // Build extCanonicalId → matchType by scanning all reverse entries for this RP name
    const result = new Map<number, 'exact' | 'slant'>();
    const canonRows = await query(`
        SELECT m.other_canonical_id, m.match_type
        FROM category_mappings m
        JOIN canonical_categories rp_cc ON m.rp_canonical_id = rp_cc.canonical_category_id
        JOIN organizations o ON rp_cc.organization_id = o.organization_id
        WHERE o.short_name = 'Rich Picks' AND rp_cc.name = $1
    `, [rpCategoryName]);
    for (const r of canonRows.rows) {
        result.set(r.other_canonical_id, r.match_type);
    }
    // suppress unused warning
    void reverse;
    return result;
}

/**
 * Fetch extCanonicalId → matchType mappings for a set of RP category names in ONE query.
 * Returns Map<rpCategoryName, Map<extCanonicalId, matchType>>.
 * Use in place of calling getRPCategoryMappings once per category.
 */
export async function getRPCategoryMappingsBatch(
    rpCategoryNames: string[],
): Promise<Map<string, Map<number, 'exact' | 'slant'>>> {
    const result = new Map<string, Map<number, 'exact' | 'slant'>>();
    if (rpCategoryNames.length === 0) return result;
    const canonRows = await query(`
        SELECT rp_cc.name AS rp_name, m.other_canonical_id, m.match_type
        FROM category_mappings m
        JOIN canonical_categories rp_cc ON m.rp_canonical_id = rp_cc.canonical_category_id
        JOIN organizations o ON rp_cc.organization_id = o.organization_id
        WHERE o.short_name = 'Rich Picks' AND rp_cc.name = ANY($1)
    `, [rpCategoryNames]);
    for (const r of canonRows.rows) {
        if (!result.has(r.rp_name)) result.set(r.rp_name, new Map());
        result.get(r.rp_name)!.set(r.other_canonical_id, r.match_type);
    }
    return result;
}

const ORG_KEY_MAP: Record<string, keyof OtherAwards> = {
    'Oscars': 'oscar', 'Globes': 'globe', 'NBR': 'nbr', 'BAFTA': 'bafta', 'SAG': 'sag', 'DGA': 'dga',
    'PGA': 'pga', 'WGA': 'wga', 'ACE': 'ace', 'ADG': 'adg', 'ASC': 'asc',
    'CDG': 'cdg', 'MUAH': 'muah', 'SCL': 'scl', 'VES': 'ves',
    'CAS': 'cas', 'MPSE': 'mpse',
    'Annie': 'annie', 'Grammy': 'grammy', 'Spirit': 'spirit'
};

const ORG_DISPLAY_NAMES: Record<string, string> = {
    'Oscars': 'Academy Awards', 'Globes': 'Golden Globe Awards', 'NBR': 'National Board of Review',
    'BAFTA': 'BAFTA', 'SAG': 'Screen Actors Guild', 'DGA': 'Directors Guild of America',
    'PGA': 'Producers Guild of America', 'WGA': 'Writers Guild of America',
    'ACE': 'American Cinema Editors', 'ADG': 'Art Directors Guild',
    'ASC': 'American Society of Cinematographers', 'CDG': 'Costume Designers Guild',
    'MUAH': 'Make-Up Artists & Hair Stylists Guild', 'SCL': 'Society of Composers & Lyricists',
    'VES': 'Visual Effects Society', 'CAS': 'Cinema Audio Society',
    'MPSE': 'Motion Picture Sound Editors', 'Annie': 'Annie Awards', 'Grammy': 'Grammy Awards',
    'Spirit': 'Film Independent Spirit Awards',
};

export interface AwardPopoverNominee {
    displayName: string;
    film: string;
    filmId?: number;
    isWinner: boolean;
    /** Person IDs attached to this entry — used by the component to highlight the current RP nominee */
    personIds: number[];
    /** When this nominee comes from an adjacent year, the actual award year is stamped here. */
    year?: number;
}

export interface AwardPopoverSection {
    categoryName: string;
    nominees: AwardPopoverNominee[];
    /** When the entire section comes from an adjacent year, show this in the header. */
    year?: number;
}

export interface AwardPopoverContext {
    orgDisplayName: string;
    /** One section per distinct other_category_name that matched the RP category */
    sections: AwardPopoverSection[];
}

/**
 * Pure in-memory function — no DB calls.
 * Builds the full nominee list for each relevant award org for a given RP category.
 * Keeping distinct award categories as separate sections so the component can render
 * them with headers (e.g. Globe Drama vs Globe Comedy).
 *
 * @param rpMappings  Pre-loaded from getRPCategoryMappings(rpCategoryName).
 *                    Maps extCanonicalId → 'exact' | 'slant'.
 */
export function buildAwardContextsFromBatch(
    batchRows: ExternalAwardRow[],
    rpCategoryName: string,
    rpMappings: Map<number, 'exact' | 'slant'>,
    scopeYear?: number,
): Record<string, AwardPopoverContext> {
    const contexts: Record<string, AwardPopoverContext> = {};
    const rpLower = rpCategoryName.toLowerCase();
    const isAnimatedFeature = rpLower.includes('animated') && rpLower.includes('film');
    const isActing = rpLower.includes('actor') || rpLower.includes('actress');

    // When scopeYear is specified, include rows from scopeYear and adjacent years (±1).
    // Rows from adjacent years will be annotated with their actual year.
    const rows = scopeYear != null
        ? batchRows.filter(r => r.year == null || (r.year >= scopeYear - 1 && r.year <= scopeYear + 1))
        : batchRows;

    // When rpMappings is empty this is a standalone non-RP category — match rows
    // directly by other_category_name instead of via the canonical mapping table.
    const useDirectMatch = rpMappings.size === 0;

    // Group matching rows: org → (category + year) → rows
    // Adjacent-year rows are grouped into SEPARATE sections (never mixed with current-year)
    // so that selectSections can pick the right one based on person/film.
    const byOrg = new Map<string, Map<string, ExternalAwardRow[]>>();

    for (const r of rows) {
        const orgKey = ORG_KEY_MAP[r.short_name];
        if (!orgKey) continue;

        if (useDirectMatch) {
            // Direct match: include rows whose raw category name equals the display name.
            if (r.other_category_name !== rpCategoryName) continue;
        } else {
            if (r.other_canonical_id == null) continue;
            const strength = rpMappings.get(r.other_canonical_id);
            if (!strength) continue;
        }

        const catLower = r.other_category_name.toLowerCase();

        // Animated feature: exclude short-film categories
        if (isAnimatedFeature && catLower.includes('short')) continue;

        // Never show cast/casting categories — they don't correspond to individual acting noms
        if (isActing) {
            const cl = r.other_category_name.toLowerCase();
            if (cl.includes('cast') || cl.includes('casting')) continue;
        }

        // Use a year-qualified key so adjacent-year rows stay in their own section
        const isAdjacentYear = scopeYear != null && r.year != null && r.year !== scopeYear;
        const catKey = isAdjacentYear ? `${r.other_category_name}|||${r.year}` : r.other_category_name;

        if (!byOrg.has(r.short_name)) byOrg.set(r.short_name, new Map());
        const byCat = byOrg.get(r.short_name)!;
        if (!byCat.has(catKey)) byCat.set(catKey, []);
        byCat.get(catKey)!.push(r);
    }

    for (const [shortName, byCat] of byOrg) {
        const orgKey = ORG_KEY_MAP[shortName]!;
        const sections: AwardPopoverSection[] = [];

        for (const [catKey, rows] of byCat) {
            // Parse out the year-qualified key
            const sepIdx = catKey.indexOf('|||');
            const catName = sepIdx >= 0 ? catKey.substring(0, sepIdx) : catKey;
            const sectionYear = sepIdx >= 0 ? parseInt(catKey.substring(sepIdx + 3)) : undefined;

            // Acting: one entry per person (keyed by person_id); displayName = person name.
            // Non-acting person categories (directing, writing, etc.): one entry per film
            // (keyed by film_id), collecting all credited names — co-directors/co-writers
            // on the same film get merged into a single "Name and Name" entry.
            // Film/craft categories with no named people: also keyed by film_id.
            const entryMap = new Map<string, { win: boolean; film: string; filmId: number; names: string[]; personIds: number[] }>();

            // For direct-match categories (e.g. EE Rising Star), nominees are individual
            // people and should use person-based keys. But some direct-match categories
            // (e.g. Outstanding British Film) have multiple people credited per film — they
            // are co-nominees on the same nomination and must group by film_id instead.
            let usePersonKeyForDirectMatch = useDirectMatch;
            if (useDirectMatch) {
                const filmPersonSets = new Map<number, Set<number | null>>();
                for (const r of rows) {
                    if (!filmPersonSets.has(r.film_id)) filmPersonSets.set(r.film_id, new Set());
                    filmPersonSets.get(r.film_id)!.add(r.person_id);
                }
                const hasMultiplePeoplePerFilm = Array.from(filmPersonSets.values()).some(s => s.size > 1);
                if (hasMultiplePeoplePerFilm) usePersonKeyForDirectMatch = false;
            }

            for (const r of rows) {
                // Use person-based keys for acting categories and for direct-match
                // categories where nominees are individual people (e.g. EE Rising Star).
                const key = (isActing || (usePersonKeyForDirectMatch && r.person_id != null)) && r.person_id != null
                    ? `person_${r.person_id}_film_${r.film_id}`
                    : `film_${r.film_id}`;

                if (!entryMap.has(key)) {
                    entryMap.set(key, { win: r.win, film: r.film_title, filmId: r.film_id, names: [], personIds: [] });
                }
                const entry = entryMap.get(key)!;
                if (r.win) entry.win = true;
                if (r.person_id != null && !entry.personIds.includes(r.person_id)) {
                    entry.personIds.push(r.person_id);
                }
                if (r.other_person_name && !entry.names.includes(r.other_person_name)) {
                    entry.names.push(r.other_person_name);
                }
            }

            const nominees: AwardPopoverNominee[] = Array.from(entryMap.values())
                .map(e => {
                    // Build display name: for acting use the single person name; for
                    // non-acting use all credited names joined, falling back to film title.
                    let displayName: string;
                    if (isActing) {
                        displayName = e.names[0] ?? e.film;
                    } else if (e.names.length > 0) {
                        const last = e.names[e.names.length - 1];
                        const rest = e.names.slice(0, -1);
                        displayName = rest.length > 0 ? `${rest.join(', ')} and ${last}` : last;
                    } else {
                        displayName = e.film;
                    }
                    return { displayName, film: e.film, filmId: e.filmId, isWinner: e.win, personIds: e.personIds };
                })
                .sort((a, b) => Number(b.isWinner) - Number(a.isWinner));

            if (nominees.length > 0) sections.push({ categoryName: catName, nominees, year: sectionYear });
        }

        if (sections.length > 0) {
            contexts[orgKey] = {
                orgDisplayName: ORG_DISPLAY_NAMES[shortName] || shortName,
                sections,
            };
        }
    }
    return contexts;
}

const BADGE_WEIGHTS = { "nominated": 1, "nominated_slant": 2, "won_slant": 3, "won": 4 } as const;

/**
 * Pure in-memory function — no DB calls.
 * Given the pre-fetched batch of all external award rows for a scope (year or category),
 * compute the OtherAwards badge map for a specific nominee.
 *
 * @param rpMappings  Pre-loaded from getRPCategoryMappings(categoryName).
 *                    Maps extCanonicalId → 'exact' | 'slant'.
 */
export function computeBadgesFromBatch(
    batchRows: ExternalAwardRow[],
    filmIds: number[],
    peopleIds: number[],
    categoryName: string,
    rpMappings: Map<number, 'exact' | 'slant'>,
    songTitle?: string,
    peopleNames: string[] = [],
    scopeYear?: number,
): OtherAwards {
    const badges: OtherAwards = {};
    const filmIdSet = new Set(filmIds);

    const isActing = categoryName.toLowerCase().includes("actor") || categoryName.toLowerCase().includes("actress");
    const isSong = categoryName === "Original Song";

    for (const r of batchRows) {
        // When scopeYear is set, include the scope year and adjacent years (±1).
        // Rows outside that window are skipped.
        if (scopeYear !== undefined && r.year !== undefined) {
            if (Math.abs(r.year - scopeYear) > 1) continue;
        }

        // Only consider rows relevant to the films in this nomination
        if (!filmIdSet.has(r.film_id)) continue;

        const key = ORG_KEY_MAP[r.short_name];
        if (!key) continue;

        if (r.other_canonical_id == null) continue;
        const matchStrength = rpMappings.get(r.other_canonical_id);
        if (!matchStrength) continue;

        if (isActing) {
            if (r.person_id) {
                if (peopleIds.length > 0 && !peopleIds.includes(r.person_id)) continue;
            } else if (peopleIds.length > 0) {
                continue;
            }
        } else if (isSong) {
            if (r.other_song_title) {
                if (songTitle && songTitle.toLowerCase() !== r.other_song_title.toLowerCase()) continue;
            } else if (peopleNames.length > 0 && r.other_person_name) {
                const matchById = r.person_id && peopleIds.includes(r.person_id);
                const otherNameLower = r.other_person_name.toLowerCase();
                const matchByName = peopleNames.some(n => n.toLowerCase().includes(otherNameLower) || otherNameLower.includes(n.toLowerCase()));
                if (!matchById && !matchByName) continue;
            }
        }

        // Force slant for adjacent-year rows regardless of canonical mapping strength
        const isAdjacentYear = scopeYear !== undefined && r.year !== undefined && r.year !== scopeYear;
        const isSlant = matchStrength === 'slant' || isAdjacentYear;
        const status: AwardStatus = r.win ? (isSlant ? 'won_slant' : 'won') : (isSlant ? 'nominated_slant' : 'nominated');
        const current = badges[key];
        const currentWeight = current && current in BADGE_WEIGHTS ? BADGE_WEIGHTS[current as keyof typeof BADGE_WEIGHTS] : 0;
        const newWeight = status && status in BADGE_WEIGHTS ? BADGE_WEIGHTS[status as keyof typeof BADGE_WEIGHTS] : 0;
        if (newWeight > currentWeight) badges[key] = status;
    }
    return badges;
}

// Keep getBadgeData for backwards-compatibility with the Film Details page
// (which already fetches external awards as part of its main nomination query)
export async function getBadgeData(year: number, filmIds: number[], peopleIds: number[], categoryName: string, songTitle?: string, peopleNames: string[] = []) {
    const [batchRows, rpMappings] = await Promise.all([
        getExternalAwardsForYears([year - 1, year, year + 1]),
        getRPCategoryMappings(categoryName),
    ]);
    return computeBadgesFromBatch(batchRows, filmIds, peopleIds, categoryName, rpMappings, songTitle, peopleNames, year);
}

export async function getYearsForCategory(categoryName: string): Promise<YearData[]> {
    // PERF: Pre-fetch ALL external award data for this category in one query,
    // then compute badges in-memory per nominee instead of one DB call each.
    const [richRes, externalBatch, rpMappings] = await Promise.all([
        query(`
            SELECT
                c.year,
                n.win,
                n.nomination_id,
                n.notes,
                f.film_id,
                f.title AS film_title,
                json_agg(json_build_object('id', p.person_id, 'name', p.name, 'nickname', p.nickname, 'lastName', p.last_name, 'isInverted', p.is_inverted_name, 'role', r.role_name)) FILTER (WHERE p.person_id IS NOT NULL) AS people,
                (SELECT title FROM songs cs JOIN nomination_songs ns ON cs.song_id=ns.song_id WHERE ns.nomination_id = n.nomination_id LIMIT 1) as song_title
            FROM nominations n
            JOIN ceremonies c USING (ceremony_id)
            JOIN categories cat USING (category_id)
            JOIN awards a ON c.award_id = a.award_id
            JOIN organizations o ON a.organization_id = o.organization_id
            JOIN films f USING (film_id)
            LEFT JOIN nomination_people np USING (nomination_id)
            LEFT JOIN people p ON np.person_id = p.person_id
            LEFT JOIN roles r ON np.role_id = r.role_id
            WHERE o.short_name = 'Rich Picks' AND cat.name = $1
            GROUP BY c.year, n.win, n.nomination_id, n.notes, f.film_id, f.title
            ORDER BY c.year DESC
        `, [categoryName]),
        getExternalAwardsForCategory(categoryName),
        getRPCategoryMappings(categoryName),
    ]);

    const res = richRes;

    const isActingCategory = categoryName.toLowerCase().includes("actor") || categoryName.toLowerCase().includes("actress");
    const isSong = categoryName === "Original Song";

    const groupedRows = new Map<string, any>();
    for (const r of res.rows) {
        let nomKey;
        const personId = r.people && r.people.length > 0 ? r.people[0].id : `nom_${r.nomination_id}`;
        if (isActingCategory) nomKey = `person_${personId}`;
        else if (isSong) nomKey = `film_${r.film_id}_song_${r.song_title}`;
        else nomKey = `film_${r.film_id}`;

        const fullKey = `${r.year}_${nomKey}`;
        if (!groupedRows.has(fullKey)) {
            groupedRows.set(fullKey, {
                ...r,
                all_people: r.people || [],
                performances: [{ film: r.film_title, character: r.people && r.people.length > 0 ? r.people[0].role : null, film_id: r.film_id, nomination_id: r.nomination_id }]
            });
        } else {
            const existing = groupedRows.get(fullKey);
            if (r.people) existing.all_people.push(...r.people);
            if (r.win) existing.win = true;
            if (r.notes && !existing.notes) existing.notes = r.notes;
            existing.performances.push({ film: r.film_title, character: r.people && r.people.length > 0 ? r.people[0].role : null, film_id: r.film_id, nomination_id: r.nomination_id });
        }
    }

    const yearMap = new Map<number, YearData>();

    for (const r of Array.from(groupedRows.values())) {
        if (!yearMap.has(r.year)) {
            yearMap.set(r.year, { year: r.year, winner: null, nominees: [] });
        }
        const yd = yearMap.get(r.year)!;

        const people = r.all_people || [];
        // Deduplicate people in case of weird overlapping data
        const uniquePeopleMap = new Map<number, any>();
        for (const p of people) {
            if (p) uniquePeopleMap.set(p.id, p);
        }
        const uniquePeople = Array.from(uniquePeopleMap.values());

        const peopleIds = uniquePeople.map((p: any) => p.id);
        const personName = uniquePeople.length > 0 ? uniquePeople.map((p: any) => personDisplayName(p)).join(', ') : r.film_title;

        let charName = isActingCategory && uniquePeople.length > 0 ? uniquePeople[0].role : undefined;
        let jobRole = !isActingCategory && uniquePeople.length > 0 ? uniquePeople[0].role : undefined;

        const filmIds = r.performances.map((p: any) => p.film_id);
        const peopleNames: string[] = [];
        for (const p of uniquePeople) {
            peopleNames.push(p.name);
            if (p.isInverted && p.lastName) {
                const first = p.name.replace(p.lastName, '').trim();
                peopleNames.push(`${first} ${p.lastName}`);
            }
        }
        const badges = computeBadgesFromBatch(externalBatch, filmIds, peopleIds, categoryName, rpMappings, r.song_title, peopleNames, r.year);

        // For acting: always include performances and compute per-film badges so
        // the UI can clearly associate each badge with the correct film.
        const actingPerformances = isActingCategory && r.performances
            ? r.performances.map((perf: any) => ({
                ...perf,
                badges: computeBadgesFromBatch(externalBatch, [perf.film_id], peopleIds, categoryName, rpMappings, undefined, peopleNames, r.year)
            }))
            : undefined;

        const nom: Nominee = {
            name: personName,
            lastName: uniquePeople.length > 0 ? uniquePeople[0].lastName : undefined,
            isInverted: uniquePeople.length > 0 ? uniquePeople[0].isInverted : undefined,
            film: r.film_title,
            film_id: r.film_id,
            character: charName,
            role: jobRole,
            songTitle: r.song_title,
            adaptedSource: r.notes,
            // For acting, badges are now on each individual performance
            otherOtherAwards: isActingCategory ? undefined : (Object.keys(badges).length > 0 ? badges : undefined),
            isWinner: r.win,
            hasRichPick: true,
            contributors: uniquePeople.length > 0 ? uniquePeople : undefined,
            performances: actingPerformances
        };

        if (r.win) {
            yd.winner = { ...nom, isWinner: true };
        } else {
            yd.nominees.push(nom);
        }
    }

    // Attach per-year popover contexts so the UI can render interactive badges.
    for (const [yr, yd] of yearMap) {
        yd.awardContexts = buildAwardContextsFromBatch(externalBatch, categoryName, rpMappings, yr);
    }

    // Build guild-only nominees (films/people nominated by other orgs but not Rich Picks).
    {
        const rpCoveredFilms = new Map<number, Set<number>>();
        const rpCoveredPeople = new Map<number, Set<number>>();
        for (const [yr, yd] of yearMap) {
            const films = new Set<number>();
            const people = new Set<number>();
            for (const nom of [...(yd.winner ? [yd.winner] : []), ...yd.nominees]) {
                if (nom.film_id) films.add(nom.film_id);
                if (nom.contributors) {
                    for (const c of nom.contributors) { if (c.id) people.add(c.id); }
                }
            }
            rpCoveredFilms.set(yr, films);
            rpCoveredPeople.set(yr, people);
        }

        type ExtGroup = {
            year: number; film_id: number; film_title: string;
            people: Map<number, string>; win: boolean; songTitle?: string;
        };
        const extGroupMap = new Map<string, ExtGroup>();

        for (const r of externalBatch) {
            if (!r.year) continue;
            if (r.other_canonical_id == null) continue;
            if (!rpMappings.has(r.other_canonical_id)) continue;
            if (!yearMap.has(r.year)) continue;

            const covered = isActingCategory && r.person_id
                ? (rpCoveredPeople.get(r.year)?.has(r.person_id) ?? false)
                : (rpCoveredFilms.get(r.year)?.has(r.film_id) ?? false);
            if (covered) continue;

            let groupKey: string;
            if (isActingCategory) {
                groupKey = `${r.year}_person_${r.person_id ?? r.other_person_name ?? r.film_id}`;
            } else if (isSong && r.other_song_title) {
                groupKey = `${r.year}_film_${r.film_id}_song_${r.other_song_title}`;
            } else {
                groupKey = `${r.year}_film_${r.film_id}`;
            }

            if (!extGroupMap.has(groupKey)) {
                extGroupMap.set(groupKey, {
                    year: r.year, film_id: r.film_id, film_title: r.film_title,
                    people: new Map(), win: false, songTitle: r.other_song_title ?? undefined,
                });
            }
            const entry = extGroupMap.get(groupKey)!;
            if (r.person_id && r.other_person_name) entry.people.set(r.person_id, r.other_person_name);
            if (r.win) entry.win = true;
        }

        for (const entry of extGroupMap.values()) {
            const yd = yearMap.get(entry.year)!;
            const peopleArr: NomineeContributor[] = Array.from(entry.people.entries()).map(([id, name]) => ({ id, name }));
            const peopleIds = peopleArr.map(p => p.id as number);
            const badges = computeBadgesFromBatch(
                externalBatch, [entry.film_id], peopleIds, categoryName,
                rpMappings, entry.songTitle, peopleArr.map(p => p.name), entry.year,
            );
            const nom: Nominee = {
                name: peopleArr.length > 0 ? peopleArr.map(p => p.name).join(', ') : entry.film_title,
                film: entry.film_title,
                film_id: entry.film_id,
                hasRichPick: false,
                isWinner: false,
                contributors: peopleArr.length > 0 ? peopleArr : undefined,
                otherOtherAwards: Object.keys(badges).length > 0 ? badges : undefined,
                songTitle: entry.songTitle,
            };
            if (!yd.guildOnlyNominees) yd.guildOnlyNominees = [];
            yd.guildOnlyNominees.push(nom);
        }

        // Sort guild nominees alphabetically by film title within each year
        for (const yd of yearMap.values()) {
            yd.guildOnlyNominees?.sort((a, b) => a.film.localeCompare(b.film));
        }
    }

    return Array.from(yearMap.values()).sort((a, b) => b.year - a.year);
}

export async function getCategoriesForYear(year: number): Promise<Category[]> {
    // PERF: Run the Rich Picks query and the external awards batch-fetch in parallel.
    const [richRes, externalBatch] = await Promise.all([
        query(`
            SELECT
                cat.name as category_name,
                n.win,
                n.nomination_id,
                n.notes,
                f.film_id,
                f.title AS film_title,
                json_agg(json_build_object('id', p.person_id, 'name', p.name, 'nickname', p.nickname, 'lastName', p.last_name, 'isInverted', p.is_inverted_name, 'role', r.role_name)) FILTER (WHERE p.person_id IS NOT NULL) AS people,
                (SELECT title FROM songs cs JOIN nomination_songs ns ON cs.song_id=ns.song_id WHERE ns.nomination_id = n.nomination_id LIMIT 1) as song_title
            FROM nominations n
            JOIN ceremonies c USING (ceremony_id)
            JOIN categories cat USING (category_id)
            JOIN awards a ON c.award_id = a.award_id
            JOIN organizations o ON a.organization_id = o.organization_id
            JOIN films f USING (film_id)
            LEFT JOIN nomination_people np USING (nomination_id)
            LEFT JOIN people p ON np.person_id = p.person_id
            LEFT JOIN roles r ON np.role_id = r.role_id
            WHERE o.short_name = 'Rich Picks' AND c.year = $1
            GROUP BY cat.name, n.win, n.nomination_id, n.notes, f.film_id, f.title
        `, [year]),
        getExternalAwardsForYears([year - 1, year, year + 1])
    ]);

    const res = richRes;

    // Fetch rpMappings for all distinct RP categories in a single query.
    const distinctCatNames = [...new Set(res.rows.map((r: any) => r.category_name as string))];
    const catMappings = await getRPCategoryMappingsBatch(distinctCatNames);

    const catMap = new Map<string, Category>();

    const groupedRows = new Map<string, any>();
    for (const r of res.rows) {
        const catName = r.category_name;
        const isActingCategory = catName.toLowerCase().includes("actor") || catName.toLowerCase().includes("actress");
        const isSong = catName === "Original Song";

        let nomKey;
        const personId = r.people && r.people.length > 0 ? r.people[0].id : `nom_${r.nomination_id}`;
        if (isActingCategory) nomKey = `person_${personId}`;
        else if (isSong) nomKey = `film_${r.film_id}_song_${r.song_title}`;
        else nomKey = `film_${r.film_id}`;

        const fullKey = `${catName}_${nomKey}`;
        if (!groupedRows.has(fullKey)) {
            groupedRows.set(fullKey, {
                ...r,
                all_people: r.people || [],
                performances: [{ film: r.film_title, character: r.people && r.people.length > 0 ? r.people[0].role : null, film_id: r.film_id, nomination_id: r.nomination_id }]
            });
        } else {
            const existing = groupedRows.get(fullKey);
            if (r.people) existing.all_people.push(...r.people);
            if (r.win) existing.win = true;
            if (r.notes && !existing.notes) existing.notes = r.notes;
            existing.performances.push({ film: r.film_title, character: r.people && r.people.length > 0 ? r.people[0].role : null, film_id: r.film_id, nomination_id: r.nomination_id });
        }
    }

    for (const r of Array.from(groupedRows.values())) {
        const catName = r.category_name;
        if (!catMap.has(catName)) {
            catMap.set(catName, {
                name: catName,
                slug: slugify(catName),
                icon: CATEGORY_ICON_MAPPING[catName] || "trophy",
                group: CATEGORY_GROUPS_MAPPING[catName] || "film",
                winner: null,
                nominees: []
            });
        }
        const cat = catMap.get(catName)!;

        const isActingCategory = catName.toLowerCase().includes("actor") || catName.toLowerCase().includes("actress");
        const people = r.all_people || [];

        const uniquePeopleMap = new Map<number, any>();
        for (const p of people) {
            if (p) uniquePeopleMap.set(p.id, p);
        }
        const uniquePeople = Array.from(uniquePeopleMap.values());

        const peopleIds = uniquePeople.map((p: any) => p.id);
        const personName = uniquePeople.length > 0 ? uniquePeople.map((p: any) => personDisplayName(p)).join(', ') : r.film_title;

        const filmIds = r.performances.map((p: any) => p.film_id);
        const peopleNames: string[] = [];
        for (const p of uniquePeople) {
            peopleNames.push(p.name);
            if (p.isInverted && p.lastName) {
                const first = p.name.replace(p.lastName, '').trim();
                peopleNames.push(`${first} ${p.lastName}`);
            }
        }
        const badges = computeBadgesFromBatch(externalBatch, filmIds, peopleIds, catName, (catMappings.get(catName) || new Map()), r.song_title, peopleNames, year);

        // For acting: always include performances with per-film badges
        const actingPerformances = isActingCategory && r.performances
            ? r.performances.map((perf: any) => ({
                ...perf,
                badges: computeBadgesFromBatch(externalBatch, [perf.film_id], peopleIds, catName, (catMappings.get(catName) || new Map()), undefined, peopleNames, year)
            }))
            : undefined;

        // For Sound categories, mark which contributors appear in Oscar/BAFTA nominations
        const isSoundCategory = catName === 'Sound Mixing' || catName === 'Sound Editing' || catName.includes('Sound ');
        let enrichedContributors = uniquePeople.length > 0 ? uniquePeople : undefined;
        if (isSoundCategory && enrichedContributors) {
            const oscarBaftaNames = new Set<string>();
            for (const er of externalBatch) {
                if (er.film_id !== r.film_id) continue;
                if (er.short_name !== 'Oscars' && er.short_name !== 'BAFTA') continue;
                // Check if this external row's category maps to the same RP Sound category
                if (er.other_canonical_id != null) {
                    const strength = catMappings.get(catName)?.get(er.other_canonical_id);
                    if (strength && er.other_person_name) {
                        oscarBaftaNames.add(er.other_person_name.toLowerCase());
                    }
                }
            }
            enrichedContributors = enrichedContributors.map(p => ({
                ...p,
                isOscarBaftaName: oscarBaftaNames.has(p.name?.toLowerCase())
            }));
        }

        const nom: Nominee = {
            name: personName,
            film: r.film_title,
            film_id: r.film_id,
            character: isActingCategory && uniquePeople.length > 0 ? uniquePeople[0].role : undefined,
            songTitle: r.song_title,
            adaptedSource: r.notes,
            role: !isActingCategory && uniquePeople.length > 0 ? uniquePeople[0].role : undefined,
            // For acting, badges are now on each individual performance
            otherOtherAwards: isActingCategory ? undefined : (Object.keys(badges).length > 0 ? badges : undefined),
            isWinner: r.win,
            contributors: enrichedContributors,
            performances: actingPerformances
        };

        if (r.win) {
            cat.winner = { ...nom, isWinner: true };
        } else {
            cat.nominees.push(nom);
        }
    }

    // Attach popover context for each category
    for (const [catName, cat] of catMap) {
        cat.awardContexts = buildAwardContextsFromBatch(externalBatch, catName, (catMappings.get(catName) || new Map()), year);
    }

    return Array.from(catMap.values());
}

export async function getTopNomineesForCategory(categoryName: string): Promise<HallOfFameEntry[]> {
    const res = await query(`
        SELECT 
            COALESCE(p.name, f.title) AS name,
            p.last_name,
            COUNT(DISTINCT c.year) AS nominations,
            COUNT(DISTINCT CASE WHEN n.win THEN c.year END) AS wins
        FROM nominations n
        JOIN ceremonies c USING (ceremony_id)
        JOIN categories cat USING (category_id)
        JOIN awards a ON c.award_id = a.award_id
        JOIN organizations o ON a.organization_id = o.organization_id
        JOIN films f USING (film_id)
        LEFT JOIN nomination_people np USING (nomination_id)
        LEFT JOIN people p ON np.person_id = p.person_id
        WHERE o.short_name = 'Rich Picks' AND cat.name = $1
        GROUP BY COALESCE(p.name, f.title), p.last_name, p.person_id
        HAVING COUNT(DISTINCT c.year) > 1
        ORDER BY wins DESC, nominations DESC, COALESCE(p.last_name, COALESCE(p.name, f.title)) ASC
        LIMIT 15
    `, [categoryName]);

    return res.rows.map((r: any) => ({
        name: r.name,
        wins: parseInt(r.wins),
        nominations: parseInt(r.nominations)
    }));
}

export async function getAllRichPicksStats(): Promise<Record<number, Record<string, { wins: number, noms: number }>>> {
    const res = await query(`
        SELECT
            c.year,
            f.title,
            COUNT(DISTINCT (n.ceremony_id, n.category_id, n.film_id)) AS noms,
            COUNT(DISTINCT CASE WHEN n.win THEN (n.ceremony_id, n.category_id, n.film_id) END) AS wins
        FROM nominations n
        JOIN ceremonies c USING (ceremony_id)
        JOIN awards a ON c.award_id = a.award_id
        JOIN organizations o ON a.organization_id = o.organization_id
        JOIN films f USING (film_id)
        WHERE o.short_name = 'Rich Picks'
        GROUP BY c.year, f.title
    `);

    const stats: Record<number, Record<string, { wins: number, noms: number }>> = {};
    for (const row of res.rows) {
        if (!stats[row.year]) stats[row.year] = {};
        stats[row.year][row.title] = {
            wins: parseInt(row.wins || "0", 10),
            noms: parseInt(row.noms || "0", 10)
        };
    }
    return stats;
}

/**
 * Returns a lookup map: `"${release_year}|${title.toLowerCase()}"` → film_id.
 * Used to generate /film/[id] links from title+year data in films.json.
 */
export async function getFilmIdMap(): Promise<Record<string, number>> {
    const res = await query(`SELECT film_id, release_year, title FROM films WHERE release_year IS NOT NULL`);
    const map: Record<string, number> = {};
    for (const row of res.rows) {
        const key = `${row.release_year}|${(row.title as string).toLowerCase()}`;
        map[key] = row.film_id;
    }
    return map;
}

const gradeValues: Record<string, number> = {
    "A+": 15, "A": 14, "A-": 13,
    "B+": 12, "B": 11, "B-": 10,
    "C+": 9, "C": 8, "C-": 7,
    "D+": 6, "D": 5, "D-": 4,
    "F": 3
};

export function getGradeValue(grade: string): number {
    if (!grade || grade === "-") return 0;
    if (grade.includes("//")) {
        const parts = grade.split("//").map(p => p.trim());
        const sum = (gradeValues[parts[0]] || 0) + (gradeValues[parts[1]] || 0);
        return sum / 2;
    }
    return gradeValues[grade.trim()] || 0;
}

/**
 * For years before Rich Picks began (pre-2005), build a Category[] using the
 * same shape as getCategoriesForYear but populated from external award orgs.
 * Each canonical RP category gets one row per film/person (deduplicated across
 * orgs) with OtherAwards badges indicating which orgs nominated or awarded them.
 */
export async function getPreRPCategoriesForYear(year: number): Promise<Category[]> {
    const canonicalNames = Object.keys(CATEGORY_DESCRIPTIONS);
    const [externalBatch, rpMappingsBatch] = await Promise.all([
        getExternalAwardsForYears([year - 1, year, year + 1]),
        getRPCategoryMappingsBatch(canonicalNames),
    ]);

    const categories: Category[] = [];

    for (const catName of canonicalNames) {
        const rpMappings = rpMappingsBatch.get(catName) ?? new Map();
        if (rpMappings.size === 0) continue;

        const isActingCat = catName.toLowerCase().includes('actor') || catName.toLowerCase().includes('actress');
        const isSong = catName === 'Original Song';
        const catNameLower = catName.toLowerCase();

        // Filter to rows relevant to this RP category, excluding noise categories
        // Include rows from scopeYear and adjacent years; only 'exact' mapping from the
        // current year is used to build the nominee list, but adjacent-year rows are
        // included so computeBadgesFromBatch can produce slant badges for them.
        const relevantRows = externalBatch.filter(r => {
            if (r.other_canonical_id == null) return false;
            if (rpMappings.get(r.other_canonical_id) !== 'exact') return false;
            // Only include rows from the scope year for building the nominee list
            if (r.year != null && r.year !== year) return false;
            const rawCatLower = r.other_category_name.toLowerCase();
            if (catNameLower.includes('animated') && rawCatLower.includes('short')) return false;
            if (isActingCat && (rawCatLower.includes('cast') || rawCatLower.includes('casting'))) return false;
            return true;
        });

        if (relevantRows.length === 0) continue;

        // Group by film or person, collecting contributors and (for acting) per-film entries
        type GroupEntry = {
            film_id: number;
            film_title: string;
            people: Map<number, { name: string; role?: string }>;  // person_id → { name, role }
            actingFilms: Map<number, string>;  // film_id → title (acting only)
            songTitle?: string;
        };
        const groupMap = new Map<string, GroupEntry>();

        for (const r of relevantRows) {
            let key: string;
            if (isActingCat && r.person_id != null) {
                key = `person_${r.person_id}`;
            } else if (isSong && r.other_song_title) {
                key = `film_${r.film_id}_song_${r.other_song_title}`;
            } else {
                key = `film_${r.film_id}`;
            }

            if (!groupMap.has(key)) {
                groupMap.set(key, {
                    film_id: r.film_id,
                    film_title: r.film_title,
                    people: new Map(),
                    actingFilms: new Map(),
                    songTitle: r.other_song_title ?? undefined,
                });
            }
            const entry = groupMap.get(key)!;
            if (r.person_id && r.other_person_name) {
                // Infer contributor role from the org category name so NomineeRow labels correctly
                const roleLower = r.other_category_name.toLowerCase();
                const role = roleLower.includes('cast') ? 'Cast' : undefined;
                entry.people.set(r.person_id, { name: r.other_person_name, role });
            }
            if (isActingCat && r.person_id != null) {
                entry.actingFilms.set(r.film_id, r.film_title);
            }
        }

        const nominees: Nominee[] = [];

        for (const [, entry] of groupMap) {
            const peopleArr: NomineeContributor[] = Array.from(entry.people.entries())
                .map(([id, p]) => ({ id, name: p.name, role: p.role }));
            const peopleIds = peopleArr.map(p => p.id as number);
            const peopleNames = peopleArr.map(p => p.name);

            if (isActingCat) {
                // Per-film performances with per-film badge sets (no character info available)
                const performances = Array.from(entry.actingFilms.entries()).map(([film_id, film]) => ({
                    film,
                    film_id,
                    nomination_id: 0,
                    badges: computeBadgesFromBatch(
                        externalBatch, [film_id], peopleIds, catName, rpMappings, undefined, peopleNames, year,
                    ),
                }));
                nominees.push({
                    name: peopleArr[0]?.name ?? entry.film_title,
                    film: entry.film_title,
                    film_id: entry.film_id,
                    contributors: peopleArr.length > 0 ? peopleArr : undefined,
                    performances,
                    isWinner: false,
                });
            } else {
                const badges = computeBadgesFromBatch(
                    externalBatch, [entry.film_id], peopleIds, catName, rpMappings,
                    entry.songTitle, peopleNames, year,
                );
                nominees.push({
                    name: peopleArr.length > 0 ? peopleArr.map(p => p.name).join(', ') : entry.film_title,
                    film: entry.film_title,
                    film_id: entry.film_id,
                    contributors: peopleArr.length > 0 ? peopleArr : undefined,
                    songTitle: entry.songTitle,
                    otherOtherAwards: Object.keys(badges).length > 0 ? badges : undefined,
                    isWinner: false,
                });
            }
        }

        // Sort: most wins across any org first, then most nominations, then alphabetical
        nominees.sort((a, b) => {
            const stats = (nom: Nominee) => {
                let wins = 0, noms = 0;
                if (nom.performances) {
                    for (const perf of nom.performances) {
                        for (const v of Object.values(perf.badges ?? {})) {
                            if (v === 'won' || v === 'won_slant') wins++;
                            if (v != null) noms++;
                        }
                    }
                } else {
                    for (const v of Object.values(nom.otherOtherAwards ?? {})) {
                        if (v === 'won' || v === 'won_slant') wins++;
                        if (v != null) noms++;
                    }
                }
                return { wins, noms };
            };
            const as = stats(a), bs = stats(b);
            if (bs.wins !== as.wins) return bs.wins - as.wins;
            if (bs.noms !== as.noms) return bs.noms - as.noms;
            return a.film.localeCompare(b.film);
        });

        categories.push({
            name: catName,
            icon: CATEGORY_ICON_MAPPING[catName] || 'trophy',
            group: CATEGORY_GROUPS_MAPPING[catName] || 'film',
            winner: null,
            nominees,
            awardContexts: buildAwardContextsFromBatch(externalBatch, catName, rpMappings, year),
        });
    }

    return categories;
}

export async function getYearsWithDBReviews(): Promise<number[]> {
    const currentYear = new Date().getFullYear();
    const res = await query(
        `SELECT DISTINCT f.release_year
         FROM reviews r
         JOIN films f ON f.film_id = r.film_id
         WHERE r.grade IS NOT NULL AND r.grade != ''
           AND f.release_year <= $1
         ORDER BY f.release_year DESC`,
        [currentYear]
    );
    return res.rows.map((r: any) => r.release_year as number);
}

export async function getTopFilmPerYear(): Promise<Array<{ year: number; title: string }>> {
    const res = await query(`
        WITH FilmNoms AS (
            SELECT c.year, f.title, COUNT(*) as noms
            FROM nominations n
            JOIN ceremonies c USING (ceremony_id)
            JOIN films f USING (film_id)
            GROUP BY c.year, f.title
        ),
        RankedFilms AS (
            SELECT year, title,
                   ROW_NUMBER() OVER (PARTITION BY year ORDER BY noms DESC, title ASC) as rn
            FROM FilmNoms
        )
        SELECT year, title FROM RankedFilms WHERE rn = 1
        ORDER BY year DESC
    `);
    return res.rows;
}

export async function getFilmIdsForStaticBuild(): Promise<number[]> {
    const res = await query(`
        SELECT film_id FROM (
            -- All films from 2005 onward (Rich Picks era)
            SELECT DISTINCT film_id FROM films WHERE release_year >= 2005
            UNION
            -- Top 20 most-nominated films per year before 2005
            SELECT film_id FROM (
                SELECT f.film_id,
                    ROW_NUMBER() OVER (PARTITION BY f.release_year ORDER BY COUNT(*) DESC) AS rn
                FROM films f
                JOIN nominations n USING (film_id)
                WHERE f.release_year < 2005
                GROUP BY f.film_id, f.release_year
            ) ranked
            WHERE rn <= 20
        ) all_films
        ORDER BY film_id
    `);
    return res.rows.map((r: { film_id: number }) => r.film_id);
}

export async function getPersonIdsForStaticBuild(): Promise<number[]> {
    const res = await query(`
        SELECT person_id FROM (
            -- All people linked to films from 2005 onward
            SELECT DISTINCT np.person_id
            FROM nomination_people np
            JOIN nominations n USING (nomination_id)
            JOIN ceremonies c USING (ceremony_id)
            WHERE c.year >= 2005
            UNION
            -- People nominated at Oscar or BAFTA before 2005
            SELECT DISTINCT np.person_id
            FROM nomination_people np
            JOIN nominations n USING (nomination_id)
            JOIN ceremonies c USING (ceremony_id)
            JOIN awards a USING (award_id)
            JOIN organizations o USING (organization_id)
            WHERE c.year < 2005
              AND o.short_name IN ('Oscar', 'BAFTA')
        ) all_people
        ORDER BY person_id
    `);
    return res.rows.map((r: { person_id: number }) => r.person_id);
}

export async function getDBFilmsForDisplay(): Promise<Array<{ release_year: number; title: string; grade: string; film_id: number }>> {
    const currentYear = new Date().getFullYear();
    const res = await query(
        `SELECT f.release_year, f.title, r.grade, f.film_id
         FROM reviews r
         JOIN films f ON f.film_id = r.film_id
         WHERE r.grade IS NOT NULL AND r.grade != ''
           AND f.release_year <= $1`,
        [currentYear]
    );
    return res.rows;
}
