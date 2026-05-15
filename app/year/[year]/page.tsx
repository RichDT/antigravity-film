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
import { getUnseenFilmsForYear } from "@/lib/unseen-films";
import { query } from "@/lib/db";
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
} from "@/lib/awards";

// ISR: Re-generate this page at most once per hour on production.
export const revalidate = 3600;

export async function generateStaticParams() {
  const years = await getYearsWithDBReviews();
  return years.map((year) => ({ year: String(year) }));
}

const RP_START_YEAR = 2005;

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

function GradeHex({ grade }: { grade: string }) {
  if (!grade) return <div className="w-5 h-6 clip-hexagon flex items-center justify-center flex-shrink-0 text-[10px] font-bold bg-muted text-muted-foreground">-</div>;

  if (grade.includes("//")) {
    const parts = grade.split("//");
    return (
      <div className={`w-5 h-6 clip-hexagon flex flex-col items-center justify-center flex-shrink-0 font-bold leading-none ${getGradeColor(parts[0])}`}>
        <span className="text-[6.5px] leading-none -translate-y-[0.5px]">{parts[0]}</span>
        <div className="w-3.5 h-[1px] bg-white/80 my-[0.5px]"></div>
        <span className="text-[6.5px] leading-none translate-y-[0.5px]">{parts[1]}</span>
      </div>
    );
  }

  return (
    <div className={`w-5 h-6 clip-hexagon flex items-center justify-center flex-shrink-0 text-[9px] font-bold ${getGradeColor(grade)}`}>
      {grade}
    </div>
  );
}

function GroupHeader({ group, index }: { group: typeof CATEGORY_GROUPS[0]; index: number }) {
  const uniqueIcons = [...new Set(group.icons)];

  return (
    <div className="col-span-full mt-8 first:mt-0 mb-4 animate-in slide-in-from-left-4 fade-in duration-500" style={{ animationDelay: `${index * 100}ms` }}>
      {index > 0 && (
        <div className="flex items-center gap-4 mb-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          {uniqueIcons.map((iconName, i) => {
            const Icon = getCategoryIcon(iconName);
            return (
              <div key={i} className="w-6 h-7 clip-hexagon bg-border/50 flex items-center justify-center">
                <div className="clip-hexagon bg-muted/60 flex items-center justify-center" style={{ width: "calc(100% - 3px)", height: "calc(100% - 3px)" }}>
                  <Icon className="w-3 h-3 text-muted-foreground" />
                </div>
              </div>
            );
          })}
        </div>

        <h2 className="font-serif text-lg font-semibold text-foreground tracking-wide">
          {group.label}
        </h2>

        <div className="h-px flex-1 bg-gradient-to-r from-border/60 to-transparent" />
      </div>
    </div>
  );
}

function isActingCategory(name: string): boolean {
  return name.toLowerCase().includes("actor") || name.toLowerCase().includes("actress");
}

function formatAdaptedSource(text: string): React.ReactNode {
  if (!text) return text;
  let formatted = text.replace(/^(The|A|An)\s+/i, (match) => match.toLowerCase());

  const doubleQuoteMatch = formatted.match(/"([^"]+)"/);
  if (doubleQuoteMatch) {
    const title = doubleQuoteMatch[1];
    const parts = formatted.split(`"${title}"`);
    return <>{parts[0]}<span className="italic">{title}</span>{parts[1]}</>;
  }

  const singleQuoteMatch = formatted.match(/(^|\s)'([^']+)'(\s|[.,!?;:]|$)/);
  if (singleQuoteMatch) {
    const title = singleQuoteMatch[2];
    const parts = formatted.split(`'${title}'`);
    return <>{parts[0]}<span className="italic">{title}</span>{parts[1]}</>;
  }

  if (formatted.toLowerCase().includes("of the same name") || formatted.toLowerCase().includes("of the same title")) {
    return formatted;
  }

  const descriptorRegex = /\b(novel|book|play|film|memoir|biography|story|novella|series|character|novellas|short story|television series|comic book|graphic novel|article)\s+(?!by\b|written by\b|of\b|from\b)(.+?)(?:\s+by\b|\s+written by\b|$)/i;
  const descMatch = formatted.match(descriptorRegex);

  if (descMatch) {
    const title = descMatch[2];
    const parts = formatted.split(title);
    return <>{parts[0]}<span className="italic">{title}</span>{parts.slice(1).join(title)}</>;
  }

  return formatted;
}

function NomineeRow({ nominee, isWinner, isActing, category }: { nominee: Nominee; isWinner: boolean; isActing: boolean; category: Category }) {
  let highlightText: React.ReactNode = nominee.name;
  let secondaryContent: React.ReactNode = null;

  if (category.group === "film") {
    highlightText = nominee.film;
    if (nominee.contributors && nominee.contributors.length > 0) {
      const rolesMap = new Map<string, { id?: number; name: string }[]>();
      nominee.contributors.forEach(c => {
        const r = c.role || "Producer";
        if (!rolesMap.has(r)) rolesMap.set(r, []);
        rolesMap.get(r)!.push({ id: c.id, name: c.name });
      });
      secondaryContent = Array.from(rolesMap.entries()).map(([role, names]) => {
        const displayRole = (names.length > 1 && !role.includes('&') && !role.endsWith('s') && role !== 'Cast') ? `${role}s` : role;
        return (
          <div key={role} className="text-[11px] text-muted-foreground leading-snug mt-0.5 group-hover:text-foreground/70 transition-colors">
            <span className="font-medium mr-1">{displayRole}:</span> <LinkedNamesList people={names} className="hover:text-accent hover:underline transition-colors" />
          </div>
        );
      });
    } else if (nominee.name && nominee.name !== nominee.film) {
      secondaryContent = <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">{nominee.name}</div>;
    }
  } else if (category.name === "Original Song") {
    highlightText = nominee.songTitle ? `"${nominee.songTitle}"` : "Unknown Song";

    let songCreators: React.ReactNode = null;
    if (nominee.contributors && nominee.contributors.length > 0) {
      const rolesMap = new Map<string, { id?: number; name: string }[]>();
      nominee.contributors.forEach(c => {
        const r = c.role || "Music & lyrics";
        if (!rolesMap.has(r)) rolesMap.set(r, []);
        rolesMap.get(r)!.push({ id: c.id, name: c.name });
      });
      songCreators = Array.from(rolesMap.entries()).map(([role, names]) => {
        const displayRole = (names.length > 1 && !role.includes('&') && !role.endsWith('s') && role !== 'Cast') ? `${role}s` : role;
        return (
          <div key={role} className="text-[11px] text-muted-foreground leading-snug mt-0.5">
            <span className="font-medium mr-1">{displayRole}:</span> <LinkedNamesList people={names} className="hover:text-accent hover:underline transition-colors" />
          </div>
        );
      });
    } else if (nominee.name) {
      songCreators = <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">{nominee.name}</div>;
    }

    // Film title comes from the sub-headline block — show only songwriters here
    secondaryContent = songCreators || null;
  } else if (category.name === "Screenplay (Original)" || category.name === "Screenplay (Adapted)") {
    const namesArray = nominee.contributors || [{ id: nominee.id, name: nominee.name, lastName: nominee.lastName, isInverted: nominee.isInverted }];
    highlightText = <LinkedNamesList people={namesArray} className="hover:text-accent hover:underline transition-colors" />;

    let writers: React.ReactNode = null;
    if (category.name === "Screenplay (Original)" && nominee.contributors && nominee.contributors.length > 0) {
      const originalRolesMap = new Map<string, { id?: number; name: string }[]>();
      nominee.contributors.forEach(c => {
        const r = c.role || "Story & screenplay";
        if (!originalRolesMap.has(r)) originalRolesMap.set(r, []);
        originalRolesMap.get(r)!.push({ id: c.id, name: c.name });
      });

      if (originalRolesMap.size > 1) {
        writers = Array.from(originalRolesMap.entries()).map(([role, names]) => {
          return (
            <div key={role} className="text-[11px] text-muted-foreground leading-snug mt-0.5">
              <span className="font-medium mr-1">{role}:</span> <LinkedNamesList people={names} className="hover:text-accent hover:underline transition-colors" />
            </div>
          );
        });
      }
    }

    let sourceStr: React.ReactNode = null;
    if (category.name === "Screenplay (Adapted)" && nominee.adaptedSource) {
      sourceStr = <span className="text-muted-foreground/80"> based on {formatAdaptedSource(nominee.adaptedSource)}</span>;
    }

    // Film title comes from the sub-headline block — show source and role breakdown here
    secondaryContent = (
      <>
        {sourceStr && (
          <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">{sourceStr}</div>
        )}
        {writers}
      </>
    );
  } else if (category.name === "Production Design" || category.name === "Art Direction") {
    const namesArray = nominee.contributors || [{ id: nominee.id, name: nominee.name, lastName: nominee.lastName, isInverted: nominee.isInverted }];
    highlightText = <LinkedNamesList people={namesArray} className="hover:text-accent hover:underline transition-colors" />;

    let designers: React.ReactNode = null;
    if (nominee.contributors && nominee.contributors.length > 0) {
      const pd: { id?: number; name: string; }[] = [];
      const sd: { id?: number; name: string; }[] = [];
      nominee.contributors.forEach(c => {
        const r = c.role?.toLowerCase() || "";
        if (r.includes("set")) sd.push({ id: c.id, name: c.name });
        else pd.push({ id: c.id, name: c.name });
      });

      designers = (
        <>
          {pd.length > 0 && (
            <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">
              <span className="font-medium mr-1">Production design:</span> <LinkedNamesList people={pd} className="hover:text-accent hover:underline transition-colors" />
            </div>
          )}
          {sd.length > 0 && (
            <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">
              <span className="font-medium mr-1">Set decoration:</span> <LinkedNamesList people={sd} className="hover:text-accent hover:underline transition-colors" />
            </div>
          )}
        </>
      );
    }

    // Film title comes from the sub-headline block — show only role breakdown here
    secondaryContent = designers || (
      nominee.role
        ? <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">· {nominee.role}</div>
        : null
    );
  } else if (
    category.name === "Make-Up & Hairstyling" || category.name === "Makeup and Hairstyling" || category.name.includes("Make-Up") || category.name.includes("Makeup") ||
    category.name === "Effects" || category.name === "Visual Effects" || category.name.includes("Effects") ||
    category.name === "Sound Mixing" || category.name === "Sound Editing" || category.name.includes("Sound ")
  ) {
    const isSoundCategory = category.name === "Sound Mixing" || category.name === "Sound Editing" || category.name.includes("Sound ");
    const allContributors = nominee.contributors || [{ id: nominee.id, name: nominee.name, lastName: nominee.lastName, isInverted: nominee.isInverted }];

    // For Sound categories, cap the headline to ≤4 names, prioritizing Oscar/BAFTA nominees
    let headlineNames = allContributors;
    if (isSoundCategory && allContributors.length > 4) {
      const oscarBaftaNames = allContributors.filter((c: any) => c.isOscarBaftaName);
      if (oscarBaftaNames.length > 0 && oscarBaftaNames.length <= 4) {
        headlineNames = oscarBaftaNames;
      } else {
        headlineNames = allContributors.slice(0, 4);
      }
    }
    highlightText = <LinkedNamesList people={headlineNames} className="hover:text-accent hover:underline transition-colors" />;

    // Helper: fix acronym capitalization in role names (e.g. "Adr" → "ADR")
    const fixRoleCapitalization = (role: string): string => {
      return role
        .replace(/\bAdr\b/gi, 'ADR')
        .replace(/\bVfx\b/gi, 'VFX')
        .replace(/\bSfx\b/gi, 'SFX');
    };

    let designers: React.ReactNode = null;
    if (nominee.contributors && nominee.contributors.length > 0) {
      const rolesMap = new Map<string, { id?: number; name: string }[]>();
      nominee.contributors.forEach(c => {
        const r = c.role ? fixRoleCapitalization(c.role) : (isSoundCategory ? "Sound" : "Makeup & Hair");
        if (!rolesMap.has(r)) rolesMap.set(r, []);
        rolesMap.get(r)!.push({ id: c.id, name: c.name });
      });

      if (rolesMap.size > 1 || nominee.contributors[0].role) {
        designers = Array.from(rolesMap.entries()).map(([role, names]) => {
          const displayRole = (names.length > 1 && !role.includes('&') && !role.endsWith('s') && role !== 'Cast') ? `${role}s` : role;
          return (
            <div key={role} className="text-[11px] text-muted-foreground leading-snug mt-0.5 group-hover:text-foreground/70 transition-colors">
              <span className="font-medium mr-1">{displayRole}:</span> <LinkedNamesList people={names} className="hover:text-accent hover:underline transition-colors" />
            </div>
          );
        });
      }
    }

    secondaryContent = designers || (
      nominee.role
        ? <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">· {nominee.role}</div>
        : null
    );
  } else {
    const namesArray = nominee.contributors || [{ id: nominee.id, name: nominee.name, lastName: nominee.lastName, isInverted: nominee.isInverted }];
    highlightText = <LinkedNamesList people={namesArray} className="hover:text-accent hover:underline transition-colors" />;

    if (!isActing) {
      // Film title comes from the sub-headline block — show only subordinate role info here
      if (nominee.role && nominee.film && nominee.name !== nominee.film) {
        secondaryContent = <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">· {nominee.role}</div>;
      }
    }
    // For acting: performances are rendered separately below — no secondaryContent needed
  }

  // ── Acting: unified film-first layout with per-film badges ──────────────────
  const actingContent = isActing && nominee.performances && nominee.performances.length > 0 ? (
    <div className={`space-y-2 ${nominee.performances.length > 1 ? 'mt-2' : 'mt-1.5'}`}>
      {nominee.performances.map((perf, idx) => {
        const hasBadges = perf.badges && Object.keys(perf.badges).length > 0;
        return (
          <div
            key={idx}
            className={`${nominee.performances!.length > 1 ? 'pl-3 border-l-2 border-border/40' : ''}`}
          >
            {/* "as [character] in" on its own line above the film title */}
            {perf.character && (
              <div className="text-[11px] text-muted-foreground leading-snug">
                as {perf.character} in
              </div>
            )}
            {/* Film title — non-italic, linked, matching other category styling */}
            <Link
              href={`/film/${perf.film_id}`}
              className="text-[13px] font-semibold text-foreground/90 hover:text-accent transition-colors"
            >
              {perf.film}
            </Link>
            {/* Badges scoped to this film — unambiguous */}
            {hasBadges && (
              <div className="mt-1">
                <OtherAwardsRow awards={perf.badges!} categoryName={category.name} categoryGroup={category.group} awardContexts={category.awardContexts} currentFilm={perf.film} peopleIds={nominee.contributors?.map(c => c.id).filter((id): id is number => id != null) ?? []} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  ) : null;

  return (
    <div className={`p-4 md:p-5 flex flex-col md:flex-row gap-4 md:gap-6 bg-card hover:bg-card/80 transition-all border border-transparent rounded-2xl group ${isWinner ? 'shadow-md border-accent/20 ring-1 ring-accent/10 relative overflow-hidden bg-gradient-to-br from-card to-accent/5' : 'hover:border-border/60 hover:shadow-sm'}`}>
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className={`font-serif text-[17px] md:text-lg mb-0.5 leading-tight ${isWinner ? 'text-accent font-bold' : 'text-foreground font-semibold group-hover:text-primary transition-colors'}`}>
          {typeof highlightText === 'string' && !isActing && nominee.film ? (
            <Link href={nominee.film_id ? `/film/${nominee.film_id}` : `/search?q=${encodeURIComponent(nominee.film)}`} className="hover:text-accent hover:underline transition-colors">{highlightText}</Link>
          ) : highlightText}
        </div>

        {/* For non-acting, non-film-group: show the film title below the person's name */}
        {nominee.film && !isActing && !isActingCategory(category.name) && category.group !== "film" && (
          <div className="text-[13px] md:text-sm text-foreground/80 font-medium mb-1 group-hover:text-foreground transition-colors">
            <Link href={nominee.film_id ? `/film/${nominee.film_id}` : `/search?q=${encodeURIComponent(nominee.film)}`} className="hover:text-accent hover:underline transition-colors">{nominee.film}</Link>
          </div>
        )}

        {secondaryContent}
        {actingContent}

        {nominee.otherOtherAwards && (
          <div className="mt-1">
            <OtherAwardsRow awards={nominee.otherOtherAwards} categoryName={category.name} categoryGroup={category.group} awardContexts={category.awardContexts} currentFilm={nominee.film} peopleIds={nominee.contributors?.map(c => c.id).filter((id): id is number => id != null) ?? []} />
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryCard({ category, index }: { category: Category; index: number }) {
  const Icon = getCategoryIcon(category.icon);
  const isActing = isActingCategory(category.name);

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both hover:border-accent/40 transition-colors" style={{ animationDelay: `${index * 50}ms` }}>
      <Link href={`/categories/${category.name.toLowerCase().replace(/[\s\W]+/g, "-").replace(/^-+|-+$/g, "")}`} className="p-3 border-b border-border/50 flex items-center gap-2.5 hover:bg-secondary/50 transition-colors block">
        <div className="w-8 h-9 clip-hexagon bg-accent/20 flex items-center justify-center flex-shrink-0 shadow-[0_0_10px_rgba(212,175,55,0.1)]">
          <Icon className="w-4 h-4 text-accent" />
        </div>
        <h3 className="font-serif text-sm font-semibold group-hover:text-accent transition-colors">{category.name}</h3>
      </Link>

      <div className="p-3 space-y-0.5">
        {category.winner && <NomineeRow nominee={category.winner} isWinner={true} isActing={isActing} category={category} />}

        {category.nominees.length > 0 && category.winner && (
          <div className="border-t border-border/30 my-1.5" />
        )}

        {category.nominees.map((nominee, i) => (
          <NomineeRow key={i} nominee={nominee} isWinner={false} isActing={isActing} category={category} />
        ))}
        {category.nominees.length === 0 && !category.winner && (
          <div className="text-xs text-muted-foreground italic text-center py-2">No selections recorded.</div>
        )}
      </div>
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

  const [dbStats, filmIdMap, dbReviewsRes, dbYears, rpFilmNomRes, dbNomYearsRes, unseenFilms] = await Promise.all([
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
  ]);

  const dbNomYears = dbNomYearsRes.rows.map((r: any) => r.year as number);
  const allYears = Array.from(new Set([...staticYears, ...dbYears, ...dbNomYears]))
    .sort((a: number, b: number) => b - a);

  if (!allYears.includes(year)) {
    notFound();
  }

  const currentIndex = allYears.indexOf(year);
  const prevYear = currentIndex < allYears.length - 1 ? allYears[currentIndex + 1] : null;
  const nextYear = currentIndex > 0 ? allYears[currentIndex - 1] : null;

  const isDBOnlyYear = !staticYears.includes(year);

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
              <Link href={`/year/${prevYear}`} className="flex items-center gap-1 text-sm transition-colors hover:text-accent group">
                <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> {prevYear}
              </Link>
            ) : <div />}
            {nextYear ? (
              <Link href={`/year/${nextYear}`} className="flex items-center gap-1 text-sm transition-colors hover:text-accent group">
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
            {isPreRPYear ? "Historical Award Archive" : "Rich Picks for Film Excellence"}
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
                        <Link href={`/film/${item.filmId}`} className="text-sm font-medium text-foreground leading-tight truncate px-1 hover:text-accent transition-colors">
                          {item.film}
                        </Link>
                      ) : (
                        <span className="text-sm font-medium text-foreground leading-tight truncate px-1">{item.film}</span>
                      )}
                      <span className="text-[10px] text-muted-foreground truncate px-1 mt-0.5">
                        {formatSubtitle(item.wins, item.noms)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {currentTop10.length === 0 && (
                <div className="py-12 text-center text-sm text-muted-foreground italic">No top 10 rankings recorded for {year}.</div>
              )}
            </div>
            {year >= 2021 && (
              <UnseenFilmsTable films={unseenFilms} year={year} />
            )}
          </div>

          {/* Right: Categories Grid grouped up */}
          <div>
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
          </div>

        </div>
      </div>
    </div>
  );
}
