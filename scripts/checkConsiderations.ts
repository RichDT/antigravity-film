import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { query } from '../lib/db';

async function main() {
  try {
    const res = await query('SELECT year, COUNT(*) FROM considerations GROUP BY year ORDER BY year DESC;');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

main();
