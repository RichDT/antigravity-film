import React from "react";
import { notFound } from "next/navigation";
import Image from "next/image";
import {
  User, Trophy, Award, Clapperboard,
  Camera, Music, Scissors, Sparkles, PenTool, Palette,
  Globe, FileText, Wand2, Brush, Volume2, ExternalLink, MapPin, GraduationCap, CalendarDays,
  Film, FileVideoCamera, UserStar, BookOpen, Theater, Shirt, MirrorRound,
  Piano, MicVocal, Headphones, SlidersHorizontal
} from "lucide-react";
import { query } from "@/lib/db";
import {
  CATEGORY_ICON_MAPPING,
  CATEGORY_GROUPS_MAPPING,
  formatNamesList,
  personDisplayName,
  getAllPersonIds,
  getExternalAwardsForYears,
  computeBadgesFromBatch,
  buildAwardContextsFromBatch,
  getRPCategoryMappingsBatch,
  getReverseCanonicalMap,
  OtherAwards,
  AwardPopoverContext,
  AwardPopoverNominee,
} from "@/lib/awards";
import { PersonAwardsBrowser } from "@/components/person-awards-browser";
import { OtherAwardsRow } from "@/components/award-icons";
import { BackButton } from "@/components/back-button";

// ISR: Re-generate this page at most once per hour on production.
export const revalidate = 3600;

// NOTE: Pre-builds all person pages at deploy time for faster initial loads.
// Remove generateStaticParams (or add `export const dynamicParams = true` only) to
// switch to on-demand ISR if build time becomes too long.
export async function generateStaticParams() {
  const ids = await getAllPersonIds();
  return ids.map(id => ({ id: String(id) }));
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
    trophy: Trophy, clapperboard: Clapperboard, user: User, camera: Camera,
    music: Music, scissors: Scissors, sparkles: Sparkles, pen: PenTool,
    palette: Palette, globe: Globe, file: FileText, wand: Wand2, brush: Brush, volume: Volume2,
    film: Film, filevideo: FileVideoCamera, userstar: UserStar, pentool: PenTool,
    bookopen: BookOpen, theater: Theater, shirt: Shirt, mirror: MirrorRound,
    piano: Piano, micvocal: MicVocal, headphones: Headphones, sliders: SlidersHorizontal,
  };
  return icons[iconName] || Award;
}

type BirthPlace = { city?: string; state?: string; country?: string };
type Education = { institution: string; degree?: string };

function formatDate(d: Date | string | null): string | null {
  if (!d) return null;
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function calcAge(birth: Date | string | null, death: Date | string | null = null): number | null {
  if (!birth) return null;
  const b = typeof birth === 'string' ? new Date(birth) : birth;
  const end = death ? (typeof death === 'string' ? new Date(death) : death) : new Date();
  return Math.floor((end.getTime() - b.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

function formatBirthPlace(bp: BirthPlace | null): string | null {
  if (!bp) return null;
  return [bp.city, bp.state, bp.country].filter(Boolean).join(', ') || null;
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

export default async function PersonPage(props: Props) {
  const params = await props.params;
  const personId = parseInt(params.id, 10);
  if (isNaN(personId)) return notFound();

  const ALL_RP_CATEGORIES = Object.keys(CATEGORY_GROUPS_MAPPING);

  // Run all three independent queries in parallel.
  const [personRes, rawNomRes, reverseMap] = await Promise.all([
    query(`
      SELECT person_id as id, name, nickname, is_inverted_name,
             birth_date, death_date, gender,
             birth_place, birth_name, original_script_name,
             education, wikipedia_url
      FROM people
      WHERE person_id = $1
    `, [personId]),
    query(`
      SELECT
        n.nomination_id,
        c.year,
        n.win,
        cat.name as category_name,
        o.short_name as org_name,
        f.film_id,
        f.title as film_title,
        r.role_name as character_role,
        ccm.canonical_category_id as cat_canonical_id,
        (SELECT title FROM songs cs JOIN nomination_songs ns ON cs.song_id=ns.song_id WHERE ns.nomination_id = n.nomination_id LIMIT 1) as song_title,
        (
          SELECT json_build_object(
            'film_title', wf.title,
            'people', COALESCE((
              SELECT json_agg(wp.name)
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
      JOIN films f USING (film_id)
      JOIN nomination_people np USING (nomination_id)
      LEFT JOIN roles r ON np.role_id = r.role_id
      LEFT JOIN category_canonical_map ccm ON ccm.category_id = cat.category_id
      WHERE np.person_id = $1
      ORDER BY c.year DESC, n.win DESC, f.title ASC
    `, [personId]),
    getReverseCanonicalMap(),
  ]);

  if (personRes.rowCount === 0) return notFound();
  const person = personRes.rows[0];

  const rawNominations = rawNomRes.rows;

  const nominationsMap = new Map();
  for (const r of rawNominations) {
    const org = (r.org_name || "").toUpperCase();
    // Resolve to an RP canonical name via the DB-driven reverse map.
    // For Rich Picks rows, the category name is already canonical.
    // For all other orgs, look up via category_canonical_map → category_mappings.
    let canonicalName: string;
    if (org === 'RICH PICKS') {
      canonicalName = r.category_name;
    } else if (r.cat_canonical_id && reverseMap.has(r.cat_canonical_id)) {
      canonicalName = reverseMap.get(r.cat_canonical_id)!;
    } else {
      // No exact mapping — keep the raw name so it can still be displayed
      // (e.g. SAG ensemble award, BAFTA Rising Star — genuinely distinct)
      canonicalName = r.category_name;
    }

    const entryKey = `${canonicalName}-${r.film_id}-${r.year}-${r.song_title || ''}`;

    if (!nominationsMap.has(entryKey)) {
      nominationsMap.set(entryKey, {
        ...r,
        category_name: canonicalName,
        hasRichPick: false,
        win: false,
        allNominationIds: [],
        contributingOrgs: []
      });
    }

    const entry = nominationsMap.get(entryKey);
    entry.allNominationIds.push(r.nomination_id);
    if (org) entry.contributingOrgs.push(org);

    if (org === 'RICH PICKS') {
      entry.hasRichPick = true;
      entry.win = r.win;
      entry.nomination_id = r.nomination_id;
    }

    // Flag entries that appear solely because of a SAG Cast nomination,
    // so the UI can show an explanatory note and inject the SAG badge.
    if (org === 'SAG' && r.category_name === 'Cast In A Motion Picture' && canonicalName === 'Live-Action Feature') {
      entry.sourcedFromSagCast = true;
      entry.sagCastWin = r.win;
    }
  }

  const nominations = Array.from(nominationsMap.values());
  const totalNoms = nominations.filter(n => n.hasRichPick).length;
  const totalWins = nominations.filter(n => n.hasRichPick && n.win).length;

  const yearsToFetch = Array.from(new Set(nominations.map(n => n.year)));
  const distinctCatNames = [...new Set(nominations.map(n => n.category_name as string).filter(n => ALL_RP_CATEGORIES.includes(n)))];
  const [externalBatchAll, catMappings] = await Promise.all([
    getExternalAwardsForYears(yearsToFetch),
    getRPCategoryMappingsBatch(distinctCatNames),
  ]);
  const yearBatchMap = new Map<number, typeof externalBatchAll>();
  for (const row of externalBatchAll) {
    const yr = row.year!;
    if (!yearBatchMap.has(yr)) yearBatchMap.set(yr, []);
    yearBatchMap.get(yr)!.push(row);
  }

  // Fetch badge data per nomination
  for (const n of nominations) {
    const peopleNames = [person.name];
    if (person.is_inverted_name) {
      const parts = person.name.split(' ');
      if (parts.length > 1) {
        peopleNames.push(`${parts.slice(1).join(' ')} ${parts[0]}`);
      }
    }

    const rpMappings = catMappings.get(n.category_name) ?? new Map();
    const yearBatch = yearBatchMap.get(n.year) ?? [];
    const badges = computeBadgesFromBatch(yearBatch, [n.film_id], [personId], n.category_name, rpMappings, n.song_title, peopleNames);
    const awardContexts = buildAwardContextsFromBatch(yearBatch, n.category_name, rpMappings);

    for (const orgName of (n.contributingOrgs || [])) {
      // orgName is already uppercased (from o.short_name.toUpperCase() above)
      const orgKey = (
        orgName === 'ACE' ? 'ace' :
        orgName === 'ADG' ? 'adg' :
        orgName === 'ASC' ? 'asc' :
        orgName === 'CDG' ? 'cdg' :
        orgName === 'MUAH' ? 'muah' :
        orgName === 'CAS' ? 'cas' :
        orgName === 'MPSE' ? 'mpse' :
        orgName === 'VES' ? 'ves' :
        orgName === 'ANNIE' ? 'annie' :
        orgName === 'GRAMMY' ? 'grammy' :
        orgName === 'SCL' ? 'scl' :
        orgName === 'OSCARS' ? 'oscar' :
        orgName === 'GLOBES' ? 'globe' :
        orgName === 'BAFTA' ? 'bafta' :
        orgName === 'SAG' ? 'sag' :
        orgName === 'DGA' ? 'dga' :
        orgName === 'PGA' ? 'pga' :
        orgName === 'WGA' ? 'wga' : null
      ) as keyof OtherAwards | null;
      if (orgKey && !(badges as any)[orgKey]) {
        const orgRow = yearBatch.find(row =>
          row.short_name.toUpperCase() === orgName &&
          row.film_id === n.film_id &&
          (row.person_id === personId || !row.person_id)
        );
        if (orgRow) {
          (badges as any)[orgKey] = orgRow.win ? 'won' : 'nominated';
        } else {
          // Nomination confirmed via contributingOrgs; win status unknown from batch
          (badges as any)[orgKey] = 'nominated';
        }
      }
    }
    
    // For entries sourced from a SAG Cast nomination, the person isn't linked
    // to that nomination individually so computeBadgesFromBatch won't pick it up.
    // Inject the SAG badge directly from the raw nomination result.
    if (n.sourcedFromSagCast && !(badges as any).sag) {
      (badges as any).sag = n.sagCastWin ? 'won' : 'nominated';
    }

    n.badges = badges;
    n.awardContexts = awardContexts;
    n.currentFilm = n.film_title;
    n.peopleIds = [personId];
  }

  // Build RP popover contexts for each (category, year) so the R hex badge
  // can show the full nominee list when clicked.
  const rpNoms = nominations.filter(n => n.hasRichPick);
  if (rpNoms.length > 0) {
    const rpCatNames = [...new Set(rpNoms.map(n => n.category_name as string))];
    const rpYears = [...new Set(rpNoms.map(n => n.year as number))];

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

    // Group by (category_name, year) → (film_id → entry)
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

    const rpContextMap = new Map<string, AwardPopoverContext>();
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

    for (const n of rpNoms) {
      n.rpContext = rpContextMap.get(`${n.category_name}||${n.year}`) ?? null;
    }
  }

  // Group by category group.
  // CATEGORY_GROUPS_MAPPING only covers RP canonical names. For external-org
  // nominations (e.g. SAG "Cast In A Motion Picture", BAFTA "EE Rising Star Award")
  // that didn't resolve to an RP canonical, fall back to inferring the group from
  // the category name text rather than defaulting everything to "film".
  function inferGroup(categoryName: string): string {
    const l = categoryName.toLowerCase();
    if (l.includes('actor') || l.includes('actress') || l.includes('performance') ||
        l.includes('cast') || l.includes('rising star') || l.includes('ensemble')) return 'acting';
    if (l.includes('direct')) return 'directing';
    if (l.includes('editing') || l.includes('edited')) return 'directing';
    if (l.includes('screenplay') || l.includes('writing') || l.includes('script')) return 'writing';
    if (l.includes('cinematograph') || l.includes('production design') || l.includes('costume') ||
        l.includes('make-up') || l.includes('makeup') || l.includes('effects') || l.includes('visual fx')) return 'visual';
    if (l.includes('score') || l.includes('song') || l.includes('music') || l.includes('sound')) return 'sound';
    return 'film';
  }

  const groupedNomsMap = new Map<string, any[]>();
  nominations.forEach((nom: any) => {
    const groupName = CATEGORY_GROUPS_MAPPING[nom.category_name] ?? inferGroup(nom.category_name);
    if (!groupedNomsMap.has(groupName)) {
      groupedNomsMap.set(groupName, []);
    }
    groupedNomsMap.get(groupName)!.push(nom);
  });

  const groupedNoms = CATEGORY_GROUPS
    .map(g => ({
      id: g.id,
      label: g.label,
      noms: groupedNomsMap.get(g.id) || []
    }))
    .filter(g => g.noms.length > 0);

  // Compute total external wins
  let externalWins = 0;
  for (const n of nominations) {
    if (n.badges) {
      externalWins += Object.values(n.badges).filter(b => b === "won").length;
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* Hero Section */}
      <div className="relative pt-24 pb-16 px-4 border-b border-border/40 overflow-hidden bg-muted/10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background pointer-events-none" />
        <div className="absolute right-0 top-0 w-2/3 h-full opacity-[0.03] pointer-events-none mix-blend-overlay">
          <User className="w-[120%] h-[120%] translate-x-1/4 -translate-y-1/4 -rotate-12" />
        </div>

        <div className="container relative z-10 max-w-5xl mx-auto">
          <BackButton />

          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            <div className="w-32 h-32 md:w-40 md:h-40 shrink-0 bg-secondary rounded-full border border-border shadow-xl flex items-center justify-center overflow-hidden">
              <User className="w-16 h-16 md:w-20 md:h-20 text-muted-foreground/50" />
            </div>

            <div className="flex-1 min-w-0 text-center md:text-left mt-2 md:mt-6">
              <h1 className="font-serif text-4xl md:text-5xl font-bold tracking-tight text-foreground/90">
                {personDisplayName(person)}
              </h1>
              {person.original_script_name && (
                <p className="font-serif text-2xl text-muted-foreground/70 mt-1 tracking-wide">
                  {person.original_script_name}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-1 mt-3">
                {person.birth_name && person.birth_name !== person.name && (
                  <span className="text-sm text-muted-foreground italic">
                    born {person.birth_name}
                  </span>
                )}
                {person.birth_date && (
                  <span className="text-sm text-muted-foreground">
                    {formatDate(person.birth_date)}
                    {!person.death_date && (
                      <span className="text-muted-foreground/60"> · age {calcAge(person.birth_date)}</span>
                    )}
                  </span>
                )}
                {person.death_date && (
                  <span className="text-sm text-muted-foreground">
                    {person.birth_date ? `${new Date(person.birth_date).getUTCFullYear()}–` : ''}{new Date(person.death_date).getUTCFullYear()}
                    <span className="text-muted-foreground/60"> · age {calcAge(person.birth_date, person.death_date)}</span>
                  </span>
                )}
                {formatBirthPlace(person.birth_place) && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    {formatBirthPlace(person.birth_place)}
                  </span>
                )}
                {person.wikipedia_url && (
                  <a
                    href={person.wikipedia_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-primary/60 hover:text-primary transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    Wikipedia
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container max-w-5xl mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row gap-8 lg:gap-12">
          
          {/* Left: Awards History Grid */}
          <div className="flex-1 min-w-0">
            <h2 className="font-serif text-2xl font-semibold mb-6 flex items-center gap-3">
              <Trophy className="w-5 h-5 text-primary" />
              Awards History
            </h2>

            <PersonAwardsBrowser groupedNoms={groupedNoms} />
          </div>

          {/* Right: Statistics Sidebar */}
          <div className="w-full md:w-64 lg:w-72 shrink-0">
            <div className="sticky top-24 space-y-6">

              {/* Education */}
              {(person.education as Education[] | null)?.length ? (
                <div>
                  <h2 className="font-serif text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5" />
                    Education
                  </h2>
                  <div className="bg-card border border-border rounded-lg divide-y divide-border/50">
                    {(person.education as Education[]).map((e, i) => (
                      <div key={i} className="px-3 py-2.5">
                        <div className="text-sm text-foreground leading-snug">{e.institution}</div>
                        {e.degree && (
                          <div className="text-xs text-muted-foreground mt-0.5">{e.degree}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Awards stats */}
              <div>
                <h2 className="font-serif text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5" />
                  At a Glance
                </h2>
                <div className="flex flex-col gap-3">
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
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
