/**
 * Targeted re-fetch for people whose education has no degree entries,
 * plus anyone still with [[ in birth_place.
 * Uses the fixed parseInfobox (tracks [[ depth) and fixed parseEducation.
 * Force-overwrites education and birth_place (does NOT use COALESCE).
 */
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const DELAY_MS = 1200;
const CONCURRENCY = 3;
const LOG_INTERVAL = 100;
const HEADERS = { 'User-Agent': 'Antigravity/1.0 r.d.truncellito@gmail.com' };

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── parseInfobox with [[ depth tracking ────────────────────────────────────

function parseInfobox(wikitext: string): Record<string, string> | null {
  const re = /\{\{Infobox\s+\w/i;
  const start = re.exec(wikitext);
  if (!start) return null;

  let depth = 0, end = start.index;
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
  let cur = '', d = 0, ld = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '{' && body[i + 1] === '{') { d++; cur += ch; continue; }
    if (ch === '}' && body[i + 1] === '}') { d--; cur += ch; continue; }
    if (ch === '[' && body[i + 1] === '[') { ld++; cur += ch; continue; }
    if (ch === ']' && body[i + 1] === ']') { ld--; cur += ch; continue; }
    if (ch === '|' && d === 0 && ld === 0) { fields.push(cur); cur = ''; continue; }
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

// ─── parseEducation with fixed plain-text branch ────────────────────────────

function expandListTemplates(s: string): string {
  const templateRe = /\{\{(?:Plainlist|Flatlist|Unbulleted list|ubl)\s*/gi;
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  templateRe.lastIndex = 0;
  while ((match = templateRe.exec(s)) !== null) {
    result += s.slice(lastIndex, match.index);
    let i = match.index + match[0].length;
    let depth = 1;
    while (i < s.length - 1 && depth > 0) {
      if (s[i] === '{' && s[i + 1] === '{') { depth++; i += 2; }
      else if (s[i] === '}' && s[i + 1] === '}') { depth--; if (depth === 0) break; i += 2; }
      else i++;
    }
    const inner = s.slice(match.index + match[0].length, i);
    const items: string[] = [];
    let cur = '', ld = 0, cd = 0;
    for (let j = 0; j < inner.length; j++) {
      if (inner[j] === '[' && inner[j + 1] === '[') { ld++; cur += inner[j]; continue; }
      if (inner[j] === ']' && inner[j + 1] === ']') { ld--; cur += inner[j]; continue; }
      if (inner[j] === '{' && inner[j + 1] === '{') { cd++; cur += inner[j]; continue; }
      if (inner[j] === '}' && inner[j + 1] === '}') { cd--; cur += inner[j]; continue; }
      if (inner[j] === '|' && ld === 0 && cd === 0) { if (cur.trim()) items.push(cur.trim()); cur = ''; continue; }
      cur += inner[j];
    }
    if (cur.trim()) items.push(cur.trim());
    result += items.join('\n');
    lastIndex = i + 2;
    templateRe.lastIndex = lastIndex;
  }
  result += s.slice(lastIndex);
  return result;
}

function parseEducation(raw: string | undefined): Array<{ institution: string; degree?: string }> {
  if (!raw) return [];
  const stripped = raw
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<ref[^>]*\/>/gi, '');
  const clean = expandListTemplates(stripped)
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/\}\}/g, '');

  const lines = clean
    .split(/\n|\*|<br\s*\/?>/i)
    .map(l => l.trim())
    .filter(l => l.length > 2);

  const results: Array<{ institution: string; degree?: string }> = [];

  for (const line of lines) {
    const linkRe = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
    const links: RegExpExecArray[] = [];
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(line)) !== null) links.push(m);

    if (links.length === 0) {
      const parenMatch = line.match(/^([^(]+?)\s*\(([^)]+)\)\s*$/);
      if (parenMatch) {
        const inst = parenMatch[1].trim();
        const deg = parenMatch[2].trim();
        if (inst.length > 3) results.push({ institution: inst, ...(deg ? { degree: deg } : {}) });
      } else {
        const plain = line.trim();
        if (plain.length > 3 && !/^[A-Z.]{1,6}$/.test(plain)) {
          results.push({ institution: plain });
        }
      }
      continue;
    }

    const instMatch = links[0];
    const institution = (instMatch[2] ?? instMatch[1]).trim();
    let degree: string | undefined;
    const afterFirst = line.slice((instMatch.index ?? 0) + instMatch[0].length);
    const paren = afterFirst.match(/^\s*\(([^)]+)\)/);
    if (paren) {
      const inner = paren[1];
      const link = inner.match(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/);
      degree = (link ? link[1] : inner).replace(/\[\[|\]\]/g, '').trim();
    } else if (links.length >= 2) {
      degree = (links[1][2] ?? links[1][1]).trim();
    }
    results.push({ institution, ...(degree ? { degree } : {}) });
  }
  return results;
}

// ─── Birth place ────────────────────────────────────────────────────────────

const COUNTRY_NORM: Record<string, string> = {
  'U.S.': 'USA', 'U.S.A.': 'USA', 'United States': 'USA', 'United States of America': 'USA', 'US': 'USA',
  'U.K.': 'UK', 'United Kingdom': 'UK', 'England': 'UK', 'Great Britain': 'UK',
};

function parseBirthPlace(raw: string | undefined): { city?: string; state?: string; country?: string } | null {
  if (!raw) return null;
  const clean = raw
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return null;
  const parts = clean.split(/,\s*/).map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const normCountry = (s: string) => COUNTRY_NORM[s] ?? s;
  if (parts.length === 1) return { city: parts[0] };
  if (parts.length === 2) return { city: parts[0], country: normCountry(parts[1]) };
  return { city: parts[0], state: parts.slice(1, -1).join(', '), country: normCountry(parts[parts.length - 1]) };
}

// ─── Wikipedia fetch ─────────────────────────────────────────────────────────

async function fetchWikitext(pageTitle: string): Promise<string | null> {
  await sleep(DELAY_MS);
  const url = `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(pageTitle)}&format=json&rvlimit=1`;
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const page: any = Object.values(data?.query?.pages)[0];
    if (!page?.revisions?.length) return null;
    return page.revisions[0].slots?.main?.['*'] ?? null;
  } catch { return null; }
}

function pageTitleFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.pathname.startsWith('/wiki/')) return null;
    return decodeURIComponent(u.pathname.slice(6)).replace(/_/g, ' ');
  } catch { return null; }
}

// ─── Main ────────────────────────────────────────────────────────────────────

type PersonRow = { person_id: number; name: string; wikipedia_url: string };
type Result = 'updated' | 'no_change' | 'no_wikitext' | 'no_infobox' | 'error';

async function processPerson(p: PersonRow): Promise<Result> {
  const pageTitle = pageTitleFromUrl(p.wikipedia_url);
  if (!pageTitle) return 'error';

  const wikitext = await fetchWikitext(pageTitle);
  if (!wikitext) return 'no_wikitext';

  const infobox = parseInfobox(wikitext);
  if (!infobox) return 'no_infobox';

  const rawEdu = infobox['education'] ?? infobox['alma_mater'] ?? infobox['alma mater'];
  const education = parseEducation(rawEdu);
  const rawBp = infobox['birth_place'] ?? infobox['birthplace'];
  const birthPlace = parseBirthPlace(rawBp);

  const hasDegree = education.some(e => e.degree);
  if (education.length === 0 && !birthPlace) return 'no_change';

  try {
    await pool.query(
      `UPDATE people SET
         education   = CASE WHEN $1::jsonb IS NOT NULL THEN $1::jsonb ELSE education END,
         birth_place = CASE WHEN $2::jsonb IS NOT NULL THEN $2::jsonb ELSE birth_place END
       WHERE person_id = $3`,
      [
        education.length > 0 ? JSON.stringify(education) : null,
        birthPlace ? JSON.stringify(birthPlace) : null,
        p.person_id,
      ]
    );
    return hasDegree || birthPlace ? 'updated' : 'no_change';
  } catch (e: any) {
    console.error(`DB error ${p.person_id} ${p.name}:`, e.message);
    return 'error';
  }
}

async function runWorker(
  batch: PersonRow[],
  stats: Record<Result | 'done' | 'total', number>
) {
  for (const p of batch) {
    const r = await processPerson(p);
    stats[r]++;
    stats.done++;
    if (stats.done % LOG_INTERVAL === 0) {
      const pct = ((stats.done / stats.total) * 100).toFixed(1);
      console.log(
        `[${new Date().toLocaleTimeString()}] ${pct}% (${stats.done}/${stats.total})` +
        `  updated=${stats.updated} no_change=${stats.no_change}` +
        `  no_wikitext=${stats.no_wikitext} no_infobox=${stats.no_infobox} errors=${stats.error}`
      );
    }
  }
}

async function main() {
  const { rows } = await pool.query<PersonRow>(`
    SELECT person_id, name, wikipedia_url
    FROM people
    WHERE wikipedia_url IS NOT NULL
      AND education IS NOT NULL
      AND jsonb_array_length(education) = 1
    ORDER BY person_id
  `);
  console.log(`Re-fetching education for ${rows.length} people.\n`);

  const buckets: PersonRow[][] = Array.from({ length: CONCURRENCY }, () => []);
  rows.forEach((r, i) => buckets[i % CONCURRENCY].push(r));

  const stats: Record<Result | 'done' | 'total', number> = {
    updated: 0, no_change: 0, no_wikitext: 0, no_infobox: 0, error: 0,
    done: 0, total: rows.length,
  };
  const t0 = Date.now();

  await Promise.all(buckets.map(b => runWorker(b, stats)));

  const elapsed = ((Date.now() - t0) / 1000 / 60).toFixed(1);
  console.log(`\nFinished in ${elapsed} min`);
  console.log(`  updated:     ${stats.updated}`);
  console.log(`  no_change:   ${stats.no_change}`);
  console.log(`  no_wikitext: ${stats.no_wikitext}`);
  console.log(`  no_infobox:  ${stats.no_infobox}`);
  console.log(`  errors:      ${stats.error}`);

  await pool.end();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
