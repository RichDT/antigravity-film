import { Pool } from 'pg';
import dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const HEADERS = {
  'User-Agent': 'Antigravity/1.0 (film-metadata-backfill) contact@example.com',
};

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function searchWikiPage(query: string): Promise<string | null> {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json`;
    try {
        const sr = await fetch(searchUrl, { headers: HEADERS });
        if (!sr.ok) return null;
        const data = await sr.json() as any;
        if (!data?.query?.search || data.query.search.length === 0) return null;
        // Check if top result is highly relevant
        const topTitle = data.query.search[0].title;
        if (topTitle.toLowerCase().includes('award') || topTitle.toLowerCase().includes('society') || topTitle.toLowerCase().includes('reel')) {
             return topTitle;
        }
        return null;
    } catch {
        return null;
    }
}

async function fetchWikiPageHTML(title: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&format=json&prop=text`;
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return null;
    const data = await res.json() as any;
    return data?.parse?.text?.['*'] ?? null;
  } catch {
    return null;
  }
}

async function ensurePerson(name: string): Promise<number> {
    const cleanName = name.replace(/\\(.*?\\)/g, '').trim(); 
    if (!cleanName) return -1;
    const result = await pool.query('SELECT person_id FROM people WHERE name = $1', [cleanName]);
    if (result.rows.length > 0) return result.rows[0].person_id;
    const ins = await pool.query('INSERT INTO people (name) VALUES ($1) RETURNING person_id', [cleanName]);
    return ins.rows[0].person_id;
}

async function ensureRole(roleName: string): Promise<number> {
  let cleanedRole = roleName.replace(/s$/, '').trim(); 
  cleanedRole = cleanedRole.charAt(0).toUpperCase() + cleanedRole.slice(1);
  const result = await pool.query('SELECT role_id FROM roles WHERE role_name ILIKE $1', [cleanedRole]);
  if (result.rows.length > 0) return result.rows[0].role_id;
  const ins = await pool.query('INSERT INTO roles (role_name) VALUES ($1) RETURNING role_id', [cleanedRole]);
  return ins.rows[0].role_id;
}

function extractRolesFromHtmlList(htmlContent: string): { title: string, rolesMap: {role: string, name: string}[] }[] {
    const results: { title: string, rolesMap: {role: string, name: string}[] }[] = [];
    
    // We do raw string matching since we don't have cheerio in this environment
    // <li><i><a href="...">Film Title</a></i> – Role: <a href="..">Name</a>; Role 2: <a href="..">Name 2</a></li>
    const liRegex = /<li>(.*?)<\/li>/gi;
    let match;
    while ((match = liRegex.exec(htmlContent)) !== null) {
        let liText = match[1];
        
        // Extract title (usually the first italic or link)
        let titleMatch = liText.match(/<i>(.*?)<\/i>/i) || liText.match(/<a[^>]*>(.*?)<\/a>/i);
        if (!titleMatch) continue;
        let pTitle = titleMatch[1].replace(/<[^>]+>/g, '').trim();

        // Strip the title block to parse roles
        const titleEnd = liText.indexOf('</i>');
        if (titleEnd > -1) {
            liText = liText.substring(titleEnd + 4);
        }

        // Clean HTML tags but keep separators
        let rawText = liText.replace(/<a[^>]*>/ig, '').replace(/<\/a>/ig, '').replace(/<i>/ig, '').replace(/<\/i>/ig, '').replace(/<b>/ig, '').replace(/<\/b>/ig, '');
        // format usually: " – Production Mixer: John Doe ; Re-Recording Mixers: Jane Doe, Bob Smith"
        
        let chunks = rawText.split(';');
        const rolesMap: {role: string, name: string}[] = [];

        for (let chunk of chunks) {
             if (chunk.includes(':')) {
                 const parts = chunk.split(':');
                 const role = parts[0].replace(/^[\\s\\-–—]+/, '').trim();
                 let namesRaw = parts[1].replace(/<[^>]+>/g, '');
                 const nList = namesRaw.split(/,| and /).map(n => n.trim()).filter(n => n.length > 0 && n.length < 40);
                 for (const n of nList) {
                      rolesMap.push({ role, name: n });
                 }
             }
        }
        
        if (rolesMap.length > 0) {
            results.push({ title: pTitle, rolesMap });
        }
    }

    return results;
}

// Map known generic fallback roles when Wikipedia gives us names but no specific sub-roles
const FALLBACK_CAS = 'Sound Mixer';
const FALLBACK_MPSE = 'Sound Editor';

async function run() {
  console.log("Starting Definitive Wiki Sync...");

  // Phase 1 + 2: CAS (Mixing)
  const yearsRes = await pool.query(`
    SELECT DISTINCT ce.year 
    FROM ceremonies ce
    ORDER BY ce.year DESC
  `);

  for (const row of yearsRes.rows) {
      const year = row.year;
      // CAS
      const casYearString = year + 1; // 2012 film -> 2013 awards
      const casQuery = `Cinema Audio Society Awards ${casYearString}`;
      
      const casWikiTitle = await searchWikiPage(casQuery);
      if (casWikiTitle) {
          console.log(`[CAS] Found: ${casWikiTitle}`);
          const html = await fetchWikiPageHTML(casWikiTitle);
          if (html) {
               const parsedData = extractRolesFromHtmlList(html);
               for (const parsed of parsedData) {
                    await applyToGuild('CAS', parsed.title, year, parsed.rolesMap, 'Sound Mixing');
               }
          }
      }

      await sleep(250);

      // MPSE
      const mpseQuery = `Cinema Audio Society Awards ${casYearString}`; // MPSE is often grouped or listed under Golden Reel
      const mpseWikiTitle = await searchWikiPage(`Golden Reel Awards ${casYearString}`);
      if (mpseWikiTitle) {
          console.log(`[MPSE] Found: ${mpseWikiTitle}`);
          const html = await fetchWikiPageHTML(mpseWikiTitle);
          if (html) {
              const parsedData = extractRolesFromHtmlList(html);
              for (const parsed of parsedData) {
                  await applyToGuild('MPSE', parsed.title, year, parsed.rolesMap, 'Sound Editing');
              }
          }
      }
  }

  // Phase 3: Sync to Rich Picks
  console.log("Syncing definitively parsed logic to Rich Picks...");
  await syncRp('Sound Mixing', 'CAS');
  await syncRp('Sound Editing', 'MPSE');

  console.log("Script Complete!");
  await pool.end();
}

async function applyToGuild(orgShortName: string, filmTitle: string, year: number, rolesMap: {role:string, name:string}[], genericCategory: string) {
    if (!filmTitle || filmTitle.trim().length < 2) return;
    let filmRes = await pool.query('SELECT film_id FROM films WHERE title ILIKE $1', [`%${filmTitle.trim()}%`]);
    if (filmRes.rows.length === 0) return; 
    const filmId = filmRes.rows[0].film_id;

    const catRes = await pool.query(`SELECT category_id FROM categories WHERE name ILIKE $1 LIMIT 1`, [`%${genericCategory}%`]);
    if (catRes.rows.length === 0) return;
    
    let nomRes = await pool.query(`
        SELECT n.nomination_id
        FROM nominations n
        JOIN ceremonies ce ON n.ceremony_id = ce.ceremony_id
        JOIN awards a ON n.ceremony_id = ce.ceremony_id AND ce.award_id = a.award_id
        JOIN organizations o ON a.organization_id = o.organization_id
        WHERE n.film_id = $1 AND o.short_name = $2 AND ce.year = $3
    `, [filmId, orgShortName, year]);

    let nomId;
    if (nomRes.rows.length > 0) {
        nomId = nomRes.rows[0].nomination_id;
        await pool.query('DELETE FROM nomination_people WHERE nomination_id = $1', [nomId]);
    } else {
        const orgRes = await pool.query('SELECT organization_id FROM organizations WHERE short_name = $1', [orgShortName]);
        if (orgRes.rows.length === 0) return;
        
        let awdRes = await pool.query('SELECT award_id FROM awards WHERE organization_id = $1', [orgRes.rows[0].organization_id]);
        if (awdRes.rows.length === 0) return;

        let cerRes = await pool.query('SELECT ceremony_id FROM ceremonies WHERE award_id = $1 AND year = $2', [awdRes.rows[0].award_id, year]);
        let cerId;
        if (cerRes.rows.length === 0) {
            const ins = await pool.query('INSERT INTO ceremonies (award_id, year) VALUES ($1, $2) RETURNING ceremony_id', [awdRes.rows[0].award_id, year]);
            cerId = ins.rows[0].ceremony_id;
        } else {
            cerId = cerRes.rows[0].ceremony_id;
        }
        
        const ins2 = await pool.query('INSERT INTO nominations (film_id, category_id, ceremony_id) VALUES ($1, $2, $3) RETURNING nomination_id', [filmId, catRes.rows[0].category_id, cerId]);
        nomId = ins2.rows[0].nomination_id;
    }

    for (const item of rolesMap) {
        const pId = await ensurePerson(item.name);
        const rId = await ensureRole(item.role);
        if (pId !== -1) {
            // Upsert safely
            const linkRes = await pool.query('SELECT nomination_person_id FROM nomination_people WHERE nomination_id = $1 AND person_id = $2', [nomId, pId]);
            if (linkRes.rows.length === 0) {
                await pool.query('INSERT INTO nomination_people (nomination_id, person_id, role_id) VALUES ($1, $2, $3)', [nomId, pId, rId]);
            } else {
                await pool.query('UPDATE nomination_people SET role_id = $1 WHERE nomination_person_id = $2', [rId, linkRes.rows[0].nomination_person_id]);
            }
        }
    }
}

async function syncRp(categoryLike: string, orgShortName: string) {
     const rpNoms = await pool.query(`
        SELECT n.nomination_id, n.film_id, ce.year
        FROM nominations n
        JOIN ceremonies ce ON n.ceremony_id = ce.ceremony_id
        JOIN awards a ON ce.award_id = a.award_id
        JOIN organizations o ON a.organization_id = o.organization_id
        JOIN categories cat ON cat.category_id = n.category_id
        WHERE o.short_name = 'Rich Picks' AND cat.name ILIKE $1
    `, [`%${categoryLike}%`]);

    for (const rp of rpNoms.rows) {
        const guildNom = await pool.query(`
            SELECT n.nomination_id
            FROM nominations n
            JOIN ceremonies ce ON n.ceremony_id = ce.ceremony_id
            JOIN awards a ON ce.award_id = a.award_id
            JOIN organizations o ON a.organization_id = o.organization_id
            WHERE o.short_name = $1 AND n.film_id = $2 AND ce.year = $3
        `, [orgShortName, rp.film_id, rp.year]);

        if (guildNom.rows.length > 0) {
            const guildId = guildNom.rows[0].nomination_id;
            const peopleRes = await pool.query(`
                SELECT np.person_id, np.role_id, r.role_name 
                FROM nomination_people np
                LEFT JOIN roles r ON r.role_id = np.role_id
                WHERE np.nomination_id = $1
            `, [guildId]);

            // Only overwrite if we actually extracted roles
            if (peopleRes.rows.length > 0 && peopleRes.rows.some(r => r.role_name !== null)) {
                await pool.query('DELETE FROM nomination_people WHERE nomination_id = $1', [rp.nomination_id]);

                for (const row of peopleRes.rows) {
                    await pool.query('INSERT INTO nomination_people (nomination_id, person_id, role_id) VALUES ($1, $2, $3)', [rp.nomination_id, row.person_id, row.role_id]);
                }
            }
        }
    }
}

run().catch(console.error);
