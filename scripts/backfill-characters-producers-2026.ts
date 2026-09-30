import { Pool } from 'pg';
import { fetchWikipediaCrew, findFilmWikitext, findCharacter } from '../lib/wikipedia-crew';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const { rows: acting } = await pool.query(
    `SELECT c.consideration_id, c.detail, f.title, f.release_year
     FROM considerations c JOIN films f USING (film_id) JOIN categories cat USING (category_id)
     WHERE c.year = 2026 AND (cat.name LIKE 'Actor%' OR cat.name LIKE 'Actress%') AND c.detail IS NOT NULL`
  );
  for (const r of acting) {
    const wt = await findFilmWikitext(r.title, r.release_year || 2026);
    const ch = wt ? findCharacter(wt, r.detail) : null;
    console.log(`${r.detail} (${r.title}) → ${ch ?? 'NOT FOUND'}`);
    if (ch) await pool.query(`UPDATE considerations SET character = $1 WHERE consideration_id = $2`, [ch, r.consideration_id]);
  }

  const { rows: films } = await pool.query(
    `SELECT DISTINCT f.film_id, f.title, f.release_year
     FROM considerations c JOIN films f USING (film_id) JOIN categories cat USING (category_id)
     WHERE c.year = 2026 AND cat.name IN ('Live-Action Feature','International Feature','Animated Feature','Documentary')`
  );
  for (const f of films) {
    const { producers } = await fetchWikipediaCrew(f.title, f.release_year || 2026);
    console.log(`${f.title} producers → ${producers.join('; ') || 'NOT FOUND'}`);
    for (const name of producers) {
      const found = await pool.query(`SELECT person_id FROM people WHERE LOWER(name) = LOWER($1)`, [name]);
      const personId = found.rows[0]?.person_id ?? (await pool.query(`INSERT INTO people (name) VALUES ($1) RETURNING person_id`, [name])).rows[0].person_id;
      await pool.query(
        `INSERT INTO film_crew (film_id, person_id, crew_role) VALUES ($1, $2, 'Producer') ON CONFLICT (film_id, person_id, crew_role) DO NOTHING`,
        [f.film_id, personId]
      );
    }
  }
  await pool.end();
}
run().catch(e => { console.error(e); process.exit(1); });
