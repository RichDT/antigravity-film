import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

async function mergeFilms() {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();

    try {
        console.log("Merging 'The Barbarian Invasions'...");
        // Keep 6930, merge 11375 into it
        await client.query(`UPDATE nominations SET film_id = 6930 WHERE film_id = 11375`);
        await client.query(`DELETE FROM films WHERE film_id = 11375`);
        console.log("Merged film 11375 into 6930.");

        console.log("Merging 'Good Bye, Lenin!'...");
        // Keep 6878, merge 18480 into it
        await client.query(`UPDATE nominations SET film_id = 6878 WHERE film_id = 18480`);
        // Maybe update title to have comma if desired:
        await client.query(`UPDATE films SET title = 'Good Bye, Lenin!' WHERE film_id = 6878`);
        await client.query(`DELETE FROM films WHERE film_id = 18480`);
        console.log("Merged film 18480 into 6878.");

        console.log("Merge complete!");
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

mergeFilms();
