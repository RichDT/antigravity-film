// Data for the homepage year lens and the season page.
import { query } from "@/lib/db";
import { FESTIVAL_COLUMNS, type FestivalPremiere } from "@/lib/release";
import { filmsData } from "@/lib/films-data";
import { getAllRichPicksStats, getFilmIdMap, getDBFilmsForDisplay, getTopFilmPerYear, getAnticipationBoardFilms, getConsiderationCounts } from "@/lib/awards";

export interface YearSummary {
  yr: number; noms: number; wins: number;
  rp_bp: string | null; rp_bp_id: number | null;
  bp: string | null; bp_id: number | null;
  reviewed: number; consid: number; unseen: number;
}

export async function loadIntegrated() {
  const currentYear = new Date().getFullYear();
  const [dbStats, filmIdMap, dbFilmsData, topFilmsPerYear, anticipationFilms, considerationCounts, sum] = await Promise.all([
    getAllRichPicksStats(), getFilmIdMap(), getDBFilmsForDisplay(), getTopFilmPerYear(),
    getAnticipationBoardFilms(currentYear), getConsiderationCounts(currentYear),
    query(`with y as (select generate_series((select min(year) from ceremonies), $1::int) yr),
      rp as (select c.year, count(distinct n.nomination_id) noms, count(distinct n.nomination_id) filter (where n.win) wins,
        (array_agg(f.title order by f.title) filter (where n.win and cat.name='Live-Action Feature'))[1] rp_bp,
        (array_agg(f.film_id order by f.title) filter (where n.win and cat.name='Live-Action Feature'))[1] rp_bp_id
        from nominations n join ceremonies c using(ceremony_id) join awards a using(award_id) join organizations o using(organization_id)
        join categories cat on cat.category_id=n.category_id join films f on f.film_id=n.film_id
        where o.short_name='Rich Picks' group by c.year),
      osc as (select c.year, (array_agg(f.title))[1] bp, (array_agg(f.film_id))[1] bp_id from nominations n join ceremonies c using(ceremony_id)
        join awards a using(award_id) join organizations o using(organization_id) join categories cat on cat.category_id=n.category_id join films f on f.film_id=n.film_id
        where o.short_name='Oscars' and n.win and cat.name in ('Best Picture','Outstanding Picture','Unique and Artistic Picture') group by c.year),
      rv as (select f.release_year yr, count(*) n from reviews r join films f using(film_id) where coalesce(r.grade,'')<>'' group by 1),
      cs as (select year, count(distinct film_id) n from considerations group by 1),
      un as (select year, count(*) n from unseen_films group by 1)
      select y.yr, coalesce(rp.noms,0)::int noms, coalesce(rp.wins,0)::int wins, rp.rp_bp, rp.rp_bp_id, osc.bp, osc.bp_id,
        coalesce(rv.n,0)::int reviewed, coalesce(cs.n,0)::int consid, coalesce(un.n,0)::int unseen
      from y left join rp on rp.year=y.yr left join osc on osc.year=y.yr left join rv on rv.yr=y.yr left join cs on cs.year=y.yr left join un on un.year=y.yr
      order by y.yr desc`, [currentYear]),
  ]);
  return { rawFilmsData: filmsData as any[], dbStats, filmIdMap, dbFilmsData, topFilmsPerYear, anticipationFilms, anticipationYear: currentYear, considerationCounts, summaries: sum.rows as YearSummary[] };
}

export interface PeerWin { yr: number; org: string; cat: string; title: string; film_id: number }
export interface PreTop { yr: number; title: string; film_id: number; noms: number; wins: number }
export interface RpNominee { yr: number; title: string; film_id: number }

/** Extra data for the Year lens variations: peer Best Picture winners, Rich's open Best Picture fields,
 *  the most-honoured films of pre-2005 years, and last year's still-to-see list. */
export async function loadLens() {
  const base = await loadIntegrated();
  const [peers, preTop, rpNoms, prevAnticipation] = await Promise.all([
    query(`with ext as (
        select m.other_canonical_id from category_mappings m join canonical_categories rp on rp.canonical_category_id=m.rp_canonical_id
        join organizations o on o.organization_id=rp.organization_id
        where o.short_name='Rich Picks' and rp.name='Live-Action Feature' and m.match_type='exact')
      select distinct c.year yr, o.short_name org, cat.name cat, f.title, f.film_id
      from ext join category_canonical_map cm on cm.canonical_category_id=ext.other_canonical_id
      join categories cat on cat.category_id=cm.category_id join nominations n on n.category_id=cat.category_id and n.win
      join ceremonies c on c.ceremony_id=n.ceremony_id join awards a on a.award_id=c.award_id
      join organizations o on o.organization_id=a.organization_id join films f on f.film_id=n.film_id
      order by 1 desc, 2, 3`),
    query(`select yr, title, film_id, noms::int, wins::int from (
        select c.year yr, f.title, f.film_id, count(*) noms, count(*) filter (where n.win) wins,
          row_number() over (partition by c.year order by count(*) filter (where n.win) desc, count(*) desc, f.title) rn
        from nominations n join ceremonies c using(ceremony_id) join films f using(film_id)
        where c.year < 2005 and coalesce(trim(f.title),'') <> '' group by c.year, f.title, f.film_id) t where rn <= 10 order by yr desc, rn`),
    query(`select c.year yr, f.title, f.film_id from nominations n join ceremonies c using(ceremony_id) join awards a using(award_id)
        join organizations o using(organization_id) join categories cat on cat.category_id=n.category_id join films f on f.film_id=n.film_id
        where o.short_name='Rich Picks' and cat.name='Live-Action Feature'
          and not exists (select 1 from nominations n2 where n2.ceremony_id=n.ceremony_id and n2.category_id=n.category_id and n2.win)
        order by c.year desc, f.title`),
    getAnticipationBoardFilms(base.anticipationYear - 1),
  ]);
  return { ...base, peers: peers.rows as PeerWin[], preTop: preTop.rows as PreTop[], rpNoms: rpNoms.rows as RpNominee[], prevAnticipation };
}

export interface SeasonFilm extends FestivalPremiere {
  film_id: number; title: string; us_release_date: string | null; release_venue: string | null; trailer_url: string | null;
  streaming_date: string | null; streaming_service: string | null; streaming_url: string | null; grade: string | null;
  accolades: { accolade_id: number; source: string; label: string }[];
  previews: { event_name: string; theatre: string; screening_date: string; showtimes: string | null; ticket_url: string }[];
}

/** Every film of a season: those Rich is waiting to see and those he has graded. */
export async function loadSeason(year: number): Promise<SeasonFilm[]> {
  const res = await query(`
    select f.film_id, f.title, to_char(f.us_release_date,'YYYY-MM-DD') us_release_date, f.release_venue, ${FESTIVAL_COLUMNS}, f.trailer_url,
      to_char(f.streaming_date,'YYYY-MM-DD') streaming_date, f.streaming_service, f.streaming_url,
      nullif(r.grade,'') grade,
      coalesce((select json_agg(json_build_object('accolade_id',a.accolade_id,'source',a.source,'label',a.label) order by a.created_at)
        from film_accolades a where a.film_id=f.film_id),'[]'::json) accolades,
      coalesce((select json_agg(json_build_object('event_name',sp.event_name,'theatre',sp.theatre,'screening_date',to_char(sp.screening_date,'YYYY-MM-DD'),
        'showtimes',sp.showtimes,'ticket_url',sp.ticket_url) order by sp.screening_date)
        from sf_preview_screenings sp where sp.film_id=f.film_id and sp.screening_date >= (now() at time zone 'America/Los_Angeles')::date),'[]'::json) previews
    from films f left join reviews r on r.film_id=f.film_id
    where (f.film_id in (select film_id from unseen_films where year=$1))
       or (f.release_year=$1 and coalesce(r.grade,'')<>'')`, [year]);
  return res.rows as SeasonFilm[];
}
