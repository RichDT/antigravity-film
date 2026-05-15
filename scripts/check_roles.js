import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

async function check() {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    
    const res = await client.query(`
        SELECT p.name AS person_name, r.role_name, n.nomination_id
        FROM nomination_people np
        JOIN people p USING (person_id)
        JOIN roles r USING (role_id)
        JOIN nominations n USING (nomination_id)
        JOIN ceremonies c USING (ceremony_id)
        JOIN awards a USING (award_id)
        JOIN organizations o USING (organization_id)
        WHERE o.short_name = 'BAFTA'
          AND p.name = r.role_name
        LIMIT 10
    `);
    console.table(res.rows);

    await client.end();
}
check();
