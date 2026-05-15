import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

async function check() {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    
    const res = await client.query(`
        SELECT n.nomination_id, COUNT(np2.person_id) as total_people, p.name
        FROM nomination_people np
        JOIN people p USING (person_id)
        JOIN roles r USING (role_id)
        JOIN nominations n USING (nomination_id)
        JOIN ceremonies c USING (ceremony_id)
        JOIN awards a USING (award_id)
        JOIN organizations o USING (organization_id)
        JOIN nomination_people np2 ON n.nomination_id = np2.nomination_id
        WHERE o.short_name = 'BAFTA'
          AND p.name = r.role_name
        GROUP BY n.nomination_id, p.name
        HAVING COUNT(np2.person_id) = 1
    `);
    console.table(res.rows);

    await client.end();
}
check();
