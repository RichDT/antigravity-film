import { query } from './db';
import { fetchWikitext, extractInfoboxField, parseNames, parseCast } from './wikipedia-crew';

const CREW_FIELDS: [string[], string][] = [
  [['director'], 'Director'], [['screenplay', 'writer', 'written_by'], 'Writer'], [['producer', 'producers'], 'Producer'],
  [['editing', 'editor'], 'Editor'], [['cinematography'], 'Cinematographer'], [['music', 'composer'], 'Composer'],
];
const STREAMERS = ['Netflix', 'Apple TV', 'Prime Video', 'Disney+', 'Hulu', 'HBO Max', 'Peacock', 'Paramount+'];
// Only a studio's or distributor's own YouTube channel counts as an official trailer
const OFFICIAL_CHANNELS = /^(Universal Pictures( UK)?|Lionsgate Movies|Pixar|Warner Bros\.?( Pictures)?( and \d+ more)?|SearchlightPictures|A24|Netflix|MUBI|Focus Features|Sony Pictures (Entertainment|Classics)|LAIKA Studios|Amazon MGM Studios|Apple TV|Prime Video|Bleecker Street|Paramount Pictures|Marvel Entertainment|Star Wars|NEON|Black Bear.*|SUMERIAN|20th Century Studios|Walt Disney Studios|Elevation Pictures|Angel Studios|IFC Films|Magnolia Pictures|Roadside Attractions|Kino Lorber|STUDIOCANAL|Janus Films|Utopia|Oscilloscope|Greenwich Entertainment|Sony Pictures India|HBO|Max|Hulu|Disney\+?|Peacock|Paramount\+)$/i;

export interface EnrichResult {
  wikipedia: string | null;
  crew: number;
  cast: number;
  releaseDate: string | null;
  venue: string | null;
  boardYear: number;
  trailer: string | null;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const cleanWiki = (s: string) => s
  .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>|<ref\b[^>]*\/>/gi, '').replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, '$1').replace(/\[\[([^\]]+)\]\]/g, '$1');

/** Only accept an article whose release info names the target year (or the year after) — avoids same-titled older films. */
async function findArticle(title: string, year: number): Promise<{ page: string; wt: string } | null> {
  for (const page of [`${title} (${year} film)`, `${title} (${year + 1} film)`, `${title} (film)`, `${title} (${year} documentary)`, title]) {
    const wt = await fetchWikitext(page);
    if (!wt) continue;
    const released = extractInfoboxField(wt, 'released') + extractInfoboxField(wt, 'release_date');
    if (new RegExp(`${year}|${year + 1}`).test(released) || new RegExp(`\\[\\[Category:(${year}|${year + 1}) (films|documentary films)\\]\\]`).test(wt)) {
      return { page, wt };
    }
  }
  return null;
}

async function personId(name: string): Promise<number> {
  const f = await query(`SELECT person_id FROM people WHERE LOWER(name) = LOWER($1) ORDER BY person_id LIMIT 1`, [name]);
  if (f.rows[0]) return f.rows[0].person_id;
  return (await query(`INSERT INTO people (name) VALUES ($1) RETURNING person_id`, [name])).rows[0].person_id;
}

function usRelease(wt: string): { date: string | null; venue: string | null; streamingDate: string | null } {
  const rel = cleanWiki(extractInfoboxField(wt, 'released') || extractInfoboxField(wt, 'release_date'));
  const parts = (rel.match(/\{\{\s*film date\s*\|([^}]*)\}\}/i)?.[1] ?? '').split('|').map(p => p.trim()).filter(p => p && !/^(df|ref\d*)=/i.test(p));
  let date: string | null = null;
  let streamingDate: string | null = null;
  for (let i = 0; i + 2 < parts.length; i += 4) {
    const [y, m, d, label] = parts.slice(i, i + 4);
    if (!/^\d{4}$/.test(y) || !/^\d+$/.test(m) || !/^\d+$/.test(d)) break;
    const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    if (label && /United States/i.test(label)) date = iso;
    else if (!label && parts.length === 3) date = iso;
    else if (label && STREAMERS.some(s => s.toLowerCase() === label.toLowerCase())) streamingDate = iso;
  }
  const dist = extractInfoboxField(wt, 'distributor').replace(/\{\{efn[\s\S]*?\}\}/gi, '');
  const usLine = dist.split(/\n|\*/).find(l => l.trim() && /United States|^[^()]*$/.test(l.trim())) ?? dist;
  const streamer = streamingDate ? undefined : STREAMERS.find(s => new RegExp(s.replace('+', '\\+'), 'i').test(usLine));
  return { date, venue: date ? (streamer ?? 'Theaters') : null, streamingDate };
}

async function findOfficialTrailer(title: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} official trailer`)}`, {
      headers: { 'Accept-Language': 'en-US,en;q=0.9', 'User-Agent': 'Mozilla/5.0' },
    });
    const html = await res.text();
    const data = html.match(/var ytInitialData = (\{[\s\S]*?\});<\/script>/)?.[1];
    if (!data) return null;
    const vids: any[] = [];
    (function walk(o: any) { if (o && typeof o === 'object') { if (o.videoRenderer) vids.push(o.videoRenderer); for (const k in o) walk(o[k]); } })(JSON.parse(data));
    const key = norm(title);
    const hit = vids.slice(0, 12).find(v => {
      const t: string = v.title?.runs?.map((r: any) => r.text).join('') ?? '';
      const ch: string = v.ownerText?.runs?.map((r: any) => r.text).join('') ?? '';
      return OFFICIAL_CHANNELS.test(ch.trim()) && /trailer|teaser/i.test(t) && norm(t).includes(key);
    });
    return hit ? `https://www.youtube.com/watch?v=${hit.videoId}` : null;
  } catch {
    return null;
  }
}

/** Fill in everything the Anticipation Board shows for a newly added film. Safe to re-run; never overwrites existing values. */
export async function enrichAnticipatedFilm(filmId: number): Promise<EnrichResult> {
  const { rows: [film] } = await query(
    `SELECT f.film_id, f.title, f.release_year, f.trailer_url, f.us_release_date, uf.year AS board_year
     FROM films f JOIN unseen_films uf USING (film_id) WHERE f.film_id = $1 ORDER BY uf.year DESC LIMIT 1`, [filmId]);
  const year: number = film.board_year ?? film.release_year;
  const result: EnrichResult = { wikipedia: null, crew: 0, cast: 0, releaseDate: null, venue: null, boardYear: year, trailer: film.trailer_url };

  const hit = await findArticle(film.title, year);
  if (hit) {
    result.wikipedia = `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.page.replace(/ /g, '_'))}`;
    await query(`UPDATE films SET wikipedia_url = COALESCE(wikipedia_url, $1) WHERE film_id = $2`, [result.wikipedia, filmId]);

    for (const [fields, role] of CREW_FIELDS) {
      const raw = fields.map(f => extractInfoboxField(hit.wt, f)).find(Boolean) ?? '';
      for (const name of parseNames(raw).map(n => n.replace(/\s*\(.*\)$/, '')).filter(n => !/^jr\.?$/i.test(n))) {
        await query(`INSERT INTO film_crew (film_id, person_id, crew_role) VALUES ($1,$2,$3) ON CONFLICT (film_id, person_id, crew_role) DO NOTHING`,
          [filmId, await personId(name), role]);
        result.crew++;
      }
    }
    let order = 0;
    for (const c of parseCast(hit.wt)) {
      order++;
      await query(`INSERT INTO film_cast (film_id, person_id, character, billing_order) VALUES ($1,$2,$3,$4) ON CONFLICT (film_id, person_id, character) DO NOTHING`,
        [filmId, await personId(c.name), c.character, order]);
      result.cast++;
    }

    const rel = usRelease(hit.wt);
    if (rel.date && !film.us_release_date) {
      const isStreamingPremiere = rel.venue && rel.venue !== 'Theaters';
      await query(
        `UPDATE films SET us_release_date = $1, release_venue = $2,
           streaming_service = COALESCE(streaming_service, $3), streaming_date = COALESCE(streaming_date, $4)
         WHERE film_id = $5`,
        [rel.date, rel.venue, isStreamingPremiere ? rel.venue : null, isStreamingPremiere ? rel.date : rel.streamingDate, filmId]);
      result.releaseDate = rel.date;
      result.venue = rel.venue;
      const releaseYear = Number(rel.date.slice(0, 4));
      if (releaseYear !== year) {
        await query(`UPDATE unseen_films SET year = $1 WHERE film_id = $2 AND year = $3`, [releaseYear, filmId, year]);
        result.boardYear = releaseYear;
      }
    }
  }

  if (!film.trailer_url) {
    const trailer = await findOfficialTrailer(film.title);
    if (trailer) {
      await query(`UPDATE films SET trailer_url = $1 WHERE film_id = $2`, [trailer, filmId]);
      result.trailer = trailer;
    }
  }
  return result;
}
