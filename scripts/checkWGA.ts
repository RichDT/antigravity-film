import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.migration' });
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function main() {
    console.log("Checking for Screenplay nominations in both WGA and Rich Picks");
    const res = await pool.query(`
        SELECT f.title, c.year, o.short_name, n.nomination_id, cat.name as category_name, p.name as person_name
        FROM nominations n
        JOIN ceremonies c USING (ceremony_id)
        JOIN categories cat USING (category_id)
        JOIN films f USING (film_id)
        JOIN awards a ON c.award_id = a.award_id
        JOIN organizations o ON a.organization_id = o.organization_id
        LEFT JOIN nomination_people np USING (nomination_id)
        LEFT JOIN people p USING (person_id)
        WHERE f.title = 'The Social Network' 
           OR f.title = 'Get Out'
           OR f.title = 'The Revenant'
        ORDER BY f.title, o.short_name
    `);
    console.log(res.rows.filter((r: any) => r.category_name.includes('Screenplay')));

    process.exit(0);
}

main();
