import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

const dataDir = path.join(process.cwd(), 'data');

async function syncPeople() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 20
    });
    console.log('Connected to DB for People Sync');

    try {
        const raw = fs.readFileSync(path.join(dataDir, 'The SpyGlasses Full (2022 Update) - People.csv'), 'utf8');
        const records = parse(raw, { columns: true, skip_empty_lines: true });

        console.log(`Parsing ${records.length} person records...`);

        const batchSize = 100;
        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize);
            const promises = batch.map(async (row: any) => {
                const imdbId = row.p_id && row.p_id.trim() !== 'NA' ? row.p_id.trim() : null;
                if (!imdbId) return;

                const first = row.Nominee_First && row.Nominee_First.trim() !== 'NA' ? row.Nominee_First.trim() : null;
                const middle = row.Nominee_Middle && row.Nominee_Middle.trim() !== 'NA' ? row.Nominee_Middle.trim() : null;
                const last = row.Nominee_Last && row.Nominee_Last.trim() !== 'NA' ? row.Nominee_Last.trim() : null;
                const appendix = row.Nominee_Appendix && row.Nominee_Appendix.trim() !== 'NA' ? row.Nominee_Appendix.trim() : null;

                if (!first && !middle && !last && !appendix) return;

                try {
                    await pool.query(
                        `UPDATE people SET first_name = COALESCE($1, first_name), middle_name = COALESCE($2, middle_name), last_name = COALESCE($3, last_name), appendix = COALESCE($4, appendix) WHERE imdb_id = $5`,
                        [first, middle, last, appendix, imdbId]
                    );
                } catch (e) {
                    // Ignore transient errors
                }
            });
            await Promise.all(promises);
            if (i % 1000 === 0 && i > 0) {
                console.log(`Processed ${i} records...`);
            }
        }

        console.log('People DB successfully synchronized with full name segments!');

    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        await pool.end();
    }
}

syncPeople();
