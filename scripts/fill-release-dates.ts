/** Fills films.us_release_date / release_venue for anticipated films missing them, from the Wikipedia infobox. */
import { Pool } from 'pg';
import { fetchWikitext, extractInfoboxField } from '../lib/wikipedia-crew';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const STREAMERS = ['Netflix', 'Apple TV', 'Prime Video', 'Amazon Prime Video', 'Disney+', 'Hulu', 'HBO Max', 'Max', 'Peacock', 'Paramount+'];

(async () => {
  const { rows } = await pool.query(
    `SELECT f.film_id, f.title, f.wikipedia_url FROM unseen_films uf JOIN films f USING (film_id)
     WHERE uf.year >= EXTRACT(YEAR FROM now())::int AND f.us_release_date IS NULL AND f.wikipedia_url IS NOT NULL`);
  for (const r of rows) {
    const wt = await fetchWikitext(decodeURIComponent(r.wikipedia_url.split('/wiki/')[1]).replace(/_/g, ' '));
    if (!wt) continue;
    const rel = (extractInfoboxField(wt, 'released') || extractInfoboxField(wt, 'release_date')).replace(/<ref\b[^>]*>[\s\S]*?<\/ref>|<ref\b[^>]*\/>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, '$1').replace(/\[\[([^\]]+)\]\]/g, '$1');
    // {{film date|Y|M|D|label|Y|M|D|label…}} — take the United States date; a bare single date counts as the U.S. release
    const parts = (rel.match(/\{\{\s*film date\s*\|([^}]*)\}\}/i)?.[1] ?? '').split('|').map(p => p.trim()).filter(p => p && !/^(df|ref\d*)=/i.test(p));
    let date: string | null = null;
    for (let i = 0; i + 2 < parts.length; i += 4) {
      const [y, m, d, label] = parts.slice(i, i + 4);
      if (!/^\d{4}$/.test(y) || !/^\d+$/.test(m) || !/^\d+$/.test(d)) break;
      if ((label && /United States/i.test(label)) || (!label && parts.length === 3)) date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    if (!date) continue;
    // Only the U.S. distributor line counts, with footnotes stripped (they mention other territories/platforms)
    const dist = extractInfoboxField(wt, 'distributor').replace(/\{\{efn[\s\S]*?\}\}/gi, '');
    const usLine = dist.split(/\n|\*/).find(l => /United States|^[^()]*$/.test(l.trim()) && l.trim()) ?? dist;
    // A premiere is a streaming premiere only when that service IS the U.S. distributor, and there is no separate labeled theatrical date
    const hasLabeledStreamingDate = parts.some(p => STREAMERS.some(s => p.toLowerCase() === s.toLowerCase()));
    const streamer = hasLabeledStreamingDate ? undefined : STREAMERS.find(s => new RegExp(s.replace('+', '\\+'), 'i').test(usLine));
    const venue = streamer ? (streamer === 'Amazon Prime Video' ? 'Prime Video' : streamer === 'Max' ? 'HBO Max' : streamer) : 'Theaters';
    await pool.query(`UPDATE films SET us_release_date = $1, release_venue = $2 WHERE film_id = $3`, [date, venue, r.film_id]);
    console.log(`${r.title}: ${date} · ${venue}`);
  }
  // A film belongs on the board for the year of its U.S. release
  const moved = await pool.query(
    `UPDATE unseen_films uf SET year = EXTRACT(YEAR FROM f.us_release_date)::int
     FROM films f
     WHERE f.film_id = uf.film_id AND uf.year >= EXTRACT(YEAR FROM now())::int AND f.us_release_date IS NOT NULL
       AND EXTRACT(YEAR FROM f.us_release_date)::int <> uf.year
     RETURNING f.title, uf.year`);
  for (const m of moved.rows) console.log(`moved to ${m.year} board: ${m.title}`);
  await pool.end();
})();
