import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

const dataDir = path.join(process.cwd(), 'data');

async function migrateCore() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    await client.connect();
    console.log('Connected to DB');

    try {
        await client.query('BEGIN');

        // 1. ORGANIZATIONS & AWARDS
        const orgs = [
            { name: 'Rich Picks', short_name: 'Rich Picks', country: 'USA' },
            { name: 'Academy of Motion Picture Arts and Sciences', short_name: 'Oscars', country: 'USA' },
            { name: 'Hollywood Foreign Press Association', short_name: 'Globes', country: 'USA' },
            { name: 'British Academy of Film and Television Arts', short_name: 'BAFTA', country: 'UK' },
            { name: 'Screen Actors Guild', short_name: 'SAG', country: 'USA' },
            { name: 'Directors Guild of America', short_name: 'DGA', country: 'USA' },
            { name: 'Producers Guild of America', short_name: 'PGA', country: 'USA' },
            { name: 'Writers Guild of America', short_name: 'WGA', country: 'USA' },
            { name: 'American Cinema Editors', short_name: 'ACE', country: 'USA' },
            { name: 'Art Directors Guild', short_name: 'ADG', country: 'USA' },
            { name: 'American Society of Cinematographers', short_name: 'ASC', country: 'USA' },
            { name: 'Costume Designers Guild', short_name: 'CDG', country: 'USA' },
            { name: 'Make-Up Artists and Hair Stylists Guild', short_name: 'MUAH', country: 'USA' },
            { name: 'Society of Composers & Lyricists', short_name: 'SCL', country: 'USA' },
            { name: 'Visual Effects Society', short_name: 'VES', country: 'USA' },
            { name: 'Recording Academy', short_name: 'Grammy', country: 'USA' },
            { name: 'ASIFA-Hollywood', short_name: 'Annie', country: 'USA' },
            { name: 'Cinema Audio Society', short_name: 'CAS', country: 'USA' },
            { name: 'Motion Picture Sound Editors', short_name: 'MPSE', country: 'USA' }
        ];

        console.log('Inserting Organizations & Awards...');
        const orgIdMap = new Map();
        for (const org of orgs) {
            const res = await client.query(
                `INSERT INTO organizations (name, short_name, country) VALUES ($1, $2, $3) RETURNING organization_id`,
                [org.name, org.short_name, org.country]
            );
            orgIdMap.set(org.short_name, res.rows[0].organization_id);

            // Create a primary award for each organization
            await client.query(
                `INSERT INTO awards (organization_id, name) VALUES ($1, $2)`,
                [res.rows[0].organization_id, org.short_name + ' Awards']
            );
        }

        // 2. FILMS
        console.log('Parsing and inserting Films...');
        let filmsRaw = '';
        try {
            filmsRaw = fs.readFileSync(path.join(dataDir, 'The SpyGlasses Full (2022 Update) - Films.csv'), 'utf8');
        } catch (e) {
            console.log('Could not find Films.csv', e);
        }
        if (filmsRaw) {
            const films = parse(filmsRaw, { columns: true, skip_empty_lines: true });
            for (const f of films) {
                if (!f.Film) continue;
                const year = parseInt(f.Year) || null;
                const runtime = parseInt(f.runtimeMinutes) || null;
                await client.query(
                    `INSERT INTO films (title, release_year, country, runtime_minutes, imdb_id) 
                     VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
                    [f.Film, year, f.Country || null, runtime, f.tconst || null]
                );
            }
            console.log(`Inserted ${films.length} films.`);
        }

        // 3. PEOPLE
        console.log('Parsing and inserting People...');
        let peopleRaw = '';
        try {
            peopleRaw = fs.readFileSync(path.join(dataDir, 'The SpyGlasses Full (2022 Update) - People.csv'), 'utf8');
        } catch (e) {
            console.log('Could not find People.csv', e);
        }
        if (peopleRaw) {
            const people = parse(peopleRaw, { columns: true, skip_empty_lines: true });
            for (const p of people) {
                if (!p.Nominee) continue;
                // Add p_id as imdb_id temporarily for easy lookup, or just match by name. 
                // Since schema has imdb_id, we can stash p_id there if it starts with 'p' 
                const p_id = p.p_id || null;
                await client.query(
                    `INSERT INTO people (name, imdb_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                    [p.Nominee, p_id]
                );
            }
            console.log(`Inserted ${people.length} people.`);
        }

        await client.query('COMMIT');
        console.log('Core entities migrated successfully!');

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', e);
    } finally {
        await client.end();
    }
}

migrateCore();
