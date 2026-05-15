import * as cheerio from 'cheerio';
import { Client } from 'pg';
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

function cleanText(text: string) {
    return text.replace(/\[\d+\]/g, '').trim();
}

function getOrdinal(n: number): string {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function parseLi($: cheerio.CheerioAPI, li: cheerio.Element, isWinner: boolean, categoryName: string): Nominee {
    const $clone = $(li).clone();
    $clone.find('ul').remove(); // remove nested

    let filmTitle: string | null = null;
    let filmUrl: string | null = null;
    let people: { name: string, url: string | null }[] = [];
    let role: string | null = null;

    $clone.find('i').each((_, iElem) => {
        const text = cleanText($(iElem).text());
        if (text) {
            filmTitle = text;
            const a = $(iElem).find('a');
            if (a.length > 0) {
                filmUrl = a.attr('href') || null;
            } else if ($(iElem).parent().is('a')) {
                 filmUrl = $(iElem).parent().attr('href') || null;
            }
        }
    });

    $clone.find('i').remove();

    let remainingText = cleanText($clone.text());
    const asMatch = remainingText.match(/\s+as\s+(.+)$/);
    if (asMatch) {
        role = cleanText(asMatch[1]);
        remainingText = remainingText.replace(asMatch[0], '');
    }

    remainingText = remainingText.replace(/^[–-]\s*/, '').replace(/\s*[–-]\s*$/, '').trim();

    const linkedPeople: {name: string, url: string | null}[] = [];
    $clone.find('a').each((_, aElem) => {
        if ($(aElem).attr('href') !== filmUrl) {
            linkedPeople.push({
                name: cleanText($(aElem).text()),
                url: $(aElem).attr('href') || null
            });
            remainingText = remainingText.replace($(aElem).text(), '').trim();
        }
    });

    if (linkedPeople.length > 0) {
        people = linkedPeople;
    } else {
         if (remainingText.length > 0 && remainingText !== '–' && remainingText !== '-') {
             let parts = remainingText.split(/,(?![^()]*\))|\s+and\s+/);
             people = parts.map(p => p.trim()).filter(p => p.length > 0).map(p => ({
                 name: cleanText(p),
                 url: null
             }));
         }
    }

    if (!filmTitle && categoryName.toLowerCase().includes('film') && people.length === 1 && !people[0].url) {
        filmTitle = people[0].name;
        people = [];
    }

    return {
        filmTitle,
        filmUrl,
        people,
        isWinner,
        role
    };
}

async function scrapeBaftaPage(url: string): Promise<Category[]> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    const html = await response.text();
    const $ = cheerio.load(html);
    const categories: Category[] = [];

    $('h3').each((_, h3) => {
        const catName = cleanText($(h3).text()).replace('[edit]', '').trim();
        if (catName.includes('Fellowship') || catName.includes('Contribution')) {
            const ul = $(h3).nextAll('ul').first();
            if (ul.length > 0) {
                const noms: Nominee[] = [];
                ul.children('li').each((_, li) => {
                    noms.push(parseLi($, li, true, catName));
                });
                if (noms.length > 0) {
                   categories.push({ name: catName, nominations: noms });
                }
            }
        }
    });

    $('table.wikitable').each((i, table) => {
        $(table).find('tr').each((j, row) => {
            $(row).find('td').each((k, cell) => {
                let catName = $(cell).find('div > b').text().trim() || $(cell).find('b').first().text().trim();
                if (!catName) {
                    catName = $(cell).contents().filter(function() {
                        return this.nodeType === 3 && $(this).text().trim().length > 0;
                    }).first().text().trim();
                }
                
                const noms: Nominee[] = [];
                $(cell).children('ul').first().children('li').each((l, li) => {
                   const isWinner = $(li).find('b').length > 0;
                   noms.push(parseLi($, li, isWinner, catName));
                   
                   $(li).find('ul > li').each((m, nestedLi) => {
                       noms.push(parseLi($, nestedLi, false, catName));
                   });
                });
                
                if (noms.length > 0 && catName) {
                    categories.push({
                        name: catName,
                        nominations: noms
                    });
                }
            });
        });
    });

    return categories;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const awardRes = await client.query(`SELECT award_id FROM awards WHERE name = 'BAFTA Award'`);
        if (awardRes.rows.length === 0) throw new Error("BAFTA Award not found");
        const awardId = awardRes.rows[0].award_id;

        // Load caches
        const filmMap = new Map<string, number>();
        const roleMap = new Map<string, number>();
        const personMap = new Map<string, number>();
        const catMap = new Map<string, number>();

        console.log("Loading DB caches...");
        const filmsRes = await client.query(`SELECT film_id, title FROM films`);
        for (const row of filmsRes.rows) filmMap.set(row.title, row.film_id);

        const rolesRes = await client.query(`SELECT role_id, role_name FROM roles`);
        for (const row of rolesRes.rows) roleMap.set(row.role_name, row.role_id);

        const peopleRes = await client.query(`SELECT person_id, name FROM people`);
        for (const row of peopleRes.rows) personMap.set(row.name, row.person_id);

        const catsRes = await client.query(`SELECT category_id, name FROM categories WHERE award_id = $1`, [awardId]);
        for (const row of catsRes.rows) catMap.set(row.name, row.category_id);

        async function getFilmId(title: string, url: string | null) {
            if (filmMap.has(title)) return filmMap.get(title);
            const wikiUrl = url ? `https://en.wikipedia.org${url}` : null;
            const res = await client.query(`INSERT INTO films (title, wikipedia_url) VALUES ($1, $2) RETURNING film_id`, [title, wikiUrl]);
            const id = res.rows[0].film_id;
            filmMap.set(title, id);
            return id;
        }

        async function getRoleId(roleName: string) {
            if (roleMap.has(roleName)) return roleMap.get(roleName);
            const res = await client.query(`INSERT INTO roles (role_name) VALUES ($1) RETURNING role_id`, [roleName]);
            const id = res.rows[0].role_id;
            roleMap.set(roleName, id);
            return id;
        }

        async function getPersonId(name: string) {
            if (personMap.has(name)) return personMap.get(name);
            const res = await client.query(`INSERT INTO people (name) VALUES ($1) RETURNING person_id`, [name]);
            const id = res.rows[0].person_id;
            personMap.set(name, id);
            return id;
        }

        async function getCatId(name: string) {
            if (catMap.has(name)) return catMap.get(name);
            const res = await client.query(`INSERT INTO categories (award_id, name) VALUES ($1, $2) RETURNING category_id`, [awardId, name]);
            const id = res.rows[0].category_id;
            catMap.set(name, id);
            return id;
        }

        // We already processed 59, 58, 57, 56. Let's resume from 55!
        for (let n = 55; n >= 1; n--) {
            const ordinal = getOrdinal(n);
            const url = `https://en.wikipedia.org/wiki/${ordinal}_British_Academy_Film_Awards`;
            const filmYear = 1947 + n - 1; 
            
            console.log(`\n======================================================`);
            console.log(`Processing ${ordinal} BAFTA Awards (Film Year: ${filmYear})`);
            
            try {
                const categories = await scrapeBaftaPage(url);
                if (categories.length === 0) {
                    console.log(`WARNING: No categories found for ${ordinal} BAFTAs.`);
                    continue;
                }

                console.log(`Parsed ${categories.length} categories.`);

                let ceremonyRes = await client.query(`SELECT ceremony_id FROM ceremonies WHERE award_id = $1 AND year = $2`, [awardId, filmYear]);
                let ceremonyId;
                if (ceremonyRes.rows.length === 0) {
                     const res = await client.query(`INSERT INTO ceremonies (award_id, year, ceremony_number) VALUES ($1, $2, $3) RETURNING ceremony_id`, [awardId, filmYear, n]);
                     ceremonyId = res.rows[0].ceremony_id;
                } else {
                     ceremonyId = ceremonyRes.rows[0].ceremony_id;
                     await client.query(`UPDATE ceremonies SET ceremony_number = $1 WHERE ceremony_id = $2`, [n, ceremonyId]);
                }

                await client.query(`
                    DELETE FROM nomination_people 
                    WHERE nomination_id IN (SELECT nomination_id FROM nominations WHERE ceremony_id = $1)
                `, [ceremonyId]);
                await client.query(`DELETE FROM nominations WHERE ceremony_id = $1`, [ceremonyId]);

                let totalNominationsInserted = 0;
                
                // Collect all inserts to do them quickly
                for (const category of categories) {
                    const categoryId = await getCatId(category.name);

                    for (const nom of category.nominations) {
                        const filmId = nom.filmTitle ? await getFilmId(nom.filmTitle, nom.filmUrl) : null;

                        const insertNom = await client.query(`
                            INSERT INTO nominations (ceremony_id, category_id, film_id, win) 
                            VALUES ($1, $2, $3, $4) RETURNING nomination_id
                        `, [ceremonyId, categoryId, filmId, nom.isWinner]);
                        const nominationId = insertNom.rows[0].nomination_id;
                        totalNominationsInserted++;

                        const roleId = nom.role ? await getRoleId(nom.role) : null;

                        for (const p of nom.people) {
                            const personId = await getPersonId(p.name);
                            await client.query(`
                                INSERT INTO nomination_people (nomination_id, person_id, role_id) 
                                VALUES ($1, $2, $3)
                                ON CONFLICT DO NOTHING
                            `, [nominationId, personId, roleId]);
                        }
                    }
                }

                console.log(`Inserted ${totalNominationsInserted} nominations for film year ${filmYear}.`);

            } catch (err) {
                console.error(`Error processing ${ordinal} BAFTAs:`, err);
            }

            await sleep(500);
        }

        console.log(`\nBatch process completed successfully!`);

    } catch (e) {
        console.error("Critical error:", e);
    } finally {
        await client.end();
    }
}

run();
