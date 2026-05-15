import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const COMMENT_RE = /<!--[\s\S]*?-->/g;

function stripComments(s: string | null | undefined): string | null {
  if (!s) return s ?? null;
  return s.replace(COMMENT_RE, '').replace(/\s{2,}/g, ' ').trim() || null;
}

// Fix birth_place where a single HTML comment was split across multiple fields
// by the comma-split in parseBirthPlace. We join all fields with ', ', strip
// comments from the concatenated string, then rebuild the JSONB.
function fixSplitComments(bp: Record<string, string>): Record<string, string> | null {
  const text = JSON.stringify(bp);
  if (!text.includes('<!--')) return bp;

  // Join all fields in order: city, state, country
  const parts: string[] = [];
  if (bp.city) parts.push(bp.city);
  if (bp.state) parts.push(bp.state);
  if (bp.country) parts.push(bp.country);

  const joined = parts.join(', ');
  const cleaned = joined.replace(COMMENT_RE, '').replace(/\s{2,}/g, ' ').trim();

  if (!cleaned) return null;

  // Re-split on commas to rebuild fields
  const tokens = cleaned.split(',').map(t => t.trim()).filter(Boolean);
  if (tokens.length === 0) return null;

  // Heuristic re-assignment: last token is country, second-to-last is state (if 3+), first is city
  const out: Record<string, string> = {};
  if (tokens.length === 1) {
    out.country = tokens[0];
  } else if (tokens.length === 2) {
    out.city = tokens[0];
    out.country = tokens[1];
  } else {
    out.city = tokens[0];
    // middle tokens as state
    out.state = tokens.slice(1, -1).join(', ');
    out.country = tokens[tokens.length - 1];
  }
  return out;
}

async function main() {
  // 1. Fix birth_place with split HTML comments
  const { rows: bpRows } = await pool.query<{
    person_id: number;
    birth_place: Record<string, string>;
  }>(`
    SELECT person_id, birth_place
    FROM people
    WHERE birth_place::text LIKE '%<!--%'
  `);

  let bpFixed = 0;
  for (const r of bpRows) {
    const cleaned = fixSplitComments(r.birth_place);
    await pool.query(
      `UPDATE people SET birth_place = $1 WHERE person_id = $2`,
      [cleaned ? JSON.stringify(cleaned) : null, r.person_id]
    );
    bpFixed++;
  }
  console.log(`Fixed split-comment birth_place: ${bpFixed} rows`);

  // 2. Fix any remaining birth_name / original_script_name with comments
  const { rows: textRows } = await pool.query<{
    person_id: number;
    birth_name: string | null;
    original_script_name: string | null;
  }>(`
    SELECT person_id, birth_name, original_script_name
    FROM people
    WHERE birth_name LIKE '%<!--%' OR original_script_name LIKE '%<!--%'
  `);

  let textFixed = 0;
  for (const r of textRows) {
    const newBirthName = stripComments(r.birth_name);
    const newOrigScript = stripComments(r.original_script_name);
    await pool.query(
      `UPDATE people SET birth_name = $1, original_script_name = $2 WHERE person_id = $3`,
      [newBirthName, newOrigScript, r.person_id]
    );
    textFixed++;
  }
  console.log(`Fixed birth_name/original_script_name: ${textFixed} rows`);

  // 3. Verify
  const { rows: verify } = await pool.query(`
    SELECT COUNT(*) as cnt FROM people
    WHERE birth_place::text LIKE '%<!--%' OR birth_name LIKE '%<!--%' OR original_script_name LIKE '%<!--%'
  `);
  console.log(`Remaining rows with HTML comments: ${verify[0].cnt}`);

  // 4. Spot-check
  const { rows: sample } = await pool.query(`
    SELECT name, birth_place FROM people
    WHERE name IN ('Julian Schnabel', 'Damien Chazelle', 'Kiefer Sutherland', 'Ariyan A. Johnson')
    LIMIT 4
  `);
  for (const r of sample) {
    console.log(' ', r.name, JSON.stringify(r.birth_place));
  }

  await pool.end();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
