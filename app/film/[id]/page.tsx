import React from "react";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Trophy, Star, Film, Clapperboard, Award, Music, Scissors, Sparkles, PenTool, Palette, Globe, FileText, Wand2, Brush, Camera, Volume2, FileVideoCamera, UserStar, BookOpen, Theater, Shirt, MirrorRound, Piano, MicVocal, Headphones, SlidersHorizontal } from "lucide-react";
import { query } from "@/lib/db";
import {
  CATEGORY_ICON_MAPPING,
  CATEGORY_GROUPS_MAPPING,
  formatNamesList,
  getAllRichPicksStats,
  getAllFilmIds,
  getGradeValue,
  getExternalAwardsForYear,
  computeBadgesFromBatch,
  buildAwardContextsFromBatch,
  getRPCategoryMappings,
  getReverseCanonicalMap,
  OtherAwards,
  AwardPopoverContext,
  AwardPopoverNominee,
} from "@/lib/awards";
import { ExpandableGuildNominees } from "@/components/expandable-guild-nominees";
import { OtherAwardsRow, LinkedNamesList } from "@/components/award-icons";
import { FilmAwardsBrowser } from "@/components/film-awards-browser";
import { BackButton } from "@/components/back-button";
import { filmsData as filmsRawData } from "@/lib/films-data";

function getGradeColor(grade: string) {
  if (!grade) return "bg-muted text-muted-foreground";
  if (grade.startsWith("A")) return "bg-emerald-700/80 text-emerald-100";
  if (grade.startsWith("B")) return "bg-sky-700/80 text-sky-100";
  if (grade.startsWith("C")) return "bg-amber-700/80 text-amber-100";
  if (grade.startsWith("D")) return "bg-orange-700/80 text-orange-100";
  return "bg-red-800/80 text-red-100";
}

function GradeHex({ grade }: { grade: string }) {
  if (!grade) return <div className="w-12 h-14 clip-hexagon flex items-center justify-center text-sm font-bold flex-shrink-0 mt-1 bg-muted text-muted-foreground">-</div>;
  if (grade.includes("//")) {
    const parts = grade.split("//");
    return (
      <div className={`w-12 h-14 clip-hexagon flex flex-col items-center justify-center flex-shrink-0 mt-1 font-bold leading-none ${getGradeColor(parts[0])}`}>
        <span className="text-[11px] leading-none -translate-y-[1px]">{parts[0]}</span>
        <div className="w-6 h-[1px] bg-white/80 my-[1px]"></div>
        <span className="text-[11px] leading-none translate-y-[1px]">{parts[1]}</span>
      </div>
    );
  }
  return (
    <div className={`w-12 h-14 clip-hexagon flex items-center justify-center text-sm font-bold flex-shrink-0 mt-1 font-serif ${getGradeColor(grade)}`}>
      {grade}
    </div>
  );
}

type Props = {
  params: Promise<{ id: string }>;
};

const CATEGORY_GROUPS = [
  { id: "film", label: "Film", icons: ["film", "filevideo", "globe", "wand", "brush", "file"] },
  { id: "directing", label: "Directing & Editing", icons: ["clapperboard", "scissors"] },
  { id: "acting", label: "Acting", icons: ["userstar", "user"] },
  { id: "writing", label: "Writing", icons: ["pentool", "bookopen"] },
  { id: "visual", label: "Visual", icons: ["camera", "theater", "shirt", "mirror", "sparkles"] },
  { id: "sound", label: "Sound & Music", icons: ["piano", "micvocal", "headphones", "sliders"] },
];

function getCategoryIcon(iconName: string) {
  const icons: Record<string, React.ElementType> = {
    trophy: Trophy, clapperboard: Clapperboard, user: Award, camera: Camera,
    music: Music, scissors: Scissors, sparkles: Sparkles, pen: PenTool,
    palette: Palette, globe: Globe, file: FileText, wand: Wand2, brush: Brush, volume: Volume2,
    film: Film, filevideo: FileVideoCamera, userstar: UserStar, pentool: PenTool,
    bookopen: BookOpen, theater: Theater, shirt: Shirt, mirror: MirrorRound,
    piano: Piano, micvocal: MicVocal, headphones: Headphones, sliders: SlidersHorizontal,
  };
  return icons[iconName] || Award;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2.5">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{label}</div>
      <div className="font-serif text-xl font-bold text-accent">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function formatCredits(
  directors: { id: number; name: string }[],
  writers: { id: number; name: string }[]
): { label: string; people: { id: number; name: string }[] }[] {
  if (directors.length === 0 && writers.length === 0) return [];

  const directorIds = directors.map(d => d.id).sort().join(',');
  const writerIds = writers.map(w => w.id).sort().join(',');

  if (directors.length === 0) return [{ label: "Written by", people: writers }];
  if (writers.length === 0) return [{ label: "Directed by", people: directors }];
  if (directorIds === writerIds) return [{ label: "Written & Directed by", people: directors }];
  return [
    { label: "Directed by", people: directors },
    { label: "Written by", people: writers },
  ];
}

export const revalidate = 3600;

// NOTE: Pre-builds all film pages at deploy time for faster initial loads.
// Remove generateStaticParams (or add `export const dynamicParams = true` only) to
// switch to on-demand ISR if build time becomes too long.
export async function generateStaticParams() {
  const ids = await getAllFilmIds();
  return ids.map(id => ({ id: String(id) }));
}

export default async function FilmPage(props: Props) {
  const params = await props.params;
  const filmId = parseInt(params.id, 10);
  if (isNaN(filmId)) return notFound();

  const [filmRes, nomRes, crewRes, dbStats, reviewRes, reverseMap] = await Promise.all([
    query(`
    SELECT 
      f.film_id as id, 
      f.title, 
      f.release_year,
      f.budget,
      f.box_office,
      f.original_language,
      f.country,
      (
        SELECT json_agg(json_build_object('id', dp.person_id, 'name', dp.name))
        FROM nominations dn
        JOIN nomination_people dnp ON dn.nomination_id = dnp.nomination_id
        JOIN categories dc ON dn.category_id = dc.category_id
        JOIN people dp ON dnp.person_id = dp.person_id
        JOIN ceremonies dce ON dn.ceremony_id = dce.ceremony_id
        JOIN awards da ON dce.award_id = da.award_id
        JOIN organizations dorg ON da.organization_id = dorg.organization_id
        WHERE dn.film_id = f.film_id 
          AND dc.name IN ('Directing', 'Director', 'Best Director')
          AND dorg.short_name = 'Rich Picks'
      ) as directors,
      (
        SELECT json_agg(json_build_object('id', wp.person_id, 'name', wp.name))
        FROM nominations wn
        JOIN nomination_people wnp ON wn.nomination_id = wnp.nomination_id
        JOIN categories wc ON wn.category_id = wc.category_id
        JOIN people wp ON wnp.person_id = wp.person_id
        JOIN ceremonies wce ON wn.ceremony_id = wce.ceremony_id
        JOIN awards wa ON wce.award_id = wa.award_id
        JOIN organizations worg ON wa.organization_id = worg.organization_id
        WHERE wn.film_id = f.film_id 
          AND wc.name IN ('Screenplay (Original)', 'Screenplay (Adapted)', 'Writing')
          AND worg.short_name = 'Rich Picks'
      ) as writers
    FROM films f
    WHERE f.film_id = $1
  `, [filmId]),
    query(`
    SELECT 
      n.nomination_id,
      c.year,
      n.win,
      cat.name as category_name,
      o.short_name as org_name,
      np.person_id,
      p.name as person_name,
      p.is_inverted_name,
      r.role_name as character_role,
      ccm.canonical_category_id as cat_canonical_id,
      (SELECT title FROM songs cs JOIN nomination_songs ns ON cs.song_id=ns.song_id WHERE ns.nomination_id = n.nomination_id LIMIT 1) as song_title,
      (
        SELECT json_build_object(
          'film_id', wf.film_id,
          'film_title', wf.title,
          'people', COALESCE((
            SELECT json_agg(json_build_object('id', wp.person_id, 'name', wp.name))
            FROM nomination_people wnp
            JOIN people wp ON wnp.person_id = wp.person_id
            WHERE wnp.nomination_id = wn.nomination_id
          ), '[]'::json)
        )
        FROM nominations wn
        JOIN films wf ON wn.film_id = wf.film_id
        WHERE wn.category_id = cat.category_id 
          AND wn.ceremony_id = n.ceremony_id 
          AND wn.win = true
        LIMIT 1
      ) as actual_winner
    FROM nominations n
    JOIN ceremonies c USING (ceremony_id)
    JOIN categories cat USING (category_id)
    JOIN awards a ON c.award_id = a.award_id
    JOIN organizations o ON a.organization_id = o.organization_id
    LEFT JOIN nomination_people np USING (nomination_id)
    LEFT JOIN people p ON np.person_id = p.person_id
    LEFT JOIN roles r ON np.role_id = r.role_id
    LEFT JOIN category_canonical_map ccm ON ccm.category_id = cat.category_id
    WHERE n.film_id = $1
    ORDER BY c.year DESC, (o.short_name = 'Rich Picks') DESC, n.win DESC, o.short_name ASC
  `, [filmId]),
    query(`SELECT person_id, crew_role FROM film_crew WHERE film_id = $1`, [filmId]),
    getAllRichPicksStats(),
    query(`SELECT grade FROM reviews WHERE film_id = $1`, [filmId]),
    getReverseCanonicalMap(),
  ]);

  if (filmRes.rowCount === 0) return notFound();
  const film = filmRes.rows[0];

  const yearStat = dbStats[film.release_year] || {};
  let grade = "";
  let topTenRank = null as number | null;
  let overview = "";

  const allYearFilms = (filmsRawData as any[])
    .filter((f: any) => parseInt(f.year, 10) === film.release_year)
    .map((f: any) => {
      const stats = yearStat[f.title] || { wins: 0, noms: 0 };
      return { ...f, wins: stats.wins, noms: stats.noms };
    })
    .sort((a: any, b: any) => {
      const valA = getGradeValue(a.grade);
      const valB = getGradeValue(b.grade);
      if (valB !== valA) return valB - valA;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.noms - a.noms;
    });

  // DB reviews table is the authoritative grade source; films.json is fallback for legacy data
  const dbGrade = reviewRes.rows[0]?.grade || "";

  const filmJsonIndex = allYearFilms.findIndex((f: any) => f.title === film.title);
  if (filmJsonIndex !== -1) {
    const jsonFilm = allYearFilms[filmJsonIndex];
    grade = dbGrade || jsonFilm.grade || "";
    overview = jsonFilm.overview || "";
    if (filmJsonIndex < 10 && grade) {
      topTenRank = filmJsonIndex + 1;
    }
  } else {
    grade = dbGrade;
  }

  const rawAllNominations = nomRes.rows;
  const personRoleInferenceMap = new Map<number, Set<string>>();
  for (const c of crewRes.rows) {
     if (!personRoleInferenceMap.has(c.person_id)) {
        personRoleInferenceMap.set(c.person_id, new Set<string>());
     }
     personRoleInferenceMap.get(c.person_id)!.add(c.crew_role);
  }

  for (const r of rawAllNominations) {
     if (r.person_id && r.character_role && (r.category_name.toLowerCase().includes('actor') || r.category_name.toLowerCase().includes('actress'))) {
        if (!personRoleInferenceMap.has(r.person_id)) {
           personRoleInferenceMap.set(r.person_id, new Set<string>());
        }
        personRoleInferenceMap.get(r.person_id)!.add(r.character_role);
     }
  }

  const ALL_RP_CATEGORIES = Object.keys(CATEGORY_GROUPS_MAPPING);
  const nominationsMap = new Map();

  for (const r of rawAllNominations) {
    const isRichPick = r.org_name === 'Rich Picks';
    let canonicalName = r.category_name;
    const org = (r.org_name || "").toUpperCase();

    if (org === 'ACE') canonicalName = "Film Editing";
    else if (org === 'ADG') canonicalName = "Art Direction";
    else if (org === 'ASC') canonicalName = "Cinematography";
    else if (org === 'CDG') canonicalName = "Costuming";
    else if (org === 'DGA') canonicalName = "Directing";
    else if (org === 'MUAH') canonicalName = "Make-Up & Hairstyling";
    else if (org === 'CAS') canonicalName = "Sound Mixing";
    else if (org === 'MPSE') canonicalName = "Sound Editing";
    else if (org === 'SCL') canonicalName = "Original Score";
    else if (org === 'VES') canonicalName = "Effects";
    else if (r.cat_canonical_id && reverseMap.has(r.cat_canonical_id)) {
      canonicalName = reverseMap.get(r.cat_canonical_id)!;
    } else {
      canonicalName = ALL_RP_CATEGORIES.find(rpCat => rpCat === r.category_name) || r.category_name;
    }
    
    const isActing = canonicalName.toLowerCase().includes('actor') || 
                     canonicalName.toLowerCase().includes('actress') || 
                     canonicalName.toLowerCase().includes('performance');
    
    const personIdsKey = isActing ? [r.person_id].filter(Boolean).sort().join(',') : "";
    const entryKey = `${canonicalName}-${r.year}-${personIdsKey}-${r.song_title || ''}`;

    if (!nominationsMap.has(entryKey)) {
      nominationsMap.set(entryKey, {
        ...r,
        category_name: canonicalName,
        hasRichPick: false,
        allNominationIds: [],
        contributingOrgs: [],
        people: []
      });
    }

    const entry = nominationsMap.get(entryKey);

    if (!entry.allNominationIds.includes(r.nomination_id)) {
      entry.allNominationIds.push(r.nomination_id);
    }
    if (!entry.contributingOrgs.includes(r.org_name)) {
      entry.contributingOrgs.push(r.org_name);
    }

    if (isRichPick) {
      entry.hasRichPick = true;
      entry.win = r.win;
      entry.actual_winner = r.actual_winner;
      entry.category_name = r.category_name;
      entry.nomination_id = r.nomination_id;
    }

    const isStudio = r.person_name &&
      /\b(pictures|animation|studios?|productions?|entertainment|films?|company|inc\.|llc|corp)\b/i.test(r.person_name);

    if (r.person_id && !isStudio) {
      let rolesToApply = isActing ? [r.character_role] : (r.character_role ? [r.character_role] : []);
      
      if (!isActing && rolesToApply.length === 0 && personRoleInferenceMap.has(r.person_id)) {
         rolesToApply = Array.from(personRoleInferenceMap.get(r.person_id)!);
      }
      
      if (rolesToApply.length === 0) {
         rolesToApply = [null];
      }

      for (const role of rolesToApply) {
        let personObj = entry.people.find((p: any) => p.id === r.person_id && p.role === role);
        if (!personObj) {
          personObj = { id: r.person_id, name: r.person_name, is_inverted: r.is_inverted_name, role: role, sources: [] };
          entry.people.push(personObj);
        }
        
        if (r.org_name && r.category_name) {
           const srcStr = `${r.org_name}: ${r.category_name}`;
           if (!personObj.sources.includes(srcStr)) personObj.sources.push(srcStr);
        }
      }
    }
  }

  const nominations = Array.from(nominationsMap.values());
  const totalNoms = nominations.filter(n => n.hasRichPick).length;
  const totalWins = nominations.filter(n => n.hasRichPick && n.win).length;

  const groupedNoms = CATEGORY_GROUPS.map(group => {
    const noms = nominations.filter(n => CATEGORY_GROUPS_MAPPING[n.category_name] === group.id);
    return { ...group, noms };
  }).filter(g => g.noms.length > 0);

  const distinctCatNames = [...new Set(nominations.map((n: any) => n.category_name as string).filter((n: string) => ALL_RP_CATEGORIES.includes(n)))];
  const [externalBatch, catMappingEntries] = await Promise.all([
    getExternalAwardsForYear(film.release_year),
    Promise.all(distinctCatNames.map(async name => [name, await getRPCategoryMappings(name)] as const)),
  ]);
  const catMappings = new Map<string, Map<number, 'exact' | 'slant'>>(catMappingEntries);

  const badgeMap = new Map();
  for (const n of nominations) {
    const peopleIds = n.people.map((p: any) => p.id).filter(Boolean);
    const peopleNames: string[] = [];
    for (const p of n.people) {
      peopleNames.push(p.name);
      if (p.is_inverted) {
        const parts = p.name.split(' ');
        if (parts.length > 1) {
          peopleNames.push(`${parts.slice(1).join(' ')} ${parts[0]}`);
        }
      }
    }
    const rpMappings = catMappings.get(n.category_name) ?? new Map();
    const badges = computeBadgesFromBatch(externalBatch, [film.id], peopleIds, n.category_name, rpMappings, n.song_title, peopleNames);
    const awardContexts = buildAwardContextsFromBatch(externalBatch, n.category_name, rpMappings);

    for (const orgName of (n.contributingOrgs || [])) {
      const guildKey = (
        orgName === 'ACE' ? 'ace' :
        orgName === 'ADG' ? 'adg' :
        orgName === 'ASC' ? 'asc' :
        orgName === 'CDG' ? 'cdg' :
        orgName === 'MUAH' ? 'muah' :
        orgName === 'CAS' ? 'cas' :
        orgName === 'MPSE' ? 'mpse' :
        orgName === 'VES' ? 'ves' :
        orgName === 'SCL' ? 'scl' : null
      ) as keyof OtherAwards | null;
      if (guildKey && !(badges as any)[guildKey]) {
        const guildRow = externalBatch.find(row => row.short_name === orgName && row.film_id === film.id);
        if (guildRow) {
          (badges as any)[guildKey] = guildRow.win ? 'won' : 'nominated';
        }
      }
    }

    badgeMap.set(n.nomination_id, { badges, awardContexts, peopleIds });
  }

  let externalWins = 0;
  const ceremonyStats = {
    oscar: { w: 0, n: 0 },
    globe: { w: 0, n: 0 },
    sag: { w: 0, n: 0 },
    dga: { w: 0, n: 0 },
    bafta: { w: 0, n: 0 },
    spirit: { w: 0, n: 0 },
  };

  for (const n of nominations) {
    const entry = badgeMap.get(n.nomination_id);
    if (!entry) continue;
    const { badges } = entry;
    let wonExternal = false;
    for (const key of ['oscar', 'globe', 'sag', 'dga', 'bafta', 'spirit'] as const) {
      if (badges[key]) {
        ceremonyStats[key].n += 1;
        if (badges[key] === "won") {
          ceremonyStats[key].w += 1;
          wonExternal = true;
        }
      }
    }
    if (wonExternal) externalWins++;
  }

  // Build RP popover contexts for the R hex badge on each nomination card.
  const rpNominations = nominations.filter((n: any) => n.hasRichPick);
  const rpContextMap = new Map<string, AwardPopoverContext>();
  if (rpNominations.length > 0) {
    const rpCatNames = [...new Set(rpNominations.map((n: any) => n.category_name as string))];
    const rpYears = [...new Set(rpNominations.map((n: any) => n.year as number))];

    const rpNomineesRes = await query(`
      SELECT
        c.year,
        cat.name AS category_name,
        f.film_id,
        f.title AS film_title,
        n.win,
        np.person_id,
        p.name AS person_name
      FROM nominations n
      JOIN ceremonies c USING (ceremony_id)
      JOIN categories cat USING (category_id)
      JOIN awards a ON c.award_id = a.award_id
      JOIN organizations o ON a.organization_id = o.organization_id
      JOIN films f USING (film_id)
      LEFT JOIN nomination_people np USING (nomination_id)
      LEFT JOIN people p ON np.person_id = p.person_id
      WHERE o.short_name = 'Rich Picks'
        AND cat.name = ANY($1)
        AND c.year = ANY($2)
      ORDER BY c.year, n.win DESC, f.title
    `, [rpCatNames, rpYears]);

    type RPEntry = { film_id: number; film_title: string; win: boolean; people: Map<number, string> };
    const rpByCatYear = new Map<string, Map<string, RPEntry>>();

    for (const row of rpNomineesRes.rows) {
      const ctxKey = `${row.category_name}||${row.year}`;
      if (!rpByCatYear.has(ctxKey)) rpByCatYear.set(ctxKey, new Map());
      const nomMap = rpByCatYear.get(ctxKey)!;
      const nomKey = String(row.film_id);
      if (!nomMap.has(nomKey)) {
        nomMap.set(nomKey, { film_id: row.film_id, film_title: row.film_title, win: false, people: new Map() });
      }
      const entry = nomMap.get(nomKey)!;
      if (row.win) entry.win = true;
      if (row.person_id && row.person_name) entry.people.set(row.person_id, row.person_name);
    }

    for (const [ctxKey, nomMap] of rpByCatYear) {
      const catName = ctxKey.split('||')[0];
      const isActingCat = catName.toLowerCase().includes('actor') || catName.toLowerCase().includes('actress');

      const nominees: AwardPopoverNominee[] = Array.from(nomMap.values()).map(entry => {
        const people = Array.from(entry.people.entries()).map(([id, name]) => ({ id, name }));
        return {
          film: entry.film_title,
          filmId: entry.film_id,
          displayName: isActingCat && people.length > 0
            ? people.map(p => p.name).join(', ')
            : entry.film_title,
          personIds: people.map(p => p.id),
          isWinner: entry.win,
        };
      });
      nominees.sort((a, b) => {
        if (a.isWinner !== b.isWinner) return a.isWinner ? -1 : 1;
        return a.film.localeCompare(b.film);
      });

      rpContextMap.set(ctxKey, {
        orgDisplayName: 'Rich Picks',
        sections: [{ categoryName: catName, nominees }],
      });
    }
  }

  groupedNoms.forEach(group => {
    group.noms.forEach((nom: any) => {
      const entry = badgeMap.get(nom.nomination_id) || {};
      nom.badges = Object.assign({}, entry.badges || {});
      nom.awardContexts = entry.awardContexts || {};
      nom.currentFilm = film.title;
      nom.peopleIds = entry.peopleIds || [];
      nom.rpContext = rpContextMap.get(`${nom.category_name}||${nom.year}`) ?? null;
    });
  });

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 font-sans">
      <div className="relative pt-24 pb-12 px-6 border-b border-border bg-card/30 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background pointer-events-none" />
        <div className="absolute top-0 right-0 p-32 opacity-5 pointer-events-none -mr-20 -mt-20">
          <Film className="w-96 h-96 -rotate-12" />
        </div>

        <div className="container relative z-10 max-w-7xl mx-auto flex flex-col md:flex-row items-center md:items-start gap-6">
          <BackButton
            className="md:-ml-12 p-2 text-muted-foreground hover:text-accent transition-colors bg-background/50 rounded-full hover:bg-muted border border-border/50 shrink-0"
            iconClassName="w-6 h-6"
          />

          <GradeHex grade={grade} />

          <div className="text-center md:text-left flex-1 min-w-0">
            <div className="flex flex-wrap items-baseline justify-center md:justify-start gap-4 mb-2">
              <h1 className="font-serif text-3xl md:text-5xl font-bold tracking-tight text-foreground drop-shadow-sm truncate">
                {film.title}
              </h1>
              {film.release_year && (
                <span className="font-serif text-2xl text-accent">{film.release_year}</span>
              )}
              {topTenRank && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground border border-border rounded px-2 py-1 uppercase tracking-wider bg-background/50">
                  <Star className="w-3.5 h-3.5 text-accent" fill="currentColor" /> #{topTenRank} of {film.release_year}
                </span>
              )}
            </div>

            <div className="flex flex-col items-center md:items-start gap-1 text-sm text-muted-foreground mt-2">
              {formatCredits(film.directors || [], film.writers || []).map(({ label, people }) => (
                <span key={label} className="flex items-center gap-1.5">
                  <Clapperboard className="w-4 h-4 text-accent/70" />
                  <span className="text-foreground/60">{label}</span>
                  <span><LinkedNamesList people={people} /></span>
                </span>
              ))}
            </div>

            {overview && (
              <p className="text-sm text-foreground/80 mt-3 max-w-3xl leading-relaxed">
                {overview}
              </p>
            )}
          </div>
        </div>
      </div>

      <main className="container max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] xl:grid-cols-[1fr_280px] gap-6 lg:gap-10">
          
          <div>
            <div className="flex items-center gap-3 mb-8">
              <Award className="w-5 h-5 text-accent" />
              <h2 className="font-serif text-xl font-bold text-foreground">Awards History</h2>
              <div className="h-px flex-1 bg-gradient-to-r from-border/60 to-transparent" />
            </div>

            <FilmAwardsBrowser groupedNoms={groupedNoms} />
      </div>

          {/* Right: Statistics Sidebar */}
          <div className="space-y-4">
            <h2 className="font-serif text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">
              At a Glance
            </h2>
            
            <div className="flex flex-col gap-3">
              <StatCard label="Rich Picks Grade" value={grade || "-"} sub="Overall quality" />
              
              {topTenRank && (
                <StatCard label="Top 10 Rank" value={`#${topTenRank}`} sub={`Best of ${film.release_year}`} />
              )}

              {(film.budget || film.box_office) && (
                <div className="bg-card border border-border rounded-lg p-3 shadow-sm flex flex-col gap-2">
                   {film.budget && (
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Budget</div>
                        <div className="text-foreground font-medium text-sm">{film.budget}</div>
                      </div>
                   )}
                   {film.box_office && (
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Box Office</div>
                        <div className="text-foreground font-medium text-sm">{film.box_office}</div>
                      </div>
                   )}
                </div>
              )}
              
              <StatCard 
                label="Rich Picks Wins" 
                value={totalWins} 
                sub={`of ${totalNoms} categories`} 
              />
              
              <StatCard 
                label="External Wins" 
                value={externalWins} 
                sub="Oscar / Globe / SAG / DGA / BAFTA" 
              />

              {/* Ceremony Breakdown */}
              <div className="bg-card border border-border rounded-lg px-3 py-2.5 mt-2 shadow-sm">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-semibold">By Ceremony</div>
                {Object.entries(ceremonyStats).map(([key, stats]) => {
                  if (stats.n === 0) return null;
                  const labels: Record<string, string> = { oscar: "Oscars", globe: "Golden Globes", sag: "SAG Awards", dga: "DGA Awards", bafta: "BAFTAs", spirit: "Spirit Awards" };
                  return (
                    <div key={key} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                      <span className="text-xs text-muted-foreground">{labels[key]}</span>
                      <span className="text-xs font-medium">
                        {stats.w > 0 && <span className="text-accent font-bold tracking-tight">{stats.w}W</span>}
                        {stats.w > 0 && stats.n > stats.w && <span className="text-muted-foreground mx-1">/</span>}
                        {stats.n > stats.w && <span className="text-muted-foreground tracking-tight">{stats.n - stats.w}N</span>}
                        {stats.n === stats.w && stats.w === 0 && <span className="text-muted-foreground tracking-tight">0W</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
