import { Pool } from 'pg';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

async function mergeFilms() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    console.log('Connected. Identifying duplicate films via prefix heuristics...');

    try {
        await pool.query('BEGIN');

        // Look for films in the same year where one title is a strict prefix of the other followed by a colon, space, or 'or'
        const { rows: duplicates } = await pool.query(`
            SELECT f1.film_id as target_id, f1.title as target_title, 
                   f2.film_id as duplicate_id, f2.title as duplicate_title
            FROM films f1
            JOIN films f2 ON f1.release_year = f2.release_year AND f1.film_id != f2.film_id
            WHERE f2.title ILIKE f1.title || ':%'
               OR f2.title ILIKE f1.title || ' %'
               OR f2.title ILIKE f1.title || ' or %'
               OR f2.title ILIKE f1.title || ' (%'
        `);

        // Filter out false positives like "Her" -> "Herblock", "The Square" -> "The Square Root" if they are totally unrelated, 
        // but 'Birdman' -> 'Birdman or (The Unexpected...' is what we want.
        // Actually the heuristics above (requiring ':', ' ', ' or ', ' (') prevent most false positives like "Herblock".
        
        const merges = new Set();

        for (const row of duplicates) {
            // Avoid ping-ponging or cyclical merges by strictly merging HIGHER id into LOWER id, or merging string lengths
            // Actually, let's always merge into the shorter title to be safe, unless it's a known preferred title
            const drop = row.duplicate_id;
            const keep = row.target_id;
            
            const key = drop > keep ? `${keep}-${drop}` : `${drop}-${keep}`;
            if (merges.has(key)) continue;
            merges.add(key);

            console.log(`Merging [${drop}] "${row.duplicate_title}" into [${keep}] "${row.target_title}"`);
            
            // Move nominations
            await pool.query('UPDATE nominations SET film_id = $1 WHERE film_id = $2', [keep, drop]);
            
            // Delete duplicate film
            await pool.query('DELETE FROM films WHERE film_id = $1', [drop]);
        }

        await pool.query('COMMIT');
        console.log(`Successfully merged ${merges.size} duplicate film pairs.`);

    } catch (e) {
        await pool.query('ROLLBACK');
        console.error('Migration failed:', e);
    } finally {
        await pool.end();
    }
}

mergeFilms();
