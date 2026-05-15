import { Pool } from 'pg';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function main() {
    const res = await pool.query(`
        SELECT
            rp.name AS rp_category,
            cm.match_type,
            o.short_name AS org,
            ext.name AS external_canonical
        FROM category_mappings cm
        JOIN canonical_categories rp ON rp.canonical_category_id = cm.rp_canonical_id
        JOIN canonical_categories ext ON ext.canonical_category_id = cm.other_canonical_id
        JOIN organizations o ON o.organization_id = ext.organization_id
        ORDER BY rp.name, cm.match_type DESC, o.short_name, ext.name
    `);

    let currentCat = '';
    for (const r of res.rows) {
        if (r.rp_category !== currentCat) {
            if (currentCat !== '') console.log('');
            console.log('── ' + r.rp_category);
            currentCat = r.rp_category;
        }
        const tag = r.match_type === 'slant' ? ' [slant]' : '';
        console.log('   ' + r.org.padEnd(14) + r.external_canonical + tag);
    }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => pool.end());
