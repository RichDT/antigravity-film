/**
 * Migrate TV-show entries out of the films table into separate archive tables.
 *
 * Background: The Globes and SAG Awards cover television, so when those
 * nominations were imported from the source CSVs, TV shows ended up in the
 * films table (one row per broadcast year, no tmdb_id). This script moves
 * them — along with all related nominations, nomination_people, and
 * film_crew rows — into tv_* archive tables so the data is preserved but
 * the main site queries are unaffected.
 *
 * Archive tables created:
 *   tv_shows            ← films rows
 *   tv_nominations      ← nominations rows
 *   tv_nomination_people ← nomination_people rows
 *   tv_film_crew        ← film_crew rows
 *
 * Original IDs are preserved as-is so records remain traceable.
 *
 * Run:  npx tsx scripts/migrateTvToArchive.ts
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ---------------------------------------------------------------------------
// CTE that identifies the TV-only film_ids:
//   • appears in at least one TV-specific category nomination
//   • never appears in any film-type category nomination
//   • never appears in any Rich Picks nomination
// ---------------------------------------------------------------------------
const TV_ONLY_CTE = `
  WITH tv_category_films AS (
    SELECT DISTINCT n.film_id
    FROM nominations n
    JOIN categories cat ON n.category_id = cat.category_id
    WHERE cat.name ILIKE '%television%'
       OR cat.name ILIKE '%drama series%'
       OR cat.name ILIKE '%comedy series%'
       OR cat.name ILIKE '%limited series%'
       OR cat.name ILIKE '%mini-series%'
       OR cat.name ILIKE '%miniseries%'
  ),
  film_category_films AS (
    SELECT DISTINCT n.film_id
    FROM nominations n
    JOIN categories cat ON n.category_id = cat.category_id
    WHERE cat.name NOT ILIKE '%television%'
      AND cat.name NOT ILIKE '%drama series%'
      AND cat.name NOT ILIKE '%comedy series%'
      AND cat.name NOT ILIKE '%limited series%'
      AND cat.name NOT ILIKE '%mini-series%'
      AND cat.name NOT ILIKE '%miniseries%'
  ),
  rich_picks AS (
    SELECT DISTINCT n.film_id
    FROM nominations n
    JOIN ceremonies c ON n.ceremony_id = c.ceremony_id
    JOIN awards a ON c.award_id = a.award_id
    JOIN organizations o ON a.organization_id = o.organization_id
    WHERE o.short_name = 'Rich Picks'
  ),
  tv_only AS (
    SELECT f.film_id
    FROM films f
    JOIN tv_category_films tcf ON f.film_id = tcf.film_id
    WHERE f.film_id NOT IN (SELECT film_id FROM film_category_films)
      AND f.film_id NOT IN (SELECT film_id FROM rich_picks)
  )
`;

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ------------------------------------------------------------------
    // 1. Create archive tables (idempotent — skip if already exist)
    // ------------------------------------------------------------------
    console.log('Creating archive tables...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS tv_shows (
        tv_show_id      INTEGER PRIMARY KEY,
        title           TEXT NOT NULL,
        release_year    INTEGER,
        original_language TEXT,
        country         TEXT,
        runtime_minutes INTEGER,
        imdb_id         TEXT,
        tmdb_id         INTEGER,
        wikipedia_url   TEXT,
        budget          TEXT,
        box_office      TEXT,
        created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        migrated_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tv_nominations (
        tv_nomination_id INTEGER PRIMARY KEY,
        tv_show_id       INTEGER REFERENCES tv_shows(tv_show_id),
        ceremony_id      INTEGER,
        category_id      INTEGER,
        win              BOOLEAN DEFAULT false,
        notes            TEXT,
        created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tv_nomination_people (
        tv_nomination_person_id INTEGER PRIMARY KEY,
        tv_nomination_id        INTEGER REFERENCES tv_nominations(tv_nomination_id),
        person_id               INTEGER,
        role_id                 INTEGER,
        credit_order            INTEGER
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tv_film_crew (
        tv_film_crew_id INTEGER PRIMARY KEY,
        tv_show_id      INTEGER REFERENCES tv_shows(tv_show_id),
        person_id       INTEGER,
        crew_role       TEXT,
        created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ------------------------------------------------------------------
    // 2. Verify no rows already migrated (re-run safety)
    // ------------------------------------------------------------------
    const { rows: [{ count: alreadyMigrated }] } = await client.query(
      `SELECT COUNT(*) FROM tv_shows`
    );
    if (parseInt(alreadyMigrated) > 0) {
      console.log(`tv_shows already has ${alreadyMigrated} rows — migration already ran. Aborting.`);
      await client.query('ROLLBACK');
      return;
    }

    // ------------------------------------------------------------------
    // 3. Copy films → tv_shows
    // ------------------------------------------------------------------
    console.log('Copying films → tv_shows...');
    const { rowCount: showsCopied } = await client.query(`
      ${TV_ONLY_CTE}
      INSERT INTO tv_shows (
        tv_show_id, title, release_year, original_language, country,
        runtime_minutes, imdb_id, tmdb_id, wikipedia_url, budget, box_office, created_at
      )
      SELECT
        f.film_id, f.title, f.release_year, f.original_language, f.country,
        f.runtime_minutes, f.imdb_id, f.tmdb_id, f.wikipedia_url, f.budget, f.box_office, f.created_at
      FROM films f
      WHERE f.film_id IN (SELECT film_id FROM tv_only)
    `);
    console.log(`  ${showsCopied} rows copied`);

    // ------------------------------------------------------------------
    // 4. Copy nominations → tv_nominations
    // ------------------------------------------------------------------
    console.log('Copying nominations → tv_nominations...');
    const { rowCount: nomsCopied } = await client.query(`
      ${TV_ONLY_CTE}
      INSERT INTO tv_nominations (
        tv_nomination_id, tv_show_id, ceremony_id, category_id, win, notes, created_at
      )
      SELECT
        n.nomination_id, n.film_id, n.ceremony_id, n.category_id, n.win, n.notes, n.created_at
      FROM nominations n
      WHERE n.film_id IN (SELECT film_id FROM tv_only)
    `);
    console.log(`  ${nomsCopied} rows copied`);

    // ------------------------------------------------------------------
    // 5. Copy nomination_people → tv_nomination_people
    // ------------------------------------------------------------------
    console.log('Copying nomination_people → tv_nomination_people...');
    const { rowCount: peopleCopied } = await client.query(`
      ${TV_ONLY_CTE}
      INSERT INTO tv_nomination_people (
        tv_nomination_person_id, tv_nomination_id, person_id, role_id, credit_order
      )
      SELECT
        np.nomination_person_id, np.nomination_id, np.person_id, np.role_id, np.credit_order
      FROM nomination_people np
      WHERE np.nomination_id IN (
        SELECT n.nomination_id FROM nominations n
        WHERE n.film_id IN (SELECT film_id FROM tv_only)
      )
    `);
    console.log(`  ${peopleCopied} rows copied`);

    // ------------------------------------------------------------------
    // 6. Copy film_crew → tv_film_crew
    // ------------------------------------------------------------------
    console.log('Copying film_crew → tv_film_crew...');
    const { rowCount: crewCopied } = await client.query(`
      ${TV_ONLY_CTE}
      INSERT INTO tv_film_crew (
        tv_film_crew_id, tv_show_id, person_id, crew_role, created_at
      )
      SELECT
        fc.film_crew_id, fc.film_id, fc.person_id, fc.crew_role, fc.created_at
      FROM film_crew fc
      WHERE fc.film_id IN (SELECT film_id FROM tv_only)
    `);
    console.log(`  ${crewCopied} rows copied`);

    // ------------------------------------------------------------------
    // 7. Delete from main tables (reverse dependency order)
    // ------------------------------------------------------------------
    console.log('Deleting from main tables...');

    const { rowCount: npDeleted } = await client.query(`
      ${TV_ONLY_CTE}
      DELETE FROM nomination_people
      WHERE nomination_id IN (
        SELECT n.nomination_id FROM nominations n
        WHERE n.film_id IN (SELECT film_id FROM tv_only)
      )
    `);
    console.log(`  nomination_people: ${npDeleted} rows deleted`);

    const { rowCount: nDeleted } = await client.query(`
      ${TV_ONLY_CTE}
      DELETE FROM nominations
      WHERE film_id IN (SELECT film_id FROM tv_only)
    `);
    console.log(`  nominations: ${nDeleted} rows deleted`);

    // Use tv_shows as the delete list for film_crew and films — the CTE above
    // cannot be reused here because the nominations it depends on were already
    // deleted in the previous step.
    const { rowCount: fcDeleted } = await client.query(`
      DELETE FROM film_crew
      WHERE film_id IN (SELECT tv_show_id FROM tv_shows)
    `);
    console.log(`  film_crew: ${fcDeleted} rows deleted`);

    const { rowCount: fDeleted } = await client.query(`
      DELETE FROM films
      WHERE film_id IN (SELECT tv_show_id FROM tv_shows)
    `);
    console.log(`  films: ${fDeleted} rows deleted`);

    // ------------------------------------------------------------------
    // 8. Verify counts match before committing
    // ------------------------------------------------------------------
    console.log('\nVerifying counts...');
    const checks = await Promise.all([
      client.query(`SELECT COUNT(*) FROM tv_shows`),
      client.query(`SELECT COUNT(*) FROM tv_nominations`),
      client.query(`SELECT COUNT(*) FROM tv_nomination_people`),
      client.query(`SELECT COUNT(*) FROM tv_film_crew`),
    ]);
    const [tvShows, tvNoms, tvPeople, tvCrew] = checks.map(r => parseInt(r.rows[0].count));
    console.log(`  tv_shows: ${tvShows}  (expected ${showsCopied})`);
    console.log(`  tv_nominations: ${tvNoms}  (expected ${nomsCopied})`);
    console.log(`  tv_nomination_people: ${tvPeople}  (expected ${peopleCopied})`);
    console.log(`  tv_film_crew: ${tvCrew}  (expected ${crewCopied})`);

    const allMatch =
      tvShows === showsCopied &&
      tvNoms === nomsCopied &&
      tvPeople === peopleCopied &&
      tvCrew === crewCopied;

    if (!allMatch) {
      console.error('\nCount mismatch — rolling back.');
      await client.query('ROLLBACK');
      process.exit(1);
    }

    await client.query('COMMIT');
    console.log('\n✅ Migration complete. All counts verified.');
    console.log(`   ${tvShows} TV shows archived`);
    console.log(`   ${tvNoms} TV nominations archived`);
    console.log(`   ${tvPeople} TV nomination_people archived`);
    console.log(`   ${tvCrew} TV film_crew entries archived`);

  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error('Fatal error — rolled back:', e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
