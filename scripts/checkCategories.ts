import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const res = await client.query("SELECT name FROM categories WHERE award_id = (SELECT award_id FROM awards WHERE name = 'Rich Picks' LIMIT 1) ORDER BY name;");
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}

main().catch(console.error);
