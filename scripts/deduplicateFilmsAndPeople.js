require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  // Long statement timeout to allow the big SQL block to finish
  statement_timeout: 600000,
  query_timeout: 600000,
});

const FILM_DEDUP_SQL = `
DO $$
DECLARE
  r RECORD;
  canonical_id INT;
  dup_id INT;
  film_ids INT[];
  film_merged INT := 0;
  film_deleted INT := 0;
BEGIN
  -- Loop over every duplicate (title, release_year) group
  FOR r IN
    SELECT
      f.title,
      f.release_year,
      array_agg(f.film_id ORDER BY
        CASE WHEN n.film_id IS NOT NULL THEN 0 ELSE 1 END,
        f.film_id
      ) AS ordered_ids
    FROM films f
    LEFT JOIN (SELECT DISTINCT film_id FROM nominations) n ON n.film_id = f.film_id
    GROUP BY f.title, f.release_year
    HAVING COUNT(*) > 1
  LOOP
    film_ids    := r.ordered_ids;
    canonical_id := film_ids[1];

    FOR i IN 2 .. array_length(film_ids, 1) LOOP
      dup_id := film_ids[i];

      -- nominations: move rows that won't create a (ceremony_id, category_id) collision
      UPDATE nominations
        SET film_id = canonical_id
        WHERE film_id = dup_id
          AND NOT EXISTS (
            SELECT 1 FROM nominations n2
            WHERE n2.film_id = canonical_id
              AND n2.ceremony_id = nominations.ceremony_id
              AND n2.category_id = nominations.category_id
          );
      DELETE FROM nominations WHERE film_id = dup_id;

      -- reviews: merge first non-conflicting, then drop rest
      INSERT INTO reviews (film_id, grade, review_text, created_at, updated_at)
        SELECT canonical_id, grade, review_text, created_at, updated_at
        FROM reviews WHERE film_id = dup_id
        ON CONFLICT (film_id) DO NOTHING;
      DELETE FROM reviews WHERE film_id = dup_id;

      -- considerations
      INSERT INTO considerations (film_id, category_id, year, detail, created_at)
        SELECT canonical_id, category_id, year, detail, created_at
        FROM considerations WHERE film_id = dup_id
        ON CONFLICT DO NOTHING;
      DELETE FROM considerations WHERE film_id = dup_id;

      -- film_crew
      INSERT INTO film_crew (film_id, person_id, crew_role, created_at)
        SELECT canonical_id, person_id, crew_role, created_at
        FROM film_crew WHERE film_id = dup_id
        ON CONFLICT DO NOTHING;
      DELETE FROM film_crew WHERE film_id = dup_id;

      -- songs (no unique constraint, just reassign)
      UPDATE songs SET film_id = canonical_id WHERE film_id = dup_id;

      -- delete the duplicate film
      DELETE FROM films WHERE film_id = dup_id;
      film_deleted := film_deleted + 1;
    END LOOP;

    film_merged := film_merged + 1;
  END LOOP;

  RAISE NOTICE 'Films: merged % groups, deleted % duplicate rows', film_merged, film_deleted;
END;
$$;
`;

const PEOPLE_DEDUP_SQL = `
DO $$
DECLARE
  r RECORD;
  canonical_id INT;
  dup_id INT;
  person_ids INT[];
  person_merged INT := 0;
  person_deleted INT := 0;
BEGIN
  FOR r IN
    SELECT
      p.name,
      array_agg(p.person_id ORDER BY
        CASE WHEN np.person_id IS NOT NULL THEN 0 ELSE 1 END,
        p.person_id
      ) AS ordered_ids
    FROM people p
    LEFT JOIN (SELECT DISTINCT person_id FROM nomination_people) np ON np.person_id = p.person_id
    GROUP BY p.name
    HAVING COUNT(*) > 1
  LOOP
    person_ids   := r.ordered_ids;
    canonical_id := person_ids[1];

    FOR i IN 2 .. array_length(person_ids, 1) LOOP
      dup_id := person_ids[i];

      -- nomination_people
      INSERT INTO nomination_people (nomination_id, person_id, role_id, credit_order)
        SELECT nomination_id, canonical_id, role_id, credit_order
        FROM nomination_people WHERE person_id = dup_id
        ON CONFLICT DO NOTHING;
      DELETE FROM nomination_people WHERE person_id = dup_id;

      -- film_crew
      INSERT INTO film_crew (film_id, person_id, crew_role, created_at)
        SELECT film_id, canonical_id, crew_role, created_at
        FROM film_crew WHERE person_id = dup_id
        ON CONFLICT DO NOTHING;
      DELETE FROM film_crew WHERE person_id = dup_id;

      -- delete the duplicate person
      DELETE FROM people WHERE person_id = dup_id;
      person_deleted := person_deleted + 1;
    END LOOP;

    person_merged := person_merged + 1;
  END LOOP;

  RAISE NOTICE 'People: merged % groups, deleted % duplicate rows', person_merged, person_deleted;
END;
$$;
`;

async function runSql(label, sql) {
  const client = await pool.connect();
  try {
    console.log(`\nRunning: ${label} ...`);
    const start = Date.now();
    await client.query(sql);
    console.log(`✓ ${label} completed in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await runSql('Film deduplication', FILM_DEDUP_SQL);
    await runSql('People deduplication', PEOPLE_DEDUP_SQL);
    console.log('\n✅ All done.');
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
