import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Film,
  Trophy,
  Search,
  Calendar,
  Star,
  Award,
  ChevronLeft,
  ChevronRight,
  User,
  Clapperboard,
  Camera,
  Music,
  Scissors,
  Sparkles,
  PenTool,
  Palette,
  Globe,
  FileText,
  Wand2,
  Brush,
  Circle,
  Volume2,
  FileVideoCamera,
  UserStar,
  BookOpen,
  Theater,
  Shirt,
  MirrorRound,
  Piano,
  MicVocal,
  Headphones,
  SlidersHorizontal,
} from "lucide-react";
import { LinkedNamesList, OtherAwardsRow } from "@/components/award-icons";
import { UnseenFilmsTable } from "@/components/unseen-films-table";
import { AnticipationBoard } from "@/components/AnticipationBoard";
import { CATEGORY_GROUPS, CategoryCard, ConsiderationsGrid, GroupHeader, getCategoryIcon } from "@/components/year-category-cards";
import { getUnseenFilmsForYear } from "@/lib/unseen-films";
import { queryCached as query } from "@/lib/db";
import { filmsData as filmsRawData } from "@/lib/films-data";
import {
  getCategoriesForYear,
  getPreRPCategoriesForYear,
  Category,
  Nominee,
  OtherAwards,
  AwardStatus,
  formatNamesList,
  getAllRichPicksStats,
  getFilmIdMap,
  getGradeValue,
  getYearsWithDBReviews,
  getConsiderationYears,
  getUpcomingAnticipatedYears,
  getAnticipationBoardFilms,
  getConsiderationsGrouped,
  ConsiderationEntry,
  CATEGORY_ICON_MAPPING,
  CATEGORY_GROUPS_MAPPING,
} from "@/lib/awards";

// ISR: Re-generate this page at most once per hour on production.
export const revalidate = 86400;

export async function generateStaticParams() {
  const years = await getYearsWithDBReviews();
  return years.map((year) => ({ year: String(year) }));
}

const RP_START_YEAR = 2005;
const CURRENT_YEAR = new Date().getFullYear();

type Props = {
  params: Promise<{ year: string }>;
};

export async function generateMetadata(props: Props) {
  const params = await props.params;
  return {
    title: `${params.year} in Film | Rich Picks`,
    description: `A historical archive of Top 10 films and award picks for ${params.year}.`
  };
}

// Category groups in display order with their unique icons (deduplicated)


function getGradeColor(grade: string): string {
  const letter = grade.charAt(0);
  const colors: Record<string, string> = {
    A: "bg-emerald-600 text-white", B: "bg-sky-600 text-white",
    C: "bg-amber-500 text-black", D: "bg-orange-600 text-white", F: "bg-red-600 text-white",
  };
  return colors[letter] || "bg-muted text-muted-foreground";
}

function formatSubtitle(wins?: number, noms?: number): string {
  if (wins && noms) {
    return `${wins} ${wins === 1 ? 'Win' : 'Wins'} · ${noms} ${noms === 1 ? 'Nomination' : 'Nominations'}`;
  }
  if (wins) return `${wins} ${wins === 1 ? 'Win' : 'Wins'}`;
  if (noms) return `${noms} ${noms === 1 ? 'Nomination' : 'Nominations'}`;
  return "No award data";
}

function formatConsiderationCount(n: number): string {
  return n === 0 ? "No considerations yet" : `${n} ${n === 1 ? 'Consideration' : 'Considerations'}`;
}

function GradeHex({ grade }: { grade: string }) {
  if (!grade) return <div className="w-5 h-6 max-sm:w-7 max-sm:h-8 clip-hexagon flex items-center justify-center flex-shrink-0 text-[10px] font-bold bg-muted text-muted-foreground">-</div>;

  if (grade.includes("//")) {
    const parts = grade.split("//");
    return (
      <div className={`w-5 h-6 max-sm:w-7 max-sm:h-8 clip-hexagon flex flex-col items-center justify-center flex-shrink-0 font-bold leading-none ${getGradeColor(parts[0])}`}>
        <span className="text-[6.5px] leading-none -translate-y-[0.5px]">{parts[0]}</span>
        <div className="w-3.5 max-sm:w-4 h-[1px] bg-white/80 my-[0.5px]"></div>
        <span className="text-[6.5px] leading-none translate-y-[0.5px]">{parts[1]}</span>
      </div>
    );
  }

  return (
    <div className={`w-5 h-6 max-sm:w-7 max-sm:h-8 clip-hexagon flex items-center justify-center flex-shrink-0 text-[9px] font-bold ${getGradeColor(grade)}`}>
      {grade}
    </div>
  );
}

export default async function YearPage(props: Props) {
  const params = await props.params;
  const year = parseInt(params.year, 10);
  if (isNaN(year)) {
    notFound();
  }

  const isPreRPYear = year < RP_START_YEAR;

  // 1) Get all unique valid years — static filmsRawData merged with DB-reviewed years
  const staticYears = Array.from(new Set(
    (filmsRawData as any[]).map((f: any) => parseInt(f.year, 10)).filter((y: number) => !isNaN(y) && y > 1900)
  ));

  const [dbStats, filmIdMap, dbReviewsRes, dbYears, rpFilmNomRes, dbNomYearsRes, unseenFilms, considerationYears, upcomingYears] = await Promise.all([
    getAllRichPicksStats(),
    getFilmIdMap(),
    query(
      `SELECT f.title, r.grade FROM reviews r JOIN films f ON f.film_id = r.film_id WHERE f.release_year = $1 AND r.grade IS NOT NULL AND r.grade != ''`,
      [year]
    ),
    getYearsWithDBReviews(),
    query(
      `SELECT DISTINCT f.title, bool_or(n.win) AS is_winner
       FROM nominations n
       JOIN films f ON f.film_id = n.film_id
       JOIN ceremonies cer ON cer.ceremony_id = n.ceremony_id
       JOIN awards aw ON aw.award_id = cer.award_id
       JOIN organizations o ON o.organization_id = aw.organization_id
       JOIN categories cat ON cat.category_id = n.category_id
       WHERE o.short_name = 'Rich Picks'
         AND cer.year = $1
         AND cat.name IN ('Live-Action Feature','International Feature','Animated Feature','Documentary')
       GROUP BY f.title`,
      [year]
    ),
    query(`SELECT DISTINCT year FROM ceremonies ORDER BY year`),
    year >= 2021 ? getUnseenFilmsForYear(year) : Promise.resolve([]),
    getConsiderationYears(),
    getUpcomingAnticipatedYears(),
  ]);
  // Until Rich Picks nominations are announced, a recent year shows the Anticipation Board in place of Films Not Screened
  const showAnticipationBoard = year >= CURRENT_YEAR - 1 && rpFilmNomRes.rows.length === 0;
  const anticipationFilms = showAnticipationBoard ? await getAnticipationBoardFilms(year) : [];

  const dbNomYears = dbNomYearsRes.rows.map((r: any) => r.year as number);
  const allYears = Array.from(new Set([...staticYears, ...dbYears, ...dbNomYears, ...considerationYears, ...upcomingYears]))
    .sort((a: number, b: number) => b - a);

  if (!allYears.includes(year)) {
    notFound();
  }

  const currentIndex = allYears.indexOf(year);
  const prevYear = currentIndex < allYears.length - 1 ? allYears[currentIndex + 1] : null;
  const nextYear = currentIndex > 0 ? allYears[currentIndex - 1] : null;

  const isDBOnlyYear = !staticYears.includes(year);

  // Pre-season: year has considerations but no RP nominations yet
  const hasRPNominations = rpFilmNomRes.rows.length > 0;
  const isUpcomingYear = year > CURRENT_YEAR;
  const isPreSeason = (considerationYears.includes(year) || isUpcomingYear) && !hasRPNominations && !isPreRPYear;
  const considerationsGrouped = isPreSeason ? await getConsiderationsGrouped(year) : {};
  const considerationCounts = new Map<string, number>();
  for (const entries of Object.values(considerationsGrouped)) {
    for (const title of new Set(entries.map(e => e.title.toLowerCase()))) {
      considerationCounts.set(title, (considerationCounts.get(title) ?? 0) + 1);
    }
  }

  // Build a map of title → DB grade for the year
  const dbGradeMap = new Map<string, string>();
  for (const row of dbReviewsRes.rows) {
    dbGradeMap.set(row.title.toLowerCase(), row.grade);
  }

  // Build RP film-category tier map: title.toLowerCase() → 2 (winner) | 1 (nominee)
  const rpFilmTierMap = new Map<string, number>();
  for (const row of rpFilmNomRes.rows) {
    const key = (row.title as string).toLowerCase();
    rpFilmTierMap.set(key, row.is_winner ? 2 : Math.max(rpFilmTierMap.get(key) ?? 0, 1));
  }

  function topTenSort(a: { film: string; grade: string; wins: number; noms: number }, b: typeof a, hasGrades: boolean) {
    const valA = getGradeValue(a.grade);
    const valB = getGradeValue(b.grade);
    if (hasGrades && valB !== valA) return valB - valA;
    if (!hasGrades) {
      const tierA = rpFilmTierMap.get(a.film.toLowerCase()) ?? 0;
      const tierB = rpFilmTierMap.get(b.film.toLowerCase()) ?? 0;
      if (tierB !== tierA) return tierB - tierA;
    }
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.noms - a.noms;
  }

  // 2) Parse Top 10 for the Sidebar
  let currentTop10: Array<{ rank: number; film: string; filmId: number | null; grade: string; wins: number; noms: number }>;

  if (isDBOnlyYear) {
    const films = dbReviewsRes.rows.map((row: any) => {
      const stats = dbStats[year]?.[row.title] || { wins: 0, noms: 0 };
      return {
        rank: 0,
        film: row.title,
        filmId: filmIdMap[`${year}|${row.title.toLowerCase()}`] ?? null,
        grade: row.grade || "",
        wins: stats.wins,
        noms: stats.noms
      };
    });
    const hasGrades = films.some((f: any) => getGradeValue(f.grade) > 0);
    currentTop10 = films
      .sort((a: any, b: any) => topTenSort(a, b, hasGrades))
      .slice(0, 10)
      .map((f: any, i: number) => ({ ...f, rank: i + 1 }));
  } else {
    const films = (filmsRawData as any[])
      .filter((f: any) => parseInt(f.year, 10) === year)
      .map((f: any) => {
        const stats = dbStats[year]?.[f.title] || { wins: 0, noms: 0 };
        const grade = dbGradeMap.get(f.title.toLowerCase()) || f.grade || "";
        return {
          film: f.title,
          filmId: filmIdMap[`${year}|${f.title.toLowerCase()}`] ?? null,
          grade,
          wins: stats.wins,
          noms: stats.noms
        };
      });
    const hasGrades = films.some((f: any) => getGradeValue(f.grade) > 0);
    currentTop10 = films
      .sort((a: any, b: any) => topTenSort(a, b, hasGrades))
      .slice(0, 10)
      .map((f: any, i: number) => ({ ...f, rank: i + 1 }));
  }

  // 3) Load category data — for pre-RP years derive from external org nominations
  const categories = await (isPreRPYear ? getPreRPCategoriesForYear(year) : getCategoriesForYear(year));

  const categoriesByGroup = CATEGORY_GROUPS.map(group => ({
    ...group,
    categories: categories.filter(c => c.group === group.id),
  })).filter(g => g.categories.length > 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <div className="pt-24 pb-6 px-6 md:px-10 border-b border-border bg-card/30">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-3 text-muted-foreground hover:text-foreground">
            {prevYear ? (
              <Link href={`/year/${prevYear}`} className="touch-target flex items-center gap-1 text-sm transition-colors hover:text-accent group">
                <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> {prevYear}
              </Link>
            ) : <div />}
            {nextYear ? (
              <Link href={`/year/${nextYear}`} className="touch-target flex items-center gap-1 text-sm transition-colors hover:text-accent group">
                {nextYear} <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            ) : <div />}
          </div>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="font-serif text-3xl md:text-4xl font-semibold text-foreground tracking-tight drop-shadow-sm">
              Awards & Top Films
            </h1>
            <span className="font-serif text-3xl md:text-5xl font-bold text-accent drop-shadow-[0_0_15px_rgba(212,175,55,0.4)]">
              {year}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1.5">
            {isPreRPYear ? "Historical Award Archive" : isUpcomingYear ? "Anticipated Films" : isPreSeason ? "Awards Season in Progress" : "Rich Picks for Film Excellence"}
          </p>

          {isPreRPYear && (
            <div className="mt-4 flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 text-sm">
              <Calendar className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-400" />
              <span className="text-amber-200/90">
                <span className="font-semibold text-amber-300">Before Rich Picks</span>
                {" "}— Award selections for {year} were not recorded. The categories below show nominees and winners from other award organizations.
              </span>
            </div>
          )}

          {isPreSeason && (
            <div className="mt-4 flex items-start gap-3 bg-sky-500/10 border border-sky-500/30 rounded-lg px-4 py-3 text-sm">
              <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0 text-sky-400" />
              <span className="text-sky-200/90">
                {isUpcomingYear ? (
                  <>
                    <span className="font-semibold text-sky-300">Coming in {year}</span>
                    {" "}— The {year} film year hasn&apos;t begun. The Anticipation Board tracks films already scheduled for {year}; considerations will appear here once Rich starts screening them.
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-sky-300">Under Consideration</span>
                    {" "}— Rich Picks nominations for {year} have not been announced yet. The categories below show films Rich is currently tracking as considerations.
                    {" "}<Link href="/picks" className="font-semibold text-sky-300 underline underline-offset-2 hover:text-sky-200">Make your own community picks →</Link>
                  </>
                )}
              </span>
            </div>
          )}

          {/* Legend */}
          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-muted-foreground bg-background/50 p-2 rounded-lg border border-border/50 inline-flex">
            <span className="flex items-center gap-1.5 px-2">
              <Trophy className="w-3 h-3 text-accent" />
              <span className="font-medium text-foreground">Won</span>
            </span>
            <span className="flex items-center gap-1.5 px-2 border-l border-border/50">
              <Circle className="w-2 h-2 text-muted-foreground/50" fill="currentColor" />
              <span className="font-medium text-foreground">Nominee</span>
            </span>
            {isPreSeason && (
              <span className="flex items-center gap-1.5 px-2 border-l border-border/50">
                <Sparkles className="w-3 h-3 text-sky-400" />
                <span className="font-medium text-foreground">Consideration</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="px-6 md:px-10 py-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-8">

          {/* Left: Top 10 Sidebar */}
          <div>
            <h2 className="font-serif text-lg font-semibold mb-4 flex items-center gap-2 text-muted-foreground drop-shadow-sm">
              <Star className="w-4 h-4 text-accent" />
              Top 10 Films of {year}
            </h2>
            <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
              {currentTop10.map((item, i) => (
                <div key={item.rank} className={`flex items-center gap-2 py-2.5 px-3 hover:bg-secondary/30 transition-colors ${i > 0 ? "border-t border-border/50" : ""}`}>
                  <span className="font-serif text-base font-bold text-accent w-5 text-center">{item.rank}</span>
                  <GradeHex grade={item.grade} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col">
                      {item.filmId ? (
                        <Link href={`/film/${item.filmId}`} className="text-sm font-medium text-foreground leading-tight truncate px-1 max-sm:py-[13px] max-sm:-my-[13px] hover:text-accent transition-colors">
                          {item.film}
                        </Link>
                      ) : (
                        <span className="text-sm font-medium text-foreground leading-tight truncate px-1">{item.film}</span>
                      )}
                      <span className="text-[10px] text-muted-foreground truncate px-1 mt-0.5">
                        {isPreSeason ? formatConsiderationCount(considerationCounts.get(item.film.toLowerCase()) ?? 0) : formatSubtitle(item.wins, item.noms)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {currentTop10.length === 0 && (
                <div className="py-12 text-center text-sm text-muted-foreground italic">No top 10 rankings recorded for {year}.</div>
              )}
            </div>
            {showAnticipationBoard ? (
              <AnticipationBoard year={year} films={anticipationFilms} />
            ) : year >= 2021 && (
              <UnseenFilmsTable films={unseenFilms} year={year} />
            )}
          </div>

          {/* Right: Categories Grid / Considerations */}
          <div>
            {isPreSeason ? (
              <ConsiderationsGrid grouped={considerationsGrouped} year={year} filmIdMap={filmIdMap} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categoriesByGroup.length === 0 ? (
                  <div className="col-span-full py-20 text-center text-muted-foreground italic border border-border/50 rounded-lg bg-card/20">
                    {isPreRPYear ? `No award data has been recorded for ${year} yet.` : "No specific award categories have been recorded for an entire year yet!"}
                  </div>
                ) : (
                  categoriesByGroup.map((group, groupIndex) => {
                    const groupData = CATEGORY_GROUPS.find(g => g.id === group.id);
                    return (
                      <React.Fragment key={group.id}>
                        {groupData && <GroupHeader group={groupData} index={groupIndex} />}
                        {group.categories.map((category, i) => (
                          <CategoryCard key={category.name} category={category} index={(groupIndex * 10) + i} />
                        ))}
                      </React.Fragment>
                    );
                  })
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
