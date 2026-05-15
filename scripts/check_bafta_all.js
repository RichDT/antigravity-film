import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

async function check() {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    
    const res = await client.query(`SELECT ceremony_id, year FROM ceremonies WHERE award_id = 4 ORDER BY year ASC LIMIT 10`);
    console.table(res.rows);

    await client.end();
}
check();
