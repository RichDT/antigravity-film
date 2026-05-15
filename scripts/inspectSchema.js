require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// We need to check which columns actually exist in each table
async function getColumns(client, table) {
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public'`,
    [table]
  );
  return rows.map(r => r.column_name);
}

async function main() {
  const client = await pool.connect();
  try {
    // Inspect table structures first
    const reviewsCols = await getColumns(client, 'reviews');
    const considerationsCols = await getColumns(client, 'considerations');
    const filmCrewCols = await getColumns(client, 'film_crew');
    const songsCols = await getColumns(client, 'songs');
    const nomPeopleCols = await getColumns(client, 'nomination_people');

    console.log('reviews columns:', reviewsCols);
    console.log('considerations columns:', considerationsCols);
    console.log('film_crew columns:', filmCrewCols);
    console.log('songs columns:', songsCols);
    console.log('nomination_people columns:', nomPeopleCols);

    await client.release();
    await pool.end();
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}

main();
