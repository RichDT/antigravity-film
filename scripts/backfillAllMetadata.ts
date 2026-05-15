import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const DELAY_MS = 450;
const CONCURRENCY = 5;
const LOG_INTERVAL = 100;

const HEADERS = {
  'User-Agent': 'Antigravity/1.0 (film-metadata-backfill) r.d.truncellito@gmail.com',
};

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function pageTitleFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.pathname.startsWith('/wiki/')) return null;
    return decodeURIComponent(u.pathname.slice(6)).replace(/_/g, ' ');
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
    .replace(/\{\{(?:increase|decrease|steady)[^}]*\}\}/gi, '')
    .replace(/\{\{(?:plainlist|ubl|flatlist|unbulleted list)\|?\s*/gi, '')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/\}\}/g, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\*\s*/g, ', ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .trim() || null;
}

function parseRuntime(raw: string | undefined): number | null {
  if (!raw) return null;
  const m = raw.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

// True if string contains characters from non-Latin writing systems
function hasNonLatinScript(s: string): boolean {
  return /[Ѐ-ӿ؀-ۿऀ-ॿঀ-৿਀-੿଀-୿ఀ-౿ഀ-ൿ฀-๿ༀ-࿿က-႟Ⴀ-ჿሀ-፿Ꭰ-᏿ -᚟ᚠ-᛿ᜀ-ᜟᜠ-᜿ᝀ-᝟ᝠ-᝿ក-៿᠀-᢯Ḁ-ỿἀ-῿Ⰰ-ⱟⱠ-ⱿⲀ-⳿぀-ヿ㐀-䶿一-鿿ꀀ-꒏가-힯豈-﫿ﬀ-ﭏﭐ-﷿ﹰ-﻿＀-￯]/.test(s);
}

// Depth-aware infobox parser (handles nested {{ }})
function parseInfobox(wikitext: string): Record<string, string> | null {
  const re = /\{\{Infobox\s+(?:film|television)/i;
  const start = re.exec(wikitext);
  if (!start) return null;

  let depth = 0;
  let end = start.index;
  for (let i = start.index; i < wikitext.length - 1; i++) {
    if (wikitext[i] === '{' && wikitext[i + 1] === '{') { depth++; i++; }
    else if (wikitext[i] === '}' && wikitext[i + 1] === '}') {
      depth--;
      if (depth === 0) { end = i + 2; break; }
      i++;
    }
  }

  const raw = wikitext.slice(start.index, end);
  const nl = raw.indexOf('\n');
  if (nl === -1) return null;
  const body = raw.slice(nl + 1);

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

function extractOriginalTitle(wikitext: string, infobox: Record<string, string>): string | null {
  // 1. Infobox 'name' field (common for foreign-language films)
  const nameRaw = infobox['name']?.trim();
  if (nameRaw) {
    const cleaned = nameRaw
      .replace(/<[^>]+>/g, '')
      .replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1')
      .replace(/\{\{[^}]*\}\}/g, '')
      .replace(/'''|''/g, '')
      .replace(/\|[\s\S]*/m, '')
      .trim();
    if (cleaned && hasNonLatinScript(cleaned)) return cleaned;
  }

  // 2. Scan article intro (first 5000 chars) for language templates
  const intro = wikitext.slice(0, 5000);

  // {{nihongo|Romaji|漢字|...}} — Japanese; original title is 2nd argument
  const nihongo = intro.match(/\{\{nihongo[^|]*\|[^|]*\|([^|}\n]+)/i);
  if (nihongo) {
    const c = nihongo[1].trim().replace(/'''|''/g, '').replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1');
    if (hasNonLatinScript(c)) return c;
  }

  // {{Korean|hangul=한글|...}} — Korean
  const korean = intro.match(/\{\{Korean[^}]*hangul\s*=\s*([^|}\n]+)/i);
  if (korean) {
    const c = korean[1].trim();
    if (hasNonLatinScript(c)) return c;
  }

  // {{zh|c=漢字|...}} or {{zh|s=...}} — Chinese
  const zh = intro.match(/\{\{zh[^}]*[cstp]\s*=\s*([^|}\n]+)/i);
  if (zh) {
    const c = zh[1].trim();
    if (hasNonLatinScript(c)) return c;
  }

  // {{lang-XX|VALUE}} or {{lang|XX|VALUE}} — generic language template
  const lang = intro.match(/\{\{(?:lang-[a-z-]+|lang\|[a-z-]+\|)([^|}\n]+)/i);
  if (lang) {
    const c = lang[1].trim().replace(/'''|''/g, '');
    if (hasNonLatinScript(c)) return c;
  }

  // {{transl|XX|VALUE}} — transliteration (the value before translation is the original)
  const transl = intro.match(/\{\{transl\|[a-z-]+\|[^|]*\|([^|}\n]+)/i);
  if (transl) {
    const c = transl[1].trim();
    if (hasNonLatinScript(c)) return c;
  }

  return null;
}

async function searchWikipedia(title: string, year: number): Promise<{ url: string; pageTitle: string } | null> {
  const queries = [
    `${title} (${year} film)`,
    `${title} (film)`,
    title,
  ];

  for (const q of queries) {
    await sleep(DELAY_MS);
    try {
      const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&srlimit=3&srwhat=text`;
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) continue;
      const data = await res.json() as any;
      const results: any[] = data?.query?.search ?? [];
      for (const r of results) {
        const pt: string = r.title;
        // Simple sanity check: the result title should share the beginning of the film title
        const prefix = title.toLowerCase().slice(0, Math.min(8, title.length));
        if (pt.toLowerCase().includes(prefix)) {
          return {
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(pt.replace(/ /g, '_'))}`,
            pageTitle: pt,
          };
        }
      }
    } catch {
      // network error; continue to next query
    }
  }
  return null;
}

async function fetchWikitext(pageTitle: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(pageTitle)}&format=json&rvlimit=1`;
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const pages = data?.query?.pages;
    if (!pages) return null;
    const page: any = Object.values(pages)[0];
    if (!page.revisions?.length) return null;
    return (page.revisions[0].slots?.main?.['*'] ?? page.revisions[0]['*']) ?? null;
  } catch {
    return null;
  }
}

type FilmRow = {
  film_id: number;
  title: string;
  release_year: number;
  wikipedia_url: string | null;
  runtime_minutes: number | null;
  budget: string | null;
  box_office: string | null;
  country: string | null;
  original_language: string | null;
  original_title: string | null;
};

type Result = 'updated' | 'url_only' | 'no_page' | 'no_infobox' | 'no_data' | 'error';

async function processFilm(film: FilmRow): Promise<Result> {
  let pageTitle: string | null = null;
  let wikiUrl = film.wikipedia_url;

  if (wikiUrl) {
    pageTitle = pageTitleFromUrl(wikiUrl);
  } else {
    const found = await searchWikipedia(film.title, film.release_year);
    if (!found) return 'no_page';
    wikiUrl = found.url;
    pageTitle = found.pageTitle;
  }

  if (!pageTitle) return 'no_page';

  await sleep(DELAY_MS);
  const wikitext = await fetchWikitext(pageTitle);

  if (!wikitext) {
    if (!film.wikipedia_url && wikiUrl) {
      await pool.query('UPDATE films SET wikipedia_url = $1 WHERE film_id = $2', [wikiUrl, film.film_id]);
      return 'url_only';
    }
    return 'no_infobox';
  }

  const infobox = parseInfobox(wikitext);
  if (!infobox) {
    if (!film.wikipedia_url && wikiUrl) {
      await pool.query('UPDATE films SET wikipedia_url = $1 WHERE film_id = $2', [wikiUrl, film.film_id]);
      return 'url_only';
    }
    return 'no_infobox';
  }

  const runtime = parseRuntime(infobox['runtime'] ?? infobox['running time'] ?? infobox['runtime_minutes']);
  const budget = cleanField(infobox['budget']);
  const boxOffice = cleanField(infobox['gross'] ?? infobox['box office'] ?? infobox['box_office'] ?? infobox['revenue']);
  const country = cleanField(infobox['country'] ?? infobox['countries']);
  const language = cleanField(infobox['language'] ?? infobox['languages']);
  const originalTitle = extractOriginalTitle(wikitext, infobox);

  if (!runtime && !budget && !boxOffice && !country && !language && !originalTitle && film.wikipedia_url) {
    return 'no_data';
  }

  try {
    await pool.query(
      `UPDATE films SET
         wikipedia_url     = COALESCE($1, wikipedia_url),
         runtime_minutes   = COALESCE($2::int, runtime_minutes),
         budget            = COALESCE($3, budget),
         box_office        = COALESCE($4, box_office),
         country           = COALESCE($5, country),
         original_language = COALESCE($6, original_language),
         original_title    = COALESCE($7, original_title)
       WHERE film_id = $8`,
      [wikiUrl, runtime, budget, boxOffice, country, language, originalTitle, film.film_id]
    );
    return 'updated';
  } catch (e: any) {
    console.error(`  DB error film_id=${film.film_id} "${film.title}":`, e.message);
    return 'error';
  }
}

async function runWorker(
  films: FilmRow[],
  stats: Record<Result | 'done' | 'total', number>
) {
  for (const film of films) {
    const result = await processFilm(film);
    stats[result]++;
    stats.done++;
    if (stats.done % LOG_INTERVAL === 0) {
      const pct = ((stats.done / stats.total) * 100).toFixed(1);
      console.log(
        `[${new Date().toLocaleTimeString()}] ${pct}% (${stats.done}/${stats.total})` +
        `  updated=${stats.updated} url_only=${stats.url_only} no_page=${stats.no_page}` +
        `  no_infobox=${stats.no_infobox} no_data=${stats.no_data} errors=${stats.error}`
      );
    }
  }
}

async function main() {
  await pool.query(`ALTER TABLE films ADD COLUMN IF NOT EXISTS original_title TEXT`);
  console.log('Column original_title ready.\n');

  const { rows: films } = await pool.query<FilmRow>(`
    SELECT film_id, title, release_year, wikipedia_url,
           runtime_minutes, budget, box_office, country, original_language, original_title
    FROM films
    WHERE NOT (
      wikipedia_url     IS NOT NULL
      AND runtime_minutes IS NOT NULL
      AND budget          IS NOT NULL
      AND box_office      IS NOT NULL
      AND country         IS NOT NULL
      AND original_language IS NOT NULL
      AND original_language ILIKE '%english%'
    )
    ORDER BY release_year DESC, film_id
  `);
  console.log(`Films to process: ${films.length}\n`);

  const buckets: FilmRow[][] = Array.from({ length: CONCURRENCY }, () => []);
  films.forEach((f, i) => buckets[i % CONCURRENCY].push(f));

  const stats: Record<Result | 'done' | 'total', number> = {
    updated: 0, url_only: 0, no_page: 0, no_infobox: 0, no_data: 0, error: 0,
    done: 0, total: films.length,
  };
  const t0 = Date.now();

  await Promise.all(buckets.map(b => runWorker(b, stats)));

  const elapsed = ((Date.now() - t0) / 1000 / 60).toFixed(1);
  console.log(`\nFinished in ${elapsed} min`);
  console.log(`  updated:     ${stats.updated}`);
  console.log(`  url_only:    ${stats.url_only}`);
  console.log(`  no_page:     ${stats.no_page}`);
  console.log(`  no_infobox:  ${stats.no_infobox}`);
  console.log(`  no_data:     ${stats.no_data}`);
  console.log(`  errors:      ${stats.error}`);

  await pool.end();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
