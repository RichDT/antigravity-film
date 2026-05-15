import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const DELAY_MS = 350;
const CONCURRENCY = 5;
const BATCH_LOG = 100;

const HEADERS = {
  'User-Agent': 'Antigravity/1.0 (film-metadata-backfill) contact@example.com',
};

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function pageTitleFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const path = u.pathname;
    if (!path.startsWith('/wiki/')) return null;
    return decodeURIComponent(path.slice(6)).replace(/_/g, ' ');
  } catch {
    return null;
  }
}

function cleanField(raw: string | undefined): string | null {
  if (!raw) return null;
  return raw
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\{\{(?:plainlist|ubl|flatlist|unbulleted list)\|?\s*/gi, '')
    .replace(/\}\}/g, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1')  // unwrap [[Target|Label]] → Label
    .replace(/\[\[([^\]]+)\]\]/g, '$1')  // unwrap [[Target]] → Target
    .replace(/\*\s*/g, ', ')              // list bullets → comma
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .trim() || null;
}

function parseRuntime(raw: string | undefined): number | null {
  if (!raw) return null;
  const match = raw.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/** Parse a Wikipedia infobox by extracting the raw {{...}} block, then
 *  splitting on top-level pipe chars (depth-aware) */
function parseInfobox(wikitext: string): Record<string, string> | null {
  // Find the start of {{Infobox film or {{Infobox television
  const infoboxRe = /\{\{Infobox\s+(?:film|television)/i;
  const startMatch = infoboxRe.exec(wikitext);
  if (!startMatch) return null;

  // Walk forward counting {{ / }} depth to find the closing }}
  let depth = 0;
  let end = startMatch.index;
  for (let i = startMatch.index; i < wikitext.length - 1; i++) {
    if (wikitext[i] === '{' && wikitext[i + 1] === '{') { depth++; i++; }
    else if (wikitext[i] === '}' && wikitext[i + 1] === '}') {
      depth--;
      if (depth === 0) { end = i + 2; break; }
      i++;
    }
  }

  // The infobox content is everything inside, after the first newline
  // (skip the "{{Infobox film" heading line itself)
  const raw = wikitext.slice(startMatch.index, end);
  const firstNewline = raw.indexOf('\n');
  if (firstNewline === -1) return null;
  const body = raw.slice(firstNewline + 1); // content after "{{Infobox film\n"

  // Split body on top-level "|" characters
  const fields: string[] = [];
  let cur = '';
  let d = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '{' && body[i + 1] === '{') { d++; cur += ch; continue; }
    if (ch === '}' && body[i + 1] === '}') { d--; cur += ch; continue; }
    if (ch === '|' && d === 0) { fields.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur) fields.push(cur);

  const result: Record<string, string> = {};
  for (const field of fields) {
    const eq = field.indexOf('=');
    if (eq === -1) continue;
    const key = field.slice(0, eq).replace(/\n/g, '').trim().toLowerCase();
    const val = field.slice(eq + 1).trim();
    if (key && val) result[key] = val;
  }
  return result;
}

async function fetchInfobox(pageTitle: string): Promise<Record<string, string> | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(pageTitle)}&format=json`;
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const pages = data?.query?.pages;
    if (!pages) return null;
    const page: any = Object.values(pages)[0];
    if (!page.revisions?.length) return null;
    const wikitext: string = page.revisions[0].slots.main['*'] ?? '';
    return parseInfobox(wikitext);
  } catch {
    return null;
  }
}

type FilmRow = {
  film_id: number;
  title: string;
  release_year: number;
  wikipedia_url: string;
};

async function processFilm(film: FilmRow): Promise<'updated' | 'skipped' | 'error'> {
  const pageTitle = pageTitleFromUrl(film.wikipedia_url);
  if (!pageTitle) return 'skipped';

  await sleep(DELAY_MS);
  const infobox = await fetchInfobox(pageTitle);
  if (!infobox) return 'skipped';

  const country   = cleanField(infobox['country'] ?? infobox['countries']);
  const language  = cleanField(infobox['language'] ?? infobox['languages']);
  const budget    = cleanField(infobox['budget']);
  const boxOffice = cleanField(infobox['gross'] ?? infobox['box office'] ?? infobox['box_office']);
  const runtime   = parseRuntime(infobox['runtime'] ?? infobox['running time']);

  if (!country && !language && !budget && !boxOffice && !runtime) return 'skipped';

  try {
    await pool.query(
      `UPDATE films SET
        country           = COALESCE($1, country),
        original_language = COALESCE($2, original_language),
        budget            = COALESCE($3, budget),
        box_office        = COALESCE($4, box_office),
        runtime_minutes   = COALESCE($5, runtime_minutes)
       WHERE film_id = $6`,
      [country, language, budget, boxOffice, runtime, film.film_id]
    );
    return 'updated';
  } catch (e: any) {
    console.error(`  DB error for ${film.title}:`, e.message);
    return 'error';
  }
}

async function runWorker(
  films: FilmRow[],
  results: { updated: number; skipped: number; errors: number; done: number; total: number }
) {
  for (const film of films) {
    const status = await processFilm(film);
    if (status === 'updated') results.updated++;
    else if (status === 'skipped') results.skipped++;
    else results.errors++;
    results.done++;
    if (results.done % BATCH_LOG === 0) {
      const pct = ((results.done / results.total) * 100).toFixed(1);
      console.log(
        `  [${new Date().toLocaleTimeString()}] ${pct}% (${results.done}/${results.total}) ` +
        `✓${results.updated} updated | ⊘${results.skipped} skipped | ✗${results.errors} errors`
      );
    }
  }
}

async function main() {
  console.log('Fetching films with Wikipedia URL but missing metadata...');
  const { rows: films } = await pool.query<FilmRow>(`
    SELECT film_id, title, release_year, wikipedia_url
    FROM films
    WHERE wikipedia_url IS NOT NULL
      AND wikipedia_url != ''
      AND (country IS NULL OR original_language IS NULL OR budget IS NULL OR box_office IS NULL OR runtime_minutes IS NULL)
    ORDER BY release_year DESC
  `);
  console.log(`Found ${films.length} films to backfill.\n`);

  const buckets: FilmRow[][] = Array.from({ length: CONCURRENCY }, () => []);
  films.forEach((f, i) => buckets[i % CONCURRENCY].push(f));

  const results = { updated: 0, skipped: 0, errors: 0, done: 0, total: films.length };
  const start = Date.now();

  await Promise.all(buckets.map(bucket => runWorker(bucket, results)));

  const elapsed = ((Date.now() - start) / 1000 / 60).toFixed(1);
  console.log(`\n✅ Done in ${elapsed} min.`);
  console.log(`   Updated: ${results.updated}`);
  console.log(`   Skipped (no useful data found): ${results.skipped}`);
  console.log(`   Errors: ${results.errors}`);

  await pool.end();
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
