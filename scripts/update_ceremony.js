import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

async function check() {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    
    // Change 709 to year 2004
    await client.query(`UPDATE ceremonies SET year = 2004 WHERE ceremony_id = 709`);
    
    console.log("Updated 709 to 2004");
    await client.end();
}
check();
