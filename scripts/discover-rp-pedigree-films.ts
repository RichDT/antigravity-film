/**
 * Finds upcoming/new films (Wikipedia "Category:<year> films") directed, written, or shot by a past
 * Rich Picks nominee or winner, and adds unreviewed ones to the Anticipation Board (unseen_films, source 'rp_pedigree').
 *
 * Usage: npx tsx --env-file=.env.local scripts/discover-rp-pedigree-films.ts [--dry] [--years 2026,2027]
 */
import { Pool } from 'pg';
import { extractInfoboxField, parseNames, parseCast } from '../lib/wikipedia-crew';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const API = 'https://en.wikipedia.org/w/api.php';
const UA = 'RichPicks/1.0 (r.d.truncellito@gmail.com)';
const DRY = process.argv.includes('--dry');
const yearsArg = process.argv[process.argv.indexOf('--years') + 1];
const YEARS = process.argv.includes('--years') ? yearsArg.split(',').map(Number) : [new Date().getFullYear(), new Date().getFullYear() + 1];

const MATCH_ROLES: [string[], string][] = [
  [['director'], 'Director'], [['screenplay', 'writer', 'written_by'], 'Writer'], [['cinematography'], 'Cinematographer'],
];
const EXTRA_ROLES: [string[], string][] = [
  [['producer', 'producers'], 'Producer'], [['editing', 'editor'], 'Editor'], [['music', 'composer'], 'Composer'],
];

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+\(.*\)$/, '').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

async function api(params: Record<string, string>) {
  const res = await fetch(`${API}?${new URLSearchParams({ format: 'json', ...params })}`, { headers: { 'User-Agent': UA } });
  return res.json();
}

async function categoryMembers(cat: string): Promise<string[]> {
  const titles: string[] = [];
  let cont: string | undefined;
  do {
    const j = await api({ action: 'query', list: 'categorymembers', cmtitle: cat, cmnamespace: '0', cmlimit: '500', ...(cont ? { cmcontinue: cont } : {}) });
    titles.push(...(j.query?.categorymembers ?? []).map((m: any) => m.title));
    cont = j.continue?.cmcontinue;
  } while (cont);
  return titles;
}

async function wikitexts(titles: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < titles.length; i += 50) {
    const j = await api({ action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', titles: titles.slice(i, i + 50).join('|') });
    for (const p of Object.values(j.query?.pages ?? {}) as any[]) {
      const t = p.revisions?.[0]?.slots?.main?.['*'];
      if (t && t.includes('{{Infobox film')) out.set(p.title, t);
    }
  }
  return out;
}

async function personId(name: string): Promise<number> {
  const f = await pool.query(`SELECT person_id FROM people WHERE LOWER(name) = LOWER($1) ORDER BY person_id LIMIT 1`, [name]);
  return f.rows[0]?.person_id ?? (await pool.query(`INSERT INTO people (name) VALUES ($1) RETURNING person_id`, [name])).rows[0].person_id;
}

async function run() {
  const rp = await pool.query(`
    SELECT pe.name, array_agg(DISTINCT cat.name) AS categories FROM people pe
    JOIN nomination_people np ON np.person_id = pe.person_id
    JOIN nominations n ON n.nomination_id = np.nomination_id
    JOIN ceremonies c ON c.ceremony_id = n.ceremony_id
    JOIN awards a ON a.award_id = c.award_id
    JOIN organizations o ON o.organization_id = a.organization_id
    JOIN categories cat ON cat.category_id = n.category_id
    WHERE o.short_name = 'Rich Picks'
    GROUP BY pe.name`);
  // Single-word names (e.g. "Sjón") are too ambiguous to match on name alone
  const rpCats = new Map<string, string[]>();
  for (const r of rp.rows as any[]) if (norm(r.name).includes(' ')) rpCats.set(norm(r.name), r.categories);
  // Guard against same-name strangers: someone known to Rich Picks only for an unrelated craft
  // (e.g. a sound editor) shouldn't match a same-named director/writer/cinematographer
  // Craft categories whose nominees rarely move into directing/writing/shooting
  const UNRELATED_CRAFT = /^(Sound Editing|Sound Mixing|Make-Up & Hairstyling|Costuming|Art Direction|Editing|Original Score)$/;
  const CRAFT_FOR_ROLE: Record<string, RegExp> = { Director: /$^/, Writer: /$^/, Cinematographer: /^Cinematography$/ };
  const review: string[] = [];
  const isMatch = (name: string, role: string, film: string) => {
    const cats = rpCats.get(norm(name));
    if (!cats) return false;
    if (!cats.every(c => UNRELATED_CRAFT.test(c) && !CRAFT_FOR_ROLE[role].test(c))) return true;
    review.push(`${film}: ${name} credited as ${role}, but Rich Picks history is only ${cats.join(', ')}`);
    return false;
  };

  for (const year of YEARS) {
    const titles = await categoryMembers(`Category:${year} films`);
    const texts = await wikitexts(titles);
    console.log(`\n== ${year}: ${titles.length} articles, ${texts.size} with film infobox`);
    let added = 0;
    for (const [page, wt] of texts) {
      const crew = new Map<string, string[]>();
      for (const [fields, role] of [...MATCH_ROLES, ...EXTRA_ROLES]) {
        const raw = fields.map(f => extractInfoboxField(wt, f)).find(Boolean) ?? '';
        crew.set(role, parseNames(raw).map(n => n.replace(/\s*\(.*\)$/, '')).filter(n => !/^jr\.?$/i.test(n)));
      }
      const hits = MATCH_ROLES.flatMap(([, role]) => (crew.get(role) ?? []).filter(n => isMatch(n, role, page)).map(n => `${n} (${role})`));
      if (hits.length === 0) continue;

      const title = page.replace(/\s*\((?:\d{4} )?(?:[a-z]+ )?film\)$/i, '');
      const existing = await pool.query(
        `SELECT f.film_id, r.grade, EXISTS (SELECT 1 FROM unseen_films u WHERE u.film_id = f.film_id) AS on_board
         FROM films f LEFT JOIN reviews r USING (film_id)
         WHERE LOWER(f.title) = LOWER($1) AND f.release_year = $2`, [title, year]);
      const row = existing.rows[0];
      if (row?.grade) continue;
      if (row?.on_board) continue;

      console.log(`${DRY ? '[dry] ' : ''}+ ${title} (${year}) — ${hits.join(', ')}`);
      added++;
      if (DRY) continue;

      const filmId = row?.film_id ?? (await pool.query(
        `INSERT INTO films (title, release_year, wikipedia_url) VALUES ($1, $2, $3) RETURNING film_id`,
        [title, year, `https://en.wikipedia.org/wiki/${encodeURIComponent(page.replace(/ /g, '_'))}`])).rows[0].film_id;
      for (const [role, names] of crew) for (const n of names) {
        await pool.query(`INSERT INTO film_crew (film_id, person_id, crew_role) VALUES ($1,$2,$3) ON CONFLICT (film_id, person_id, crew_role) DO NOTHING`, [filmId, await personId(n), role]);
      }
      let order = 0;
      for (const c of parseCast(wt)) {
        order++;
        await pool.query(`INSERT INTO film_cast (film_id, person_id, character, billing_order) VALUES ($1,$2,$3,$4) ON CONFLICT (film_id, person_id, character) DO NOTHING`, [filmId, await personId(c.name), c.character, order]);
      }
      await pool.query(`INSERT INTO unseen_films (film_id, year, source) VALUES ($1, $2, 'rp_pedigree') ON CONFLICT (film_id, year) DO NOTHING`, [filmId, year]);
    }
    console.log(`${year}: ${added} film(s) ${DRY ? 'would be ' : ''}added`);
  }
  if (review.length) console.log(`\nNeeds review (possible same-name mix-up, not added):\n  ${[...new Set(review)].join('\n  ')}`);
  await pool.end();
}
run().catch(e => { console.error(e); process.exit(1); });
