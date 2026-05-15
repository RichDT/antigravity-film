import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.migration' });
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function main() {
    console.log("Checking adapted screenplay roles");
    const res = await pool.query(`
        SELECT p.name, r.role_name, f.title
        FROM nominations n
        JOIN ceremonies c USING (ceremony_id)
        JOIN categories cat USING (category_id)
        JOIN films f USING (film_id)
        LEFT JOIN nomination_people np USING (nomination_id)
        LEFT JOIN people p USING (person_id)
        LEFT JOIN roles r USING (role_id)
        WHERE cat.name = 'Screenplay (Adapted)'
        LIMIT 10
    `);
    console.log(res.rows);

    console.log("Checking art direction roles");
    const res2 = await pool.query(`
        SELECT p.name, r.role_name, f.title
        FROM nominations n
        JOIN ceremonies c USING (ceremony_id)
        JOIN categories cat USING (category_id)
        JOIN films f USING (film_id)
        LEFT JOIN nomination_people np USING (nomination_id)
        LEFT JOIN people p USING (person_id)
        LEFT JOIN roles r USING (role_id)
        WHERE cat.name = 'Art Direction'
        LIMIT 10
    `);
    console.log(res2.rows);

    process.exit(0);
}

main();
