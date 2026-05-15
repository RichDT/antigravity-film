import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const DELAY_MS = 1500; // gentle delay between Wikipedia API calls

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Map Wikipedia infobox fields to our internal roles
const ROLE_MAP: Record<string, string> = {
  director: 'Director',
  producer: 'Producer',
  writer: 'Writer',
  screenplay: 'Writer',
  story: 'Writer',
  cinematography: 'Cinematographer',
  editing: 'Editor',
  music: 'Composer',
  'production design': 'Production Designer',
  'costume design': 'Costume Designer',
};

// Extracts values from a wikitext string. Handles simple values and wikitext links e.g., [[Phil Lord]] or [[Phil Lord|Philip Lord]]
// Also handles HTML line breaks <br>, bullet points, and {{Plainlist| ... }}
function parseWikitextList(wikitext: string | undefined): string[] {
  if (!wikitext) return [];
  
  // Clean up references like <ref>...</ref> and HTML comments
  let text = wikitext.replace(/<ref[^>]*>.*?<\/ref>/gi, '')
                     .replace(/<ref[^>]*\/>/gi, '')
                     .replace(/<!--.*?-->/g, '');

  const names: string[] = [];

  // 1. Find all pure wiki links: [[Target]] or [[Target|Label]]
  const linkRegex = /\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g;
  let match;
  while ((match = linkRegex.exec(text)) !== null) {
    if (!match[1].toLowerCase().includes('category:') && !match[1].toLowerCase().includes('file:')) {
      names.push(match[1].trim());
    }
  }

  // Remove the wikilinks we just extracted so they don't get processed as plaintext
  text = text.replace(/\[\[.*?\]\]/g, ' ');

  // Strip template markup like {{Plainlist| ... }}
  text = text.replace(/\{\{Plainlist\|?\s*/i, '').replace(/\}\}/g, '');
  text = text.replace(/\{\{ubl\|/i, '').replace(/\{\{flatlist\|/i, '');
  
  // Split remaining text by common delimiters: unbulleted list stars (*), line breaks, etc.
  const parts = text.split(/<br\s*\/?>|\n|\*|\|/i)
                    .map(p => p.trim())
                    // Ignore parts that look like typical infobox junk or are too long
                    .filter(p => p.length > 0 && p.length < 50 && !p.includes('=') && !p.includes('}}')); 
  names.push(...parts);

  // Deduplicate and clean up
  return [...new Set(names)]
    .map(n => n.replace(/<\/?[^>]+(>|$)/g, "")) // stip any lingering html
    .filter(n => n.length > 0);
}

// Tries to find the exact wikipedia page title for a given film title and year
async function findWikipediaPageTitle(title: string, year: number): Promise<string | null> {
  // First try direct search with "(film)" or "(year film)"
  const queries = [
    `${title} (${year} film)`,
    `${title} (film)`,
    title
  ];

  const headers = { 'User-Agent': 'Antigravity/1.0 (admin@example.com) NextJS db sync script' };
  for (const q of queries) {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&utf8=&format=json&srlimit=1`;
    try {
      const res = await fetch(url, { headers });
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        if (data.query && data.query.search && data.query.search.length > 0) {
          await sleep(DELAY_MS); // Be gentle
          return data.query.search[0].title;
        }
      } catch (e) {
        console.error(`Error parsing JSON for ${q} (possibly blocked by Wikipedia). Response text snippet:`, text.substring(0, 100));
      }
    } catch (e) {
      console.error(`Network Error searching Wikipedia for ${q}:`, e);
    }
    await sleep(DELAY_MS);
  }
  return null;
}

async function fetchWikipediaInfobox(pageTitle: string): Promise<Record<string, string> | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(pageTitle)}&format=json`;
  const headers = { 'User-Agent': 'Antigravity/1.0 (admin@example.com) NextJS db sync script' };
  try {
    const res = await fetch(url, { headers });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error(`Error parsing JSON for infobox ${pageTitle}. Blocked?`);
      return null;
    }
    const pages = data.query?.pages;
    if (!pages) return null;
    
    const page: any = Object.values(pages)[0];
    if (!page.revisions || page.revisions.length === 0) return null;
    
    const wikitext = page.revisions[0].slots.main['*'];
    if (!wikitext) return null;

    // We only care about the {{Infobox film ... }} block
    const infoboxMatch = wikitext.match(/\{\{Infobox film\s*\|([\s\S]*?)(?=\n\}\}|\n\n)/i) ||
                         wikitext.match(/\{\{Infobox television\s*\|([\s\S]*?)(?=\n\}\}|\n\n)/i); 
                         
    if (!infoboxMatch) return null;

    const infoboxText = infoboxMatch[1];
    
    // Parse key-value pairs (basic implementation handling some nested templates)
    const result: Record<string, string> = {};
    const lines = infoboxText.split(/\n\s*\|\s*/);
    
    for (const line of lines) {
      // Split by first equals sign
      const eqIndex = line.indexOf('=');
      if (eqIndex === -1) continue;
      
      const key = line.substring(0, eqIndex).trim().toLowerCase();
      const value = line.substring(eqIndex + 1).trim();
      if (key && value) {
        result[key] = value;
      }
    }
    
    return result;

  } catch (e) {
    console.error(`Error fetching wikitext for ${pageTitle}:`, e);
    return null;
  }
}

const normalizeStr = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

async function run() {
  console.log('Fetching films from database...');
  // Group by title and year to avoid redundant API queries for duplicate films
  const res = await pool.query(`SELECT title, release_year, array_agg(film_id) as film_ids FROM films WHERE wikipedia_url IS NULL OR wikipedia_url = '' GROUP BY title, release_year ORDER BY MAX(film_id) DESC`);
  const films = res.rows;
  console.log(`Found ${films.length} unique films to process.`);

  console.log('Caching people table...');
  const peopleRes = await pool.query(`SELECT person_id, name FROM people`);
  const personLookup = new Map<string, number>();
  // Normalize names (remove accents, lowercase) for robust matching
  peopleRes.rows.forEach(p => {
     personLookup.set(normalizeStr(p.name), p.person_id);
  });

  for (const film of films) {
    console.log(`\nProcessing: ${film.title} (${film.release_year}) with ${film.film_ids.length} entries`);
    
    let pageTitle = film.title;
    // We don't have wikipedia_url available directly here anymore, we grouped by title/year.
    // If one of these duplicates already had a wikipedia_url it wouldn't be in this query anyway.
    const foundTitle = await findWikipediaPageTitle(film.title, film.release_year);
       if (!foundTitle) {
         console.log(`  -> Could not find Wikipedia page`);
         continue;
       }
       pageTitle = foundTitle;
    

    console.log(`  -> Fetching infobox for "${pageTitle}"...`);
    const infobox = await fetchWikipediaInfobox(pageTitle);
    await sleep(DELAY_MS);
    
    if (!infobox) {
       console.log(`  -> Could not parse Infobox film`);
       continue;
    }

    // 1. Update Film Metadata
    const dbWikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`;
    
    // Clean metadata fields of refs
    const cleanStr = (s: string | undefined) => s ? s.replace(/<ref[^>]*>.*?<\/ref>/gi, '').trim() : null;
    
    const budget = cleanStr(infobox['budget']);
    const gross = cleanStr(infobox['gross']);
    const country = cleanStr(infobox['country']);
    const language = cleanStr(infobox['language']);

    const filmIds = film.film_ids as number[];
    for (const fId of filmIds) {
      await pool.query(
        `UPDATE films SET wikipedia_url = $1, budget = COALESCE($2, budget), box_office = COALESCE($3, box_office), country = COALESCE($4, country), original_language = COALESCE($5, original_language) WHERE film_id = $6`,
        [dbWikiUrl, budget, gross, country, language, fId]
      );
    }

    // 2. Map Crew Roles
    let matchedCrewCount = 0;
    for (const [wikiField, ourRole] of Object.entries(ROLE_MAP)) {
       const wikitextVal = infobox[wikiField] || infobox[wikiField + 's'];
       const crewNames = parseWikitextList(wikitextVal);
       
       for (const name of crewNames) {
          const personId = personLookup.get(normalizeStr(name));
          if (personId) {
             let insertedAny = false;
             for (const fId of filmIds) {
                try {
                   await pool.query(
                      `INSERT INTO film_crew (film_id, person_id, crew_role) VALUES ($1, $2, $3)
                       ON CONFLICT (film_id, person_id, crew_role) DO NOTHING`,
                      [fId, personId, ourRole]
                   );
                   insertedAny = true;
                } catch (e) {}
             }
             if (insertedAny) matchedCrewCount++;
          }
       }
    }
    
    console.log(`  -> Found ${matchedCrewCount} ground truth crew connections.`);
  }

  console.log('\nSync complete!');
  pool.end();
}

run().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
