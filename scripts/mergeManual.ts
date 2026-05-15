import { Pool } from 'pg';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

async function manualMerges() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await pool.query('BEGIN');
        
        console.log('Merging Birdman (641) into Birdman (640)...');
        await pool.query('UPDATE nominations SET film_id = 640 WHERE film_id = 641');
        await pool.query('UPDATE songs SET film_id = 640 WHERE film_id = 641'); // just in case
        await pool.query('DELETE FROM films WHERE film_id = 641');

        console.log('Merging Birdman of Alcatraz (2342) into (2336)...');
        await pool.query('UPDATE nominations SET film_id = 2336 WHERE film_id = 2342');
        await pool.query('UPDATE songs SET film_id = 2336 WHERE film_id = 2342');
        await pool.query('DELETE FROM films WHERE film_id = 2342');

        console.log('Merging Alejandro G. Iñárritu (9437) into Alejandro González Iñárritu (576)...');
        // Handle potential unique constraint overlaps carefully in nomination_people
        const res = await pool.query('SELECT nomination_person_id, nomination_id, role_id FROM nomination_people WHERE person_id = 9437');
        for (const row of res.rows) {
            try {
                await pool.query('UPDATE nomination_people SET person_id = 576 WHERE nomination_person_id = $1', [row.nomination_person_id]);
            } catch (e: any) {
                // If collision happens, it means 576 is already attached to this nomination in this role! Just delete the redundant 9437 link.
                if (e.code === '23505') {
                    await pool.query('DELETE FROM nomination_people WHERE nomination_person_id = $1', [row.nomination_person_id]);
                } else {
                    throw e;
                }
            }
        }
        await pool.query('DELETE FROM people WHERE person_id = 9437');

        await pool.query('COMMIT');
        console.log('Manual merges completed successfully!');
    } catch (e) {
        await pool.query('ROLLBACK');
        console.error('Migration failed:', e);
    } finally {
        await pool.end();
    }
}

manualMerges();
