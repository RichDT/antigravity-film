'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { OtherAwardsRow, LinkedNamesList } from "@/components/award-icons";
import type { YearData, Nominee } from "@/lib/awards";

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

function NomineeRow({
  nominee,
  isWinner,
  isActing,
  categoryGroup,
  categoryName,
  awardContexts,
  hasRichPick = true,
}: {
  nominee: Nominee;
  isWinner: boolean;
  isActing: boolean;
  categoryGroup: string;
  categoryName: string;
  awardContexts?: Record<string, any>;
  hasRichPick?: boolean;
}) {
  const preposition = isActing ? "in" : "for";
  const showFilm = nominee.name !== nominee.film;

  let highlightText: React.ReactNode = nominee.name;
  let secondaryContent: React.ReactNode = null;

  if (categoryGroup === "film") {
    highlightText = nominee.film;
    if (nominee.contributors && nominee.contributors.length > 0) {
      const rolesMap = new Map<string, { id?: number; name: string }[]>();
      nominee.contributors.forEach(c => {
        const r = c.role || "Producer";
        if (!rolesMap.has(r)) rolesMap.set(r, []);
        rolesMap.get(r)!.push({ id: c.id, name: c.name });
      });
      secondaryContent = Array.from(rolesMap.entries()).map(([role, names]) => {
        const displayRole = (names.length > 1 && !role.includes('&') && !role.endsWith('s')) ? `${role}s` : role;
        return (
          <div key={role} className="text-xs text-muted-foreground leading-snug mt-0.5 group-hover:text-foreground/70 transition-colors">
            <span className="font-medium mr-1">{displayRole}:</span> <LinkedNamesList people={names} className="hover:text-accent hover:underline transition-colors" />
          </div>
        );
      });
    } else if (nominee.name && nominee.name !== nominee.film) {
      secondaryContent = <div className="text-xs text-muted-foreground leading-snug mt-0.5">{nominee.name}</div>;
    }
  } else if (categoryName === "Original Song") {
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
        const displayRole = (names.length > 1 && !role.includes('&') && !role.endsWith('s')) ? `${role}s` : role;
        return (
          <div key={role} className="text-xs text-muted-foreground leading-snug mt-0.5">
            <span className="font-medium mr-1">{displayRole}:</span> <LinkedNamesList people={names} className="hover:text-accent hover:underline transition-colors" />
          </div>
        );
      });
    } else if (nominee.name) {
      songCreators = <div className="text-xs text-muted-foreground leading-snug mt-0.5">{nominee.name}</div>;
    }

    secondaryContent = (
      <>
        <div className="text-xs text-muted-foreground leading-snug mt-0.5"><span className="italic">{nominee.film}</span></div>
        {songCreators}
      </>
    );
  } else if (categoryName === "Screenplay (Original)" || categoryName === "Screenplay (Adapted)") {
    const namesArray = nominee.contributors || [{ id: nominee.id, name: nominee.name, lastName: nominee.lastName, isInverted: nominee.isInverted }];
    highlightText = <LinkedNamesList people={namesArray} className="hover:text-accent hover:underline transition-colors" />;

    let writers: React.ReactNode = null;
    if (categoryName === "Screenplay (Original)" && nominee.contributors && nominee.contributors.length > 0) {
      const originalRolesMap = new Map<string, { id?: number; name: string }[]>();
      nominee.contributors.forEach(c => {
        const r = c.role || "Story & screenplay";
        if (!originalRolesMap.has(r)) originalRolesMap.set(r, []);
        originalRolesMap.get(r)!.push({ id: c.id, name: c.name });
      });

      if (originalRolesMap.size > 1) {
        writers = Array.from(originalRolesMap.entries()).map(([role, names]) => {
          return (
            <div key={role} className="text-xs text-muted-foreground leading-snug mt-0.5 group-hover:text-foreground/70 transition-colors">
              <span className="font-medium mr-1">{role}:</span> <LinkedNamesList people={names} className="hover:text-accent hover:underline transition-colors" />
            </div>
          );
        });
      }
    }

    let sourceStr: React.ReactNode = null;
    if (categoryName === "Screenplay (Adapted)" && nominee.adaptedSource) {
      sourceStr = <span className="text-muted-foreground/80"> based on {formatAdaptedSource(nominee.adaptedSource)}</span>;
    }

    secondaryContent = (
      <>
        <div className="text-xs text-muted-foreground leading-snug mt-0.5">
          <span className="italic">{nominee.film}</span>{sourceStr}
        </div>
        {writers}
      </>
    );
  } else if (categoryName === "Production Design" || categoryName === "Art Direction") {
    const namesArray = nominee.contributors || [{ id: nominee.id, name: nominee.name, lastName: nominee.lastName, isInverted: nominee.isInverted }];
    highlightText = <LinkedNamesList people={namesArray} className="hover:text-accent hover:underline transition-colors" />;

    let designers: React.ReactNode = null;
    if (nominee.contributors && nominee.contributors.length > 0) {
      const pd: { id?: number; name: string }[] = [];
      const sd: { id?: number; name: string }[] = [];
      nominee.contributors.forEach(c => {
        const r = c.role?.toLowerCase() || "";
        if (r.includes("set")) sd.push({ id: c.id, name: c.name });
        else pd.push({ id: c.id, name: c.name });
      });

      designers = (
        <>
          {pd.length > 0 && (
            <div className="text-xs text-muted-foreground leading-snug mt-0.5 group-hover:text-foreground/70 transition-colors">
              <span className="font-medium mr-1">Production design:</span> <LinkedNamesList people={pd} className="hover:text-accent hover:underline transition-colors" />
            </div>
          )}
          {sd.length > 0 && (
            <div className="text-xs text-muted-foreground leading-snug mt-0.5 group-hover:text-foreground/70 transition-colors">
              <span className="font-medium mr-1">Set decoration:</span> <LinkedNamesList people={sd} className="hover:text-accent hover:underline transition-colors" />
            </div>
          )}
        </>
      );
    }

    secondaryContent = (
      <>
        <div className="text-xs text-muted-foreground leading-snug mt-0.5"><span className="italic">{nominee.film}</span></div>
        {designers || (
          nominee.role && <div className="text-xs text-muted-foreground leading-snug mt-0.5">· {nominee.role}</div>
        )}
      </>
    );
  } else {
    const namesArray = nominee.contributors || [{ id: nominee.id, name: nominee.name, lastName: nominee.lastName, isInverted: nominee.isInverted }];
    highlightText = <LinkedNamesList people={namesArray} className="hover:text-accent hover:underline transition-colors" />;

    if (isActing && nominee.performances && nominee.performances.length > 1) {
      secondaryContent = (
        <div className="flex flex-col gap-0.5 mt-1">
          {nominee.performances.map((perf, idx) => (
            <div key={idx} className="text-xs text-muted-foreground leading-snug">
              as {perf.character} in{" "}
              <Link href={perf.film_id ? `/film/${perf.film_id}` : `/search?q=${encodeURIComponent(perf.film)}`} className="text-foreground/80 hover:text-accent hover:underline transition-colors">{perf.film}</Link>
            </div>
          ))}
        </div>
      );
    } else {
      if (isActing) {
        if (nominee.character || nominee.film) {
          secondaryContent = (
            <div className="text-xs text-muted-foreground leading-snug mt-0.5">
              {nominee.character && <>as {nominee.character} in{" "}</>}
              {nominee.film && (
                <Link href={nominee.film_id ? `/film/${nominee.film_id}` : `/search?q=${encodeURIComponent(nominee.film)}`} className="text-foreground/80 hover:text-accent hover:underline transition-colors">{nominee.film}</Link>
              )}
            </div>
          );
        }
      } else {
        let roleText = "";
        if (nominee.role) roleText = `· ${nominee.role}`;
        const combinedStr = `${roleText} ${showFilm ? nominee.film : ""}`.trim();
        if (combinedStr) {
          secondaryContent = <div className="text-xs text-muted-foreground leading-snug mt-0.5">{combinedStr}</div>;
        }
      }
    }
  }

  // Suppress unused variable warning for preposition
  void preposition;

  return (
    <div className={`flex items-start gap-2 py-1.5 px-2 -mx-2 rounded transition-colors group ${
      isWinner && hasRichPick ? "bg-accent/10 hover:bg-accent/20" : "hover:bg-secondary/20"
    } ${!hasRichPick ? "opacity-60 hover:opacity-100 saturate-[0.6] hover:saturate-100" : ""}`}>
      {hasRichPick ? (
        isWinner ? (
          <div className="w-5 h-6 clip-hexagon bg-accent flex items-center justify-center flex-shrink-0 mt-0.5 shadow-[0_0_8px_rgba(212,175,55,0.4)]">
            <span className="font-serif font-bold text-[11px] text-accent-foreground">R</span>
          </div>
        ) : (
          <div className="w-5 h-6 clip-hexagon bg-border flex items-center justify-center flex-shrink-0 mt-0.5">
            <div className="clip-hexagon bg-secondary flex items-center justify-center" style={{ width: "calc(100% - 2px)", height: "calc(100% - 2px)" }}>
              <span className="font-serif font-bold text-[11px] text-muted-foreground/80">R</span>
            </div>
          </div>
        )
      ) : (
        <div className="w-5 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">
          <div className="w-1.5 h-1.5 rounded-full bg-border flex-shrink-0" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center flex-wrap gap-x-2">
          <span className={`text-sm ${isWinner && hasRichPick ? "font-semibold text-foreground drop-shadow-sm whitespace-nowrap" : "text-foreground/90 whitespace-nowrap"}`}>
            {typeof highlightText === 'string' && !isActing && nominee.film ? (
              <Link href={nominee.film_id ? `/film/${nominee.film_id}` : `/search?q=${encodeURIComponent(nominee.film)}`} className="hover:text-accent hover:underline transition-colors">{highlightText}</Link>
            ) : highlightText}
          </span>
          <OtherAwardsRow
            awards={nominee.otherOtherAwards}
            categoryName={categoryName}
            categoryGroup={categoryGroup}
            awardContexts={awardContexts}
            currentFilm={nominee.film}
            peopleIds={nominee.contributors?.map(c => c.id).filter((id): id is number => id != null) ?? (nominee.id != null ? [nominee.id] : [])}
          />
        </div>

        {secondaryContent && (
          <div className="flex flex-col">
            {secondaryContent}
          </div>
        )}
      </div>
    </div>
  );
}

function YearBlock({
  yearData,
  isActing,
  index,
  categoryGroup,
  categoryName,
  showGuildNominees,
}: {
  yearData: YearData;
  isActing: boolean;
  index: number;
  categoryGroup: string;
  categoryName: string;
  showGuildNominees: boolean;
}) {
  const guildNominees = showGuildNominees ? (yearData.guildOnlyNominees ?? []) : [];

  return (
    <div className="relative animate-in slide-in-from-bottom-4 fade-in duration-500" style={{ animationFillMode: "both", animationDelay: `${index * 50}ms` }}>
      <div className="flex items-center gap-3 mb-2">
        <Link
          href={`/year/${yearData.year}`}
          className="font-serif text-lg font-semibold text-muted-foreground hover:text-accent transition-colors"
        >
          {yearData.year}
        </Link>
        <div className="h-px flex-1 bg-gradient-to-r from-border/50 to-transparent" />
      </div>

      <div className="pl-4 border-l-2 border-accent/30 space-y-0.5 pb-6">
        {yearData.winner && (
          <NomineeRow
            nominee={yearData.winner}
            isWinner={true}
            isActing={isActing}
            categoryGroup={categoryGroup}
            categoryName={categoryName}
            awardContexts={yearData.awardContexts}
            hasRichPick={true}
          />
        )}
        {yearData.nominees.map((nominee, i) => (
          <NomineeRow
            key={i}
            nominee={nominee}
            isWinner={false}
            isActing={isActing}
            categoryGroup={categoryGroup}
            categoryName={categoryName}
            awardContexts={yearData.awardContexts}
            hasRichPick={true}
          />
        ))}
        {guildNominees.map((nominee, i) => (
          <NomineeRow
            key={`guild-${i}`}
            nominee={nominee}
            isWinner={false}
            isActing={isActing}
            categoryGroup={categoryGroup}
            categoryName={categoryName}
            awardContexts={yearData.awardContexts}
            hasRichPick={false}
          />
        ))}
      </div>
    </div>
  );
}

export function CategoryTimeline({
  years,
  isActing,
  categoryGroup,
  categoryName,
}: {
  years: YearData[];
  isActing: boolean;
  categoryGroup: string;
  categoryName: string;
}) {
  const [showOnlyRichPicks, setShowOnlyRichPicks] = useState(false);

  const hasAnyGuildNominees = years.some(y => y.guildOnlyNominees && y.guildOnlyNominees.length > 0);

  return (
    <div>
      {hasAnyGuildNominees && (
        <div className="flex items-center justify-end mb-6">
          <label className="flex items-center gap-2 cursor-pointer group">
            <span className={`text-sm font-medium transition-colors ${showOnlyRichPicks ? 'text-muted-foreground' : 'text-foreground'}`}>All Guilds</span>
            <div className="relative inline-flex items-center h-6 rounded-full w-11 bg-secondary border border-border shadow-inner transition-colors focus-within:ring-2 focus-within:ring-accent/50">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={showOnlyRichPicks}
                onChange={(e) => setShowOnlyRichPicks(e.target.checked)}
              />
              <span className={`inline-block w-4 h-4 transform bg-accent rounded-full transition-transform duration-200 ease-in-out ${showOnlyRichPicks ? 'translate-x-6' : 'translate-x-1'}`} />
            </div>
            <span className={`text-sm font-medium transition-colors ${showOnlyRichPicks ? 'text-foreground' : 'text-muted-foreground'}`}>Rich Picks Only</span>
          </label>
        </div>
      )}

      {years.length === 0 ? (
        <div className="text-muted-foreground text-center py-20 italic">No historical data recorded for this category.</div>
      ) : (
        <div className="space-y-2">
          {years.map((yearData, index) => (
            <YearBlock
              key={yearData.year}
              yearData={yearData}
              isActing={isActing}
              index={index}
              categoryGroup={categoryGroup}
              categoryName={categoryName}
              showGuildNominees={!showOnlyRichPicks}
            />
          ))}
        </div>
      )}
    </div>
  );
}
