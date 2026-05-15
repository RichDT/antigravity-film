import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

async function check() {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    
    // Check BAFTA 709
    const res = await client.query(`
        SELECT f.title
        FROM nominations n
        JOIN films f ON n.film_id = f.film_id
        WHERE n.ceremony_id = 709
        LIMIT 5
    `);
    console.table(res.rows);

    await client.end();
}
check();
