import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

const dataDir = path.join(process.cwd(), 'data');

const fileConfigs = [
    { file: "The SpyGlasses Full (2022 Update) - Oscars.csv", org: "Oscars", yearCol: "Year", filmCol: "Film", nomCol: "Nominee", wonCol: "Win_Oscar", catCol: "Category_Oscar", songCol: "Song.Title" },
    { file: "The SpyGlasses Full (2022 Update) - Globes.csv", org: "Globes", yearCol: "Year", filmCol: "Film", nomCol: "Nominee", wonCol: "Win_Globe", catCol: "Category_Globes", songCol: "Song_Title" },
    { file: "The SpyGlasses Full (2022 Update) - BAFTA.csv", org: "BAFTA", yearCol: "Year", filmCol: "Film", nomCol: "Nominee", wonCol: "Won", catCol: "Category" },
    { file: "The SpyGlasses Full (2022 Update) - SAG.csv", org: "SAG", yearCol: "Year", filmCol: "Film", nomCol: "Nominee", wonCol: "Won", catCol: "Category" },
    { file: "The SpyGlasses Full (2022 Update) - DGA.csv", org: "DGA", yearCol: "Year", filmCol: "Film", nomCol: "Nominee", wonCol: "Won", catCol: "Category" },
    { file: "The SpyGlasses Full (2022 Update) - PGA.csv", org: "PGA", yearCol: "Year", filmCol: "Film", nomCol: "Nominee", wonCol: "Won", catCol: "Category" },
    { file: "The SpyGlasses Full (2022 Update) - WGA.csv", org: "WGA", yearCol: "Year", filmCol: "Film", nomCol: "Nominee", wonCol: "Won", catCol: "Category" },
    { file: "The SpyGlasses Full (2022 Update) - ACE.csv", org: "ACE", yearCol: "Year", filmCol: "Film", nomCol: "Nominee", wonCol: "Won", catCol: "Category" },
    { file: "The SpyGlasses Full (2022 Update) - ADG.csv", org: "ADG", yearCol: "Year", filmCol: "Film", nomCol: "Nominee", wonCol: "Won", catCol: "Category" },
    { file: "The SpyGlasses Full (2022 Update) - ASC.csv", org: "ASC", yearCol: "Year", filmCol: "Film", nomCol: "Nominee", wonCol: "Won", catCol: "Category" },
    { file: "The SpyGlasses Full (2022 Update) - CDG.csv", org: "CDG", yearCol: "Year", filmCol: "Film", nomCol: "Nominee", wonCol: "Won", catCol: "Category" },
    { file: "The SpyGlasses Full (2022 Update) - MUAH.csv", org: "MUAH", yearCol: "Year", filmCol: "Film", nomCol: "Nominee", wonCol: "Won", catCol: "Category" },
    { file: "The SpyGlasses Full (2022 Update) - SCL.csv", org: "SCL", yearCol: "Year", filmCol: "Film", nomCol: "Nominee", wonCol: "Won", catCol: "Category", songCol: "Song_Title" },
    { file: "The SpyGlasses Full (2022 Update) - VES.csv", org: "VES", yearCol: "Year", filmCol: "Film", nomCol: "Nominee", wonCol: "Won", catCol: "Category" }
];

async function migrateGuilds() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 20
    });
    console.log('Connected to DB for Guilds Migration (Pool)');

    try {
        console.log('Building DB lookups...');
        const { rows: films } = await pool.query('SELECT film_id, LOWER(title) as title, release_year FROM films');
        const filmMap = new Map<string, number>();
        for (const f of films) {
            filmMap.set(`${f.title}_${f.release_year}`, f.film_id);
            if (!filmMap.has(`${f.title}_null`)) {
                filmMap.set(`${f.title}_null`, f.film_id);
            }
        }

        const { rows: people } = await pool.query('SELECT person_id, LOWER(name) as name FROM people');
        const peopleNameMap = new Map<string, number>();
        for (const p of people) {
            if (!peopleNameMap.has(p.name)) peopleNameMap.set(p.name, p.person_id);
        }

        const { rows: awards } = await pool.query(`SELECT award_id, o.short_name FROM awards JOIN organizations o USING (organization_id)`);
        const awardMap = new Map<string, number>();
        for (const a of awards) {
            awardMap.set(a.short_name, a.award_id);
        }

        // Caches for categories and ceremonies so we don't query 10,000 times
        let categoriesCache = new Map<string, number>(); // KEY: award_id + "_" + category_name
        let ceremoniesCache = new Map<string, number>(); // KEY: award_id + "_" + year

        for (const config of fileConfigs) {
            console.log(`Processing ${config.org}...`);
            const awardId = awardMap.get(config.org);
            if (!awardId) {
                console.log(`Award ID not found for ${config.org}`);
                continue;
            }

            const raw = fs.readFileSync(path.join(dataDir, config.file), 'utf8');
            const records = parse(raw, { columns: true, skip_empty_lines: true });

            const batchSize = 10;
            for (let i = 0; i < records.length; i += batchSize) {
                const batch = records.slice(i, i + batchSize);
                const promises = batch.map(async (row: any) => {
                    const year = parseInt(row[config.yearCol]);
                    if (isNaN(year)) return;

                    // Ceremony resolving
                    const cerKey = `${awardId}_${year}`;
                    if (!ceremoniesCache.has(cerKey)) {
                        let cRes = await pool.query(`SELECT ceremony_id FROM ceremonies WHERE award_id=$1 AND year=$2`, [awardId, year]);
                        if (cRes.rows.length === 0) {
                            cRes = await pool.query(`INSERT INTO ceremonies (award_id, year) VALUES ($1, $2) ON CONFLICT (award_id, year) DO UPDATE SET year=EXCLUDED.year RETURNING ceremony_id`, [awardId, year]);
                        }
                        ceremoniesCache.set(cerKey, cRes.rows[0].ceremony_id);
                    }
                    const ceremonyId = ceremoniesCache.get(cerKey);

                    // Category resolving
                    const catName = row[config.catCol] || 'Unknown Category';
                    const catKey = `${awardId}_${catName}`;
                    if (!categoriesCache.has(catKey)) {
                        let cRes = await pool.query(`SELECT category_id FROM categories WHERE award_id=$1 AND name=$2`, [awardId, catName]);
                        if (cRes.rows.length === 0) {
                            cRes = await pool.query(`INSERT INTO categories (award_id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING category_id`, [awardId, catName]);
                            if (cRes.rows.length === 0) cRes = await pool.query(`SELECT category_id FROM categories WHERE award_id=$1 AND name=$2`, [awardId, catName]);
                        }
                        categoriesCache.set(catKey, cRes.rows[0].category_id);
                    }
                    const categoryId = categoriesCache.get(catKey);

                    // Film resolving
                    const fTitle = (row[config.filmCol] || '').toLowerCase();
                    let filmId = filmMap.get(`${fTitle}_${year}`) || filmMap.get(`${fTitle}_null`);
                    if (!filmId && row[config.filmCol]) {
                        try {
                            const cRes = await pool.query(
                                `INSERT INTO films (title, release_year) VALUES ($1, $2) RETURNING film_id`,
                                [row[config.filmCol], year]
                            );
                            filmId = cRes.rows[0].film_id;
                            filmMap.set(`${fTitle}_${year}`, filmId as number);
                        } catch (e) { }
                    }
                    if (!filmId) return;

                    // Insert Nomination
                    const winVal = row[config.wonCol];
                    const win = winVal === 'TRUE' || winVal === 'true' || winVal === '1' || winVal === 'Won';

                    let nominationId;
                    try {
                        const nomRes = await pool.query(
                            `INSERT INTO nominations (ceremony_id, category_id, film_id, win) VALUES ($1, $2, $3, $4) RETURNING nomination_id`,
                            [ceremonyId, categoryId, filmId, win]
                        );
                        nominationId = nomRes.rows[0].nomination_id;
                    } catch (e) {
                        return; // Handle duplicate constraints gracefully
                    }

                    // Insert Song if it exists
                    if (config.songCol && row[config.songCol] && row[config.songCol].trim() !== 'NA') {
                        const songTitle = row[config.songCol].trim();
                        try {
                            const songRes = await pool.query(
                                `INSERT INTO songs (title) VALUES ($1) ON CONFLICT (title) DO UPDATE SET title=EXCLUDED.title RETURNING song_id`,
                                [songTitle]
                            );
                            const songId = songRes.rows[0].song_id;
                            await pool.query(
                                `INSERT INTO nomination_songs (nomination_id, song_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                                [nominationId as number, songId as number]
                            );
                        } catch (e: any) { }
                    }

                    // Nominee Person Link
                    const nomName = row[config.nomCol];
                    if (nomName && nomName.trim() && nomName.trim() !== 'NA') {
                        const nomsSpl = nomName.split(',').map((s: string) => s.trim().split(' and ').map(y => y.trim())).flat();
                        for (const n of nomsSpl) {
                            if (!n) continue;
                            let pId = peopleNameMap.get(n.toLowerCase());
                            if (!pId) {
                                try {
                                    const cRes = await pool.query(`INSERT INTO people (name) VALUES ($1) RETURNING person_id`, [n]);
                                    pId = cRes.rows[0].person_id;
                                    peopleNameMap.set(n.toLowerCase(), pId as number);
                                } catch (e) { }
                            }
                            if (pId) {
                                try {
                                    await pool.query(
                                        `INSERT INTO nomination_people (nomination_id, person_id) VALUES ($1, $2)`,
                                        [nominationId as number, pId as number]
                                    );
                                } catch (e: any) { }
                            }
                        }
                    }
                });
                await Promise.all(promises);
            }
        }

        console.log('Guilds migrated successfully!');

    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        await pool.end();
    }
}

migrateGuilds();
