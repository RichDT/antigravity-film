/** Re-run the Anticipation Board lookup for films by id. Usage: npx tsx --env-file=.env.local scripts/enrich-film.ts <film_id> [...] */
import { enrichAnticipatedFilm } from '../lib/enrich-film';
(async () => {
  for (const id of process.argv.slice(2).map(Number)) console.log(id, JSON.stringify(await enrichAnticipatedFilm(id)));
  process.exit(0);
})();
