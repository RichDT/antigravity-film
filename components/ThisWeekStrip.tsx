'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Ticket, Play, Tv, CalendarDays, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { AnticipationFilm } from '@/lib/awards';
import { FilmStatusIcons } from '@/components/community/FilmStatusControls';
import { PedigreeBadge } from '@/components/AnticipationBoard';

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

// Where and when, as a plain line (the same treatment as the Still to see list) — not a chip, since it isn't a control
const KIND_STYLE: Record<Kind, { icon: React.ElementType; tone: string }> = {
  preview:   { icon: Ticket,       tone: 'text-accent' },
  release:   { icon: CalendarDays, tone: 'text-foreground/80' },
  streaming: { icon: Tv,           tone: 'text-sky-300' },
  upcoming:  { icon: CalendarDays, tone: 'text-muted-foreground' },
};

export function ThisWeekStrip({ films, boardAnchor = '#anticipation-board', boardLabel = 'Full board' }: { films: AnticipationFilm[]; boardAnchor?: string; boardLabel?: string }) {
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

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let lock = 0;
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;           // trackpad sideways swipes scroll natively
      const dir = e.deltaY > 0 ? 1 : -1;
      const atEdge = dir > 0 ? el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 : el.scrollLeft <= 4;
      if (atEdge) return;                                               // let the page scroll past the strip
      e.preventDefault();
      if (Date.now() < lock) return;
      lock = Date.now() + 280;
      const card = (el.querySelector('li') as HTMLElement | null)?.offsetWidth ?? 220;
      el.scrollBy({ left: dir * (card + 12), behavior: 'smooth' });     // one card per notch, so snapping can't pull it back
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [cards.length]);

  const page = (dir: 1 | -1) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: dir * Math.max(232, el.clientWidth - 120), behavior: 'smooth' });
  };

  if (cards.length === 0) return null;

  return (
    <section aria-labelledby="this-week-heading" className="w-full min-w-0">
      <div className="flex items-end gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <h2 id="this-week-heading" className="font-serif text-xl font-semibold leading-tight whitespace-nowrap">Opening this week</h2>
          {/* on phones the season link shares the date line, so the title keeps the full width */}
          <div className="mt-0.5 flex items-baseline gap-3">
            <p className="text-xs text-muted-foreground min-w-0">
              <time>{range}</time>
              <span className="hidden sm:inline"> · {filled ? 'plus what’s next' : 'in theaters, streaming & preview screenings'}</span>
            </p>
            <span className="sm:hidden ml-auto shrink-0"><a href={boardAnchor} className="touch-target inline-flex items-center gap-1 text-xs text-accent hover:underline whitespace-nowrap">
            {boardLabel} {boardAnchor.startsWith('#') ? <ArrowDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </a></span>
          </div>
        </div>
        <div className="hidden sm:flex ml-auto items-center gap-1 shrink-0">
          <button onClick={() => page(-1)} disabled={edges.atStart} aria-label="Scroll back"
            className="inline-flex w-8 h-8 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 disabled:opacity-30 disabled:pointer-events-none">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => page(1)} disabled={edges.atEnd} aria-label="Scroll forward"
            className="inline-flex w-8 h-8 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 disabled:opacity-30 disabled:pointer-events-none">
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="ml-2"><a href={boardAnchor} className="touch-target inline-flex items-center gap-1 text-xs text-accent hover:underline whitespace-nowrap">
            {boardLabel} {boardAnchor.startsWith('#') ? <ArrowDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </a></span>
        </div>
      </div>
      <div className="relative">
        <ul ref={scroller} className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory scroll-px-6 lg:scroll-px-0 -mx-6 px-6 lg:mx-0 lg:px-0 pb-1">
        {cards.map(({ film, kind, label, action }) => {
          const style = KIND_STYLE[kind];
          const KindIcon = style.icon;
          const rich = film.pedigree.length > 0;
          return (
            <li key={`${kind}-${film.film_id}`} className="snap-start shrink-0 w-[220px] rounded-lg border border-border bg-card p-3 flex flex-col">
              <div className="flex items-start gap-2">
                <Link href={`/film/${film.film_id}`} className="flex-1 min-w-0 font-serif text-base font-semibold leading-snug text-foreground hover:text-accent line-clamp-2">
                  {film.title}
                </Link>
                {rich && <span className="mt-0.5 shrink-0"><PedigreeBadge pedigree={film.pedigree} size="md" /></span>}
              </div>
              {kind === 'streaming' && film.streaming_url ? (
                <a href={film.streaming_url} target="_blank" rel="noopener noreferrer" className={`mt-1 flex items-center gap-1.5 text-[11px] hover:underline ${style.tone}`}>
                  <KindIcon className="w-3 h-3 shrink-0" /><span className="truncate">{label}</span>
                </a>
              ) : (
                <p className={`mt-1 flex items-center gap-1.5 text-[11px] ${style.tone}`}>
                  <KindIcon className="w-3 h-3 shrink-0" /><span className="truncate">{label}</span>
                </p>
              )}
              <div className="mt-auto pt-3 flex items-center gap-2">
                {action && (
                  <a href={action.href} target="_blank" rel="noopener noreferrer"
                    className="touch-target inline-flex items-center gap-1 h-8 px-3 rounded-full border border-border text-xs text-muted-foreground hover:text-foreground hover:border-accent/50">
                    <action.icon className="w-3 h-3" fill={action.icon === Play ? 'currentColor' : 'none'} /> {action.text}
                  </a>
                )}
                <FilmStatusIcons filmId={film.film_id} title={film.title} className="ml-auto -mr-1" />
              </div>
            </li>
          );
        })}
          {/* spacer so the last card can scroll fully into view past the edge fade */}
          <li aria-hidden className="shrink-0 w-px" />
        </ul>
        {!edges.atEnd && <div className="pointer-events-none absolute inset-y-0 -right-6 lg:right-0 w-10 bg-gradient-to-l from-background to-transparent" />}
        {!edges.atStart && <div className="pointer-events-none absolute inset-y-0 -left-6 lg:left-0 w-10 bg-gradient-to-r from-background to-transparent" />}
      </div>
    </section>
  );
}
