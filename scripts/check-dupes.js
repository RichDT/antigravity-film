import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const res = await pool.query(`SELECT title, release_year, COUNT(*) as c FROM films GROUP BY title, release_year HAVING COUNT(*) > 1 LIMIT 5`);
  console.log("Duplicate films:");
  console.log(res.rows);
  
  const fkRes = await pool.query(`SELECT * FROM films WHERE title LIKE '%Kokuho%' OR title LIKE '%Kokuhō%'`);
  console.log("Kokuho rows:");
  console.log(fkRes.rows);
  
  pool.end();
}
run();
