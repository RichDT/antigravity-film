/**
 * migrateMissingOrgs.ts
 *
 * Imports CAS, MPSE, Annie Award, and Grammy Award nominations from CSV files
 * into the Supabase database.
 *
 * Import rules per org:
 *   CAS   — one nomination row per person per film per category per year
 *   MPSE  — one nomination row per person per film per category per year
 *   Annie — one nomination row per film per category per year (no people)
 *           de-duplicates on (ceremony, category, film) to handle multi-studio rows
 *   Grammy — one nomination row per credited person (Nominee/Songwriter/blank-role)
 *            skips Performer rows (performers, not award nominees)
 *            links song title via nomination_songs where Song column is present
 */

import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
});

const dataDir = path.join(process.cwd(), 'data');

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function buildFilmMap(): Promise<Map<string, number>> {
    const { rows } = await pool.query(
        'SELECT film_id, LOWER(title) as title, release_year FROM films'
    );
    const map = new Map<string, number>();
    for (const f of rows) {
        map.set(`${f.title}_${f.release_year}`, f.film_id);
        if (!map.has(`${f.title}_null`)) map.set(`${f.title}_null`, f.film_id);
    }
    return map;
}

async function buildPeopleMap(): Promise<Map<string, number>> {
    const { rows } = await pool.query('SELECT person_id, LOWER(name) as name FROM people');
    const map = new Map<string, number>();
    for (const p of rows) {
        if (!map.has(p.name)) map.set(p.name, p.person_id);
    }
    return map;
}

async function getOrCreateCeremony(
    cache: Map<string, number>,
    awardId: number,
    year: number
): Promise<number> {
    const key = `${awardId}_${year}`;
    if (cache.has(key)) return cache.get(key)!;
    let res = await pool.query(
        'SELECT ceremony_id FROM ceremonies WHERE award_id=$1 AND year=$2',
        [awardId, year]
    );
    if (res.rows.length === 0) {
        res = await pool.query(
            `INSERT INTO ceremonies (award_id, year) VALUES ($1, $2)
             ON CONFLICT (award_id, year) DO UPDATE SET year=EXCLUDED.year
             RETURNING ceremony_id`,
            [awardId, year]
        );
    }
    const id = res.rows[0].ceremony_id;
    cache.set(key, id);
    return id;
}

async function getOrCreateCategory(
    cache: Map<string, number>,
    awardId: number,
    name: string
): Promise<number> {
    const key = `${awardId}_${name}`;
    if (cache.has(key)) return cache.get(key)!;
    let res = await pool.query(
        'SELECT category_id FROM categories WHERE award_id=$1 AND name=$2',
        [awardId, name]
    );
    if (res.rows.length === 0) {
        res = await pool.query(
            `INSERT INTO categories (award_id, name) VALUES ($1, $2)
             ON CONFLICT DO NOTHING RETURNING category_id`,
            [awardId, name]
        );
        if (res.rows.length === 0) {
            res = await pool.query(
                'SELECT category_id FROM categories WHERE award_id=$1 AND name=$2',
                [awardId, name]
            );
        }
    }
    const id = res.rows[0].category_id;
    cache.set(key, id);
    return id;
}

async function resolveFilm(
    filmMap: Map<string, number>,
    rawTitle: string,
    year: number
): Promise<number | null> {
    if (!rawTitle) return null;
    const lower = rawTitle.toLowerCase();
    let id = filmMap.get(`${lower}_${year}`) || filmMap.get(`${lower}_null`);
    if (!id) {
        try {
            const res = await pool.query(
                'INSERT INTO films (title, release_year) VALUES ($1, $2) RETURNING film_id',
                [rawTitle, year]
            );
            id = res.rows[0].film_id;
            filmMap.set(`${lower}_${year}`, id);
        } catch {
            return null;
        }
    }
    return id ?? null;
}

async function resolvePerson(
    peopleMap: Map<string, number>,
    name: string
): Promise<number | null> {
    if (!name || !name.trim()) return null;
    const lower = name.trim().toLowerCase();
    let id = peopleMap.get(lower);
    if (!id) {
        try {
            const res = await pool.query(
                'INSERT INTO people (name) VALUES ($1) RETURNING person_id',
                [name.trim()]
            );
            id = res.rows[0].person_id;
            peopleMap.set(lower, id);
        } catch {
            return null;
        }
    }
    return id ?? null;
}

async function resolveSong(cache: Map<string, number>, title: string): Promise<number | null> {
    if (!title || !title.trim()) return null;
    const key = title.trim().toLowerCase();
    if (cache.has(key)) return cache.get(key)!;
    let res = await pool.query('SELECT song_id FROM songs WHERE LOWER(title) = $1', [key]);
    if (res.rows.length === 0) {
        res = await pool.query('INSERT INTO songs (title) VALUES ($1) RETURNING song_id', [title.trim()]);
    }
    const id = res.rows[0].song_id;
    cache.set(key, id);
    return id;
}

// ─── Per-org import functions ──────────────────────────────────────────────────

/** CAS — one nomination per person per film per category per year */
async function importCAS(
    awardId: number,
    filmMap: Map<string, number>,
    peopleMap: Map<string, number>
) {
    console.log('Importing CAS...');
    const raw = fs.readFileSync(
        path.join(dataDir, 'The SpyGlasses Full (2022 Update) - CAS.csv'),
        'utf8'
    );
    const records: any[] = parse(raw, { columns: true, skip_empty_lines: true });
    const ceremoniesCache = new Map<string, number>();
    const categoriesCache = new Map<string, number>();
    let inserted = 0;

    for (const row of records) {
        const year = parseInt(row.Year);
        if (isNaN(year)) continue;
        const ceremonyId = await getOrCreateCeremony(ceremoniesCache, awardId, year);
        const categoryId = await getOrCreateCategory(categoriesCache, awardId, row.Category?.trim() || 'Unknown');
        const filmId = await resolveFilm(filmMap, row.Film, year);
        if (!filmId) continue;

        const win = row.Won?.trim().toUpperCase() === 'TRUE';
        let nominationId: number;
        try {
            const res = await pool.query(
                'INSERT INTO nominations (ceremony_id, category_id, film_id, win) VALUES ($1, $2, $3, $4) RETURNING nomination_id',
                [ceremonyId, categoryId, filmId, win]
            );
            nominationId = res.rows[0].nomination_id;
            inserted++;
        } catch { continue; }

        const personId = await resolvePerson(peopleMap, row.Nominee);
        if (personId) {
            try {
                await pool.query(
                    'INSERT INTO nomination_people (nomination_id, person_id) VALUES ($1, $2)',
                    [nominationId, personId]
                );
            } catch { /* ignore duplicate */ }
        }
    }
    console.log(`  CAS: inserted ${inserted} nominations`);
}

/** MPSE — one nomination per person per film per category per year */
async function importMPSE(
    awardId: number,
    filmMap: Map<string, number>,
    peopleMap: Map<string, number>
) {
    console.log('Importing MPSE...');
    const raw = fs.readFileSync(
        path.join(dataDir, 'The SpyGlasses Full (2022 Update) - MPSE.csv'),
        'utf8'
    );
    const records: any[] = parse(raw, { columns: true, skip_empty_lines: true });
    const ceremoniesCache = new Map<string, number>();
    const categoriesCache = new Map<string, number>();
    let inserted = 0;

    for (const row of records) {
        const year = parseInt(row.Year);
        if (isNaN(year)) continue;
        const ceremonyId = await getOrCreateCeremony(ceremoniesCache, awardId, year);
        const categoryId = await getOrCreateCategory(categoriesCache, awardId, row.Category?.trim() || 'Unknown');
        const filmId = await resolveFilm(filmMap, row.Film, year);
        if (!filmId) continue;

        const win = row.Won?.trim().toUpperCase() === 'TRUE';
        let nominationId: number;
        try {
            const res = await pool.query(
                'INSERT INTO nominations (ceremony_id, category_id, film_id, win) VALUES ($1, $2, $3, $4) RETURNING nomination_id',
                [ceremonyId, categoryId, filmId, win]
            );
            nominationId = res.rows[0].nomination_id;
            inserted++;
        } catch { continue; }

        const personId = await resolvePerson(peopleMap, row.Nominee);
        if (personId) {
            try {
                await pool.query(
                    'INSERT INTO nomination_people (nomination_id, person_id) VALUES ($1, $2)',
                    [nominationId, personId]
                );
            } catch { /* ignore duplicate */ }
        }
    }
    console.log(`  MPSE: inserted ${inserted} nominations`);
}

/** Annie — one nomination per film per category per year; no nominees */
async function importAnnie(
    awardId: number,
    filmMap: Map<string, number>
) {
    console.log('Importing Annie...');
    const raw = fs.readFileSync(
        path.join(dataDir, 'The SpyGlasses Full (2022 Update) - Annie.csv'),
        'utf8'
    );
    const records: any[] = parse(raw, { columns: true, skip_empty_lines: true });
    const ceremoniesCache = new Map<string, number>();
    const categoriesCache = new Map<string, number>();
    // De-dup: Annie has multi-studio rows for the same film; keep only first win/nom per combo
    const seen = new Set<string>();
    let inserted = 0;

    for (const row of records) {
        const year = parseInt(row.Year);
        if (isNaN(year)) continue;
        const filmTitle = row.Film?.trim();
        if (!filmTitle) continue;

        const dedupKey = `${year}_${row.Category?.trim()}_${filmTitle.toLowerCase()}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);

        const ceremonyId = await getOrCreateCeremony(ceremoniesCache, awardId, year);
        const categoryId = await getOrCreateCategory(categoriesCache, awardId, row.Category?.trim() || 'Unknown');
        const filmId = await resolveFilm(filmMap, filmTitle, year);
        if (!filmId) continue;

        const win = row.Won?.trim().toUpperCase() === 'TRUE';
        try {
            await pool.query(
                'INSERT INTO nominations (ceremony_id, category_id, film_id, win) VALUES ($1, $2, $3, $4)',
                [ceremonyId, categoryId, filmId, win]
            );
            inserted++;
        } catch { /* ignore */ }
    }
    console.log(`  Annie: inserted ${inserted} nominations`);
}

/** Grammy — one nomination per credited person (Nominee/Songwriter/blank-role); skips Performer rows */
async function importGrammy(
    awardId: number,
    filmMap: Map<string, number>,
    peopleMap: Map<string, number>
) {
    console.log('Importing Grammy...');
    const raw = fs.readFileSync(
        path.join(dataDir, 'The SpyGlasses Full (2022 Update) - Grammy.csv'),
        'utf8'
    );
    const records: any[] = parse(raw, { columns: true, skip_empty_lines: true });
    const ceremoniesCache = new Map<string, number>();
    const categoriesCache = new Map<string, number>();
    const songCache = new Map<string, number>();
    let inserted = 0;

    for (const row of records) {
        // Skip Performer credits — they are not the award nominees
        const role = row.Role?.trim();
        if (role === 'Performer') continue;

        const year = parseInt(row.Year);
        if (isNaN(year)) continue;
        const filmTitle = row.Film?.trim();
        if (!filmTitle) continue;

        const ceremonyId = await getOrCreateCeremony(ceremoniesCache, awardId, year);
        const categoryId = await getOrCreateCategory(categoriesCache, awardId, row.Category?.trim() || 'Unknown');
        const filmId = await resolveFilm(filmMap, filmTitle, year);
        if (!filmId) continue;

        const win = row.Won?.trim().toUpperCase() === 'TRUE';
        let nominationId: number;
        try {
            const res = await pool.query(
                'INSERT INTO nominations (ceremony_id, category_id, film_id, win) VALUES ($1, $2, $3, $4) RETURNING nomination_id',
                [ceremonyId, categoryId, filmId, win]
            );
            nominationId = res.rows[0].nomination_id;
            inserted++;
        } catch { continue; }

        // Link song if present
        const songTitle = row.Song?.trim();
        if (songTitle) {
            const songId = await resolveSong(songCache, songTitle);
            if (songId) {
                try {
                    await pool.query(
                        'INSERT INTO nomination_songs (nomination_id, song_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                        [nominationId, songId]
                    );
                } catch { /* ignore */ }
            }
        }

        // Link person
        const personId = await resolvePerson(peopleMap, row.Nominee);
        if (personId) {
            try {
                await pool.query(
                    'INSERT INTO nomination_people (nomination_id, person_id) VALUES ($1, $2)',
                    [nominationId, personId]
                );
            } catch { /* ignore duplicate */ }
        }
    }
    console.log(`  Grammy: inserted ${inserted} nominations`);
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    console.log('Building lookup tables...');
    const filmMap = await buildFilmMap();
    const peopleMap = await buildPeopleMap();

    const { rows: awardRows } = await pool.query(
        'SELECT a.award_id, o.short_name FROM awards a JOIN organizations o USING (organization_id)'
    );
    const awardMap = new Map<string, number>(awardRows.map(r => [r.short_name, r.award_id]));

    const casAwardId = awardMap.get('CAS');
    const mpseAwardId = awardMap.get('MPSE');
    const annieAwardId = awardMap.get('Annie');
    const grammyAwardId = awardMap.get('Grammy');

    if (!casAwardId || !mpseAwardId || !annieAwardId || !grammyAwardId) {
        throw new Error(`Missing award IDs: CAS=${casAwardId} MPSE=${mpseAwardId} Annie=${annieAwardId} Grammy=${grammyAwardId}`);
    }

    const only = process.argv[2];
    if (!only || only === 'CAS')   await importCAS(casAwardId, filmMap, peopleMap);
    if (!only || only === 'MPSE')  await importMPSE(mpseAwardId, filmMap, peopleMap);
    if (!only || only === 'Annie') await importAnnie(annieAwardId, filmMap);
    if (!only || only === 'Grammy') await importGrammy(grammyAwardId, filmMap, peopleMap);

    console.log('Done.');
    await pool.end();
}

main().catch(async e => {
    console.error('Fatal:', e);
    await pool.end();
    process.exit(1);
});
