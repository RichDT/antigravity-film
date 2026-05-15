import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

const dataDir = path.join(process.cwd(), 'data');

async function migrateSpyGlasses() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 20
    });
    console.log('Connected to DB (Pool)');

    try {
        // References
        const { rows: awards } = await pool.query(`SELECT award_id FROM awards JOIN organizations USING (organization_id) WHERE short_name = 'Rich Picks'`);
        const awardId = awards[0].award_id;

        console.log('Building local reference maps from database...');
        const { rows: films } = await pool.query('SELECT film_id, LOWER(title) as title, release_year FROM films');
        const filmMap = new Map<string, number>(); // KEY: lower(title)_year
        for (const f of films) {
            filmMap.set(`${f.title}_${f.release_year}`, f.film_id);
            if (!filmMap.has(`${f.title}_null`)) {
                filmMap.set(`${f.title}_null`, f.film_id);
            }
        }

        const { rows: people } = await pool.query('SELECT person_id, imdb_id, LOWER(name) as name FROM people');
        const peopleIdMap = new Map<string, number>();
        const peopleNameMap = new Map<string, number>();
        for (const p of people) {
            if (p.imdb_id) peopleIdMap.set(p.imdb_id, p.person_id);
            peopleNameMap.set(p.name, p.person_id);
        }

        let catMap = new Map<string, number>();
        let roleMap = new Map<string, number>();
        let ceremonyMap = new Map<number, number>(); // year -> ceremony_id

        console.log('Parsing Nominees.csv...');
        const nomRaw = fs.readFileSync(path.join(dataDir, 'The SpyGlasses Full (2022 Update) - Nominees.csv'), 'utf8');
        const noms = parse(nomRaw, { columns: true, skip_empty_lines: true });

        const batchSize = 20;
        for (let i = 0; i < noms.length; i += batchSize) {
            const batch = noms.slice(i, i + batchSize);
            const promises = batch.map(async (row: any) => {
                const isNominated = row.Nominated === 'TRUE' || row.Outcome === 'Won';
                if (!isNominated) return;

                const year = parseInt(row.Year);
                if (isNaN(year)) return;

                // 1. Ceremony
                if (!ceremonyMap.has(year)) {
                    let cRes = await pool.query(`SELECT ceremony_id FROM ceremonies WHERE award_id=$1 AND year=$2`, [awardId, year]);
                    if (cRes.rows.length === 0) {
                        cRes = await pool.query(
                            `INSERT INTO ceremonies (award_id, year, ceremony_number) VALUES ($1, $2, $3) ON CONFLICT (award_id, year) DO UPDATE SET year=EXCLUDED.year RETURNING ceremony_id`,
                            [awardId, year, year - 2004]
                        );
                    }
                    ceremonyMap.set(year, cRes.rows[0].ceremony_id);
                }
                const ceremonyId = ceremonyMap.get(year);

                // 2. Category
                if (!catMap.has(row.Category)) {
                    let cRes = await pool.query(`SELECT category_id FROM categories WHERE award_id=$1 AND name=$2`, [awardId, row.Category]);
                    if (cRes.rows.length === 0) {
                        cRes = await pool.query(
                            `INSERT INTO categories (award_id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING category_id`,
                            [awardId, row.Category]
                        );
                        if (cRes.rows.length === 0) cRes = await pool.query(`SELECT category_id FROM categories WHERE award_id=$1 AND name=$2`, [awardId, row.Category]);
                    }
                    catMap.set(row.Category, cRes.rows[0].category_id);
                }
                const categoryId = catMap.get(row.Category);

                // 3. Film
                const fTitle = (row.Film || '').toLowerCase();
                let filmId = filmMap.get(`${fTitle}_${year}`) || filmMap.get(`${fTitle}_null`);
                if (!filmId) {
                    try {
                        const cRes = await pool.query(
                            `INSERT INTO films (title, release_year) VALUES ($1, $2) RETURNING film_id`,
                            [row.Film, year]
                        );
                        filmId = cRes.rows[0].film_id;
                        filmMap.set(`${fTitle}_${year}`, filmId);
                    } catch (e) { }
                }

                // 4. Role
                let roleId = null;
                if (row.Role && row.Role.trim()) {
                    const rName = row.Role.trim();
                    if (!roleMap.has(rName)) {
                        let cRes = await pool.query(`SELECT role_id FROM roles WHERE role_name=$1`, [rName]);
                        if (cRes.rows.length === 0) {
                            cRes = await pool.query(
                                `INSERT INTO roles (role_name) VALUES ($1) ON CONFLICT (role_name) DO UPDATE SET role_name=EXCLUDED.role_name RETURNING role_id`,
                                [rName]
                            );
                        }
                        roleMap.set(rName, cRes.rows[0].role_id);
                    }
                    roleId = roleMap.get(rName);
                }

                if (!filmId) return;

                // 5. Insert Nomination
                const win = row.Outcome === 'Won';
                let notes = null;
                if (row.Category === 'Screenplay (Adapted)' && row.Title && row.Title.trim() !== 'NA') {
                    notes = row.Title.trim();
                }

                let nominationId;
                try {
                    const nomRes = await pool.query(
                        `INSERT INTO nominations (ceremony_id, category_id, film_id, win, notes) VALUES ($1, $2, $3, $4, $5) RETURNING nomination_id`,
                        [ceremonyId, categoryId, filmId, win, notes]
                    );
                    nominationId = nomRes.rows[0].nomination_id;
                } catch (e) { return; } // prevent crash on dupes

                // 6. Link People
                if (row.p_id && row.p_id.trim() !== 'NA') {
                    let personId = peopleIdMap.get(row.p_id.trim());
                    if (!personId) {
                        try {
                            const cRes = await pool.query(`INSERT INTO people (name, imdb_id) VALUES ($1, $2) RETURNING person_id`, [row.Nominee || 'Unknown', row.p_id.trim()]);
                            personId = cRes.rows[0].person_id;
                            peopleIdMap.set(row.p_id.trim(), personId);
                        } catch (e) { }
                    }
                    if (personId) {
                        try {
                            await pool.query(
                                `INSERT INTO nomination_people (nomination_id, person_id, role_id) VALUES ($1, $2, $3)`,
                                [nominationId as number, personId as number, roleId as number | null]
                            );
                        } catch (e) { }
                    }
                } else if (row.Nominee && row.Category.indexOf('Actor') === -1) {
                    const nomsSpl = row.Nominee.split(',').map((s: string) => s.trim().split(' and ').map((y: string) => y.trim())).flat();
                    for (let nom of nomsSpl) {
                        if (!nom) continue;
                        let pId = peopleNameMap.get(nom.toLowerCase());
                        if (!pId) {
                            try {
                                const cRes = await pool.query(`INSERT INTO people (name) VALUES ($1) RETURNING person_id`, [nom]);
                                pId = cRes.rows[0].person_id;
                                peopleNameMap.set(nom.toLowerCase(), pId);
                            } catch (e) { }
                        }
                        if (pId) {
                            try {
                                await pool.query(
                                    `INSERT INTO nomination_people (nomination_id, person_id, role_id) VALUES ($1, $2, $3)`,
                                    [nominationId as number, pId as number, roleId as number | null]
                                );
                            } catch (e: any) { }
                        }
                    }
                }

                // 7. Link Songs
                if (row.Category === 'Original Song' && row.Title && row.Title.trim() !== 'NA') {
                    const sName = row.Title.replace(/"/g, '').trim();
                    let songId;
                    try {
                        const songRes = await pool.query(
                            `INSERT INTO songs (title, film_id) VALUES ($1, $2) RETURNING song_id`,
                            [sName, filmId]
                        );
                        songId = songRes.rows[0].song_id;
                    } catch (e) {
                        const sRes = await pool.query(`SELECT song_id FROM songs WHERE title=$1 AND film_id=$2`, [sName, filmId]);
                        if (sRes.rows.length > 0) songId = sRes.rows[0].song_id;
                    }
                    if (songId) {
                        try {
                            await pool.query(
                                `INSERT INTO nomination_songs (nomination_id, song_id) VALUES ($1, $2)`,
                                [nominationId as number, songId as number]
                            );
                        } catch (e) { }
                    }
                }
            });
            await Promise.all(promises);
        }

        console.log('SpyGlasses migrated successfully!');

    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        await pool.end();
    }
}

migrateSpyGlasses();
