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
        const text = cleanText($(aElem).text());
        if ($(aElem).attr('href') !== filmUrl && text !== role) {
            linkedPeople.push({
                name: text,
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

/**
 * Parse an acting-format line like "Henry Fonda in 12 Angry Men"
 * or a film-only line like "The Bridge on the River Kwai"
 * or a screenplay-format line like "The Bridge on the River Kwai - Pierre Boulle"
 */
function parseEntry($: cheerio.CheerioAPI, el: cheerio.Cheerio<cheerio.Element>, categoryName: string): Nominee {
    const catLower = categoryName.toLowerCase();
    const isActing = catLower.includes('actor') || catLower.includes('actress');
    const isScreenplay = catLower.includes('screenplay') || catLower.includes('screenwriter');

    // Extract italic text as film title
    let filmTitle: string | null = null;
    let filmUrl: string | null = null;
    const italics = el.find('i');
    if (italics.length > 0) {
        filmTitle = cleanText(italics.first().text());
        const a = italics.find('a');
        if (a.length > 0) {
            filmUrl = a.attr('href') || null;
        } else if (italics.parent().is('a')) {
             filmUrl = italics.parent().attr('href') || null;
        }
    }

    // Remove italic elements and get remaining text
    const clone = el.clone();
    clone.find('i').remove();
    let remainingText = cleanText(clone.text());

    // Remove leading/trailing dashes
    remainingText = remainingText.replace(/^[\s–-]+/, '').replace(/[\s–-]+$/, '').trim();
    // Remove "in " prefix for acting categories
    remainingText = remainingText.replace(/\s+in\s*$/, '').trim();

    const people: { name: string, url: string | null }[] = [];

    if (isActing && remainingText) {
        // For acting: remaining text is the person name
        people.push({ name: remainingText, url: null });
    } else if (isScreenplay && remainingText) {
        // For screenplay: remaining text after removing film title might be writer names
        // Format: "Film Title - Writer Name" or "Film Title – Writer Name"
        const parts = remainingText.split(/\s*[-–]\s*/);
        for (const p of parts) {
            const trimmed = p.trim();
            if (trimmed && trimmed !== filmTitle) {
                people.push({ name: trimmed, url: null });
            }
        }
    }

    // If no film title found but this is a film category, treat the whole text as film title
    if (!filmTitle && (catLower.includes('film') || catLower.includes('documentary'))) {
        filmTitle = cleanText(el.text());
    }

    return {
        filmTitle,
        filmUrl,
        people,
        isWinner: false,
        role: null,
    };
}

async function scrapeH3Format(url: string, $: cheerio.CheerioAPI): Promise<Category[]> {
    const categories: Category[] = [];

    // Find all h3 elements (they may be inside .mw-heading3 divs or standalone)
    const headings: cheerio.Cheerio<cheerio.Element>[] = [];
    
    // Try .mw-heading3 > h3 first (newer Wikipedia format)
    $('.mw-heading3').each((_, div) => {
        headings.push($(div));
    });
    
    // If none found, fall back to bare h3
    if (headings.length === 0) {
        $('h3').each((_, h3) => {
            headings.push($(h3));
        });
    }

    for (const heading of headings) {
        const h3El = heading.is('h3') ? heading : heading.find('h3');
        const catName = cleanText(h3El.text());
        if (!catName || ['References', 'External links', 'See also', 'Notes', 'Winners and nominees'].includes(catName)) continue;

        const nominations: Nominee[] = [];

        // Walk siblings after the heading div
        let next = heading.next();
        while (next.length > 0 && !next.hasClass('mw-heading3') && !next.hasClass('mw-heading2') && !next.is('h2') && !next.is('h3')) {
            const tag = next.prop('tagName')?.toUpperCase();

            if (tag === 'P') {
                // Winner paragraph — bold content
                const boldEl = next.find('b');
                if (boldEl.length > 0) {
                    const winner = parseEntry($, boldEl, catName);
                    winner.isWinner = true;
                    nominations.push(winner);
                }
            } else if (tag === 'UL') {
                // Nominee list
                next.children('li').each((_, li) => {
                    const nominee = parseEntry($, $(li), catName);
                    nominations.push(nominee);
                });
            }

            next = next.next();
        }

        if (nominations.length > 0) {
            categories.push({ name: catName, nominations });
        }
    }

    return categories;
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

    if ($('table.wikitable').length === 0) {
        return scrapeH3Format(url, $);
    }

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

        // Process the missing years: film years 1952-1963 (ceremonies 6th to 17th)
        for (let n = 17; n >= 6; n--) {
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

                // PREPARE BULK INSERT
                const nomRecords = [];
                for (const category of categories) {
                    const categoryId = await getCatId(category.name);
                    for (const nom of category.nominations) {
                        const filmId = nom.filmTitle ? await getFilmId(nom.filmTitle, nom.filmUrl) : null;
                        const roleId = nom.role ? await getRoleId(nom.role) : null;
                        
                        const personIds = [];
                        for (const p of nom.people) {
                            personIds.push(await getPersonId(p.name));
                        }
                        
                        nomRecords.push({
                            categoryId,
                            filmId,
                            isWinner: nom.isWinner,
                            roleId,
                            personIds
                        });
                    }
                }

                if (nomRecords.length === 0) continue;

                // 1. Bulk Insert Nominations
                const nomValueStrings = [];
                const nomParams = [];
                let paramIndex = 1;
                
                for (const record of nomRecords) {
                    nomValueStrings.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
                    nomParams.push(ceremonyId, record.categoryId, record.filmId, record.isWinner);
                }
                
                const insertNomsQuery = `
                    INSERT INTO nominations (ceremony_id, category_id, film_id, win) 
                    VALUES ${nomValueStrings.join(', ')} 
                    RETURNING nomination_id
                `;
                const nomsRes = await client.query(insertNomsQuery, nomParams);
                
                // 2. Bulk Insert Nomination People
                const npValueStrings = [];
                const npParams = [];
                paramIndex = 1;
                
                for (let i = 0; i < nomRecords.length; i++) {
                    const record = nomRecords[i];
                    const nominationId = nomsRes.rows[i].nomination_id;
                    
                    for (const personId of record.personIds) {
                        npValueStrings.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
                        npParams.push(nominationId, personId, record.roleId);
                    }
                }

                if (npValueStrings.length > 0) {
                    // Split into chunks of 1000 params max to be safe
                    const MAX_PARAMS = 10000;
                    const CHUNK_SIZE = Math.floor(MAX_PARAMS / 3);
                    
                    for (let i = 0; i < npValueStrings.length; i += CHUNK_SIZE) {
                        const chunkStrings = npValueStrings.slice(i, i + CHUNK_SIZE);
                        // Re-index params for this chunk
                        let chunkParamIndex = 1;
                        const reindexedStrings = chunkStrings.map(s => {
                            return s.replace(/\$\d+/g, () => `$${chunkParamIndex++}`);
                        });
                        
                        const chunkParams = npParams.slice(i * 3, (i + CHUNK_SIZE) * 3);
                        
                        const insertNpQuery = `
                            INSERT INTO nomination_people (nomination_id, person_id, role_id) 
                            VALUES ${reindexedStrings.join(', ')} 
                            ON CONFLICT DO NOTHING
                        `;
                        await client.query(insertNpQuery, chunkParams);
                    }
                }

                console.log(`Inserted ${nomRecords.length} nominations for film year ${filmYear}.`);

            } catch (err) {
                console.error(`Error processing ${ordinal} BAFTAs:`, err);
            }

            await sleep(500); // polite pause for wiki
        }

        console.log(`\nBatch process completed successfully!`);

    } catch (e) {
        console.error("Critical error:", e);
    } finally {
        await client.end();
    }
}

run();
