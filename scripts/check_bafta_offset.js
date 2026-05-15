import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

async function check() {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    
    // Check BAFTA 2024
    const res = await client.query(`
        SELECT f.title, c.year
        FROM nominations n
        JOIN ceremonies c ON n.ceremony_id = c.ceremony_id
        JOIN films f ON n.film_id = f.film_id
        WHERE c.award_id = 4 AND c.year = 2024
        LIMIT 5
    `);
    console.table(res.rows);

    await client.end();
}
check();
