import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const orgs = await client.query("SELECT * FROM organizations;");
  const awards = await client.query("SELECT * FROM awards;");
  console.log('ORGS:', JSON.stringify(orgs.rows, null, 2));
  console.log('AWARDS:', JSON.stringify(awards.rows, null, 2));
  await client.end();
}

main().catch(console.error);
