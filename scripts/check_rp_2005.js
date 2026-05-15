import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

async function check() {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    
    const res = await client.query(`
        SELECT cat.name as category_name
        FROM nominations n
        JOIN ceremonies c USING (ceremony_id)
        JOIN categories cat USING (category_id)
        JOIN awards a ON c.award_id = a.award_id
        JOIN organizations o ON a.organization_id = o.organization_id
        WHERE o.short_name = 'Rich Picks' AND c.year = 2005
        GROUP BY cat.name
    `);
    
    const rpCategories = res.rows.map(r => r.category_name);
    console.log("Rich Picks Categories for 2005:", rpCategories);
    
    // Check which ones have NO mappings
    for (const catName of rpCategories) {
        const canonRows = await client.query(`
            SELECT m.other_canonical_id
            FROM category_mappings m
            JOIN canonical_categories rp_cc ON m.rp_canonical_id = rp_cc.canonical_category_id
            JOIN organizations o ON rp_cc.organization_id = o.organization_id
            WHERE o.short_name = 'Rich Picks' AND rp_cc.name = $1
        `, [catName]);
        if (canonRows.rows.length === 0) {
            console.log("NO MAPPINGS FOR:", catName);
        }
    }

    await client.end();
}
check();
