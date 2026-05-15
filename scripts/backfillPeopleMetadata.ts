import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const CONCURRENCY = 3;
const DELAY_MS = 1200;
const LOG_INTERVAL = 100;

const HEADERS = {
  'User-Agent': 'Antigravity/1.0 (people-metadata-backfill) r.d.truncellito@gmail.com',
};

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Name parsing ────────────────────────────────────────────────────────────

const APPENDICES = new Set(['Jr.', 'Sr.', 'II', 'III', 'IV', 'V', 'Jr', 'Sr', '2nd', '3rd']);

function parseNameParts(name: string, isInverted: boolean) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: null, middle: null, last: null, appendix: null };

  let appendix: string | null = null;
  const tail = parts[parts.length - 1].replace(/,$/, '');
  if (APPENDICES.has(tail) && parts.length > 1) {
    appendix = tail;
    parts.pop();
  }

  if (parts.length === 0) return { first: null, middle: null, last: null, appendix };
  if (parts.length === 1) return { first: parts[0], middle: null, last: null, appendix };

  if (isInverted) {
    // e.g. "Bong Joon-ho": family name first → last=Bong, first=Joon-ho
    const [last, ...rest] = parts;
    return {
      last,
      first: rest[rest.length - 1],
      middle: rest.length > 1 ? rest.slice(0, -1).join(' ') : null,
      appendix,
    };
  }

  if (parts.length === 2) return { first: parts[0], middle: null, last: parts[1], appendix };
  return {
    first: parts[0],
    middle: parts.slice(1, -1).join(' ') || null,
    last: parts[parts.length - 1],
    appendix,
  };
}

// ─── Date parsing ────────────────────────────────────────────────────────────

const MONTHS: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04', may: '05',
  june: '06', july: '07', august: '08', september: '09', october: '10',
  november: '11', december: '12',
  jan: '01', feb: '02', mar: '03', apr: '04', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function parseNaturalDate(s: string): string | null {
  const s2 = s.trim().toLowerCase().replace(/[,]+/g, ' ').replace(/\s+/g, ' ');
  // "22 june 1949"
  const dmy = s2.match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
  if (dmy) {
    const m = MONTHS[dmy[2]];
    if (m) return `${dmy[3]}-${m}-${dmy[1].padStart(2, '0')}`;
  }
  // "june 22 1949"
  const mdy = s2.match(/([a-z]+)\s+(\d{1,2})\s+(\d{4})/);
  if (mdy) {
    const m = MONTHS[mdy[1]];
    if (m) return `${mdy[3]}-${m}-${mdy[2].padStart(2, '0')}`;
  }
  // year only → Jan 1 of that year
  const yr = s2.match(/^(\d{4})$/);
  if (yr) return `${yr[1]}-01-01`;
  return null;
}

function parseDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = raw.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '').replace(/<ref[^>]*\/>/gi, '').trim();

  // {{birth date|YYYY|M|D}} / {{death date|YYYY|M|D}} / {{birth date and age|...}}
  const tmpl = s.match(/\{\{(?:birth|death)\s+date(?:\s+and\s+age)?\s*\|\s*(\d{4})\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})/i);
  if (tmpl) return `${tmpl[1]}-${tmpl[2].padStart(2, '0')}-${tmpl[3].padStart(2, '0')}`;

  // {{birth-date|text}} / {{death-date|text}}
  const dashed = s.match(/\{\{(?:birth|death)-date\|([^|}]+)/i);
  if (dashed) return parseNaturalDate(dashed[1]);

  // ISO YYYY-MM-DD
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  return parseNaturalDate(s);
}

// ─── Birth place parsing ──────────────────────────────────────────────────────

const COUNTRY_NORM: Record<string, string> = {
  'U.S.': 'USA', 'U.S.A.': 'USA', 'United States': 'USA',
  'United States of America': 'USA', 'US': 'USA',
  'U.K.': 'UK', 'United Kingdom': 'UK', 'England': 'UK',
  'Great Britain': 'UK',
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
  // 3+: city, [state], country
  return {
    city: parts[0],
    state: parts.slice(1, -1).join(', '),
    country: normCountry(parts[parts.length - 1]),
  };
}

// ─── Education parsing ────────────────────────────────────────────────────────

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
    // Extract all wiki links in this line
    const linkRe = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
    const links: RegExpExecArray[] = [];
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(line)) !== null) links.push(m);

    if (links.length === 0) {
      // plain text – extract institution and any parenthetical degree
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

    // First link is the institution
    const instMatch = links[0];
    const institution = (instMatch[2] ?? instMatch[1]).trim();

    // Look for a degree: second wikilink, or text in parentheses after the first link
    let degree: string | undefined;
    const afterFirst = line.slice((instMatch.index ?? 0) + instMatch[0].length);

    // Parenthetical degree: "[[Vassar]] ([[BA|B.A.]])" or "[[Vassar]] (B.A.)"
    const paren = afterFirst.match(/^\s*\(([^)]+)\)/);
    if (paren) {
      const inner = paren[1];
      const link = inner.match(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/);
      degree = (link ? link[1] : inner).replace(/\[\[|\]\]/g, '').trim();
    } else if (links.length >= 2) {
      // Second link is the degree
      degree = (links[1][2] ?? links[1][1]).trim();
    }

    if (institution) results.push({ institution, ...(degree ? { degree } : {}) });
  }

  return results;
}

// ─── Infobox parser (generic, depth-aware) ───────────────────────────────────

function parseInfobox(wikitext: string): Record<string, string> | null {
  // Match any {{Infobox ...}} block
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

function isPersonInfobox(infobox: Record<string, string>): boolean {
  return 'birth_date' in infobox || 'birthdate' in infobox || 'born' in infobox ||
    'death_date' in infobox || 'deathdate' in infobox || 'birth_place' in infobox ||
    'birthplace' in infobox || 'education' in infobox || 'alma_mater' in infobox;
}

// ─── Original script name ─────────────────────────────────────────────────────

function hasNonLatinScript(s: string): boolean {
  return /[Ѐ-ӿ؀-ۿऀ-ॿ一-鿿぀-ヿ가-힯฀-๿א-תက-႟Ⴀ-ჿ]/.test(s);
}

function extractOriginalScriptName(wikitext: string, infobox: Record<string, string>): string | null {
  // Check infobox native_name
  const native = infobox['native_name']?.trim();
  if (native && hasNonLatinScript(native)) {
    const c = native.replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1').replace(/\{\{[^}]*\}\}/g, '').replace(/'''|''/g, '').trim();
    if (c && hasNonLatinScript(c)) return c;
  }

  const intro = wikitext.slice(0, 5000);

  // {{nihongo|Romaji|漢字|...}} — Japanese, original title is 2nd argument
  const nihongo = intro.match(/\{\{nihongo[^|]*\|[^|]*\|([^|}\n]+)/i);
  if (nihongo) {
    const c = nihongo[1].trim().replace(/'''|''/g, '').replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1');
    if (hasNonLatinScript(c)) return c;
  }

  // {{Korean|hangul=한글|...}}
  const korean = intro.match(/\{\{Korean[^}]*hangul\s*=\s*([^|}\n]+)/i);
  if (korean) {
    const c = korean[1].trim();
    if (hasNonLatinScript(c)) return c;
  }

  // {{zh|c=漢字|...}}
  const zh = intro.match(/\{\{zh[^}]*[cstp]\s*=\s*([^|}\n]+)/i);
  if (zh) {
    const c = zh[1].trim();
    if (hasNonLatinScript(c)) return c;
  }

  // {{lang-XX|VALUE}} or {{lang|XX|VALUE}}
  const lang = intro.match(/\{\{(?:lang-[a-z-]+|lang\|[a-z-]+\|)([^|}\n]+)/i);
  if (lang) {
    const c = lang[1].trim().replace(/'''|''/g, '');
    if (hasNonLatinScript(c)) return c;
  }

  return null;
}

// ─── Gender inference ─────────────────────────────────────────────────────────

function inferGender(wikitext: string, categories: string[]): string | null {
  const intro = wikitext.slice(0, 1500);

  if (/\b(?:she|her|herself)\s+(?:is|was|has|had|became|won|directed|starred|performed|received|began|started|works|appeared|studied|earned|graduated)\b/i.test(intro)) return 'Female';
  if (/\b(?:he|his|himself)\s+(?:is|was|has|had|became|won|directed|starred|performed|received|began|started|works|appeared|studied|earned|graduated)\b/i.test(intro)) return 'Male';
  if (/\bthey\s+(?:are|were|have|had|became|won|directed|performed|received|began|work|appear)\b/i.test(intro)) return 'Non-binary';

  // Fallback: categories
  for (const cat of categories) {
    if (/\bwomen\b|\bfemale\b|\bactresses\b/i.test(cat)) return 'Female';
    if (/\b(?:men|male)\b/i.test(cat) && !/\bwomen\b/i.test(cat)) return 'Male';
  }

  return null;
}

// ─── Wikipedia API ────────────────────────────────────────────────────────────

async function searchWikipedia(name: string): Promise<string | null> {
  await sleep(DELAY_MS);
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name)}&format=json&srlimit=5&srnamespace=0`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const results: any[] = data?.query?.search ?? [];
    for (const r of results) {
      const pt: string = r.title;
      // Reject obvious non-matches: disambig indicators or totally different names
      if (/\(disambiguation\)/i.test(pt)) continue;
      // The title should share at least the first meaningful word
      const firstWord = name.trim().split(/\s+/)[0].toLowerCase();
      if (pt.toLowerCase().includes(firstWord)) return pt;
    }
  } catch { /* network error */ }
  return null;
}

async function fetchPersonPage(pageTitle: string): Promise<{
  wikitext: string;
  categories: string[];
  wikiUrl: string;
} | null> {
  await sleep(DELAY_MS);
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&prop=revisions|categories&rvprop=content&rvslots=main&titles=${encodeURIComponent(pageTitle)}&cllimit=100&format=json&rvlimit=1`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const pages = data?.query?.pages;
    if (!pages) return null;
    const page: any = Object.values(pages)[0];
    if (!page.revisions?.length) return null;

    const wikitext: string = page.revisions[0].slots?.main?.['*'] ?? page.revisions[0]['*'] ?? '';
    const categories: string[] = (page.categories ?? []).map((c: any) => c.title as string);
    const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`;
    return { wikitext, categories, wikiUrl };
  } catch { return null; }
}

// ─── Per-person processing ────────────────────────────────────────────────────

type PersonRow = {
  person_id: number;
  name: string;
  is_inverted_name: boolean;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  appendix: string | null;
  birth_date: string | null;
  death_date: string | null;
  gender: string | null;
  wikipedia_url: string | null;
  birth_place: object | null;
  birth_name: string | null;
  original_script_name: string | null;
  education: object | null;
};

type Result = 'updated' | 'url_only' | 'no_page' | 'no_person_infobox' | 'disambig' | 'error';

function cleanField(raw: string | undefined): string | null {
  if (!raw) return null;
  return raw
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1')
    .replace(/'''|''/g, '')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || null;
}

async function processPerson(person: PersonRow): Promise<Result> {
  let pageTitle: string | null = null;

  if (person.wikipedia_url) {
    try {
      const u = new URL(person.wikipedia_url);
      pageTitle = decodeURIComponent(u.pathname.slice(6)).replace(/_/g, ' ');
    } catch { pageTitle = null; }
  }

  if (!pageTitle) {
    pageTitle = await searchWikipedia(person.name);
    if (!pageTitle) return 'no_page';
  }

  const page = await fetchPersonPage(pageTitle);
  if (!page) {
    if (!person.wikipedia_url && pageTitle) {
      const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`;
      await pool.query('UPDATE people SET wikipedia_url = $1 WHERE person_id = $2', [url, person.person_id]);
      return 'url_only';
    }
    return 'no_page';
  }

  const { wikitext, categories, wikiUrl } = page;

  // Reject disambiguation pages
  if (/\{\{(?:disambiguation|disambig|disamb)/i.test(wikitext)) return 'disambig';

  const infobox = parseInfobox(wikitext);
  if (!infobox || !isPersonInfobox(infobox)) {
    if (!person.wikipedia_url) {
      await pool.query('UPDATE people SET wikipedia_url = $1 WHERE person_id = $2', [wikiUrl, person.person_id]);
      return 'url_only';
    }
    return 'no_person_infobox';
  }

  const birthDate  = parseDate(infobox['birth_date'] ?? infobox['birthdate'] ?? infobox['born']);
  const deathDate  = parseDate(infobox['death_date'] ?? infobox['deathdate'] ?? infobox['died']);
  const birthPlace = parseBirthPlace(infobox['birth_place'] ?? infobox['birthplace'] ?? infobox['place_of_birth']);
  const birthName  = cleanField(infobox['birth_name'] ?? infobox['birthname']);
  const rawEdu     = infobox['education'] ?? infobox['alma_mater'] ?? infobox['alma mater'];
  const education  = parseEducation(rawEdu);
  const origScript = extractOriginalScriptName(wikitext, infobox);
  const gender     = inferGender(wikitext, categories);

  // Name parts (from canonical name, only if not already set)
  const nameParts = parseNameParts(person.name, person.is_inverted_name ?? false);

  try {
    await pool.query(
      `UPDATE people SET
         wikipedia_url        = COALESCE($1,  wikipedia_url),
         birth_date           = COALESCE($2::date, birth_date),
         death_date           = COALESCE($3::date, death_date),
         gender               = COALESCE($4,  gender),
         birth_place          = COALESCE($5::jsonb, birth_place),
         birth_name           = COALESCE($6,  birth_name),
         original_script_name = COALESCE($7,  original_script_name),
         education            = COALESCE($8::jsonb, education),
         first_name           = COALESCE(first_name, $9),
         middle_name          = COALESCE(middle_name, $10),
         last_name            = COALESCE(last_name, $11),
         appendix             = COALESCE(appendix, $12)
       WHERE person_id = $13`,
      [
        wikiUrl,
        birthDate,
        deathDate,
        gender,
        birthPlace ? JSON.stringify(birthPlace) : null,
        birthName,
        origScript,
        education.length > 0 ? JSON.stringify(education) : null,
        nameParts.first,
        nameParts.middle,
        nameParts.last,
        nameParts.appendix,
        person.person_id,
      ]
    );
    return 'updated';
  } catch (e: any) {
    console.error(`  DB error person_id=${person.person_id} "${person.name}":`, e.message);
    return 'error';
  }
}

// ─── Worker ───────────────────────────────────────────────────────────────────

async function runWorker(
  people: PersonRow[],
  stats: Record<Result | 'done' | 'total', number>
) {
  for (const p of people) {
    const result = await processPerson(p);
    stats[result]++;
    stats.done++;
    if (stats.done % LOG_INTERVAL === 0) {
      const pct = ((stats.done / stats.total) * 100).toFixed(1);
      console.log(
        `[${new Date().toLocaleTimeString()}] ${pct}% (${stats.done}/${stats.total})` +
        `  updated=${stats.updated} url_only=${stats.url_only}` +
        `  no_page=${stats.no_page} disambig=${stats.disambig}` +
        `  no_infobox=${stats.no_person_infobox} errors=${stats.error}`
      );
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Add new columns (idempotent)
  await pool.query(`
    ALTER TABLE people
      ADD COLUMN IF NOT EXISTS wikipedia_url        TEXT,
      ADD COLUMN IF NOT EXISTS birth_place          JSONB,
      ADD COLUMN IF NOT EXISTS birth_name           TEXT,
      ADD COLUMN IF NOT EXISTS original_script_name TEXT,
      ADD COLUMN IF NOT EXISTS education            JSONB
  `);
  console.log('Schema ready.\n');

  // Phase 1: fill name parts for everyone who's missing them (no API needed)
  console.log('Filling missing name parts from canonical names...');
  const { rows: allPeople } = await pool.query<PersonRow>(
    `SELECT person_id, name, is_inverted_name, first_name, middle_name, last_name, appendix
     FROM people WHERE first_name IS NULL OR last_name IS NULL`
  );
  let nameFills = 0;
  for (const p of allPeople) {
    const { first, middle, last, appendix } = parseNameParts(p.name, p.is_inverted_name ?? false);
    if (!first && !last) continue;
    await pool.query(
      `UPDATE people SET
         first_name  = COALESCE(first_name,  $1),
         middle_name = COALESCE(middle_name, $2),
         last_name   = COALESCE(last_name,   $3),
         appendix    = COALESCE(appendix,    $4)
       WHERE person_id = $5`,
      [first, middle, last, appendix, p.person_id]
    );
    nameFills++;
  }
  console.log(`  Name parts filled for ${nameFills} people.\n`);

  // Phase 2: Wikipedia backfill for all people (or those still missing metadata)
  const { rows: people } = await pool.query<PersonRow>(`
    SELECT person_id, name, is_inverted_name,
           first_name, middle_name, last_name, appendix,
           birth_date, death_date, gender,
           wikipedia_url, birth_place, birth_name, original_script_name, education
    FROM people
    WHERE wikipedia_url IS NULL
    ORDER BY name
  `);
  console.log(`Wikipedia backfill for ${people.length} people (missing URL).\n`);

  const buckets: PersonRow[][] = Array.from({ length: CONCURRENCY }, () => []);
  people.forEach((p, i) => buckets[i % CONCURRENCY].push(p));

  const stats: Record<Result | 'done' | 'total', number> = {
    updated: 0, url_only: 0, no_page: 0, disambig: 0,
    no_person_infobox: 0, error: 0, done: 0, total: people.length,
  };
  const t0 = Date.now();

  await Promise.all(buckets.map(b => runWorker(b, stats)));

  const elapsed = ((Date.now() - t0) / 1000 / 60).toFixed(1);
  console.log(`\nFinished in ${elapsed} min`);
  console.log(`  updated:       ${stats.updated}`);
  console.log(`  url_only:      ${stats.url_only}`);
  console.log(`  no_page:       ${stats.no_page}`);
  console.log(`  disambig:      ${stats.disambig}`);
  console.log(`  no_infobox:    ${stats.no_person_infobox}`);
  console.log(`  errors:        ${stats.error}`);

  await pool.end();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
