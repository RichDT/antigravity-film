import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

async function check() {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    
    const res = await client.query(`
        SELECT c.name as cat_name, ccm.canonical_category_id 
        FROM categories c
        JOIN awards a ON c.award_id = a.award_id
        LEFT JOIN category_canonical_map ccm ON c.category_id = ccm.category_id
        WHERE a.organization_id = 4
        LIMIT 10
    `);
    console.table(res.rows);

    await client.end();
}
check();
