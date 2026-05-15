import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

type EducationEntry = { institution: string; degree?: string };

function cleanEducation(edu: EducationEntry[] | null): EducationEntry[] | null {
  if (!edu) return null;
  return edu.map(e => ({
    institution: e.institution.replace(/\[\[/g, '').replace(/\]\]/g, '').trim(),
    ...(e.degree ? { degree: e.degree.replace(/\[\[/g, '').replace(/\]\]/g, '').trim() } : {}),
  })).filter(e => e.institution);
}

async function fixEducationWikilinks() {
  const { rows } = await pool.query<{ person_id: number; education: EducationEntry[] }>(`
    SELECT person_id, education FROM people WHERE education::text LIKE '%[[%'
  `);
  let fixed = 0;
  for (const r of rows) {
    const cleaned = cleanEducation(r.education);
    await pool.query(`UPDATE people SET education = $1 WHERE person_id = $2`, [
      cleaned ? JSON.stringify(cleaned) : null,
      r.person_id,
    ]);
    fixed++;
  }
  console.log(`Fixed education wikilinks: ${fixed} rows`);
}

async function main() {
  // Step 1: clean malformed education values
  await fixEducationWikilinks();

  // Step 2: deduplicate people
  const { rows: groups } = await pool.query<{
    name: string;
    ids: number[];
    canonical_id: number;
  }>(`
    SELECT name,
           array_agg(person_id ORDER BY person_id) as ids,
           MIN(person_id) as canonical_id
    FROM people
    GROUP BY name
    HAVING COUNT(*) > 1
    ORDER BY name
  `);

  console.log(`\nFound ${groups.length} duplicate names.`);

  let mergedWiki = 0;
  let mergedMeta = 0;
  let deletedTotal = 0;
  let skipped = 0;

  for (const g of groups) {
    const dupeIds = g.ids.filter(id => id !== g.canonical_id);

    // Safety check: verify duplicates have no nominations or crew links
    const { rows: safety } = await pool.query(`
      SELECT COUNT(*) as cnt FROM (
        SELECT person_id FROM nomination_people WHERE person_id = ANY($1)
        UNION ALL
        SELECT person_id FROM film_crew WHERE person_id = ANY($1)
      ) t
    `, [dupeIds]);

    if (parseInt(safety[0].cnt) > 0) {
      console.warn(`SKIP "${g.name}": dupe ids ${dupeIds} have linked data`);
      skipped++;
      continue;
    }

    // Fetch canonical and dupe records
    const { rows: [canonical] } = await pool.query(
      `SELECT wikipedia_url, birth_date, gender, birth_place, birth_name, original_script_name, education
       FROM people WHERE person_id = $1`,
      [g.canonical_id]
    );
    const { rows: dupeRows } = await pool.query(
      `SELECT wikipedia_url, birth_date, gender, birth_place, birth_name, original_script_name, education
       FROM people WHERE person_id = ANY($1)`,
      [dupeIds]
    );

    // Collect fields the canonical is missing
    const textUpdates: Record<string, any> = {};
    const jsonbUpdates: Record<string, string> = {}; // pass as pre-serialized strings

    for (const dupe of dupeRows) {
      if (!canonical.wikipedia_url && dupe.wikipedia_url) textUpdates.wikipedia_url = dupe.wikipedia_url;
      if (!canonical.birth_date && dupe.birth_date) textUpdates.birth_date = dupe.birth_date;
      if (!canonical.gender && dupe.gender) textUpdates.gender = dupe.gender;
      if (!canonical.birth_name && dupe.birth_name) textUpdates.birth_name = dupe.birth_name;
      if (!canonical.original_script_name && dupe.original_script_name) textUpdates.original_script_name = dupe.original_script_name;
      if (!canonical.birth_place && dupe.birth_place) jsonbUpdates.birth_place = JSON.stringify(dupe.birth_place);
      if (!canonical.education && dupe.education) jsonbUpdates.education = JSON.stringify(cleanEducation(dupe.education));
    }

    const allUpdates = { ...textUpdates, ...jsonbUpdates };
    if (Object.keys(allUpdates).length > 0) {
      const setClauses = Object.keys(allUpdates).map((k, i) => `${k} = $${i + 2}`).join(', ');
      await pool.query(
        `UPDATE people SET ${setClauses} WHERE person_id = $1`,
        [g.canonical_id, ...Object.values(allUpdates)]
      );
      if (allUpdates.wikipedia_url) mergedWiki++;
      mergedMeta++;
    }

    // Delete the empty duplicate shells
    const { rowCount } = await pool.query(`DELETE FROM people WHERE person_id = ANY($1)`, [dupeIds]);
    deletedTotal += rowCount ?? 0;
  }

  console.log(`\nMerged Wikipedia URL from dupe to canonical: ${mergedWiki}`);
  console.log(`Merged other metadata:                       ${mergedMeta}`);
  console.log(`Deleted duplicate records:                   ${deletedTotal}`);
  console.log(`Skipped (had linked data):                   ${skipped}`);

  const { rows: final } = await pool.query(`SELECT COUNT(*) as cnt FROM people`);
  console.log(`\nPeople table now has ${final[0].cnt} rows`);

  await pool.end();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
