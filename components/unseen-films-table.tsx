'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { EyeOff, ChevronDown, ChevronUp, Play } from 'lucide-react';
import { useAuthStatus } from '@/lib/use-auth-status';
import type { UnseenFilm } from '@/lib/unseen-films';
import { AddUnseenFilm } from '@/components/add-unseen-film';
import { FestivalBadge, ReleaseLine, groupBySource } from '@/components/AnticipationBoard';

export function UnseenFilmsTable({ films, year }: { films: UnseenFilm[]; year: number }) {
  const [expanded, setExpanded] = useState(false);
  const { isAdmin } = useAuthStatus();


  const unseenCount = films.filter(f => f.status === 'unseen').length;
  const lateCount = films.filter(f => f.status === 'reviewed_late').length;
  const totalDisplay = films.length;

  if (totalDisplay === 0 && !isAdmin) return null;

  return (
    <div className="mt-5">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between gap-2 py-2 max-sm:py-3 px-3 rounded-lg bg-card border border-border hover:border-border/80 hover:bg-card/80 transition-colors group"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
          <EyeOff className="w-3.5 h-3.5 shrink-0" />
          Films Not Screened
          {totalDisplay > 0 && (
            <span className="text-xs text-muted-foreground/70 font-normal">
              ({unseenCount} unseen{lateCount > 0 ? `, ${lateCount} late` : ''})
            </span>
          )}
        </span>
        {expanded
          ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
      </button>

      {expanded && (
        <div className="mt-2 rounded-lg border border-border bg-card overflow-hidden">
          <p className="px-3 pt-3 pb-1 text-[11px] text-muted-foreground/70 italic leading-snug">
            Live-action, animated, and international features only. Tracked from 2021 onward.
            Films reviewed within 3 years are removed; later reviews are noted but this year&apos;s
            awards remain permanent.
          </p>

          {films.length === 0 ? (
            <p className="px-3 py-4 text-xs text-muted-foreground italic">No films on record for this year.</p>
          ) : (
            <ul className="divide-y divide-border/40">
              {films.map(film => (
                <li key={film.film_id} className="flex items-start gap-2 px-3 py-2">
                  {film.status === 'reviewed_late' ? (
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-muted-foreground line-through leading-snug">
                        {film.title}
                      </span>
                      <span className="block text-[10px] text-muted-foreground/60 italic mt-0.5">
                        reviewed {film.review_year}; not considered for this year&apos;s awards (frozen)
                      </span>
                    </div>
                  ) : film.details ? (
                    // 2026 on: keep the board's trailer, festival badges and release/streaming dates
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <Link href={`/film/${film.film_id}`} className="touch-target text-sm text-foreground/80 hover:text-accent transition-colors leading-snug">
                          {film.title}
                        </Link>
                        {film.details.trailer_url && (
                          <a href={film.details.trailer_url} target="_blank" rel="noopener noreferrer"
                            className="relative inline-flex items-center gap-1 h-7 px-2.5 rounded-full border border-border bg-background/40 text-xs text-muted-foreground hover:text-accent hover:border-accent/50 transition-colors touch-target sm:h-auto sm:px-0 sm:gap-0.5 sm:rounded-none sm:border-0 sm:bg-transparent sm:text-[10px]"
                            title={`Watch the official trailer for ${film.title} on YouTube`} aria-label={`Watch the official trailer for ${film.title}`}>
                            <Play className="w-2.5 h-2.5 sm:w-2 sm:h-2 self-center" fill="currentColor" />
                            Trailer
                          </a>
                        )}
                        {film.details.accolades.length > 0 && (
                          <div className="flex items-center gap-1 max-sm:gap-1.5 flex-wrap">
                            {Object.entries(groupBySource(film.details.accolades)).map(([source, accs]) => (
                              <FestivalBadge key={source} source={source} accolades={accs} />
                            ))}
                          </div>
                        )}
                      </div>
                      {(film.details.us_release_date || film.details.streaming_service) && <ReleaseLine film={{ title: film.title, ...film.details }} />}
                    </div>
                  ) : (
                    <Link
                      href={`/film/${film.film_id}`}
                      className="flex-1 min-w-0 text-sm text-foreground/80 hover:text-accent transition-colors leading-snug truncate"
                    >
                      {film.title}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}

          {isAdmin && <AddUnseenFilm year={year} />}
        </div>
      )}
    </div>
  );
}
