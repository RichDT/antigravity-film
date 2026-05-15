require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function findDuplicates() {
  try {
    const res = await pool.query(`
      SELECT title, release_year, COUNT(*) as count, array_agg(film_id) as ids
      FROM films
      GROUP BY title, release_year
      HAVING COUNT(*) > 1
      ORDER BY count DESC;
    `);
    
    console.log(`Found ${res.rows.length} groups of duplicate films.`);
    if (res.rows.length > 0) {
      console.log('Top 10 duplicate films:');
      console.table(res.rows.slice(0, 10));
    }
    
    const resPeople = await pool.query(`
      SELECT name, COUNT(*) as count, array_agg(person_id) as ids
      FROM people
      GROUP BY name
      HAVING COUNT(*) > 1
      ORDER BY count DESC;
    `);
    
    console.log(`Found ${resPeople.rows.length} groups of duplicate people.`);
    if (resPeople.rows.length > 0) {
      console.log('Top 10 duplicate people:');
      console.table(resPeople.rows.slice(0, 10));
    }
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

findDuplicates();
