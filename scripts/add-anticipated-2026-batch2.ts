import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const TITLES = [
  'Possible Love', 'Primetime', 'The Further Mis-Adventures of Cliff Booth',
  'The Devil Wears Prada 2', 'Cry to Heaven', 'Pressure', 'The Entertainment System Is Down',
  'Godzilla Minus Zero', 'Avengers: Doomsday', 'The Mandalorian and Grogu',
];
const ACCOLADES: [string, string, string][] = [['Possible Love', 'venice', 'Grand Jury Prize']];
async function run() {
  const ids = new Map<string, number>();
  for (const title of TITLES) {
    const found = await pool.query(
      `SELECT f.film_id, r.grade FROM films f LEFT JOIN reviews r USING (film_id)
       WHERE LOWER(f.title) = LOWER($1) AND f.release_year = 2026`, [title]);
    if (found.rows[0]?.grade) { console.log(`skip (reviewed ${found.rows[0].grade}): ${title}`); continue; }
    const filmId = found.rows[0]?.film_id
      ?? (await pool.query(`INSERT INTO films (title, release_year) VALUES ($1, 2026) RETURNING film_id`, [title])).rows[0].film_id;
    ids.set(title, filmId);
    await pool.query(`INSERT INTO unseen_films (film_id, year) VALUES ($1, 2026) ON CONFLICT (film_id, year) DO NOTHING`, [filmId]);
    console.log(`added: ${title}`);
  }
  for (const [t, s, l] of ACCOLADES) {
    const id = ids.get(t); if (!id) continue;
    const d = await pool.query(`SELECT 1 FROM film_accolades WHERE film_id=$1 AND source=$2 AND label=$3`, [id, s, l]);
    if (!d.rowCount) await pool.query(`INSERT INTO film_accolades (film_id, source, label) VALUES ($1,$2,$3)`, [id, s, l]);
  }
  console.log((await pool.query(`SELECT COUNT(*)::int n FROM unseen_films WHERE year=2026`)).rows[0]);
  await pool.end();
}
run();
