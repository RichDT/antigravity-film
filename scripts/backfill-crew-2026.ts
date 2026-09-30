/**
 * One-time script: fetch Wikipedia crew for 2026 consideration films missing data.
 * Run: npx tsx scripts/backfill-crew-2026.ts
 */
import 'dotenv/config';
import { Pool } from 'pg';
import { fetchWikipediaCrew } from '../lib/wikipedia-crew';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ROLE_MAP: { key: keyof Awaited<ReturnType<typeof fetchWikipediaCrew>>; role: string }[] = [
  { key: 'directors',        role: 'Director' },
  { key: 'writers',          role: 'Writer' },
  { key: 'editors',          role: 'Editor' },
  { key: 'cinematographers', role: 'Cinematographer' },
  { key: 'composers',        role: 'Composer' },
  { key: 'costumeDesigners', role: 'Costume Designer' },
];

async function run() {
  const { rows: films } = await pool.query<{ film_id: number; title: string; release_year: number }>(
    `SELECT DISTINCT f.film_id, f.title, f.release_year
     FROM considerations c
     JOIN films f USING (film_id)
     WHERE c.year = 2026
     ORDER BY f.title`
  );

  for (const film of films) {
    console.log(`\n→ ${film.title} (${film.release_year})`);
    const crew = await fetchWikipediaCrew(film.title, film.release_year || 2026);
    const total = Object.values(crew).flat().length;
    if (total === 0) { console.log('  no Wikipedia data found'); continue; }

    for (const { key, role } of ROLE_MAP) {
      const names = crew[key] as string[];
      for (const name of names) {
        let { rows } = await pool.query(`SELECT person_id FROM people WHERE LOWER(name) = LOWER($1)`, [name]);
        let personId: number;
        if (rows.length > 0) {
          personId = rows[0].person_id;
        } else {
          const ins = await pool.query(`INSERT INTO people (name) VALUES ($1) RETURNING person_id`, [name]);
          personId = ins.rows[0].person_id;
        }
        await pool.query(
          `INSERT INTO film_crew (film_id, person_id, crew_role) VALUES ($1, $2, $3) ON CONFLICT (film_id, person_id, crew_role) DO NOTHING`,
          [film.film_id, personId, role]
        );
        console.log(`  ✓ ${role}: ${name}`);
      }
    }
  }

  await pool.end();
  console.log('\nDone.');
}

run().catch(err => { console.error(err); process.exit(1); });
