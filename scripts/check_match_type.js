import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

async function check() {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    
    const res = await client.query(`
        SELECT cc_rp.name as rp_cat, o.short_name, cc_ext.name as ext_cat, m.match_type
        FROM category_mappings m
        JOIN canonical_categories cc_rp ON m.rp_canonical_id = cc_rp.canonical_category_id
        JOIN canonical_categories cc_ext ON m.other_canonical_id = cc_ext.canonical_category_id
        JOIN organizations o ON cc_ext.organization_id = o.organization_id
        WHERE o.short_name = 'BAFTA'
        LIMIT 20
    `);
    console.table(res.rows);

    await client.end();
}
check();
