import { Pool } from 'pg';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

async function flagKoreanNames() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    console.log('Connected to DB for Korean name heuristic processing.');

    try {
        console.log('Merging further duplicates based on flipped name strings...');
        const merges = [
            { keep: 263, drop: 2783 },   // Cho Won-woo
            { keep: 644, drop: 2779 },   // Han Jin-won
            { keep: 875, drop: 2734 },   // Kwak Sin-ae
            { keep: 925, drop: 2784 },   // Lee Ha-jun
            { keep: 1752, drop: 2765 },  // Yang Jin-mo
            { keep: 1230, drop: 6900 },  // Park Chan-wook
            { keep: 1230, drop: 6902 }   // Park Chan-wook
        ];

        for (const m of merges) {
            await pool.query('UPDATE nomination_people SET person_id = $1 WHERE person_id = $2', [m.keep, m.drop]);
            await pool.query('DELETE FROM people WHERE person_id = $1', [m.drop]);
            await pool.query(`
                UPDATE people 
                SET is_inverted_name = true, 
                    name = last_name || ' ' || first_name
                WHERE person_id = $1 AND first_name IS NOT NULL AND last_name IS NOT NULL
            `, [m.keep]);
        }

        console.log('Applying heuristic to rest of database...');
        // Find everyone with '-' in first name, no '-' in last name, who is not Western.
        const res = await pool.query(`
            SELECT person_id, first_name, last_name 
            FROM people 
            WHERE first_name LIKE '%-%' 
              AND last_name NOT LIKE '%-%' 
              AND is_inverted_name = false
        `);

        const westernHyphens = ['jean-', 'pierre-', 'lin-', 'marie-', 'marc-', 'paul-', 'anne-', 'claude-', 'louis-', 'jacques-', 'jayne-', 'erik-', 'liane-'];

        let count = 0;
        for (const row of res.rows) {
            const lowerFirst = (row.first_name || '').toLowerCase();
            if (westernHyphens.some(h => lowerFirst.startsWith(h))) {
                continue; // Skip Western or mixed names
            }
            if (['Erik-Jan', 'Jayne-Ann', 'Yves-Marie'].includes(row.first_name)) {
                continue;
            }

            // Re-map the heuristic match securely.
            await pool.query(`
                UPDATE people 
                SET is_inverted_name = true, 
                    name = last_name || ' ' || first_name
                WHERE person_id = $1
            `, [row.person_id]);
            count++;
        }

        console.log('Heuristic successfully applied globally to', count, 'Korean creators. Duplicates eliminated securely.');

    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        await pool.end();
    }
}

flagKoreanNames();
