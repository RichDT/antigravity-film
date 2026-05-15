import { Pool } from 'pg';
import dotenv from 'dotenv';

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

async function fetchWikiPage(title: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(title)}&format=json`;
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const pages = data?.query?.pages;
    if (!pages) return null;
    const page: any = Object.values(pages)[0];
    if (!page.revisions?.length) return null;
    return page.revisions[0].slots.main['*'] ?? '';
  } catch {
    return null;
  }
}

function extractNamesFromItem(itemText: string): string[] {
    // Remove "– Production Design:" and "Set Decoration:" text natively if it exists so we can map it via regex later
    let cleaned = itemText.replace(/''(.*?)(?:''|\]\])/g, ''); // try to remove film title
    
    // Extract anything within [[ ]] that doesn't have a colon (skipping file links)
    const links = [...cleaned.matchAll(/\[\[(?!File:|Image:)([^\]\|]+)(?:\|([^\]]+))?\]\]/g)];
    return links.map(m => (m[2] ? m[2] : m[1]).trim());
}

async function ensureRole(roleName: string): Promise<number> {
  const result = await pool.query('SELECT role_id FROM roles WHERE role_name = $1', [roleName]);
  if (result.rows.length > 0) return result.rows[0].role_id;
  const ins = await pool.query('INSERT INTO roles (role_name) VALUES ($1) RETURNING role_id', [roleName]);
  return ins.rows[0].role_id;
}

function getOrdinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

async function run() {
  console.log("Starting open source wiki data backfill...");

  // Find all distinct ceremony years for the targeted categories
  const yearsRes = await pool.query(`
    SELECT DISTINCT ce.year
    FROM nominations n
    JOIN ceremonies ce ON ce.ceremony_id = n.ceremony_id
    JOIN categories cat ON cat.category_id = n.category_id
    WHERE cat.name ILIKE '%Art Direction%' OR cat.name ILIKE '%Production Design%'
       OR cat.name ILIKE '%Effects%' OR cat.name ILIKE '%Make-up%' OR cat.name ILIKE '%Makeup%'
    ORDER BY ce.year DESC
  `);

  const pdRole = await ensureRole("Production Designer");
  const sdRole = await ensureRole("Set Decorator");
  const vfxRole = await ensureRole("Visual Effects Supervisor");
  const makeupRole = await ensureRole("Makeup Designer");

  for (const row of yearsRes.rows) {
      const year = row.year;
      // The Oscars ceremony for releases of 'year' is typically held in 'year + 1'
      // Example: 2024 film -> 97th Academy Awards held in 2025. 
      // Math: Ceremony # = year - 1927
      const ceremonyNumber = year - 1927;
      if (ceremonyNumber < 1) continue;
      const ceremonyOrdinal = getOrdinal(ceremonyNumber);
      const wikiTitle = `${ceremonyOrdinal}_Academy_Awards`;
      
      console.log(`Processing Year ${year} -> ${wikiTitle}...`);
      
      const wikitext = await fetchWikiPage(wikiTitle);
      if (!wikitext) {
          console.warn(`Failed to fetch Wikipedia page: ${wikiTitle}`);
          continue;
      }
      
      // Look for Production Design
      const pdBlock = wikitext.match(/(?:Best\s+(?:Production\s+Design|Art\s+Direction)).*?(?=\n\||==)/is);
      if (pdBlock) {
          const lines = pdBlock[0].split('\\n').filter(l => l.trim().startsWith('*'));
          for (const line of lines) {
              const filmMatch = line.match(/''(?:\[\[.*?\|)?(.*?)(?:\]\])?''/);
              if (filmMatch) {
                  let title = filmMatch[1].replace(/\\s+\\(.*film\\)/i, '').trim();
                  
                  // Heuristic: If it has "Production Design:" and "Set Decoration:"
                  let pdNames = [];
                  let sdNames = [];
                  
                  if (line.includes('Production Design:') && line.includes('Set Decoration:')) {
                      const pdPart = line.substring(line.indexOf('Production Design:'), line.indexOf('Set Decoration:'));
                      const sdPart = line.substring(line.indexOf('Set Decoration:'));
                      pdNames = extractNamesFromItem(pdPart);
                      sdNames = extractNamesFromItem(sdPart);
                  } else if (line.includes('Art Direction:') && line.includes('Set Decoration:')) {
                      const pdPart = line.substring(line.indexOf('Art Direction:'), line.indexOf('Set Decoration:'));
                      const sdPart = line.substring(line.indexOf('Set Decoration:'));
                      pdNames = extractNamesFromItem(pdPart);
                      sdNames = extractNamesFromItem(sdPart);
                  } else {
                      // fallback: 1st is PD, 2nd is Set dec usually, or just assign PD to all
                      const allNames = extractNamesFromItem(line);
                      if (allNames.length >= 2) {
                          pdNames = [allNames[0]];
                          sdNames = allNames.slice(1);
                      } else {
                          pdNames = allNames;
                      }
                  }

                  // DB Mapping
                  await applyRolesToDb(title, year, '%Art Direction%', pdNames, pdRole);
                  await applyRolesToDb(title, year, '%Production Design%', pdNames, pdRole);
                  await applyRolesToDb(title, year, '%Art Direction%', sdNames, sdRole);
                  await applyRolesToDb(title, year, '%Production Design%', sdNames, sdRole);
              }
          }
      }

      // Look for Make-up
      const makeupBlock = wikitext.match(/(?:Best\s+(?:Makeup|Make-up)).*?(?=\n\||==)/is);
      if (makeupBlock) {
            const lines = makeupBlock[0].split('\\n').filter(l => l.trim().startsWith('*'));
            for (const line of lines) {
                const filmMatch = line.match(/''(?:\[\[.*?\|)?(.*?)(?:\]\])?''/);
                if (filmMatch) {
                    let title = filmMatch[1].replace(/\\s+\\(.*film\\)/i, '').trim();
                    const allNames = extractNamesFromItem(line);
                    await applyRolesToDb(title, year, '%Makeup%', allNames, makeupRole);
                    await applyRolesToDb(title, year, '%Make-up%', allNames, makeupRole);
                }
            }
      }

      // Look for VFX
      const vfxBlock = wikitext.match(/(?:Best\s+(?:Visual|Special)\s+Effects).*?(?=\n\||==)/is);
      if (vfxBlock) {
          const lines = vfxBlock[0].split('\\n').filter(l => l.trim().startsWith('*'));
          for (const line of lines) {
              const filmMatch = line.match(/''(?:\[\[.*?\|)?(.*?)(?:\]\])?''/);
              if (filmMatch) {
                  let title = filmMatch[1].replace(/\\s+\\(.*film\\)/i, '').trim();
                  const allNames = extractNamesFromItem(line);
                  await applyRolesToDb(title, year, '%Effects%', allNames, vfxRole);
              }
          }
      }
      
      await sleep(100); // polite rate limit
  }

  console.log("Completed Wikipedia fallback heuristic mapping!");
  await pool.end();
}

async function applyRolesToDb(filmTitle: string, year: number, categoryLike: string, names: string[], roleId: number) {
    if (!names || names.length === 0) return;

    // Find the nomination(s) for this film in this category
    const nomRes = await pool.query(`
        SELECT n.nomination_id
        FROM nominations n
        JOIN films f ON f.film_id = n.film_id
        JOIN ceremonies ce ON ce.ceremony_id = n.ceremony_id
        JOIN categories cat ON cat.category_id = n.category_id
        WHERE f.title ILIKE $1
          AND ce.year = $2
          AND cat.name ILIKE $3
    `, [filmTitle, year, categoryLike]);

    for (const nom of nomRes.rows) {
        for (const name of names) {
            // Find person
            const pRes = await pool.query('SELECT person_id FROM people WHERE name = $1', [name.trim()]);
            if (pRes.rows.length === 0) continue; // we only map if they already exist in the DB (since Oscars DB has full lists)
            const pId = pRes.rows[0].person_id;

            // Connect/Update role
            const linkRes = await pool.query('SELECT nomination_person_id FROM nomination_people WHERE nomination_id = $1 AND person_id = $2', [nom.nomination_id, pId]);
            if (linkRes.rows.length > 0) {
                 await pool.query('UPDATE nomination_people SET role_id = $1 WHERE nomination_person_id = $2', [roleId, linkRes.rows[0].nomination_person_id]);
            }
        }
    }
}

run().catch(console.error);
