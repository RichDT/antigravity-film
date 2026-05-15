/**
 * migrateCategoryMappings.ts
 *
 * Phase 3 of the canonical categories migration.
 * Creates and populates the category_mappings table:
 *   rp_canonical_id  ← canonical_category_id from Rich Picks org
 *   other_canonical_id ← canonical_category_id from any other org
 *   match_type       ← 'exact' | 'slant'
 *
 * 'exact'  — open competition equivalent (same craft, unrestricted eligibility)
 * 'slant'  — same craft but restricted/subsidiary category (nationality, independence tier, etc.)
 *            or cross-tier acting match (leading↔supporting)
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

// ─── Mapping definitions ──────────────────────────────────────────────────────
// [RP canonical name, external org short_name, external canonical name, match_type]
type MappingDef = [string, string, string, 'exact' | 'slant'];

const MAPPINGS: MappingDef[] = [

    // ── Actor in a Leading Role ────────────────────────────────────────────
    ['Actor in a Leading Role',     'NBR',     'Best Actor',                           'exact'],
    ['Actor in a Leading Role',     'Oscars',  'Actor in a Leading Role',              'exact'],
    ['Actor in a Leading Role',     'Globes',  'Actor in a Motion Picture \u2013 Drama',          'exact'],
    ['Actor in a Leading Role',     'Globes',  'Actor in a Motion Picture \u2013 Musical or Comedy', 'exact'],
    ['Actor in a Leading Role',     'BAFTA',   'Actor in a Leading Role',              'exact'],
    ['Actor in a Leading Role',     'SAG',     'Male Actor in a Leading Role',         'exact'],
    // Supporting acting cross-tier → slant
    ['Actor in a Leading Role',     'Oscars',  'Actor in a Supporting Role',           'slant'],
    ['Actor in a Leading Role',     'Globes',  'Supporting Actor in a Motion Picture', 'slant'],
    ['Actor in a Leading Role',     'BAFTA',   'Actor in a Supporting Role',           'slant'],
    ['Actor in a Leading Role',     'SAG',     'Male Actor in a Supporting Role',      'slant'],

    // ── Actor in a Supporting Role ─────────────────────────────────────────
    ['Actor in a Supporting Role',  'NBR',     'Best Supporting Actor',                'exact'],
    ['Actor in a Supporting Role',  'Oscars',  'Actor in a Supporting Role',           'exact'],
    ['Actor in a Supporting Role',  'Globes',  'Supporting Actor in a Motion Picture', 'exact'],
    ['Actor in a Supporting Role',  'BAFTA',   'Actor in a Supporting Role',           'exact'],
    ['Actor in a Supporting Role',  'SAG',     'Male Actor in a Supporting Role',      'exact'],
    // Leading acting cross-tier → slant
    ['Actor in a Supporting Role',  'Oscars',  'Actor in a Leading Role',              'slant'],
    ['Actor in a Supporting Role',  'Globes',  'Actor in a Motion Picture \u2013 Drama',          'slant'],
    ['Actor in a Supporting Role',  'Globes',  'Actor in a Motion Picture \u2013 Musical or Comedy', 'slant'],
    ['Actor in a Supporting Role',  'BAFTA',   'Actor in a Leading Role',              'slant'],
    ['Actor in a Supporting Role',  'SAG',     'Male Actor in a Leading Role',         'slant'],

    // ── Actress in a Leading Role ──────────────────────────────────────────
    ['Actress in a Leading Role',   'NBR',     'Best Actress',                         'exact'],
    ['Actress in a Leading Role',   'Oscars',  'Actress in a Leading Role',            'exact'],
    ['Actress in a Leading Role',   'Globes',  'Actress in a Motion Picture \u2013 Drama',        'exact'],
    ['Actress in a Leading Role',   'Globes',  'Actress in a Motion Picture \u2013 Musical or Comedy', 'exact'],
    ['Actress in a Leading Role',   'BAFTA',   'Actress in a Leading Role',            'exact'],
    ['Actress in a Leading Role',   'SAG',     'Female Actor in a Leading Role',       'exact'],
    // Supporting cross-tier → slant
    ['Actress in a Leading Role',   'Oscars',  'Actress in a Supporting Role',         'slant'],
    ['Actress in a Leading Role',   'Globes',  'Supporting Actress in a Motion Picture', 'slant'],
    ['Actress in a Leading Role',   'BAFTA',   'Actress in a Supporting Role',         'slant'],
    ['Actress in a Leading Role',   'SAG',     'Female Actor in a Supporting Role',    'slant'],

    // ── Actress in a Supporting Role ───────────────────────────────────────
    ['Actress in a Supporting Role', 'NBR',    'Best Supporting Actress',              'exact'],
    ['Actress in a Supporting Role', 'Oscars', 'Actress in a Supporting Role',         'exact'],
    ['Actress in a Supporting Role', 'Globes', 'Supporting Actress in a Motion Picture', 'exact'],
    ['Actress in a Supporting Role', 'BAFTA',  'Actress in a Supporting Role',         'exact'],
    ['Actress in a Supporting Role', 'SAG',    'Female Actor in a Supporting Role',    'exact'],
    // Leading cross-tier → slant
    ['Actress in a Supporting Role', 'Oscars', 'Actress in a Leading Role',            'slant'],
    ['Actress in a Supporting Role', 'Globes', 'Actress in a Motion Picture \u2013 Drama',        'slant'],
    ['Actress in a Supporting Role', 'Globes', 'Actress in a Motion Picture \u2013 Musical or Comedy', 'slant'],
    ['Actress in a Supporting Role', 'BAFTA',  'Actress in a Leading Role',            'slant'],
    ['Actress in a Supporting Role', 'SAG',    'Female Actor in a Leading Role',       'slant'],

    // ── Animated Feature ───────────────────────────────────────
    ['Animated Feature', 'NBR',    'Best Animated Feature',               'exact'],
    ['Animated Feature', 'Oscars', 'Animated Feature Film',               'exact'],
    ['Animated Feature', 'Globes', 'Motion Picture \u2013 Animated',                'exact'],
    ['Animated Feature', 'BAFTA',  'Animated Film',                       'exact'],
    ['Animated Feature', 'Annie',  'Animated Feature',                    'exact'],
    ['Animated Feature', 'Annie',  'Animated Feature \u2014 Independent',           'slant'],
    ['Animated Feature', 'PGA',    'Animated',                            'exact'],

    // ── Animated Short ────────────────────────────────────────────────
    ['Animated Short',          'Oscars', 'Animated Short Film',            'exact'],
    ['Animated Short',          'BAFTA',  'Short Animation',                     'exact'],
    ['Animated Short',          'Annie',  'Animated Short Subject',              'exact'],

    // ── Art Direction ──────────────────────────────────────────────────────
    ['Art Direction',                'Oscars', 'Production Design',                   'exact'],
    ['Art Direction',                'BAFTA',  'Production Design',                   'exact'],
    ['Art Direction',                'ADG',    'Contemporary Film',                   'exact'],
    ['Art Direction',                'ADG',    'Fantasy Film',                        'exact'],
    ['Art Direction',                'ADG',    'Period Film',                         'exact'],
    ['Art Direction',                'ADG',    'Animated Film',                       'exact'],

    // ── Cinematography ─────────────────────────────────────────────────────
    ['Cinematography',               'NBR',   'Outstanding Achievement in Cinematography', 'exact'],
    ['Cinematography',               'Oscars', 'Cinematography',                      'exact'],
    ['Cinematography',               'BAFTA',  'Cinematography',                      'exact'],
    ['Cinematography',               'ASC',    'Achievement in Cinematography in Theatrical Releases', 'exact'],

    // ── Costuming ──────────────────────────────────────────────────────────
    ['Costuming',                    'Oscars', 'Costume Design',                      'exact'],
    ['Costuming',                    'BAFTA',  'Costume Design',                      'exact'],
    ['Costuming',                    'CDG',    'Contemporary Film',                   'exact'],
    ['Costuming',                    'CDG',    'Period Film',                         'exact'],
    ['Costuming',                    'CDG',    'Sci-Fi/Fantasy Film',                 'exact'],

    // ── Directing ──────────────────────────────────────────────────────────
    ['Directing',                    'NBR',    'Best Director',                       'exact'],
    // First-time director awards are subsidiary/restricted categories → slant
    ['Directing',                    'NBR',    'Best Directorial Debut',              'slant'],
    ['Directing',                    'Oscars', 'Directing',                           'exact'],
    ['Directing',                    'Globes', 'Director \u2013 Motion Picture',               'exact'],
    ['Directing',                    'BAFTA',  'Director',                            'exact'],
    ['Directing',                    'DGA',    'Feature Film',                        'exact'],
    ['Directing',                    'DGA',    'First-Time Feature Film',             'slant'],

    // ── Documentary ───────────────────────────────────────────────────
    // Craft-specific awards (editing, sound) belong to those craft categories, not here.
    // WGA Documentary Screenplay has no RP equivalent.
    ['Documentary',             'NBR',    'Best Documentary',                    'exact'],
    ['Documentary',             'Oscars', 'Documentary Feature Film',            'exact'],
    ['Documentary',             'BAFTA',  'Documentary',                         'exact'],
    ['Documentary',             'PGA',    'Documentary',                         'exact'],
    ['Documentary',             'DGA',    'Documentaries',                       'exact'],

    // ── Editing ────────────────────────────────────────────────────────────
    ['Editing',                      'Oscars', 'Editing',                             'exact'],
    ['Editing',                      'BAFTA',  'Editing',                             'exact'],
    ['Editing',                      'ACE',    'Edited Feature Film \u2013 Dramatic',          'exact'],
    ['Editing',                      'ACE',    'Edited Feature Film \u2013 Comedy or Musical', 'exact'],
    ['Editing',                      'ACE',    'Edited Documentary \u2013 Feature',            'exact'],

    // ── Effects ────────────────────────────────────────────────────────────
    ['Effects',                      'Oscars', 'Visual Effects',                      'exact'],
    ['Effects',                      'BAFTA',  'Special Visual Effects',              'exact'],
    // VES: only the three open-competition feature-wide awards are exact matches;
    // all craft-specific/subsidiary VES categories are slant
    ['Effects',                      'VES',    'Visual Effects in a Photoreal Feature',             'exact'],
    ['Effects',                      'VES',    'Supporting Visual Effects in a Photoreal Feature',  'exact'],
    ['Effects',                      'VES',    'Special Effects in a Feature Motion Picture',       'exact'],
    ['Effects',                      'VES',    'Compositing and Lighting in a Feature',             'slant'],
    ['Effects',                      'VES',    'Animated Character in a Photoreal Feature',         'slant'],
    ['Effects',                      'VES',    'Animated Character in an Animated Feature',         'slant'],
    ['Effects',                      'VES',    'Animation in an Animated Feature',                  'slant'],
    ['Effects',                      'VES',    'Created Environment in a Photoreal Feature',        'slant'],
    ['Effects',                      'VES',    'Created Environment in an Animated Feature',        'slant'],
    ['Effects',                      'VES',    'Effects Simulations in a Photoreal Feature',        'slant'],
    ['Effects',                      'VES',    'Effects Simulations in an Animated Feature',        'slant'],
    ['Effects',                      'VES',    'Model in a Photoreal or Animated Project',          'slant'],
    ['Effects',                      'VES',    'Virtual Cinematography in a CG Project',            'slant'],
    ['Effects',                      'VES',    'Single Visual Effect of the Year',                  'slant'],

    // ── International Feature ─────────────────────────────────
    // Covers what was previously split between "Foreign Film" and "International
    // Feature" RP categories; merged into a single canonical.
    // (The Oscar "Sound" pre/post-2020 situation is handled at the
    // category_canonical_map level via dual-mapping — no extra entry needed here.)
    ['International Feature', 'NBR',    'Best International Film',                           'exact'],
    ['International Feature', 'Oscars', 'International Feature Film',                        'exact'],
    ['International Feature', 'Globes', 'Motion Picture \u2013 Foreign/Non-English Language', 'exact'],
    ['International Feature', 'BAFTA',  'Film Not in the English Language',                  'exact'],

    // ── Live-Action Feature ────────────────────────────────────
    ['Live-Action Feature', 'NBR',    'Best Film',                       'exact'],
    ['Live-Action Feature', 'NBR',    'Top 10 Independent Films',        'slant'],
    ['Live-Action Feature', 'Oscars', 'Picture',                         'exact'],
    ['Live-Action Feature', 'Globes', 'Motion Picture \u2013 Drama',              'exact'],
    ['Live-Action Feature', 'Globes', 'Motion Picture \u2013 Musical or Comedy',  'exact'],
    ['Live-Action Feature', 'BAFTA',  'Film',                            'exact'],
    ['Live-Action Feature', 'BAFTA',  'British Film',                    'slant'],
    ['Live-Action Feature', 'BAFTA',  'Children\'s & Family Film',       'slant'],
    ['Live-Action Feature', 'PGA',    'Live-Action',                     'exact'],
    ['Live-Action Feature', 'SAG',    'Cast In A Motion Picture',        'exact'],

    // ── Live-Action Short ─────────────────────────────────────────────
    ['Live-Action Short',       'Oscars', 'Live-Action Short Film',         'exact'],
    ['Live-Action Short',       'BAFTA',  'Short Film',                          'exact'],

    // ── Make-Up & Hairstyling ──────────────────────────────────────────────
    ['Make-Up & Hairstyling',        'Oscars', 'Makeup and Hairstyling',              'exact'],
    ['Make-Up & Hairstyling',        'BAFTA',  'Make Up & Hair',                     'exact'],
    ['Make-Up & Hairstyling',        'MUAH',   'Contemporary Make-Up',               'exact'],
    ['Make-Up & Hairstyling',        'MUAH',   'Contemporary Hair Styling',          'exact'],
    ['Make-Up & Hairstyling',        'MUAH',   'Period and/or Character Make-Up',    'exact'],
    ['Make-Up & Hairstyling',        'MUAH',   'Period and/or Character Hair Styling','exact'],
    ['Make-Up & Hairstyling',        'MUAH',   'Period Hair Styling and/or Character Hair Styling', 'exact'],
    ['Make-Up & Hairstyling',        'MUAH',   'Special Make-Up Effects',            'exact'],

    // ── Original Score ─────────────────────────────────────────────────────
    ['Original Score',               'Oscars', 'Original Score',                     'exact'],
    ['Original Score',               'Globes', 'Original Score \u2013 Motion Picture',        'exact'],
    ['Original Score',               'BAFTA',  'Original Score',                     'exact'],
    ['Original Score',               'SCL',    'Studio Film Score',                  'exact'],
    ['Original Score',               'SCL',    'Independent Film Score',             'exact'],
    ['Original Score',               'Grammy', 'Score Soundtrack for Visual Media',  'exact'],

    // ── Original Song ──────────────────────────────────────────────────────
    ['Original Song',                'Oscars', 'Original Song',                      'exact'],
    ['Original Song',                'Globes', 'Original Song \u2013 Motion Picture',          'exact'],
    ['Original Song',                'SCL',    'Song \u2013 Dramatic/Documentary',             'exact'],
    ['Original Song',                'SCL',    'Song \u2013 Musical/Comedy',                   'exact'],
    ['Original Song',                'Grammy', 'Song Written for Visual Media',      'exact'],

    // ── Screenplay (Adapted) ───────────────────────────────────────────────
    ['Screenplay (Adapted)',         'NBR',    'Best Adapted Screenplay',             'exact'],
    ['Screenplay (Adapted)',         'Oscars', 'Adapted Screenplay',                 'exact'],
    ['Screenplay (Adapted)',         'BAFTA',  'Adapted Screenplay',                 'exact'],
    ['Screenplay (Adapted)',         'WGA',    'Adapted Screenplay',                 'exact'],
    // Globes has a single screenplay award — maps to both adapted and original
    ['Screenplay (Adapted)',         'Globes', 'Screenplay \u2013 Motion Picture',            'exact'],

    // ── Screenplay (Original) ──────────────────────────────────────────────
    ['Screenplay (Original)',        'NBR',    'Best Original Screenplay',            'exact'],
    ['Screenplay (Original)',        'Oscars', 'Original Screenplay',                'exact'],
    ['Screenplay (Original)',        'Globes', 'Screenplay \u2013 Motion Picture',            'exact'],
    ['Screenplay (Original)',        'BAFTA',  'Original Screenplay',                'exact'],
    ['Screenplay (Original)',        'WGA',    'Original Screenplay',                'exact'],

    // ── Sound Editing ──────────────────────────────────────────────────────
    // Note: the post-2020 Oscar "Sound" category is dual-mapped at the
    // category_canonical_map level to both Sound Editing and Sound Mixing
    // canonicals, so it matches here automatically without a separate entry.
    ['Sound Editing',                'Oscars', 'Sound Editing',                      'exact'],
    // BAFTA "Sound" covers both editing and mixing — dual-mapped
    ['Sound Editing',                'BAFTA',  'Sound',                              'exact'],
    ['Sound Editing',                'MPSE',   'Feature Effects / Foley',            'exact'],
    ['Sound Editing',                'MPSE',   'Feature Dialogue / ADR',             'exact'],
    ['Sound Editing',                'MPSE',   'Feature Animation',                  'exact'],
    ['Sound Editing',                'MPSE',   'Feature International / Foreign Language', 'exact'],
    ['Sound Editing',                'MPSE',   'Music Editing \u2014 Feature',               'exact'],
    ['Sound Editing',                'MPSE',   'Musical for Feature Film',           'exact'],
    ['Sound Editing',                'MPSE',   'Feature Documentary',                'exact'],
    ['Sound Editing',                'MPSE',   'Music Editing \u2014 Documentary',           'exact'],

    // ── Sound Mixing ───────────────────────────────────────────────────────
    // Same note re: post-2020 Oscar "Sound" as above.
    ['Sound Mixing',                 'Oscars', 'Sound Mixing',                       'exact'],
    // BAFTA "Sound" dual-mapped
    ['Sound Mixing',                 'BAFTA',  'Sound',                              'exact'],
    ['Sound Mixing',                 'CAS',    'Motion Picture \u2013 Live-Action',           'exact'],
    ['Sound Mixing',                 'CAS',    'Motion Picture \u2013 Animated',              'exact'],
    ['Sound Mixing',                 'CAS',    'Motion Picture \u2013 Documentary',           'exact'],

    // ── Special Visionary ─────────────────────────────────────────────
    // No external org equivalent; intentionally unmapped

    // ── NBR-only (no RP canonical equivalent) ─────────────────────────────
    // 'Breakthrough Performance', 'NBR Freedom of Expression Award' — NBR-specific, no cross-org match
    // 'Outstanding Achievement in Stunt Artistry' — cross-matches SAG 'Stunt Ensemble in a Motion Picture'
    //   but neither has an RP canonical; cross-link cannot be modeled in category_mappings

    // ── Spirit (Film Independent Spirit Awards) ────────────────────────────
    // Auto-created canonical names strip "Best " prefix (see autoCanonicalName in
    // migrateCanonicalCategories.ts). Gender-neutral performance categories map to
    // both male and female RP canonicals.
    ['Live-Action Feature',           'Spirit', 'Feature',                  'exact'],
    ['Directing',                     'Spirit', 'Director',                 'exact'],
    // Gender-neutral (post-2022): both RP gendered categories get the combined canonical
    ['Actor in a Leading Role',       'Spirit', 'Lead Performance',         'exact'],
    ['Actress in a Leading Role',     'Spirit', 'Lead Performance',         'exact'],
    ['Actor in a Supporting Role',    'Spirit', 'Supporting Performance',   'exact'],
    ['Actress in a Supporting Role',  'Spirit', 'Supporting Performance',   'exact'],
    // Gendered (pre-2022): each maps to its matching RP category only
    ['Actor in a Leading Role',       'Spirit', 'Male Lead',                'exact'],
    ['Actress in a Leading Role',     'Spirit', 'Female Lead',              'exact'],
    ['Actor in a Supporting Role',    'Spirit', 'Supporting Male',          'exact'],
    ['Actress in a Supporting Role',  'Spirit', 'Supporting Female',        'exact'],
    ['Screenplay (Adapted)',          'Spirit', 'Screenplay',               'exact'],
    ['Screenplay (Original)',         'Spirit', 'Screenplay',               'exact'],
    ['Documentary',                   'Spirit', 'Documentary Feature',      'exact'],
    ['International Feature',         'Spirit', 'International Film',       'exact'],
    ['Cinematography',                'Spirit', 'Cinematography',           'exact'],
    ['Editing',                       'Spirit', 'Editing',                  'exact'],
    // First Feature/Screenplay → slant (subsidiary first-timer category)
    ['Live-Action Feature',           'Spirit', 'First Feature',            'slant'],
    ['Screenplay (Adapted)',          'Spirit', 'First Screenplay',         'slant'],
    ['Screenplay (Original)',         'Spirit', 'First Screenplay',         'slant'],
    // Debut/Breakthrough Performance → slant on all four acting categories
    // (these were always gender-neutral, so only one canonical each)
    ['Actor in a Leading Role',       'Spirit', 'Debut Performance',        'slant'],
    ['Actress in a Leading Role',     'Spirit', 'Debut Performance',        'slant'],
    ['Actor in a Supporting Role',    'Spirit', 'Debut Performance',        'slant'],
    ['Actress in a Supporting Role',  'Spirit', 'Debut Performance',        'slant'],
    ['Actor in a Leading Role',       'Spirit', 'Breakthrough Performance', 'slant'],
    ['Actress in a Leading Role',     'Spirit', 'Breakthrough Performance', 'slant'],
    ['Actor in a Supporting Role',    'Spirit', 'Breakthrough Performance', 'slant'],
    ['Actress in a Supporting Role',  'Spirit', 'Breakthrough Performance', 'slant'],
];

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // ── Create table ───────────────────────────────────────────────────
        console.log('Creating category_mappings table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS category_mappings (
                mapping_id        serial  PRIMARY KEY,
                rp_canonical_id   integer NOT NULL
                    REFERENCES canonical_categories(canonical_category_id),
                other_canonical_id integer NOT NULL
                    REFERENCES canonical_categories(canonical_category_id),
                match_type        text    NOT NULL
                    CHECK (match_type IN ('exact', 'slant')),
                UNIQUE (rp_canonical_id, other_canonical_id)
            )
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_category_mappings_rp
                ON category_mappings (rp_canonical_id)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_category_mappings_other
                ON category_mappings (other_canonical_id)
        `);

        // ── Build canonical ID lookup ──────────────────────────────────────
        const { rows: canonRows } = await client.query(`
            SELECT cc.canonical_category_id, cc.name, o.short_name
            FROM canonical_categories cc
            JOIN organizations o ON cc.organization_id = o.organization_id
        `);
        // Map: "orgShortName|canonicalName" → canonical_category_id
        const canonLookup = new Map<string, number>();
        for (const r of canonRows) {
            canonLookup.set(`${r.short_name}|${r.name}`, r.canonical_category_id);
        }

        // ── Replace mappings (full replace to remove stale rows) ──────────
        console.log('Clearing existing mappings...');
        await client.query('DELETE FROM category_mappings');

        console.log(`Inserting ${MAPPINGS.length} mappings...`);
        let inserted = 0;
        let skipped = 0;
        const warnings: string[] = [];

        for (const [rpName, extOrg, extName, matchType] of MAPPINGS) {
            const rpId = canonLookup.get(`Rich Picks|${rpName}`);
            const extId = canonLookup.get(`${extOrg}|${extName}`);

            if (!rpId) {
                warnings.push(`  WARN: RP canonical not found: "${rpName}"`);
                skipped++;
                continue;
            }
            if (!extId) {
                warnings.push(`  WARN: External canonical not found: [${extOrg}] "${extName}"`);
                skipped++;
                continue;
            }

            await client.query(`
                INSERT INTO category_mappings (rp_canonical_id, other_canonical_id, match_type)
                VALUES ($1, $2, $3)
                ON CONFLICT (rp_canonical_id, other_canonical_id)
                DO UPDATE SET match_type = EXCLUDED.match_type
            `, [rpId, extId, matchType]);
            inserted++;
        }

        await client.query('COMMIT');

        // ── Summary ────────────────────────────────────────────────────────
        for (const w of warnings) console.warn(w);

        const totals = await pool.query(`
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE match_type = 'exact') AS exact_count,
                COUNT(*) FILTER (WHERE match_type = 'slant') AS slant_count,
                COUNT(DISTINCT rp_canonical_id) AS rp_cats_covered,
                COUNT(DISTINCT other_canonical_id) AS ext_cats_covered
            FROM category_mappings
        `);
        const t = totals.rows[0];
        console.log(`\n✓ Done. Inserted ${inserted} mappings (${skipped} skipped with warnings).`);
        console.log(`  Total mappings   : ${t.total}`);
        console.log(`  Exact            : ${t.exact_count}`);
        console.log(`  Slant            : ${t.slant_count}`);
        console.log(`  RP categories    : ${t.rp_cats_covered}`);
        console.log(`  Ext. canonicals  : ${t.ext_cats_covered}`);

        // Per-org breakdown
        const perOrg = await pool.query(`
            SELECT o.short_name, m.match_type, COUNT(*) as cnt
            FROM category_mappings m
            JOIN canonical_categories cc ON m.other_canonical_id = cc.canonical_category_id
            JOIN organizations o ON cc.organization_id = o.organization_id
            GROUP BY o.short_name, m.match_type
            ORDER BY o.short_name, m.match_type
        `);
        console.log('\n  Per-org breakdown:');
        let prevOrg = '';
        for (const r of perOrg.rows) {
            if (r.short_name !== prevOrg) { process.stdout.write(`  ${r.short_name}:`); prevOrg = r.short_name; }
            process.stdout.write(`  ${r.match_type}=${r.cnt}`);
        }
        console.log('');

    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
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
