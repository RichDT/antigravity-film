import { Pool } from 'pg';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

async function flagInvertedNames() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    console.log('Connected to DB for East Asian name formatting.');

    try {
        // 1. Merge duplicates manually
        console.log('Merging duplicate Bong Joon-ho and Youn Yuh-jung rows...');
        // Bong Joon-ho
        await pool.query('UPDATE nomination_people SET person_id = 151 WHERE person_id = 2733');
        await pool.query('DELETE FROM people WHERE person_id = 2733');

        // Youn Yuh-jung
        await pool.query('UPDATE nomination_people SET person_id = 1764 WHERE person_id = 2643');
        await pool.query('DELETE FROM people WHERE person_id = 2643');

        // 2. Identify known East Asian creators that should be inverted
        const invertedTargets = [
            151, // Bong Joon-ho
            1764, // Youn Yuh-jung
            1521, // Song Kang-ho
            1230, // Park Chan-wook
            638,  // Ryûsuke Hamaguchi
            1101, // Hayao Miyazaki
            2366, // Lee Kyoung-mi
            1231, // Park Eun-kyo
            264 // Choi Tae-young
        ];

        console.log('Flagging inverted names...');
        for (let id of invertedTargets) {
            await pool.query(`
                UPDATE people 
                SET is_inverted_name = true, 
                    name = last_name || ' ' || first_name
                WHERE person_id = $1 AND first_name IS NOT NULL AND last_name IS NOT NULL
            `, [id]);
        }

        console.log('Name inversion flagged and merged globally.');

    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        await pool.end();
    }
}

flagInvertedNames();
