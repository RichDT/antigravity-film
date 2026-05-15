import { Pool } from 'pg';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

async function manualPeopleMerges() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    const merges = [
        { keep: 197, drop: 198, name: "Willie Burton" },
        { keep: 205, drop: 204, name: "Greg Butler" },
        { keep: 326, drop: 2084, name: "David Crossman" },
        { keep: 338, drop: 337, name: "Peter Czernin" },
        { keep: 397, drop: 398, name: "Robert Downey Jr." },
        { keep: 482, drop: 483, name: "Scott Fisher" },
        { keep: 685, drop: 686, name: "Doug Hemphill" },
        { keep: 836, drop: 837, name: "Peter King" },
        { keep: 986, drop: 2050, name: "Tod Maitland" },
        { keep: 992, drop: 993, name: "Mark Mangini" },
        { keep: 1016, drop: 1017, name: "Ann Maskrey" },
        { keep: 1318, drop: 1319, name: "Steven Rales" },
        { keep: 1442, drop: 2115, name: "J.D. Schwalm" },
        { keep: 1479, drop: 1478, name: "Dave Shirk" },
        { keep: 2043, drop: 1678, name: "Diane Warren" }
    ];

    try {
        await pool.query('BEGIN');
        
        for (const m of merges) {
            console.log(`Merging ${m.name} (${m.drop}) -> (${m.keep})`);
            
            const res = await pool.query('SELECT nomination_person_id, nomination_id, role_id FROM nomination_people WHERE person_id = $1', [m.drop]);
            for (const row of res.rows) {
                try {
                    await pool.query('UPDATE nomination_people SET person_id = $1 WHERE nomination_person_id = $2', [m.keep, row.nomination_person_id]);
                } catch (e: any) {
                    if (e.code === '23505') {
                        // Unique collision, gracefully delete
                        await pool.query('DELETE FROM nomination_people WHERE nomination_person_id = $1', [row.nomination_person_id]);
                    } else {
                        throw e;
                    }
                }
            }
            
            await pool.query('UPDATE other_award_people SET person_id = $1 WHERE person_id = $2', [m.keep, m.drop]).catch(() => {});
            await pool.query('DELETE FROM people WHERE person_id = $1', [m.drop]);
        }

        await pool.query('COMMIT');
        console.log('All additional manual duplicate people merged safely!');
    } catch (e) {
        await pool.query('ROLLBACK');
        console.error('Migration failed:', e);
    } finally {
        await pool.end();
    }
}

manualPeopleMerges();
