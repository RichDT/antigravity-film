import { Client } from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

type Nominee = {
    filmTitle: string | null;
    filmUrl: string | null;
    people: { name: string, url: string | null }[];
    isWinner: boolean;
    role: string | null;
};

type Category = {
    name: string;
    nominations: Nominee[];
};

async function insertBafta() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        
        const data: Category[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'scripts', 'pilot_bafta.json'), 'utf-8'));
        
        // 1. Get BAFTA Award ID
        const awardRes = await client.query(`SELECT award_id FROM awards WHERE name = 'BAFTA Award'`);
        if (awardRes.rows.length === 0) throw new Error("BAFTA Award not found");
        const awardId = awardRes.rows[0].award_id;

        // 2. Get Ceremony ID for 2005 (58th BAFTA)
        const ceremonyRes = await client.query(`SELECT ceremony_id FROM ceremonies WHERE award_id = $1 AND year = 2005`, [awardId]);
        let ceremonyId;
        if (ceremonyRes.rows.length === 0) {
             const res = await client.query(`INSERT INTO ceremonies (award_id, year, ceremony_number) VALUES ($1, $2, $3) RETURNING ceremony_id`, [awardId, 2005, 58]);
             ceremonyId = res.rows[0].ceremony_id;
        } else {
             ceremonyId = ceremonyRes.rows[0].ceremony_id;
        }

        console.log(`Using Ceremony ID: ${ceremonyId} for 2005 BAFTAs`);

        // 3. Clear existing data for this ceremony
        console.log(`Clearing existing nominations for Ceremony ${ceremonyId}...`);
        await client.query(`
            DELETE FROM nomination_people 
            WHERE nomination_id IN (SELECT nomination_id FROM nominations WHERE ceremony_id = $1)
        `, [ceremonyId]);
        await client.query(`DELETE FROM nominations WHERE ceremony_id = $1`, [ceremonyId]);

        // 4. Insert New Data
        let totalNominationsInserted = 0;
        
        for (const category of data) {
            // Find or Create Category
            let catRes = await client.query(`SELECT category_id FROM categories WHERE award_id = $1 AND name = $2`, [awardId, category.name]);
            let categoryId;
            if (catRes.rows.length === 0) {
                console.log(`Creating Category: ${category.name}`);
                const insertCat = await client.query(`INSERT INTO categories (award_id, name) VALUES ($1, $2) RETURNING category_id`, [awardId, category.name]);
                categoryId = insertCat.rows[0].category_id;
            } else {
                categoryId = catRes.rows[0].category_id;
            }

            for (const nom of category.nominations) {
                let filmId = null;
                if (nom.filmTitle) {
                    let filmRes = await client.query(`SELECT film_id FROM films WHERE title = $1`, [nom.filmTitle]);
                    if (filmRes.rows.length === 0) {
                        const wikiUrl = nom.filmUrl ? `https://en.wikipedia.org${nom.filmUrl}` : null;
                        const insertFilm = await client.query(`INSERT INTO films (title, wikipedia_url) VALUES ($1, $2) RETURNING film_id`, [nom.filmTitle, wikiUrl]);
                        filmId = insertFilm.rows[0].film_id;
                    } else {
                        filmId = filmRes.rows[0].film_id;
                    }
                }

                // Insert Nomination
                const insertNom = await client.query(`
                    INSERT INTO nominations (ceremony_id, category_id, film_id, win) 
                    VALUES ($1, $2, $3, $4) RETURNING nomination_id
                `, [ceremonyId, categoryId, filmId, nom.isWinner]);
                const nominationId = insertNom.rows[0].nomination_id;
                totalNominationsInserted++;

                // Process People & Roles
                let roleId = null;
                if (nom.role) {
                    let roleRes = await client.query(`SELECT role_id FROM roles WHERE role_name = $1`, [nom.role]);
                    if (roleRes.rows.length === 0) {
                        const insertRole = await client.query(`INSERT INTO roles (role_name) VALUES ($1) RETURNING role_id`, [nom.role]);
                        roleId = insertRole.rows[0].role_id;
                    } else {
                        roleId = roleRes.rows[0].role_id;
                    }
                }

                for (const p of nom.people) {
                    let personRes = await client.query(`SELECT person_id FROM people WHERE name = $1`, [p.name]);
                    let personId;
                    if (personRes.rows.length === 0) {
                        const insertPerson = await client.query(`INSERT INTO people (name) VALUES ($1) RETURNING person_id`, [p.name]);
                        personId = insertPerson.rows[0].person_id;
                    } else {
                        personId = personRes.rows[0].person_id;
                    }

                    // Insert Nomination Person
                    await client.query(`
                        INSERT INTO nomination_people (nomination_id, person_id, role_id) 
                        VALUES ($1, $2, $3)
                        ON CONFLICT DO NOTHING
                    `, [nominationId, personId, roleId]);
                }
            }
        }

        console.log(`Successfully inserted ${totalNominationsInserted} nominations for the 58th BAFTA Awards!`);

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

insertBafta();
