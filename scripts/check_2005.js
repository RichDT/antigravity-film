import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

async function check() {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    
    const res = await client.query(`
        SELECT f.title
        FROM nominations n
        JOIN films f ON n.film_id = f.film_id
        JOIN ceremonies c ON n.ceremony_id = c.ceremony_id
        WHERE c.award_id = 4 AND c.year = 2005
        LIMIT 5
    `);
    console.table(res.rows);

    await client.end();
}
check();
