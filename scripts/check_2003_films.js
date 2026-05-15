import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

async function check() {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    
    const res = await client.query(`
        SELECT film_id, title 
        FROM films 
        WHERE title ILIKE '%Barbarian Invasions%' OR title ILIKE '%Good Bye%Lenin%'
    `);
    console.table(res.rows);

    await client.end();
}
check();
