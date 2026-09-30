import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const YEAR = 2026;

// From awards-watch-2026.md (trade awards coverage); seen + unconfirmed titles excluded
const TITLES = [
  'The Odyssey', 'Michael', 'Toy Story 5', 'Hoppers', 'Dune: Part Three', 'Digger', 'Behemoth!',
  'Wild Horse Nine', 'The Debut', 'The Invite', 'Obsession', 'Fjord', 'La Bola Negra', 'Fatherland',
  'Being Heumann', 'Sense and Sensibility', 'The Social Reckoning', 'Werwulf', 'Ink', 'Bucking Fastard',
  'Here Comes the Flood', 'The Mosquito Bowl', 'Wildwood', 'Ray Gunn', 'Verity', 'Elsinore',
  'Tender Loving Care', 'Power Ballad', 'Gentle Monster', 'Clarissa', 'All of a Sudden', 'Tenzing',
  'Madden', 'I Play Rocky', 'Club Kid', 'Your Mother Your Mother Your Mother', 'Misty Green',
  'You Can See Everything', 'Paper Tiger', 'Minotaur', 'Rose', 'Tuner', 'Bunker', 'Coward', 'Josephine',
  'Artificial', 'Heart of the Beast', 'Mr. Irrelevant', 'A Long Winter', 'The Housewife', 'Musk',
  'The Life and Deaths of Wilson Shedd', 'A Talent for Murder', 'The Last Photograph',
];

// Verified against Wikipedia festival pages / TIFF announcement coverage
const ACCOLADES: [string, string, string][] = [
  ['Fjord', 'cannes', "Palme d'Or"],
  ['Minotaur', 'cannes', 'Grand Prix'],
  ['La Bola Negra', 'cannes', 'Best Director (shared)'],
  ['La Bola Negra', 'tiff', "People's Choice Award"],
  ['Fatherland', 'cannes', 'Best Director (shared)'],
  ['All of a Sudden', 'cannes', 'Best Actress — Virginie Efira & Tao Okamoto'],
  ['Coward', 'cannes', 'Best Actor — Emmanuel Macchia & Valentin Campagne'],
  ['Wild Horse Nine', 'venice', 'Volpi Cup for Best Actor — John Malkovich'],
  ['Rose', 'berlin', 'Silver Bear for Best Leading Performance — Sandra Hüller'],
  ['Josephine', 'sundance', 'Grand Jury Prize, U.S. Dramatic'],
  ['Josephine', 'sundance', 'Audience Award, U.S. Dramatic'],
  ['I Play Rocky', 'tiff', "People's Choice Award — 1st runner-up"],
  ['Being Heumann', 'tiff', "People's Choice Award — 2nd runner-up"],
  ['Elsinore', 'tiff', "International People's Choice Award"],
];

async function run() {
  const ids = new Map<string, number>();
  for (const title of TITLES) {
    const found = await pool.query(
      `SELECT f.film_id, r.grade FROM films f LEFT JOIN reviews r USING (film_id)
       WHERE LOWER(f.title) = LOWER($1) AND f.release_year = $2`, [title, YEAR]);
    if (found.rows[0]?.grade) { console.log(`  skip (already reviewed): ${title}`); continue; }
    const filmId = found.rows[0]?.film_id
      ?? (await pool.query(`INSERT INTO films (title, release_year) VALUES ($1, $2) RETURNING film_id`, [title, YEAR])).rows[0].film_id;
    ids.set(title, filmId);
    await pool.query(`INSERT INTO unseen_films (film_id, year) VALUES ($1, $2) ON CONFLICT (film_id, year) DO NOTHING`, [filmId, YEAR]);
  }
  for (const [title, source, label] of ACCOLADES) {
    const filmId = ids.get(title);
    if (!filmId) continue;
    const dup = await pool.query(`SELECT 1 FROM film_accolades WHERE film_id = $1 AND source = $2 AND label = $3`, [filmId, source, label]);
    if (dup.rowCount === 0) await pool.query(`INSERT INTO film_accolades (film_id, source, label) VALUES ($1, $2, $3)`, [filmId, source, label]);
  }
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM unseen_films WHERE year = $1`, [YEAR]);
  const acc = await pool.query(`SELECT COUNT(*)::int AS n FROM film_accolades`);
  console.log(`anticipated 2026: ${rows[0].n}, accolades: ${acc.rows[0].n}`);
  await pool.end();
}
run().catch(e => { console.error(e); process.exit(1); });
