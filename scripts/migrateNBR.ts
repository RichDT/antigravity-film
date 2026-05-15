/**
 * migrateNBR.ts
 *
 * Intake script for National Board of Review awards.
 * Safe to re-run: all inserts use upsert or existence checks.
 *
 * Steps:
 *   1. Upsert NBR organization, award, and ceremony rows
 *   2. Insert any films not yet in the DB
 *   3. Upsert NBR categories
 *   4. Insert nominations (with existence checks) + nomination_people
 *   5. Report summary
 *
 * After running this script, re-run migrateCanonicalCategories.ts and
 * migrateCategoryMappings.ts to wire up the canonical mapping tables.
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

// ─── Film lookup (title → film_id) ───────────────────────────────────────────
// Known DB film_ids from pre-flight check. Titles match DB exactly.
// Titles where NBR uses a different form are noted in comments.
const KNOWN_FILMS: Record<string, number> = {
    'One Battle after Another':                    1401,  // NBR: "One Battle After Another"
    'Avatar: Fire and Ash':                        1420,
    'F1':                                          1424,
    'Frankenstein':                                1408,
    'Jay Kelly':                                   1415,
    'Marty Supreme':                               1422,
    'Rental Family':                               1413,
    'Sinners':                                     1394,
    'Train Dreams':                                1421,
    "Wake Up Dead Man: A 'Knives Out' Mystery":   10243,  // NBR: without quotes
    'Wicked: For Good':                            1412,
    "If I Had Legs I'd Kick You":                  1425,
    'Sentimental Value':                           1414,
    'Sorry, Baby':                                 1419,
    'Cover-Up':                                    9802,
    'Arco':                                        1625,
    'It Was Just an Accident':                     1427,
    'The Secret Agent':                            1417,
    'Sirāt':                                       1629,
    '2000 Meters to Andriivka':                    9801,
    'Come See Me in the Good Light':               1636,
    'My Mom Jayne':                               10030,
    'The Mastermind':                              1407,
    'Mission: Impossible - The Final Reckoning':   8199,  // DB uses hyphen, not em-dash
};

// Films that need to be inserted into the films table.
const NEW_FILMS: Array<{ title: string; release_year: number }> = [
    { title: 'Left-Handed Girl',           release_year: 2025 },
    { title: 'The Love That Remains',      release_year: 2025 },
    { title: 'Put Your Soul on Your Hand and Walk', release_year: 2025 },
    { title: 'Natchez',                    release_year: 2025 },
    { title: 'Orwell: 2+2=5',             release_year: 2025 },
    { title: 'The Baltimorans',            release_year: 2025 },
    { title: 'Bring Her Back',             release_year: 2025 },
    { title: 'Father Mother Sister Brother', release_year: 2025 },
    { title: 'Friendship',                 release_year: 2025 },
    { title: 'Good Boy',                   release_year: 2025 },
    { title: 'Rebuilding',                 release_year: 2025 },
    { title: 'Urchin',                     release_year: 2025 },
];

// ─── Person lookup (name → person_id) ────────────────────────────────────────
// All confirmed present in DB from pre-flight check.
const KNOWN_PEOPLE: Record<string, number> = {
    'Paul Thomas Anderson':   34,
    'Ryan Coogler':          302,
    'Eva Victor':           2187,
    'Rose Byrne':           2198,
    'Benicio del Toro':     2245,
    'Inga Ibsdotter Lilleaas': 2246,
    'Autumn Durald Arkapaw': 2318,
    'Chase Infiniti':       6322,
    'Leonardo DiCaprio':     377,
    'Clint Bentley':        1971,
    'Greg Kwedar':          1970,
};

// ─── Nomination data ──────────────────────────────────────────────────────────
// Each entry is one nomination row. film is the key into the merged film map.
// people is an ordered list of person names for nomination_people rows.
// win: true = winner, false = nominee.

interface NomEntry {
    category: string;
    film: string;
    win: boolean;
    people?: string[];  // names; must exist in KNOWN_PEOPLE
}

const NOMINATIONS_2025: NomEntry[] = [

    // ── Best Film ─────────────────────────────────────────────────────────────
    // Winner + the Top 10 Films list as de facto nominees
    { category: 'Best Film', film: 'One Battle after Another',                  win: true  },
    { category: 'Best Film', film: 'Avatar: Fire and Ash',                      win: false },
    { category: 'Best Film', film: 'F1',                                        win: false },
    { category: 'Best Film', film: 'Frankenstein',                              win: false },
    { category: 'Best Film', film: 'Jay Kelly',                                 win: false },
    { category: 'Best Film', film: 'Marty Supreme',                             win: false },
    { category: 'Best Film', film: 'Rental Family',                             win: false },
    { category: 'Best Film', film: 'Sinners',                                   win: false },
    { category: 'Best Film', film: 'Train Dreams',                              win: false },
    { category: 'Best Film', film: "Wake Up Dead Man: A 'Knives Out' Mystery",  win: false },
    { category: 'Best Film', film: 'Wicked: For Good',                          win: false },

    // ── Best Director ─────────────────────────────────────────────────────────
    { category: 'Best Director', film: 'One Battle after Another', win: true,
      people: ['Paul Thomas Anderson'] },

    // ── Best Actor ────────────────────────────────────────────────────────────
    { category: 'Best Actor', film: 'One Battle after Another', win: true,
      people: ['Leonardo DiCaprio'] },

    // ── Best Actress ──────────────────────────────────────────────────────────
    { category: 'Best Actress', film: "If I Had Legs I'd Kick You", win: true,
      people: ['Rose Byrne'] },

    // ── Best Supporting Actor ─────────────────────────────────────────────────
    { category: 'Best Supporting Actor', film: 'One Battle after Another', win: true,
      people: ['Benicio del Toro'] },

    // ── Best Supporting Actress ───────────────────────────────────────────────
    { category: 'Best Supporting Actress', film: 'Sentimental Value', win: true,
      people: ['Inga Ibsdotter Lilleaas'] },

    // ── Best Original Screenplay ──────────────────────────────────────────────
    { category: 'Best Original Screenplay', film: 'Sinners', win: true,
      people: ['Ryan Coogler'] },

    // ── Best Adapted Screenplay ───────────────────────────────────────────────
    { category: 'Best Adapted Screenplay', film: 'Train Dreams', win: true,
      people: ['Clint Bentley', 'Greg Kwedar'] },

    // ── Best Animated Feature ─────────────────────────────────────────────────
    { category: 'Best Animated Feature', film: 'Arco', win: true },

    // ── Breakthrough Performance ──────────────────────────────────────────────
    { category: 'Breakthrough Performance', film: 'One Battle after Another', win: true,
      people: ['Chase Infiniti'] },

    // ── Best Directorial Debut ────────────────────────────────────────────────
    { category: 'Best Directorial Debut', film: 'Sorry, Baby', win: true,
      people: ['Eva Victor'] },

    // ── Best International Film ───────────────────────────────────────────────
    // Winner + Top 5 International Films as de facto nominees
    { category: 'Best International Film', film: 'It Was Just an Accident', win: true  },
    { category: 'Best International Film', film: 'Left-Handed Girl',        win: false },
    { category: 'Best International Film', film: 'The Love That Remains',   win: false },
    { category: 'Best International Film', film: 'The Secret Agent',        win: false },
    { category: 'Best International Film', film: 'Sentimental Value',       win: false },
    { category: 'Best International Film', film: 'Sirāt',                   win: false },

    // ── Best Documentary ──────────────────────────────────────────────────────
    // Winner + Top 5 Documentaries as de facto nominees
    { category: 'Best Documentary', film: 'Cover-Up',                        win: true  },
    { category: 'Best Documentary', film: '2000 Meters to Andriivka',        win: false },
    { category: 'Best Documentary', film: 'Come See Me in the Good Light',   win: false },
    { category: 'Best Documentary', film: 'My Mom Jayne',                    win: false },
    { category: 'Best Documentary', film: 'Natchez',                         win: false },
    { category: 'Best Documentary', film: 'Orwell: 2+2=5',                  win: false },

    // ── Outstanding Achievement in Cinematography ─────────────────────────────
    { category: 'Outstanding Achievement in Cinematography', film: 'Sinners', win: true,
      people: ['Autumn Durald Arkapaw'] },

    // ── Outstanding Achievement in Stunt Artistry ─────────────────────────────
    { category: 'Outstanding Achievement in Stunt Artistry',
      film: 'Mission: Impossible - The Final Reckoning', win: true },

    // ── NBR Freedom of Expression Award ──────────────────────────────────────
    { category: 'NBR Freedom of Expression Award',
      film: 'Put Your Soul on Your Hand and Walk', win: true },

    // ── Top 10 Independent Films ──────────────────────────────────────────────
    // All de facto nominees; no winner
    { category: 'Top 10 Independent Films', film: 'The Baltimorans',             win: false },
    { category: 'Top 10 Independent Films', film: 'Bring Her Back',              win: false },
    { category: 'Top 10 Independent Films', film: 'Father Mother Sister Brother', win: false },
    { category: 'Top 10 Independent Films', film: 'Friendship',                  win: false },
    { category: 'Top 10 Independent Films', film: 'Good Boy',                    win: false },
    { category: 'Top 10 Independent Films', film: "If I Had Legs I'd Kick You",  win: false },
    { category: 'Top 10 Independent Films', film: 'The Mastermind',              win: false },
    { category: 'Top 10 Independent Films', film: 'Rebuilding',                  win: false },
    { category: 'Top 10 Independent Films', film: 'Sorry, Baby',                 win: false },
    { category: 'Top 10 Independent Films', film: 'Urchin',                      win: false },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function upsertOrg(client: PoolClient): Promise<number> {
    const existing = await client.query(`SELECT organization_id FROM organizations WHERE short_name = 'NBR'`);
    if (existing.rows.length > 0) return existing.rows[0].organization_id;
    const res = await client.query(`
        INSERT INTO organizations (name, short_name, country, website)
        VALUES ('National Board of Review', 'NBR', 'US', 'https://nationalboardofreview.org')
        RETURNING organization_id
    `);
    return res.rows[0].organization_id;
}

async function upsertAward(client: PoolClient, orgId: number): Promise<number> {
    const existing = await client.query(`SELECT award_id FROM awards WHERE organization_id = $1`, [orgId]);
    if (existing.rows.length > 0) return existing.rows[0].award_id;
    const res = await client.query(`
        INSERT INTO awards (organization_id, name, start_year)
        VALUES ($1, 'National Board of Review Awards', 1929)
        RETURNING award_id
    `, [orgId]);
    return res.rows[0].award_id;
}

async function upsertCeremony(client: PoolClient, awardId: number, year: number): Promise<number> {
    const res = await client.query(`
        INSERT INTO ceremonies (award_id, year)
        VALUES ($1, $2)
        ON CONFLICT (award_id, year) DO NOTHING
        RETURNING ceremony_id
    `, [awardId, year]);
    if (res.rows.length > 0) return res.rows[0].ceremony_id;
    const sel = await client.query(`SELECT ceremony_id FROM ceremonies WHERE award_id = $1 AND year = $2`, [awardId, year]);
    return sel.rows[0].ceremony_id;
}

async function upsertCategory(client: PoolClient, awardId: number, name: string): Promise<number> {
    const existing = await client.query(`SELECT category_id FROM categories WHERE award_id = $1 AND name = $2`, [awardId, name]);
    if (existing.rows.length > 0) return existing.rows[0].category_id;
    const res = await client.query(`INSERT INTO categories (award_id, name) VALUES ($1, $2) RETURNING category_id`, [awardId, name]);
    return res.rows[0].category_id;
}

async function insertFilm(client: PoolClient, title: string, year: number): Promise<number> {
    const existing = await client.query(`SELECT film_id FROM films WHERE title = $1 AND release_year = $2`, [title, year]);
    if (existing.rows.length > 0) return existing.rows[0].film_id;
    const res = await client.query(`INSERT INTO films (title, release_year) VALUES ($1, $2) RETURNING film_id`, [title, year]);
    return res.rows[0].film_id;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    const client = await pool.connect();
    const YEAR = 2025;

    try {
        await client.query('BEGIN');

        // ── Step 1: Org / Award / Ceremony ────────────────────────────────────
        console.log('Upserting NBR organization, award, ceremony...');
        const orgId      = await upsertOrg(client);
        const awardId    = await upsertAward(client, orgId);
        const ceremonyId = await upsertCeremony(client, awardId, YEAR);
        console.log(`  org_id=${orgId}  award_id=${awardId}  ceremony_id=${ceremonyId}`);

        // ── Step 2: Insert missing films ──────────────────────────────────────
        console.log('Inserting new films...');
        const filmMap = new Map<string, number>(Object.entries(KNOWN_FILMS));
        for (const f of NEW_FILMS) {
            const id = await insertFilm(client, f.title, f.release_year);
            filmMap.set(f.title, id);
            console.log(`  film: "${f.title}" → film_id=${id}`);
        }

        // ── Step 3: Upsert categories ─────────────────────────────────────────
        console.log('Upserting categories...');
        const categoryNames = [...new Set(NOMINATIONS_2025.map(n => n.category))];
        const catMap = new Map<string, number>();
        for (const name of categoryNames) {
            const id = await upsertCategory(client, awardId, name);
            catMap.set(name, id);
            console.log(`  category: "${name}" → category_id=${id}`);
        }

        // ── Step 4: Insert nominations + nomination_people ────────────────────
        console.log('Inserting nominations...');
        let inserted = 0;
        let skipped  = 0;

        for (const nom of NOMINATIONS_2025) {
            const filmId = filmMap.get(nom.film);
            if (!filmId) {
                console.warn(`  WARN: film not found: "${nom.film}" — skipping`);
                skipped++;
                continue;
            }
            const categoryId = catMap.get(nom.category)!;

            // Check for duplicate (no unique constraint on nominations)
            const existing = await client.query(`
                SELECT nomination_id FROM nominations
                WHERE ceremony_id = $1 AND category_id = $2 AND film_id = $3
            `, [ceremonyId, categoryId, filmId]);

            let nominationId: number;
            if (existing.rows.length > 0) {
                nominationId = existing.rows[0].nomination_id;
                // Update win flag in case it changed
                await client.query(`UPDATE nominations SET win = $1 WHERE nomination_id = $2`, [nom.win, nominationId]);
                skipped++;
            } else {
                const res = await client.query(`
                    INSERT INTO nominations (ceremony_id, category_id, film_id, win)
                    VALUES ($1, $2, $3, $4)
                    RETURNING nomination_id
                `, [ceremonyId, categoryId, filmId, nom.win]);
                nominationId = res.rows[0].nomination_id;
                inserted++;
            }

            // Insert nomination_people rows
            if (nom.people && nom.people.length > 0) {
                for (let i = 0; i < nom.people.length; i++) {
                    const personName = nom.people[i];
                    const personId = KNOWN_PEOPLE[personName];
                    if (!personId) {
                        console.warn(`  WARN: person not found: "${personName}"`);
                        continue;
                    }
                    await client.query(`
                        INSERT INTO nomination_people (nomination_id, person_id, credit_order)
                        VALUES ($1, $2, $3)
                        ON CONFLICT (nomination_id, person_id, role_id) DO NOTHING
                    `, [nominationId, personId, i + 1]);
                }
            }
        }

        console.log(`  Inserted ${inserted} nominations, ${skipped} already existed / skipped`);

        await client.query('COMMIT');

        // ── Summary ────────────────────────────────────────────────────────────
        const totals = await pool.query(`
            SELECT
                (SELECT COUNT(*) FROM nominations n
                 JOIN ceremonies c USING (ceremony_id)
                 WHERE c.award_id = $1 AND c.year = $2) AS nom_count,
                (SELECT COUNT(*) FROM nominations n
                 JOIN ceremonies c USING (ceremony_id)
                 WHERE c.award_id = $1 AND c.year = $2 AND n.win = true) AS win_count,
                (SELECT COUNT(*) FROM nomination_people np
                 JOIN nominations n USING (nomination_id)
                 JOIN ceremonies c USING (ceremony_id)
                 WHERE c.award_id = $1 AND c.year = $2) AS people_count
        `, [awardId, YEAR]);
        const t = totals.rows[0];
        console.log('\n✓ Done.');
        console.log(`  ${YEAR} NBR nominations : ${t.nom_count}`);
        console.log(`  Winners             : ${t.win_count}`);
        console.log(`  nomination_people   : ${t.people_count}`);
        console.log('\nNext steps:');
        console.log('  npx tsx scripts/migrateCanonicalCategories.ts');
        console.log('  npx tsx scripts/migrateCategoryMappings.ts');

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
