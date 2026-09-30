'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { UnseenFilm } from '@/lib/unseen-films';
import { AddUnseenFilm } from '@/components/add-unseen-film';

export function UnseenFilmsTable({ films, year }: { films: UnseenFilm[]; year: number }) {
  const [expanded, setExpanded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setIsAdmin(!!data.session?.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setIsAdmin(!!session?.user));
    return () => sub.subscription.unsubscribe();
  }, []);

  const unseenCount = films.filter(f => f.status === 'unseen').length;
  const lateCount = films.filter(f => f.status === 'reviewed_late').length;
  const totalDisplay = films.length;

  if (totalDisplay === 0 && !isAdmin) return null;

  return (
    <div className="mt-5">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-card border border-border hover:border-border/80 hover:bg-card/80 transition-colors group"
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
