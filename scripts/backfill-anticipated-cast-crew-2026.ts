import { Pool } from 'pg';
import { fetchWikitext, extractInfoboxField, parseNames, parseCast } from '../lib/wikipedia-crew';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const CREW_FIELDS: [string[], string][] = [
  [['director'], 'Director'], [['screenplay', 'writer', 'written_by'], 'Writer'], [['producer', 'producers'], 'Producer'],
  [['editing', 'editor'], 'Editor'], [['cinematography'], 'Cinematographer'], [['music', 'composer'], 'Composer'],
];

// Only accept an article whose infobox release info mentions 2026 — guards against same-titled older films
async function findStrict(title: string): Promise<{ page: string; wt: string } | null> {
  for (const page of [`${title} (2026 film)`, `${title} (film)`, title]) {
    const wt = await fetchWikitext(page);
    if (!wt) continue;
    const released = extractInfoboxField(wt, 'released') + extractInfoboxField(wt, 'release_date');
    if (/2026/.test(released) || /\[\[Category:2026 films\]\]/.test(wt)) return { page, wt };
  }
  return null;
}

async function personId(name: string): Promise<number> {
  const f = await pool.query(`SELECT person_id FROM people WHERE LOWER(name) = LOWER($1) ORDER BY person_id LIMIT 1`, [name]);
  return f.rows[0]?.person_id ?? (await pool.query(`INSERT INTO people (name) VALUES ($1) RETURNING person_id`, [name])).rows[0].person_id;
}

async function run() {
  const { rows: films } = await pool.query(
    `SELECT f.film_id, f.title FROM unseen_films uf JOIN films f USING (film_id) WHERE uf.year = 2026 ORDER BY f.title`);
  const missing: string[] = [];
  for (const film of films) {
    const hit = await findStrict(film.title);
    if (!hit) { missing.push(film.title); console.log(`✗ ${film.title}: no 2026 Wikipedia article`); continue; }
    await pool.query(`UPDATE films SET wikipedia_url = $1 WHERE film_id = $2 AND wikipedia_url IS NULL`,
      [`https://en.wikipedia.org/wiki/${encodeURIComponent(hit.page.replace(/ /g, '_'))}`, film.film_id]);
    let crewN = 0;
    for (const [fields, role] of CREW_FIELDS) {
      const raw = fields.map(f => extractInfoboxField(hit.wt, f)).find(Boolean) ?? '';
      for (const name of parseNames(raw)) {
        if (/^\(|film|^jr\.?$/i.test(name)) continue;
        await pool.query(`INSERT INTO film_crew (film_id, person_id, crew_role) VALUES ($1,$2,$3) ON CONFLICT (film_id, person_id, crew_role) DO NOTHING`,
          [film.film_id, await personId(name.replace(/\s*\(.*\)$/, '')), role]);
        crewN++;
      }
    }
    let cast = parseCast(hit.wt);
    if (cast.length === 0) cast = parseNames(extractInfoboxField(hit.wt, 'starring')).map(name => ({ name, character: null }));
    let order = 0;
    for (const c of cast) {
      order++;
      await pool.query(`INSERT INTO film_cast (film_id, person_id, character, billing_order) VALUES ($1,$2,$3,$4) ON CONFLICT (film_id, person_id, character) DO NOTHING`,
        [film.film_id, await personId(c.name), c.character, order]);
    }
    console.log(`✓ ${film.title} [${hit.page}]: ${crewN} crew, ${cast.length} cast`);
  }
  console.log(`\nNo article found for ${missing.length}: ${missing.join('; ')}`);
  await pool.end();
}
run().catch(e => { console.error(e); process.exit(1); });
