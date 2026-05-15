import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

async function fix() {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    
    console.log("Deleting bogus people parsed as roles from nomination_people...");
    const res = await client.query(`
        DELETE FROM nomination_people np
        USING people p, roles r, nominations n, ceremonies c, awards a, organizations o
        WHERE np.person_id = p.person_id
          AND np.role_id = r.role_id
          AND np.nomination_id = n.nomination_id
          AND n.ceremony_id = c.ceremony_id
          AND c.award_id = a.award_id
          AND a.organization_id = o.organization_id
          AND o.short_name = 'BAFTA'
          AND p.name = r.role_name
        RETURNING p.name
    `);
    
    console.log(`Deleted ${res.rowCount} bogus records.`);
    
    await client.end();
}
fix();
