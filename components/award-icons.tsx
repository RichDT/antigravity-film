"use client";

import React from "react";
import Link from "next/link";
import { Trophy, Circle } from "lucide-react";
import { AwardStatus, OtherAwards, AwardPopoverContext, AwardPopoverSection } from "@/lib/awards";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function LinkedNamesList({ people, className = "hover:text-accent hover:underline transition-colors" }: { people: { id?: number; name: string }[], className?: string }) {
  if (!people || people.length === 0) return null;

  return (
    <>
      {people.map((p, i) => {
        const isLast = i === people.length - 1;
        const isSecondToLast = i === people.length - 2;
        const needsAnd = people.length > 1 && isLast;

        const content = p.id ? (
          <Link href={`/person/${p.id}`} className={className}>{p.name}</Link>
        ) : (
          <span>{p.name}</span>
        );

        return (
          <React.Fragment key={i}>
            {needsAnd && " and "}
            {content}
            {!isLast && !isSecondToLast && ", "}
            {isSecondToLast && people.length > 2 && ", "}
          </React.Fragment>
        );
      })}
    </>
  );
}

export function AwardIcon({ award, status }: { award: string; status: AwardStatus }) {
  if (!status) return null;

  const isWon = status === "won" || status === "won_slant";
  const isSlant = status === "won_slant" || status === "nominated_slant" || status === "considered_slant";
  const isConsidered = status === "considered" || status === "considered_slant";
  const isRich = award === "rich";
  const labels: Record<string, string> = {
    rich: "RICH", oscar: "Oscar", globe: "Globe", nbr: "NBR", sag: "SAG", dga: "DGA", bafta: "BAFTA",
    pga: "PGA", wga: "WGA", ace: "ACE", adg: "ADG", asc: "ASC",
    cdg: "CDG", muah: "MUAH", scl: "SCL", ves: "VES",
    cas: "CAS", mpse: "MPSE",
    annie: "Annie", grammy: "Grammy", spirit: "Spirit"
  };

  const baseSize = isRich ? "text-[10px] px-1.5 h-4" : "text-[8px] px-1 h-3.5";

  let className = "";
  if (isWon) {
    className = isSlant
      ? "shadow-sm"  // rose-gold fill — set via inline style below
      : "bg-accent text-accent-foreground shadow-sm";
  } else if (isConsidered) {
    className = "bg-transparent border border-dashed border-muted-foreground/40 text-muted-foreground";
  } else {
    className = isSlant
      ? "bg-secondary border border-border"  // text color set via inline style to match border
      : "bg-secondary text-secondary-foreground border border-border";
  }

  const inlineStyle: React.CSSProperties = isWon && isSlant
    ? { backgroundColor: "var(--rose-gold)", color: "var(--rose-gold-foreground)" }
    : !isWon && isSlant
    ? { color: "var(--border)" }
    : {};

  return (
    <span
      className={`inline-flex items-center justify-center font-bold rounded ${baseSize} ${className}`}
      style={inlineStyle}
      title={`${labels[award]} ${isWon ? "Winner" : isConsidered ? "Considered" : "Nominee"} ${isSlant ? "(Other Category)" : ""}`}
    >
      {labels[award]}
    </span>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isActingCategory(name: string) {
  const l = name.toLowerCase();
  return l.includes('actor') || l.includes('actress');
}

/**
 * Return the sections to display in the popover.
 *
 * Acting categories: only show sections in which the specific person (by personId)
 * actually appears. This naturally handles tier (leading/supporting) and the slant
 * scenario — if the person appears in a different tier at this org, that section
 * shows up because they're in it, not because of any tier-matching heuristic.
 *
 * Non-acting categories: only show sections in which the current film appears.
 * This collapses Globe Drama / Comedy to whichever one the film is actually in.
 *
 * If neither filter can be applied (no personIds, no currentFilm), return all sections.
 */
function selectSections(
  sections: AwardPopoverSection[],
  rpCategoryName: string,
  currentFilm: string | undefined,
  peopleIds: number[],
): AwardPopoverSection[] {
  if (isActingCategory(rpCategoryName)) {
    if (peopleIds.length === 0) return sections;
    return sections.filter(s => {
      // For adjacent-year sections (cross-year slant), require BOTH person AND film
      // to match. This prevents showing a different film's nomination from an adjacent
      // year (e.g. Streep's 1981 BAFTA for French Lieutenant's Woman shouldn't show
      // when clicking the slant BAFTA badge for Sophie's Choice on the 1982 page).
      if (s.year != null && currentFilm) {
        const filmLower = currentFilm.toLowerCase();
        return s.nominees.some(n =>
          n.personIds.some(id => peopleIds.includes(id)) &&
          n.film.toLowerCase() === filmLower
        );
      }
      // For same-year sections, filter by person only (show full category context)
      return s.nominees.some(n => n.personIds.some(id => peopleIds.includes(id)));
    });
  }

  // Non-acting: filter to sections where the current film appears
  if (currentFilm) {
    const filmLower = currentFilm.toLowerCase();
    const matched = sections.filter(s =>
      s.nominees.some(n => n.film.toLowerCase() === filmLower)
    );
    if (matched.length > 0) return matched;
  }

  return sections;
}

// ─── Popover badge ────────────────────────────────────────────────────────────

function AwardBadgeWithPopover({
  award,
  status,
  context,
  rpCategoryName,
  currentFilm,
  peopleIds,
}: {
  award: string;
  status: AwardStatus;
  context: AwardPopoverContext;
  rpCategoryName: string;
  currentFilm?: string;
  peopleIds?: number[];
}) {
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<'click' | 'hover' | null>(null);
  const hoverOpenTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverCloseTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (hoverOpenTimer.current) clearTimeout(hoverOpenTimer.current);
      if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
    };
  }, []);

  if (!status) return null;

  const labels: Record<string, string> = {
    oscar: "Oscar", globe: "Globe", nbr: "NBR", sag: "SAG", dga: "DGA", bafta: "BAFTA",
    pga: "PGA", wga: "WGA", ace: "ACE", adg: "ADG", asc: "ASC",
    cdg: "CDG", muah: "MUAH", scl: "SCL", ves: "VES",
    cas: "CAS", mpse: "MPSE", annie: "Annie", grammy: "Grammy", spirit: "Spirit",
  };

  const isWon = status === "won" || status === "won_slant";
  const isSlant = status === "won_slant" || status === "nominated_slant" || status === "considered_slant";

  let badgeClass = "";
  if (isWon) {
    badgeClass = isSlant ? "shadow-sm" : "bg-accent text-accent-foreground shadow-sm";
  } else {
    badgeClass = isSlant ? "bg-secondary border border-border" : "bg-secondary text-secondary-foreground border border-border";
  }

  const badgeStyle: React.CSSProperties = isWon && isSlant
    ? { backgroundColor: "var(--rose-gold)", color: "var(--rose-gold-foreground)" }
    : !isWon && isSlant
    ? { color: "var(--border)" }
    : {};

  const resolvedPeopleIds = peopleIds ?? [];
  const sectionsToShow = selectSections(context.sections, rpCategoryName, currentFilm, resolvedPeopleIds);
  if (sectionsToShow.length === 0) return null;

  const multiSection = sectionsToShow.length > 1;
  const isActing = isActingCategory(rpCategoryName);
  const rpLower = rpCategoryName.toLowerCase();
  const isFilmGroup = rpLower.includes('film') || rpLower.includes('picture');

  function clearHoverOpenTimer() {
    if (hoverOpenTimer.current) { clearTimeout(hoverOpenTimer.current); hoverOpenTimer.current = null; }
  }
  function clearHoverCloseTimer() {
    if (hoverCloseTimer.current) { clearTimeout(hoverCloseTimer.current); hoverCloseTimer.current = null; }
  }

  function handleOpenChange(newOpen: boolean) {
    clearHoverOpenTimer();
    if (newOpen) {
      setOpen(true);
      setMode('click');
    } else if (mode === 'hover') {
      // Clicking the badge while hover-open upgrades to click mode
      setMode('click');
    } else {
      setOpen(false);
      setMode(null);
    }
  }

  function handleBadgeMouseEnter() {
    clearHoverCloseTimer();
    if (mode !== null) return;
    hoverOpenTimer.current = setTimeout(() => {
      setOpen(true);
      setMode('hover');
    }, 2000);
  }

  function handleBadgeMouseLeave() {
    clearHoverOpenTimer();
    if (mode === 'hover') {
      hoverCloseTimer.current = setTimeout(() => {
        setOpen(false);
        setMode(null);
      }, 100);
    }
  }

  function handlePopoverMouseEnter() {
    if (mode === 'hover') clearHoverCloseTimer();
  }

  function handlePopoverMouseLeave() {
    if (mode === 'hover') {
      setOpen(false);
      setMode(null);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <span
          className={`inline-flex items-center justify-center text-[8px] font-bold rounded px-1 h-3.5 cursor-pointer transition-all hover:scale-110 hover:shadow-sm ${badgeClass}`}
          style={badgeStyle}
          onMouseEnter={handleBadgeMouseEnter}
          onMouseLeave={handleBadgeMouseLeave}
        >
          {labels[award]}
        </span>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-0 bg-card border-border shadow-xl"
        align="start"
        sideOffset={4}
        onMouseEnter={handlePopoverMouseEnter}
        onMouseLeave={handlePopoverMouseLeave}
      >
        {/* Org header */}
        <div className="px-3 py-2 border-b border-border bg-muted/30">
          <div className="text-xs font-semibold text-foreground">{context.orgDisplayName}</div>
          <div className="text-[10px] text-muted-foreground">
            {sectionsToShow.map(s => {
              const label = s.categoryName;
              return s.year ? `${label} (${s.year})` : label;
            }).join(' · ')}
          </div>
        </div>

        {/* Sections */}
        <div className="max-h-80 overflow-y-auto">
          {sectionsToShow.map((section, si) => {
            const winnerCount = section.nominees.filter(n => n.isWinner).length;
            const isTie = winnerCount > 1;
            return (
              <div key={si}>
                {/* Section header — shown when multiple sections present */}
                {multiSection && (
                  <div className={`px-3 pt-2 pb-1 ${si > 0 ? 'border-t border-border/40 mt-1' : ''}`}>
                    <span className="text-[10px] text-muted-foreground/80 italic">
                      {section.categoryName}{section.year ? ` (${section.year})` : ''}
                    </span>
                  </div>
                )}

                {/* Nominees */}
                <div className={multiSection ? 'pb-1' : 'py-1.5'}>
                  {section.nominees.map((nominee, i) => {
                    const isCurrentPerson = resolvedPeopleIds.length > 0 && isActing
                      ? nominee.personIds.some(id => resolvedPeopleIds.includes(id))
                      : false;
                    const isCurrentFilm = !isActing && currentFilm
                      ? nominee.film.toLowerCase() === currentFilm.toLowerCase()
                      : false;
                    const highlight = isCurrentPerson || isCurrentFilm || (isTie && nominee.isWinner);

                    return (
                      <div
                        key={i}
                        className={`flex items-center gap-2 px-3 py-1.5 ${highlight ? 'bg-accent/10' : ''}`}
                      >
                        {/* Win / nominee indicator */}
                        <div className="w-4 flex-shrink-0 flex items-center justify-center">
                          {nominee.isWinner ? (
                            <Trophy className="w-3 h-3 text-accent" />
                          ) : (
                            <Circle className="w-1.5 h-1.5 text-muted-foreground/40" fill="currentColor" />
                          )}
                        </div>

                        {/* Name + film */}
                        <div className="flex-1 min-w-0">
                          {isFilmGroup ? (
                            <>
                              {nominee.filmId ? (
                                <Link href={`/film/${nominee.filmId}`} className={`text-xs leading-snug hover:underline ${nominee.isWinner ? 'font-semibold text-foreground' : 'text-foreground/80'} ${highlight ? 'text-accent' : ''}`}>
                                  {nominee.film}
                                </Link>
                              ) : (
                                <span className={`text-xs leading-snug ${nominee.isWinner ? 'font-semibold text-foreground' : 'text-foreground/80'} ${highlight ? 'text-accent' : ''}`}>
                                  {nominee.film}
                                </span>
                              )}
                              {nominee.displayName !== nominee.film && (
                                <span className="text-[10px] text-muted-foreground ml-1 italic">
                                  {nominee.displayName}
                                </span>
                              )}
                            </>
                          ) : (
                            <>
                              {nominee.personIds.length === 1 ? (
                                <Link href={`/person/${nominee.personIds[0]}`} className={`text-xs leading-snug hover:underline ${nominee.isWinner ? 'font-semibold text-foreground' : 'text-foreground/80'} ${highlight ? 'text-accent' : ''}`}>
                                  {nominee.displayName}
                                </Link>
                              ) : (
                                <span className={`text-xs leading-snug ${nominee.isWinner ? 'font-semibold text-foreground' : 'text-foreground/80'} ${highlight ? 'text-accent' : ''}`}>
                                  {nominee.displayName}
                                </span>
                              )}
                              {nominee.displayName !== nominee.film && nominee.filmId && (
                                <Link href={`/film/${nominee.filmId}`} className="text-[10px] text-muted-foreground ml-1 italic hover:underline hover:text-foreground/70">
                                  {nominee.film}
                                </Link>
                              )}
                              {nominee.displayName !== nominee.film && !nominee.filmId && (
                                <span className="text-[10px] text-muted-foreground ml-1 italic">
                                  {nominee.film}
                                </span>
                              )}
                            </>
                          )}
                        </div>

                        {/* Status label */}
                        <div className="flex-shrink-0 text-right">
                          {nominee.isWinner && (
                            <span className="text-[9px] font-medium text-accent">{isTie ? 'WON (TIE)' : 'WON'}</span>
                          )}
                          {highlight && !nominee.isWinner && (
                            <span className="text-[9px] font-medium text-muted-foreground">THIS</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Rich Picks hex badge with popover ───────────────────────────────────────

export function RichPicksHexBadge({
  isWon,
  rpContext,
  categoryName,
  currentFilm,
  peopleIds,
}: {
  isWon: boolean;
  rpContext?: AwardPopoverContext | null;
  categoryName: string;
  currentFilm?: string;
  peopleIds?: number[];
}) {
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<'click' | 'hover' | null>(null);
  const hoverOpenTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverCloseTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (hoverOpenTimer.current) clearTimeout(hoverOpenTimer.current);
      if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
    };
  }, []);

  const isActing = categoryName.toLowerCase().includes('actor') || categoryName.toLowerCase().includes('actress');
  const isFilmGroup = categoryName.toLowerCase().includes('film') || categoryName.toLowerCase().includes('picture');
  const resolvedPeopleIds = peopleIds ?? [];
  const section = rpContext?.sections[0];

  const hexBadge = isWon ? (
    <div className="w-6 h-7 clip-hexagon bg-accent flex items-center justify-center shadow-[0_0_10px_rgba(212,175,55,0.3)]">
      <span className="font-serif font-bold text-xs text-accent-foreground">R</span>
    </div>
  ) : (
    <div className="w-6 h-7 clip-hexagon bg-border flex items-center justify-center">
      <div className="clip-hexagon bg-secondary flex items-center justify-center" style={{ width: "calc(100% - 2px)", height: "calc(100% - 2px)" }}>
        <span className="font-serif font-bold text-xs text-muted-foreground/80">R</span>
      </div>
    </div>
  );

  if (!rpContext || !section) return hexBadge;

  function clearHoverOpenTimer() {
    if (hoverOpenTimer.current) { clearTimeout(hoverOpenTimer.current); hoverOpenTimer.current = null; }
  }
  function clearHoverCloseTimer() {
    if (hoverCloseTimer.current) { clearTimeout(hoverCloseTimer.current); hoverCloseTimer.current = null; }
  }

  function handleOpenChange(newOpen: boolean) {
    clearHoverOpenTimer();
    if (newOpen) {
      setOpen(true);
      setMode('click');
    } else if (mode === 'hover') {
      setMode('click');
    } else {
      setOpen(false);
      setMode(null);
    }
  }

  function handleBadgeMouseEnter() {
    clearHoverCloseTimer();
    if (mode !== null) return;
    hoverOpenTimer.current = setTimeout(() => {
      setOpen(true);
      setMode('hover');
    }, 2000);
  }

  function handleBadgeMouseLeave() {
    clearHoverOpenTimer();
    if (mode === 'hover') {
      hoverCloseTimer.current = setTimeout(() => {
        setOpen(false);
        setMode(null);
      }, 100);
    }
  }

  function handlePopoverMouseEnter() {
    if (mode === 'hover') clearHoverCloseTimer();
  }

  function handlePopoverMouseLeave() {
    if (mode === 'hover') {
      setOpen(false);
      setMode(null);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          className="cursor-pointer hover:scale-110 transition-transform focus:outline-none"
          onMouseEnter={handleBadgeMouseEnter}
          onMouseLeave={handleBadgeMouseLeave}
        >
          {hexBadge}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-0 bg-card border-border shadow-xl"
        align="end"
        sideOffset={4}
        onMouseEnter={handlePopoverMouseEnter}
        onMouseLeave={handlePopoverMouseLeave}
      >
        <div className="px-3 py-2 border-b border-border bg-muted/30">
          <div className="text-xs font-semibold text-foreground">{rpContext.orgDisplayName}</div>
          <div className="text-[10px] text-muted-foreground">{section.categoryName}</div>
        </div>
        <div className="max-h-80 overflow-y-auto py-1.5">
          {(() => {
            const winnerCount = section.nominees.filter(n => n.isWinner).length;
            const isTie = winnerCount > 1;
            return section.nominees.map((nominee, i) => {
            const isCurrentPerson = resolvedPeopleIds.length > 0 && isActing
              ? nominee.personIds.some(id => resolvedPeopleIds.includes(id))
              : false;
            const isCurrentFilm = !isActing && currentFilm
              ? nominee.film.toLowerCase() === currentFilm.toLowerCase()
              : false;
            const highlight = isCurrentPerson || isCurrentFilm;

            return (
              <div key={i} className={`flex items-center gap-2 px-3 py-1.5 ${highlight ? 'bg-accent/10' : ''}`}>
                <div className="w-4 flex-shrink-0 flex items-center justify-center">
                  {nominee.isWinner ? (
                    <Trophy className="w-3 h-3 text-accent" />
                  ) : (
                    <Circle className="w-1.5 h-1.5 text-muted-foreground/40" fill="currentColor" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {isFilmGroup ? (
                    nominee.filmId ? (
                      <Link href={`/film/${nominee.filmId}`} className={`text-xs leading-snug hover:underline ${nominee.isWinner ? 'font-semibold text-foreground' : 'text-foreground/80'} ${highlight ? 'text-accent' : ''}`}>
                        {nominee.film}
                      </Link>
                    ) : (
                      <span className={`text-xs leading-snug ${nominee.isWinner ? 'font-semibold text-foreground' : 'text-foreground/80'} ${highlight ? 'text-accent' : ''}`}>
                        {nominee.film}
                      </span>
                    )
                  ) : (
                    <>
                      {nominee.personIds.length === 1 ? (
                        <Link href={`/person/${nominee.personIds[0]}`} className={`text-xs leading-snug hover:underline ${nominee.isWinner ? 'font-semibold text-foreground' : 'text-foreground/80'} ${highlight ? 'text-accent' : ''}`}>
                          {nominee.displayName}
                        </Link>
                      ) : (
                        <span className={`text-xs leading-snug ${nominee.isWinner ? 'font-semibold text-foreground' : 'text-foreground/80'} ${highlight ? 'text-accent' : ''}`}>
                          {nominee.displayName}
                        </span>
                      )}
                      {nominee.displayName !== nominee.film && nominee.filmId && (
                        <Link href={`/film/${nominee.filmId}`} className="text-[10px] text-muted-foreground ml-1 italic hover:underline hover:text-foreground/70">
                          {nominee.film}
                        </Link>
                      )}
                      {nominee.displayName !== nominee.film && !nominee.filmId && (
                        <span className="text-[10px] text-muted-foreground ml-1 italic">{nominee.film}</span>
                      )}
                    </>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  {nominee.isWinner && <span className="text-[9px] font-medium text-accent">{isTie ? 'WON (TIE)' : 'WON'}</span>}
                  {highlight && !nominee.isWinner && <span className="text-[9px] font-medium text-muted-foreground">THIS</span>}
                </div>
              </div>
            );
          });
          })()}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Public row component ─────────────────────────────────────────────────────

export function OtherAwardsRow({
  awards,
  categoryName,
  categoryGroup,
  awardContexts,
  currentFilm,
  peopleIds,
}: {
  awards?: OtherAwards;
  categoryName: string;
  categoryGroup: string;
  awardContexts?: Record<string, AwardPopoverContext>;
  currentFilm?: string;
  peopleIds?: number[];
}) {
  if (!awards) return null;

  const universal = ["oscar", "globe", "nbr", "bafta", "spirit"];
  const specifics: string[] = [];
  const lower = categoryName.toLowerCase();

  if (categoryGroup === "acting" || lower.includes("actor") || lower.includes("actress") || lower.includes("performance")) specifics.push("sag");
  if (categoryGroup === "directing" || lower.includes("directing") || lower.includes("director")) specifics.push("dga");
  if (categoryGroup === "film" || lower.includes("picture") || lower.includes("film") || lower.includes("animated")) specifics.push("pga");
  if (categoryGroup === "film") specifics.push("sag"); // SAG "Cast In A Motion Picture" is an exact match for Live-Action Feature
  if (categoryGroup === "writing" || lower.includes("writing") || lower.includes("screenplay")) specifics.push("wga");
  if ((lower.includes("editing") || lower === "film editing") && !lower.includes("sound")) specifics.push("ace");
  if (lower.includes("production design") || lower.includes("art direction") || lower === "art direction") specifics.push("adg");
  if (lower.includes("cinematography")) specifics.push("asc");
  if (lower.includes("costume") || lower === "costuming") specifics.push("cdg");
  if (lower.includes("makeup") || lower.includes("hairstyling") || lower.includes("make-up")) specifics.push("muah");
  if (lower.includes("score") || lower.includes("song") || lower.includes("music") || lower === "original score" || lower === "original song") {
    specifics.push("scl");
    specifics.push("grammy");
  }
  if (lower.includes("effects") || lower === "effects") specifics.push("ves");
  if (lower.includes("animated")) specifics.push("annie");
  if (lower.includes("sound mixing") || lower === "sound mixing") specifics.push("cas");
  if (lower.includes("sound editing") || lower === "sound editing") specifics.push("mpse");

  const allowedKeys = ["rich", ...universal, ...specifics];
  const hasAnyAward = allowedKeys.some(k => awards[k as keyof OtherAwards]);
  if (!hasAnyAward) return null;

  return (
    <span className="inline-flex items-center gap-1 align-middle -translate-y-[1px]">
      {allowedKeys.map(key => {
        const status = awards[key as keyof OtherAwards] || null;
        if (!status) return null;
        const context = awardContexts?.[key];
        if (context && key !== "rich") {
          return (
            <AwardBadgeWithPopover
              key={key}
              award={key}
              status={status}
              context={context}
              rpCategoryName={categoryName}
              currentFilm={currentFilm}
              peopleIds={peopleIds}
            />
          );
        }
        return <AwardIcon key={key} award={key} status={status} />;
      })}
    </span>
  );
}
