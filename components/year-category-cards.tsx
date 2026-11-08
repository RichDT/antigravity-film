// Category cards shared by the year page and the film page (nominations and considerations).
import React from "react";
import Link from "next/link";
import {
  Film, Trophy, Award, User, Clapperboard, Camera, Music, Scissors, Sparkles, PenTool, Palette, Globe,
  FileText, Wand2, Brush, Circle, Volume2, FileVideoCamera, UserStar, BookOpen, Theater, Shirt,
  MirrorRound, Piano, MicVocal, Headphones, SlidersHorizontal,
} from "lucide-react";
import { LinkedNamesList, OtherAwardsRow } from "@/components/award-icons";
import {
  Category,
  Nominee,
  OtherAwards,
  AwardStatus,
  formatNamesList,
  ConsiderationEntry,
  CATEGORY_ICON_MAPPING,
  CATEGORY_GROUPS_MAPPING,
} from "@/lib/awards";

export const CATEGORY_GROUPS = [
  { id: "film", label: "Film", icons: ["film", "filevideo", "globe", "wand", "brush", "file"] },
  { id: "directing", label: "Directing & Editing", icons: ["clapperboard", "scissors"] },
  { id: "acting", label: "Acting", icons: ["userstar", "user"] },
  { id: "writing", label: "Writing", icons: ["pentool", "bookopen"] },
  { id: "visual", label: "Visual", icons: ["camera", "theater", "shirt", "mirror", "sparkles"] },
  { id: "sound", label: "Sound & Music", icons: ["piano", "micvocal", "headphones", "sliders"] },
];

export function getCategoryIcon(iconName: string) {
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


export function GroupHeader({ group, index }: { group: typeof CATEGORY_GROUPS[0]; index: number }) {
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

export function isActingCategory(name: string): boolean {
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

export function NomineeRow({ nominee, isWinner, isActing, category }: { nominee: Nominee; isWinner: boolean; isActing: boolean; category: Category }) {
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
            <span className="font-medium mr-1">{displayRole}:</span> <LinkedNamesList people={names} className="touch-target hover:text-accent hover:underline transition-colors" />
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
            <span className="font-medium mr-1">{displayRole}:</span> <LinkedNamesList people={names} className="touch-target hover:text-accent hover:underline transition-colors" />
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
    highlightText = <LinkedNamesList people={namesArray} className="touch-target hover:text-accent hover:underline transition-colors" />;

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
              <span className="font-medium mr-1">{role}:</span> <LinkedNamesList people={names} className="touch-target hover:text-accent hover:underline transition-colors" />
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
    highlightText = <LinkedNamesList people={namesArray} className="touch-target hover:text-accent hover:underline transition-colors" />;

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
              <span className="font-medium mr-1">Production design:</span> <LinkedNamesList people={pd} className="touch-target hover:text-accent hover:underline transition-colors" />
            </div>
          )}
          {sd.length > 0 && (
            <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">
              <span className="font-medium mr-1">Set decoration:</span> <LinkedNamesList people={sd} className="touch-target hover:text-accent hover:underline transition-colors" />
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
    highlightText = <LinkedNamesList people={headlineNames} className="touch-target hover:text-accent hover:underline transition-colors" />;

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
              <span className="font-medium mr-1">{displayRole}:</span> <LinkedNamesList people={names} className="touch-target hover:text-accent hover:underline transition-colors" />
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
    highlightText = <LinkedNamesList people={namesArray} className="touch-target hover:text-accent hover:underline transition-colors" />;

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
              className="touch-target text-[13px] font-semibold text-foreground/90 hover:text-accent transition-colors"
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
            <Link href={nominee.film_id ? `/film/${nominee.film_id}` : `/search?q=${encodeURIComponent(nominee.film)}`} className="touch-target hover:text-accent hover:underline transition-colors">{highlightText}</Link>
          ) : highlightText}
        </div>

        {/* For non-acting, non-film-group: show the film title below the person's name */}
        {nominee.film && !isActing && !isActingCategory(category.name) && category.group !== "film" && (
          <div className="text-[13px] md:text-sm text-foreground/80 font-medium mb-1 group-hover:text-foreground transition-colors">
            <Link href={nominee.film_id ? `/film/${nominee.film_id}` : `/search?q=${encodeURIComponent(nominee.film)}`} className="touch-target hover:text-accent hover:underline transition-colors">{nominee.film}</Link>
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

export function CategoryCard({ category, index }: { category: Category; index: number }) {
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

// ─── ConsiderationsGrid — shown for pre-season years ─────────────────────────

export function ConsiderationCard({
  catName,
  entries,
  index,
}: {
  catName: string;
  entries: ConsiderationEntry[];
  index: number;
}) {
  const Icon = getCategoryIcon(CATEGORY_ICON_MAPPING[catName] || 'trophy');
  const catSlug = `/categories/${catName.toLowerCase().replace(/[\s\W]+/g, "-").replace(/^-+|-+$/g, "")}`;
  const group = CATEGORY_GROUPS_MAPPING[catName] || 'film';
  const category: Category = { name: catName, icon: CATEGORY_ICON_MAPPING[catName] || 'trophy', group, winner: null, nominees: [] };
  const isActing = isActingCategory(catName);

  // Shape considerations like nominations so NomineeRow renders them identically
  const byFilm = new Map<number, { title: string; names: string[]; characters: Record<string, string>; producers: string[] }>();
  for (const e of entries) {
    if (!byFilm.has(e.film_id)) byFilm.set(e.film_id, { title: e.title, names: [], characters: {}, producers: e.producers ?? [] });
    const f = byFilm.get(e.film_id)!;
    if (e.detail) for (const n of e.detail.split(', ')) {
      if (!f.names.includes(n)) f.names.push(n);
      if (e.character) f.characters[n] = e.character;
    }
  }

  const personIds = entries[0]?.personIds ?? {};
  const person = (name: string) => ({ name, id: personIds[name.toLowerCase()] });
  const rows: { key: string; nominee: Nominee; rowCategory: Category }[] = [];
  for (const [filmId, { title, names, characters, producers }] of byFilm) {
    if (isActing) {
      for (const name of names) {
        rows.push({
          key: `${filmId}-${name}`,
          rowCategory: category,
          nominee: { name, id: personIds[name.toLowerCase()], film: title, film_id: filmId, performances: [{ film: title, character: characters[name], film_id: filmId, nomination_id: 0 }] },
        });
      }
    } else if (group === 'film') {
      rows.push({
        key: String(filmId),
        rowCategory: category,
        nominee: { name: title, film: title, film_id: filmId, contributors: producers.length > 0 ? producers.map(name => ({ ...person(name), role: 'Producer' })) : undefined },
      });
    } else if (names.length === 0) {
      // No confirmed names yet: render film-only, like a film-category row
      rows.push({ key: String(filmId), rowCategory: { ...category, group: 'film' }, nominee: { name: title, film: title, film_id: filmId } });
    } else {
      rows.push({
        key: String(filmId),
        rowCategory: category,
        nominee: { name: names.join(', '), film: title, film_id: filmId, contributors: names.map(person) },
      });
    }
  }

  return (
    <div
      className="bg-card border border-sky-500/25 rounded-lg overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both hover:border-sky-400/50 transition-colors"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <Link href={catSlug} className="p-3 border-b border-sky-500/20 bg-sky-500/5 flex items-center gap-2.5 hover:bg-sky-500/10 transition-colors block">
        <div className="w-8 h-9 clip-hexagon bg-sky-500/20 flex items-center justify-center flex-shrink-0 shadow-[0_0_10px_rgba(56,189,248,0.12)]">
          <Icon className="w-4 h-4 text-sky-400" />
        </div>
        <h3 className="font-serif text-sm font-semibold">{catName}</h3>
      </Link>

      <div className="p-3 space-y-0.5">
        {rows.map(r => (
          <NomineeRow key={r.key} nominee={r.nominee} isWinner={false} isActing={isActing} category={r.rowCategory} />
        ))}
      </div>
    </div>
  );
}

export function ConsiderationsGrid({
  grouped,
  year,
  filmIdMap,
}: {
  grouped: Record<string, ConsiderationEntry[]>;
  year: number;
  filmIdMap: Record<string, number>;
}) {
  if (Object.keys(grouped).length === 0) {
    return (
      <div className="py-20 text-center text-muted-foreground italic border border-border/50 rounded-lg bg-card/20">
        No considerations have been recorded for {year} yet.
      </div>
    );
  }

  // Build groups in CATEGORY_GROUPS order, same as the nominations view
  const groupedBySection = CATEGORY_GROUPS.map(group => ({
    ...group,
    categories: Object.keys(grouped).filter(
      cat => (CATEGORY_GROUPS_MAPPING[cat] || 'film') === group.id
    ),
  })).filter(g => g.categories.length > 0);

  let cardIndex = 0;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {groupedBySection.map((section, sectionIdx) => (
        <React.Fragment key={section.id}>
          <GroupHeader group={section} index={sectionIdx} />
          {section.categories.map(catName => {
            const idx = cardIndex++;
            return (
              <ConsiderationCard
                key={catName}
                catName={catName}
                entries={grouped[catName]}
                index={idx}
              />
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
}
