import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

const merges = [
    { canonicalId: 18717, duplicateId: 4777, title: "Back to the Future" },
    { canonicalId: 18767, duplicateId: 4441, title: "E.T. the Extra-Terrestrial" },
    { canonicalId: 18772, duplicateId: 4499, title: "Quest for Fire" },
    { canonicalId: 18768, duplicateId: 4503, title: "Shoot the Moon" },
    { canonicalId: 4220, duplicateId: 18799, title: "My Brilliant Career" },
    { canonicalId: 4290, duplicateId: 18800, title: "Urban Cowboy" },
    { canonicalId: 1453, duplicateId: 12879, title: "First Cow" },
    { canonicalId: 18443, duplicateId: 7004, title: "Eternal Sunshine of the Spotless Mind" },
    { canonicalId: 18875, duplicateId: 3561, title: "Lacombe, Lucien" },
    { canonicalId: 3105, duplicateId: 18950, title: "M*A*S*H" },
    { canonicalId: 7076, duplicateId: 11370, title: "The Sea Inside" },
    { canonicalId: 14758, duplicateId: 5906, title: "Three Colours: Red" },
    { canonicalId: 1237, duplicateId: 11113, title: "Anatomy of a Fall" },
    { canonicalId: 13913, duplicateId: 11117, title: "Tótem" },
    { canonicalId: 1032, duplicateId: 1454, title: "The Midnight Sky" }
];

async function run() {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();

    try {
        await client.query('BEGIN');

        for (const merge of merges) {
            console.log(`Merging ${merge.title} (ID: ${merge.duplicateId} -> ${merge.canonicalId})...`);
            
            // 1. Update nominations
            await client.query(`UPDATE nominations SET film_id = $1 WHERE film_id = $2`, [merge.canonicalId, merge.duplicateId]);
            
            // 2. Update film_crew
            // To avoid duplicates, we'll delete duplicates first, then update
            await client.query(`
                DELETE FROM film_crew fc1
                WHERE film_id = $2
                AND EXISTS (
                    SELECT 1 FROM film_crew fc2
                    WHERE fc2.film_id = $1
                    AND fc2.person_id = fc1.person_id
                    AND fc2.crew_role = fc1.crew_role
                )
            `, [merge.canonicalId, merge.duplicateId]);
            await client.query(`UPDATE film_crew SET film_id = $1 WHERE film_id = $2`, [merge.canonicalId, merge.duplicateId]);

            // 3. Update reviews
            await client.query(`UPDATE reviews SET film_id = $1 WHERE film_id = $2`, [merge.canonicalId, merge.duplicateId]);

            // 4. Update considerations
            await client.query(`UPDATE considerations SET film_id = $1 WHERE film_id = $2`, [merge.canonicalId, merge.duplicateId]);

            // 5. Update songs
            await client.query(`UPDATE songs SET film_id = $1 WHERE film_id = $2`, [merge.canonicalId, merge.duplicateId]);
            
            // 6. Update title of canonical
            await client.query(`UPDATE films SET title = $1 WHERE film_id = $2`, [merge.title, merge.canonicalId]);
            
            // 7. Delete duplicate
            await client.query(`DELETE FROM films WHERE film_id = $1`, [merge.duplicateId]);
        }

        await client.query('COMMIT');
        console.log("All merges completed successfully!");
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Error during merging:", e);
    } finally {
        await client.end();
    }
}

run();
