import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.migration' });
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function main() {
    console.log("Checking nominations with multiple rows mapping to same film + category");
    const res = await pool.query(`
        SELECT c.year, cat.name as category_name, f.title as film_title, 
               COUNT(n.nomination_id) as num_noms,
               COUNT(DISTINCT n.nomination_id) as distinct_noms,
               json_agg(p.name) as people
        FROM nominations n
        JOIN ceremonies c USING (ceremony_id)
        JOIN categories cat USING (category_id)
        JOIN awards a ON c.award_id = a.award_id
        JOIN organizations o ON a.organization_id = o.organization_id
        JOIN films f USING (film_id)
        LEFT JOIN nomination_people np USING (nomination_id)
        LEFT JOIN people p ON np.person_id = p.person_id
        WHERE o.short_name = 'Rich Picks' 
          AND cat.name NOT LIKE '%Actor%' 
          AND cat.name NOT LIKE '%Actress%'
          AND cat.name != 'Original Song'
        GROUP BY c.year, cat.name, f.title
        HAVING COUNT(DISTINCT n.nomination_id) > 1
        ORDER BY num_noms DESC
        LIMIT 10
    `);
    console.log("Multiple nominations for same film/category:", res.rows);
    process.exit(0);
}

main();
