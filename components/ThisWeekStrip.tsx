'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Ticket, Play, Tv, CalendarDays, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { AnticipationFilm } from '@/lib/awards';

type Kind = 'preview' | 'release' | 'streaming' | 'upcoming';
interface Card { film: AnticipationFilm; kind: Kind; date: string; label: string; action?: { href: string; text: string; icon: React.ElementType } }

const DAY = 86_400_000;
function todayInSF(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
}
function addDays(iso: string, n: number): string {
  return new Date(Date.parse(iso + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
}
function dayLabel(iso: string, today: string): string {
  if (iso === today) return 'Today';
  if (iso === addDays(today, 1)) return 'Tomorrow';
  const d = new Date(iso + 'T00:00:00Z');
  const withinWeek = Math.abs(Date.parse(iso) - Date.parse(today)) < 7 * DAY;
  return d.toLocaleDateString('en-US', { timeZone: 'UTC', ...(withinWeek ? { weekday: 'short' } : { month: 'short', day: 'numeric' }) });
}

function weekRange(): string {
  const today = todayInSF();
  const fmt = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
  return `${fmt(today)} – ${fmt(addDays(today, 6))}`;
}

/** What's actionable this week: SF preview screenings, releases, and new streaming arrivals. */
function buildCards(films: AnticipationFilm[]): { cards: Card[]; filled: boolean } {
  const today = todayInSF();
  const weekEnd = addDays(today, 6);
  const weekAgo = addDays(today, -6);
  const cards: Card[] = [];
  const used = new Set<number>();

  for (const f of films) {
    const p = f.previews.find(p => p.screening_date >= today && p.screening_date <= weekEnd);
    if (p) {
      cards.push({ film: f, kind: 'preview', date: p.screening_date, label: `${p.event_name.replace(/^AMC /, '')} · ${dayLabel(p.screening_date, today)}`,
        action: { href: p.ticket_url, text: 'Tickets', icon: Ticket } });
      used.add(f.film_id);
    }
  }
  for (const f of films) {
    if (used.has(f.film_id) || !f.us_release_date) continue;
    if (f.us_release_date >= today && f.us_release_date <= weekEnd) {
      const where = f.release_venue && f.release_venue !== 'Theaters' ? `On ${f.release_venue}` : 'In theaters';
      cards.push({ film: f, kind: 'release', date: f.us_release_date, label: `${where} · ${dayLabel(f.us_release_date, today)}`,
        action: f.trailer_url ? { href: f.trailer_url, text: 'Trailer', icon: Play } : undefined });
      used.add(f.film_id);
    }
  }
  for (const f of films) {
    if (used.has(f.film_id) || !f.streaming_service || !f.streaming_date) continue;
    if (f.streaming_date >= weekAgo && f.streaming_date <= weekEnd) {
      const live = f.streaming_date <= today;
      cards.push({ film: f, kind: 'streaming', date: f.streaming_date,
        label: live ? `Now on ${f.streaming_service}` : `${f.streaming_service} · ${dayLabel(f.streaming_date, today)}`,
        action: live && f.streaming_url ? { href: f.streaming_url, text: 'Watch', icon: Tv } : (f.trailer_url ? { href: f.trailer_url, text: 'Trailer', icon: Play } : undefined) });
      used.add(f.film_id);
    }
  }
  cards.sort((a, b) => a.date.localeCompare(b.date));

  // Quiet week: top up with the next releases so the strip is never empty
  let filled = false;
  if (cards.length < 3) {
    const next = films
      .filter(f => !used.has(f.film_id) && f.us_release_date && f.us_release_date > weekEnd)
      .sort((a, b) => a.us_release_date!.localeCompare(b.us_release_date!))
      .slice(0, 4 - cards.length);
    for (const f of next) {
      cards.push({ film: f, kind: 'upcoming', date: f.us_release_date!, label: `Coming ${dayLabel(f.us_release_date!, today)}`,
        action: f.trailer_url ? { href: f.trailer_url, text: 'Trailer', icon: Play } : undefined });
      filled = true;
    }
  }
  return { cards, filled };
}

const KIND_STYLE: Record<Kind, { icon: React.ElementType; chip: string }> = {
  preview:   { icon: Ticket,       chip: 'bg-accent/15 text-accent border-accent/40' },
  release:   { icon: CalendarDays, chip: 'bg-secondary text-foreground/90 border-border' },
  streaming: { icon: Tv,           chip: 'bg-sky-500/10 text-sky-300 border-sky-500/30' },
  upcoming:  { icon: CalendarDays, chip: 'bg-secondary/60 text-muted-foreground border-border' },
};

export function ThisWeekStrip({ films, boardAnchor = '#anticipation-board' }: { films: AnticipationFilm[]; boardAnchor?: string }) {
  const { cards, filled } = useMemo(() => buildCards(films), [films]);
  const range = useMemo(() => weekRange(), []);
  const scroller = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ atStart: true, atEnd: true });

  // Track whether there's more to scroll in either direction (drives the arrow buttons)
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () => setEdges({ atStart: el.scrollLeft <= 4, atEnd: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', update); ro.disconnect(); };
  }, [cards.length]);

  const page = (dir: 1 | -1) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: dir * Math.max(232, el.clientWidth - 120), behavior: 'smooth' });
  };

  if (cards.length === 0) return null;

  return (
    <section aria-labelledby="this-week-heading" className="w-full min-w-0">
      <div className="flex items-end gap-3 mb-3">
        <div className="min-w-0">
          <h2 id="this-week-heading" className="font-serif text-xl font-semibold leading-tight">This week</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            <time>{range}</time>
            <span className="hidden sm:inline"> · {filled ? 'plus what’s next' : 'in theaters, streaming & preview screenings'}</span>
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <button onClick={() => page(-1)} disabled={edges.atStart} aria-label="Scroll back"
            className="hidden sm:inline-flex w-8 h-8 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 disabled:opacity-30 disabled:pointer-events-none">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => page(1)} disabled={edges.atEnd} aria-label="Scroll forward"
            className="hidden sm:inline-flex w-8 h-8 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 disabled:opacity-30 disabled:pointer-events-none">
            <ChevronRight className="w-4 h-4" />
          </button>
          <a href={boardAnchor} className="touch-target ml-2 inline-flex items-center gap-1 text-xs text-accent hover:underline whitespace-nowrap">
            Full board <ArrowDown className="w-3 h-3" />
          </a>
        </div>
      </div>
      <div className="relative">
        <ul ref={scroller} className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory scroll-px-6 lg:scroll-px-0 -mx-6 px-6 lg:mx-0 lg:px-0 pb-1">
        {cards.map(({ film, kind, label, action }) => {
          const style = KIND_STYLE[kind];
          const KindIcon = style.icon;
          const rich = film.pedigree.length > 0;
          return (
            <li key={`${kind}-${film.film_id}`} className="snap-start shrink-0 w-[220px] rounded-lg border border-border bg-card p-3 flex flex-col gap-2">
              <span className={`self-start inline-flex items-center gap-1 h-6 px-2 rounded-full border text-[11px] font-medium ${style.chip}`}>
                <KindIcon className="w-3 h-3" /> {label}
              </span>
              <Link href={`/film/${film.film_id}`} className="font-serif text-base font-semibold leading-snug text-foreground hover:text-accent line-clamp-2 min-h-[2.75rem]">
                {film.title}
              </Link>
              <div className="mt-auto flex items-center gap-2">
                {action && (
                  <a href={action.href} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 h-9 px-3 rounded-full border border-border text-xs text-muted-foreground hover:text-foreground hover:border-accent/50">
                    <action.icon className="w-3 h-3" fill={action.icon === Play ? 'currentColor' : 'none'} /> {action.text}
                  </a>
                )}
                {rich && (
                  <span title="Made by past Rich Picks nominees/winners" className={`ml-auto inline-flex items-center justify-center text-[10px] font-bold rounded px-1.5 h-5 ${film.pedigree.some(p => p.won) ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground border border-border'}`}>
                    RICH
                  </span>
                )}
              </div>
            </li>
          );
        })}
          {/* spacer so the last card can scroll fully into view past the edge fade */}
          <li aria-hidden className="shrink-0 w-px" />
        </ul>
        {!edges.atEnd && <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent" />}
        {!edges.atStart && <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-background to-transparent" />}
      </div>
    </section>
  );
}
