require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const films = await pool.query(`
    SELECT title, release_year, COUNT(*) as count, array_agg(film_id ORDER BY film_id) as ids
    FROM films
    GROUP BY title, release_year
    HAVING COUNT(*) > 1
    ORDER BY title, release_year;
  `);

  const people = await pool.query(`
    SELECT name, COUNT(*) as count, array_agg(person_id ORDER BY person_id) as ids
    FROM people
    GROUP BY name
    HAVING COUNT(*) > 1
    ORDER BY name;
  `);

  const output = { films: films.rows, people: people.rows };
  fs.writeFileSync('/tmp/dedup_data.json', JSON.stringify(output, null, 2));
  console.log(`Films: ${films.rowCount}, People: ${people.rowCount}`);
  await pool.end();
}

run().catch(e => { console.error(e); process.exit(1); });
