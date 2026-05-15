import { Pool } from 'pg';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

async function mergeCategories() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    console.log('Connected. Starting Multi-Category Merge.');

    try {
        await pool.query('BEGIN');

        // Step 1: Handle Directing/Director
        const { rows: directingAwards } = await pool.query(
            "SELECT DISTINCT award_id FROM categories WHERE name IN ('Directing', 'Director')"
        );

        for (const { award_id } of directingAwards) {
            // Find target (earliest Directing or Director record)
            const { rows: targets } = await pool.query(
                "SELECT category_id, name FROM categories WHERE award_id = $1 AND name = 'Directing' ORDER BY category_id ASC LIMIT 1",
                [award_id]
            );
            
            let targetId;
            if (targets.length > 0) {
                targetId = targets[0].category_id;
            } else {
                // If no 'Directing', pick earliest 'Director' and rename it
                const { rows: fallbacks } = await pool.query(
                    "SELECT category_id FROM categories WHERE award_id = $1 AND name = 'Director' ORDER BY category_id ASC LIMIT 1",
                    [award_id]
                );
                targetId = fallbacks[0].category_id;
                await pool.query("UPDATE categories SET name = 'Directing' WHERE category_id = $1", [targetId]);
            }

            // Find all other ids to merge
            const { rows: others } = await pool.query(
                "SELECT category_id FROM categories WHERE award_id = $1 AND name IN ('Directing', 'Director') AND category_id != $2",
                [award_id, targetId]
            );

            for (const { category_id } of others) {
                console.log(`Merging Director/Directing (${category_id}) into Directing (${targetId})`);
                await pool.query('UPDATE nominations SET category_id = $1 WHERE category_id = $2', [targetId, category_id]);
                await pool.query('DELETE FROM categories WHERE category_id = $1', [category_id]);
            }
        }

        // Step 2: Handle Editing/Film Editing
        const { rows: editingAwards } = await pool.query(
            "SELECT DISTINCT award_id FROM categories WHERE name IN ('Editing', 'Film Editing')"
        );

        for (const { award_id } of editingAwards) {
            // Find target (earliest Editing record)
            const { rows: targets } = await pool.query(
                "SELECT category_id FROM categories WHERE award_id = $1 AND name = 'Editing' ORDER BY category_id ASC LIMIT 1",
                [award_id]
            );
            
            let targetId;
            if (targets.length > 0) {
                targetId = targets[0].category_id;
            } else {
                // If no 'Editing', pick earliest 'Film Editing' and rename it
                const { rows: fallbacks } = await pool.query(
                    "SELECT category_id FROM categories WHERE award_id = $1 AND name = 'Film Editing' ORDER BY category_id ASC LIMIT 1",
                    [award_id]
                );
                targetId = fallbacks[0].category_id;
                await pool.query("UPDATE categories SET name = 'Editing' WHERE category_id = $1", [targetId]);
            }

            // Find all other ids to merge
            const { rows: others } = await pool.query(
                "SELECT category_id FROM categories WHERE award_id = $1 AND name IN ('Editing', 'Film Editing') AND category_id != $2",
                [award_id, targetId]
            );

            for (const { category_id } of others) {
                console.log(`Merging Editing/Film Editing (${category_id}) into Editing (${targetId})`);
                await pool.query('UPDATE nominations SET category_id = $1 WHERE category_id = $2', [targetId, category_id]);
                await pool.query('DELETE FROM categories WHERE category_id = $1', [category_id]);
            }
        }

        await pool.query('COMMIT');
        console.log('Categories successfully merged and renamed.');

    } catch (e) {
        await pool.query('ROLLBACK');
        console.error('Migration failed:', e);
    } finally {
        await pool.end();
    }
}

mergeCategories();
