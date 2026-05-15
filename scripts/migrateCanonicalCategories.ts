/**
 * migrateCanonicalCategories.ts
 *
 * Phase 2 of the canonical categories migration:
 *   1. Create canonical_categories and category_canonical_map tables
 *   2. Fix BAFTA "Debut" → "Début" accent in DB
 *   3. Insert all canonical category entries
 *   4. Map every category row to its canonical (explicit merges + auto-create for remainder)
 *   5. Set retired_year on pre-2005 Globes categories
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface CanonicalDef {
    org: string;          // organization short_name
    name: string;         // canonical category name
    notes?: string;
    components: string[]; // DB category.name values that map to this canonical
}

// ─── Explicit canonical definitions ──────────────────────────────────────────
// Covers all rename chains and merges. Categories not listed here are handled
// by the auto-create sweep at the end (which strips leading "Best " / "Outstanding ").
// Dual-mapped categories (e.g. Oscar "Sound" → both Sound Editing and Sound Mixing)
// appear as a component in two separate CanonicalDef entries.

const EXPLICIT_CANONICALS: CanonicalDef[] = [

    // ── OSCARS ─────────────────────────────────────────────────────────────
    { org: 'Oscars', name: 'Animated Feature Film',
      components: ['Animated Feature', 'Animated Feature Film'] },
    { org: 'Oscars', name: 'Animated Short Film',
      components: ['Animated Short', 'Animated Short Film'] },
    { org: 'Oscars', name: 'Documentary Feature Film',
      components: ['Documentary Feature', 'Documentary Feature Film'] },
    { org: 'Oscars', name: 'Documentary Short Film',
      components: ['Documentary Short', 'Documentary Short Film'] },
    { org: 'Oscars', name: 'Live-Action Short Film',
      components: ['Live-Action Short', 'Live Action Short Film'] },
    { org: 'Oscars', name: 'Makeup and Hairstyling',
      components: ['Make-Up', 'Makeup and Hairstyling'] },
    { org: 'Oscars', name: 'Original Score',
      components: ['Original Score', 'Music (Original Score)'] },
    { org: 'Oscars', name: 'Original Song',
      components: ['Original Song', 'Music (Original Song)'] },
    { org: 'Oscars', name: 'International Feature Film',
      components: ['Foreign Language Film', 'International Feature', 'International Feature Film'] },
    { org: 'Oscars', name: 'Adapted Screenplay',
      components: ['Adapted Screenplay', 'Writing (Adapted Screenplay)'] },
    { org: 'Oscars', name: 'Original Screenplay',
      components: ['Original Screenplay', 'Writing (Original Screenplay)'] },
    // "Sound" (2020+) dual-maps: appears in both Sound Editing and Sound Mixing
    { org: 'Oscars', name: 'Sound Editing',
      components: ['Sound Editing', 'Sound'] },
    { org: 'Oscars', name: 'Sound Mixing',
      components: ['Sound Mixing', 'Sound'] },

    // ── GLOBES ─────────────────────────────────────────────────────────────
    { org: 'Globes', name: 'Motion Picture \u2013 Drama',
      components: ['Best Motion Picture - Drama'] },
    { org: 'Globes', name: 'Motion Picture \u2013 Musical or Comedy',
      components: ['Best Motion Picture - Musical or Comedy'] },
    { org: 'Globes', name: 'Motion Picture \u2013 Animated',
      components: ['Best Motion Picture - Animated'] },
    { org: 'Globes', name: 'Motion Picture \u2013 Foreign/Non-English Language',
      components: ['Best Motion Picture - Foreign Language', 'Best Motion Picture - Non-English Language'] },
    { org: 'Globes', name: 'Director \u2013 Motion Picture',
      components: ['Best Director - Motion Picture', 'Best Director'] },
    { org: 'Globes', name: 'Screenplay \u2013 Motion Picture',
      components: ['Best Screenplay - Motion Picture', 'Best Screenplay'] },
    { org: 'Globes', name: 'Original Score \u2013 Motion Picture',
      components: ['Best Original Score - Motion Picture', 'Best Original Score'] },
    { org: 'Globes', name: 'Original Song \u2013 Motion Picture',
      components: ['Best Original Song - Motion Picture', 'Best Original Song'] },
    { org: 'Globes', name: 'Actor in a Motion Picture \u2013 Drama',
      components: [
        'Best Performance by an Actor in a Motion Picture - Drama',
        'Best Performance in a Motion Picture \u2013 Drama \u2013 Actor',
        'Best Male Actor in a Motion Picture - Drama',
      ] },
    { org: 'Globes', name: 'Actor in a Motion Picture \u2013 Musical or Comedy',
      components: [
        'Best Performance by an Actor in a Motion Picture - Musical or Comedy',
        'Best Performance in a Motion Picture \u2013 Musical or Comedy \u2013 Actor',
        'Best Male Actor in a Motion Picture - Musical or Comedy',
      ] },
    { org: 'Globes', name: 'Actress in a Motion Picture \u2013 Drama',
      components: [
        'Best Performance by an Actress in a Motion Picture - Drama',
        'Best Performance in a Motion Picture \u2013 Drama \u2013 Actress',
        'Best Female Actor in a Motion Picture - Drama',
      ] },
    { org: 'Globes', name: 'Actress in a Motion Picture \u2013 Musical or Comedy',
      components: [
        'Best Performance by an Actress in a Motion Picture - Musical or Comedy',
        'Best Performance in a Motion Picture \u2013 Musical or Comedy \u2013 Actress',
        'Best Female Actor in a Motion Picture - Musical or Comedy',
      ] },
    { org: 'Globes', name: 'Supporting Actor in a Motion Picture',
      components: [
        'Best Performance by an Actor in a Supporting Role in any Motion Picture',
        'Best Supporting Performance in a Motion Picture \u2013 Supporting Actor',
        'Best Supporting Male Actor in a Motion Picture',
      ] },
    { org: 'Globes', name: 'Supporting Actress in a Motion Picture',
      components: [
        'Best Performance by an Actress in a Supporting Role in any Motion Picture',
        'Best Supporting Performance in a Motion Picture \u2013 Supporting Actress',
        'Best Supporting Female Actor in a Motion Picture',
      ] },

    // ── BAFTA ──────────────────────────────────────────────────────────────
    { org: 'BAFTA', name: 'Make Up & Hair',
      components: ['Best Make-up and Hair', 'Best Make Up & Hair'] },
    { org: 'BAFTA', name: 'Original Score',
      components: ['Best Original Music', 'Best Original Score'] },
    { org: 'BAFTA', name: 'Director',
      components: ['Best Direction', 'Best Director'] },
    { org: 'BAFTA', name: 'Rising Star Award',
      components: ['Rising Star Award', 'EE Rising Star Award'] },
    { org: 'BAFTA', name: 'D\u00e9but by a British Writer, Director or Producer',
      notes: 'Prior to 2023, films without significant British involvement were eligible',
      // Both DB variants (with/without comma before "or") after Début accent fix
      components: [
        'Outstanding D\u00e9but by a British Writer, Director, or Producer',
        'Outstanding D\u00e9but by a British Writer, Director or Producer',
      ] },
    { org: 'BAFTA', name: 'Short Animation',
      notes: 'Prior to 2023, films without significant British involvement were eligible',
      components: ['Best Short Animation', 'Best British Short Animation'] },
    { org: 'BAFTA', name: 'Short Film',
      notes: 'Prior to 2023, films without significant British involvement were eligible',
      components: ['Best Short Film', 'Best British Short Film'] },

    // ── ACE ────────────────────────────────────────────────────────────────
    { org: 'ACE', name: 'Edited Feature Film \u2013 Dramatic',
      components: ['Best Edited Feature Film \u2013 Dramatic', 'Best Edited Feature Film (Drama, Theatrical)'] },
    { org: 'ACE', name: 'Edited Feature Film \u2013 Comedy or Musical',
      components: ['Best Edited Feature Film \u2013 Comedy or Musical', 'Best Edited Feature Film (Comedy, Theatrical)'] },
    { org: 'ACE', name: 'Edited Animated Feature Film',
      components: ['Best Edited Animated Feature Film', 'Best Edited Animated Feature Film (Theatrical or Non-Theatrical)'] },
    { org: 'ACE', name: 'Edited Documentary \u2013 Feature',
      components: [
        'Best Edited Documentary \u2013 Feature',
        'Best Edited Documentary (Theatrical)',
        'Best Edited Documentary Feature (Theatrical)',
      ] },
    { org: 'ACE', name: 'Edited Documentary (Non-Theatrical)',
      components: ['Best Edited Documentary (Non-Theatrical)'] },
    { org: 'ACE', name: 'Edited Feature Film (Non-Theatrical)',
      components: ['Best Edited Feature Film (Non-Theatrical)'] },

    // ── CDG ────────────────────────────────────────────────────────────────
    { org: 'CDG', name: 'Sci-Fi/Fantasy Film',
      components: ['Fantasy Film', 'Sci-Fi/Fantasy Film'] },

    // ── MUAH ───────────────────────────────────────────────────────────────
    { org: 'MUAH', name: 'Contemporary Make-Up',
      components: [
        'Best Contemporary Make-Up in a Feature-Length Motion Picture',
        'Best Contemporary Make-Up',
      ] },
    { org: 'MUAH', name: 'Contemporary Hair Styling',
      components: [
        'Best Contemporary Hair Styling in a Feature-Length Motion Picture',
        'Best Contemporary Hair Styling',
      ] },
    { org: 'MUAH', name: 'Period and/or Character Make-Up',
      components: [
        'Best Period and/or Character Make-Up in a Feature-Length Motion Picture',
        'Best Period and/or Character Make-Up',
      ] },
    { org: 'MUAH', name: 'Period and/or Character Hair Styling',
      components: [
        'Best Period and/or Character Hair Styling in a Feature-Length Motion Picture',
        'Best Period and/or Character Hair Styling',
      ] },
    { org: 'MUAH', name: 'Special Make-Up Effects',
      components: [
        'Best Special Make-Up Effects in a Feature-Length Motion Picture',
        'Best Special Make-Up Effects',
      ] },

    // ── PGA ────────────────────────────────────────────────────────────────
    { org: 'PGA', name: 'Live-Action',
      components: ['Darryl F. Zanuck Award for Outstanding Producer of Theatrical Motion Pictures'] },
    { org: 'PGA', name: 'Animated',
      components: ['Outstanding Producer of Animated Theatrical Motion Pictures'] },
    { org: 'PGA', name: 'Documentary',
      components: ['Outstanding Producer of Documentary Theatrical Motion Pictures'] },

    // ── SAG ────────────────────────────────────────────────────────────────
    // "in a" must not be capitalized (user requirement)
    { org: 'SAG', name: 'Female Actor in a Leading Role',
      components: ['Female Lead In A Motion Picture', 'Female Actor In A Leading Role'] },
    { org: 'SAG', name: 'Male Actor in a Leading Role',
      components: ['Male Lead In A Motion Picture', 'Male Actor In A Leading Role'] },
    { org: 'SAG', name: 'Female Actor in a Supporting Role',
      components: ['Female Support In A Motion Picture', 'Female Actor In A Supporting Role'] },
    { org: 'SAG', name: 'Male Actor in a Supporting Role',
      components: ['Male Support In A Motion Picture', 'Male Actor In A Supporting Role'] },
    { org: 'SAG', name: 'Stunt Ensemble in a Motion Picture',
      components: ['Stunt Ensemble In A Motion Picture'] },

    // ── NBR ────────────────────────────────────────────────────────────────
    { org: 'NBR', name: 'Best Film',
      components: ['Best Film'] },
    { org: 'NBR', name: 'Best Director',
      components: ['Best Director'] },
    { org: 'NBR', name: 'Best Actor',
      components: ['Best Actor'] },
    { org: 'NBR', name: 'Best Actress',
      components: ['Best Actress'] },
    { org: 'NBR', name: 'Best Supporting Actor',
      components: ['Best Supporting Actor'] },
    { org: 'NBR', name: 'Best Supporting Actress',
      components: ['Best Supporting Actress'] },
    { org: 'NBR', name: 'Best Original Screenplay',
      components: ['Best Original Screenplay'] },
    { org: 'NBR', name: 'Best Adapted Screenplay',
      components: ['Best Adapted Screenplay'] },
    { org: 'NBR', name: 'Best Animated Feature',
      components: ['Best Animated Feature'] },
    { org: 'NBR', name: 'Breakthrough Performance',
      components: ['Breakthrough Performance'] },
    { org: 'NBR', name: 'Best Directorial Debut',
      components: ['Best Directorial Debut'] },
    { org: 'NBR', name: 'Best International Film',
      components: ['Best International Film'] },
    { org: 'NBR', name: 'Best Documentary',
      components: ['Best Documentary'] },
    { org: 'NBR', name: 'Outstanding Achievement in Cinematography',
      components: ['Outstanding Achievement in Cinematography'] },
    { org: 'NBR', name: 'Outstanding Achievement in Stunt Artistry',
      notes: 'Cross-matches SAG "Stunt Ensemble in a Motion Picture"; no RP canonical equivalent',
      components: ['Outstanding Achievement in Stunt Artistry'] },
    { org: 'NBR', name: 'NBR Freedom of Expression Award',
      components: ['NBR Freedom of Expression Award'] },
    { org: 'NBR', name: 'Top 10 Independent Films',
      components: ['Top 10 Independent Films'] },

    // ── SCL ────────────────────────────────────────────────────────────────
    { org: 'SCL', name: 'Studio Film Score',
      components: ['Best Studio Film Score', 'Outstanding Original Score for a Studio Film'] },
    { org: 'SCL', name: 'Independent Film Score',
      components: ['Best Independent Film Score', 'Outstanding Original Score for an Independent Film'] },
    // "Best Song for Visual Media" (pre-split 2019–2020) dual-maps to both song canonicals
    { org: 'SCL', name: 'Song \u2013 Dramatic/Documentary',
      components: [
        'Best Song for a Drama / Documentary',
        'Outstanding Original Song for a Dramatic or Documentary Visual Media Production',
        'Best Song for Visual Media',
      ] },
    { org: 'SCL', name: 'Song \u2013 Musical/Comedy',
      components: [
        'Best Song for a Musical / Comedy',
        'Outstanding Original Song for a Comedy or Musical Visual Media Production',
        'Best Song for Visual Media',
      ] },

    // ── VES ────────────────────────────────────────────────────────────────
    { org: 'VES', name: 'Visual Effects in a Photoreal Feature',
      components: ['Outstanding Visual Effects in a Photoreal Feature'] },
    { org: 'VES', name: 'Supporting Visual Effects in a Photoreal Feature',
      components: ['Outstanding Supporting Visual Effects in a Photoreal Feature'] },
    { org: 'VES', name: 'Compositing and Lighting in a Feature',
      components: [
        'Outstanding Compositing and Lighting in a Feature',
        'Outstanding Compositing & Lighting in a Feature',
      ] },
    { org: 'VES', name: 'Animated Character in a Photoreal Feature',
      components: [
        'Outstanding Animated Character in a Photoreal Feature',
        'Outstanding Character in a Photoreal Feature',
      ] },
    { org: 'VES', name: 'Animated Character in an Animated Feature',
      components: [
        'Outstanding Animated Character in an Animated Feature',
        'Outstanding Character in an Animated Feature',
      ] },
    { org: 'VES', name: 'Animation in an Animated Feature',
      components: [
        'Outstanding Visual Effects in an Animated Feature',
        'Outstanding Animation in an Animated Feature',
      ] },
    { org: 'VES', name: 'Created Environment in a Photoreal Feature',
      components: [
        'Outstanding Created Environment in a Photoreal Feature',
        'Outstanding Environment in a Photoreal Feature',
      ] },
    { org: 'VES', name: 'Created Environment in an Animated Feature',
      components: [
        'Outstanding Created Environment in an Animated Feature',
        'Outstanding Environment in an Animated Feature',
      ] },
    { org: 'VES', name: 'Effects Simulations in a Photoreal Feature',
      components: ['Outstanding Effects Simulations in a Photoreal Feature'] },
    { org: 'VES', name: 'Effects Simulations in an Animated Feature',
      components: ['Outstanding Effects Simulations in an Animated Feature'] },
    { org: 'VES', name: 'Model in a Photoreal or Animated Project',
      components: ['Outstanding Model in a Photoreal or Animated Project'] },
    { org: 'VES', name: 'Special Effects in a Feature Motion Picture',
      components: [
        'Outstanding Special Effects in a Feature Motion Picture',
        'Outstanding Special (Practical) Effects in a Photoreal or Animated Project',
        'Outstanding Special (Practical) Effects in a Photoreal Project',
      ] },
    { org: 'VES', name: 'Virtual Cinematography in a CG Project',
      components: [
        'Outstanding Virtual Cinematography in a CG Project',
        'Outstanding CG Cinematography',
      ] },
    { org: 'VES', name: 'Single Visual Effect of the Year',
      components: ['Best Single Visual Effect of the Year'] },

    // ── ANNIE ──────────────────────────────────────────────────────────────
    { org: 'Annie', name: 'Animated Feature',
      components: ['Best Animated Feature', 'Best Feature'] },
    { org: 'Annie', name: 'Animated Short Subject',
      components: ['Best Animated Short Subject', 'Best Short Subject'] },
    { org: 'Annie', name: 'Animated Feature \u2014 Independent',
      components: ['Best Animated Feature \u2014 Independent'] },

    // ── GRAMMY ─────────────────────────────────────────────────────────────
    { org: 'Grammy', name: 'Score Soundtrack for Visual Media',
      components: [
        'Best Score Soundtrack for Visual Media',
        'Best Score Soundtrack Album for Visual Media',
      ] },
    { org: 'Grammy', name: 'Song Written for Visual Media',
      components: ['Best Song Written for Visual Media'] },

    // ── MPSE ───────────────────────────────────────────────────────────────
    { org: 'MPSE', name: 'Feature Effects / Foley',
      components: ['Sound Effects and Foley for Feature Film', 'Feature Effects / Foley'] },
    { org: 'MPSE', name: 'Feature Dialogue / ADR',
      components: ['Dialogue and ADR for Feature Film', 'Feature Dialogue / ADR'] },
    { org: 'MPSE', name: 'Feature Animation',
      components: [
        'Sound Effects, Foley, Dialogue and ADR for Animated Feature Film',
        'Feature Animation',
      ] },
    { org: 'MPSE', name: 'Feature International / Foreign Language',
      components: [
        'Sound Effects, Foley, Dialogue and ADR for Foreign Language Feature Film',
        'Foreign Language Feature',
        'Feature International',
      ] },
    { org: 'MPSE', name: 'Music Editing \u2014 Feature',
      components: ['Feature Underscore', 'Music Editing \u2014 Feature'] },
    { org: 'MPSE', name: 'Musical for Feature Film',
      components: ['Musical for Feature Film'] },
    { org: 'MPSE', name: 'Feature Documentary',
      notes: 'Pre-2021 data missing; was "Sound Effects, Foley, Dialogue, ADR and Music in a Feature Documentary" before 2021',
      components: ['Feature Documentary'] },
    { org: 'MPSE', name: 'Music Editing \u2014 Documentary',
      components: ['Music Editing \u2014 Documentary'] },

    // ── CAS ────────────────────────────────────────────────────────────────
    // "Motion Picture" (2005–2011, pre-split) dual-maps to both Live-Action and Animated
    { org: 'CAS', name: 'Motion Picture \u2013 Live-Action',
      components: ['Motion Picture \u2013 Live-Action', 'Motion Picture'] },
    { org: 'CAS', name: 'Motion Picture \u2013 Animated',
      components: ['Motion Picture \u2013 Animated', 'Motion Picture'] },
    { org: 'CAS', name: 'Motion Picture \u2013 Documentary',
      components: ['Motion Picture \u2013 Documentary'] },
];

// ─── Auto-create name transform ───────────────────────────────────────────────
// For categories not covered by EXPLICIT_CANONICALS, strip leading "Best " or
// "Outstanding " to produce the canonical name.
function autoCanonicalName(dbName: string): string {
    return dbName.replace(/^Best /, '').replace(/^Outstanding /, '');
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // ── Step 1: Create tables ──────────────────────────────────────────
        console.log('Creating canonical_categories and category_canonical_map tables...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS canonical_categories (
                canonical_category_id serial PRIMARY KEY,
                organization_id       integer NOT NULL REFERENCES organizations(organization_id),
                name                  text    NOT NULL,
                notes                 text,
                created_at            timestamptz DEFAULT now(),
                UNIQUE (organization_id, name)
            )
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS category_canonical_map (
                category_id           integer NOT NULL REFERENCES categories(category_id),
                canonical_category_id integer NOT NULL REFERENCES canonical_categories(canonical_category_id),
                PRIMARY KEY (category_id, canonical_category_id)
            )
        `);

        // ── Step 2: Fix BAFTA "Debut" → "Début" accent ────────────────────
        console.log('Fixing BAFTA Début accent...');
        const debutFix = await client.query(`
            UPDATE categories c
            SET name = REPLACE(c.name, 'Debut', 'D\u00e9but')
            FROM awards a
            JOIN organizations o ON a.organization_id = o.organization_id
            WHERE c.award_id = a.award_id
              AND o.short_name = 'BAFTA'
              AND c.name LIKE '%Debut%'
            RETURNING c.category_id, c.name
        `);
        console.log(`  Fixed ${debutFix.rowCount} BAFTA Début rows`);

        // ── Step 3: Build org_id lookup ────────────────────────────────────
        const { rows: orgRows } = await client.query(
            'SELECT organization_id, short_name FROM organizations'
        );
        const orgIdMap = new Map<string, number>(
            orgRows.map(r => [r.short_name, r.organization_id])
        );

        // ── Step 4: Process explicit canonicals ───────────────────────────
        console.log('Inserting explicit canonical categories...');
        let explicitCount = 0;
        let mappingCount = 0;

        // Track which (org, dbName) pairs have been mapped so the auto-sweep skips them
        const mappedDbNames = new Map<string, Set<string>>(); // orgShortName → Set<dbName>

        for (const def of EXPLICIT_CANONICALS) {
            const orgId = orgIdMap.get(def.org);
            if (!orgId) {
                console.warn(`  WARNING: org "${def.org}" not found, skipping`);
                continue;
            }

            // Insert canonical (upsert in case script is re-run)
            const canonRes = await client.query(`
                INSERT INTO canonical_categories (organization_id, name, notes)
                VALUES ($1, $2, $3)
                ON CONFLICT (organization_id, name) DO UPDATE SET notes = EXCLUDED.notes
                RETURNING canonical_category_id
            `, [orgId, def.name, def.notes ?? null]);
            const canonId = canonRes.rows[0].canonical_category_id;
            explicitCount++;

            // Map all matching DB category rows to this canonical
            for (const componentName of def.components) {
                const { rows: catRows } = await client.query(`
                    SELECT c.category_id
                    FROM categories c
                    JOIN awards a ON c.award_id = a.award_id
                    WHERE a.organization_id = $1 AND c.name = $2
                `, [orgId, componentName]);

                for (const catRow of catRows) {
                    await client.query(`
                        INSERT INTO category_canonical_map (category_id, canonical_category_id)
                        VALUES ($1, $2)
                        ON CONFLICT DO NOTHING
                    `, [catRow.category_id, canonId]);
                    mappingCount++;
                }

                // Record as mapped so auto-sweep skips it
                if (!mappedDbNames.has(def.org)) mappedDbNames.set(def.org, new Set());
                mappedDbNames.get(def.org)!.add(componentName);
            }
        }
        console.log(`  Inserted ${explicitCount} explicit canonicals, ${mappingCount} mappings`);

        // ── Step 5: Auto-create canonicals for remaining categories ────────
        console.log('Auto-creating canonicals for remaining categories...');
        const { rows: allCats } = await client.query(`
            SELECT c.category_id, c.name, o.short_name as org, o.organization_id
            FROM categories c
            JOIN awards a ON c.award_id = a.award_id
            JOIN organizations o ON a.organization_id = o.organization_id
            ORDER BY o.short_name, c.name
        `);

        let autoCount = 0;
        let autoMappings = 0;

        for (const cat of allCats) {
            // Skip if already mapped by an explicit canonical
            const alreadyMapped = await client.query(
                'SELECT 1 FROM category_canonical_map WHERE category_id = $1 LIMIT 1',
                [cat.category_id]
            );
            if (alreadyMapped.rows.length > 0) continue;

            // Derive canonical name
            const canonName = autoCanonicalName(cat.name);
            const orgId = cat.organization_id;

            // Upsert canonical
            const canonRes = await client.query(`
                INSERT INTO canonical_categories (organization_id, name)
                VALUES ($1, $2)
                ON CONFLICT (organization_id, name) DO UPDATE SET name = EXCLUDED.name
                RETURNING canonical_category_id
            `, [orgId, canonName]);
            const canonId = canonRes.rows[0].canonical_category_id;
            autoCount++;

            // Map this category to the canonical
            await client.query(`
                INSERT INTO category_canonical_map (category_id, canonical_category_id)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING
            `, [cat.category_id, canonId]);
            autoMappings++;
        }
        console.log(`  Auto-created ${autoCount} canonicals, ${autoMappings} mappings`);

        // ── Step 6: Set retired_year on pre-2005 Globes categories ────────
        console.log('Setting retired_year on pre-2005 Globes categories...');
        const retiredRes = await client.query(`
            UPDATE categories c
            SET retired_year = sub.max_year
            FROM (
                SELECT c2.category_id, MAX(cer.year)::integer AS max_year
                FROM categories c2
                JOIN awards a ON c2.award_id = a.award_id
                JOIN organizations o ON a.organization_id = o.organization_id
                JOIN nominations n ON n.category_id = c2.category_id
                JOIN ceremonies cer ON n.ceremony_id = cer.ceremony_id
                WHERE o.short_name = 'Globes'
                GROUP BY c2.category_id
                HAVING MAX(cer.year) < 2005
            ) sub
            WHERE c.category_id = sub.category_id
              AND c.retired_year IS NULL
            RETURNING c.category_id
        `);
        console.log(`  Set retired_year on ${retiredRes.rowCount} Globes categories`);

        await client.query('COMMIT');

        // ── Summary ────────────────────────────────────────────────────────
        const totals = await pool.query(`
            SELECT
                (SELECT COUNT(*) FROM canonical_categories) AS canonicals,
                (SELECT COUNT(*) FROM category_canonical_map) AS mappings,
                (SELECT COUNT(DISTINCT canonical_category_id) FROM category_canonical_map
                 WHERE category_id IN (
                     SELECT category_id FROM category_canonical_map
                     GROUP BY category_id HAVING COUNT(*) > 1
                 )) AS dual_mapped_canonicals,
                (SELECT COUNT(*) FROM categories WHERE retired_year IS NOT NULL) AS retired_cats
        `);
        const t = totals.rows[0];
        console.log('\n✓ Done.');
        console.log(`  canonical_categories rows : ${t.canonicals}`);
        console.log(`  category_canonical_map rows: ${t.mappings}`);
        console.log(`  canonicals with dual-mapped category rows: ${t.dual_mapped_canonicals}`);
        console.log(`  categories with retired_year set: ${t.retired_cats}`);

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
