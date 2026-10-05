'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Eye, Bookmark, BookmarkCheck, CheckCircle2, Circle, CalendarPlus, MessageSquare, Trophy,
  ChevronDown, ChevronUp, Play, Users, FlaskConical,
} from 'lucide-react';
import { getGradeColor } from '@/components/grade-hex';

export interface DemoFilm {
  film_id: number;
  title: string;
  us_release_date: string | null;
  release_venue: string | null;
  trailer_url: string | null;
}
export interface DemoReviewed { film_id: number; title: string; grade: string }

// ─── Mock data (deterministic per film so it's stable across reloads) ─────────

const GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'];
const COMMENT_MAX = 280;

function seeded(n: number) {
  let x = n * 2654435761 % 2 ** 32;
  return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 2 ** 32; };
}

function mockAnticipating(id: number) { return 8 + Math.floor(seeded(id)() * 320); }

function mockRatings(id: number): number[] {
  const r = seeded(id + 7);
  const center = 1 + Math.floor(r() * 6);
  return Array.from({ length: 6 + Math.floor(r() * 40) }, () =>
    Math.min(GRADES.length - 1, Math.max(0, Math.round(center + (r() - 0.5) * 4))));
}

const HANDLES = ['filmfan_ella', 'reelmarcus', 'popcornpriya', 'twofeet_of_film', 'cinemadan', 'noirnadia', 'lateshowluis'];
const TEMPLATES = [
  'Trailer alone has me counting the days.', 'Festival buzz on this one is unreal.',
  'Cautiously optimistic — the director’s last film was a miss for me.', 'Could be the one to beat this year.',
  'Saw it at a festival. Bring tissues.', 'The cinematography in the trailer is gorgeous.',
];
function mockComments(id: number) {
  const r = seeded(id + 13);
  return Array.from({ length: Math.floor(r() * 4) }, (_, i) => ({
    id: `m${id}-${i}`, who: HANDLES[Math.floor(r() * HANDLES.length)], text: TEMPLATES[Math.floor(r() * TEMPLATES.length)],
    when: `${1 + Math.floor(r() * 9)}d ago`,
  }));
}

function avgGrade(idx: number[]): string | null {
  if (idx.length === 0) return null;
  return GRADES[Math.round(idx.reduce((a, b) => a + b, 0) / idx.length)];
}

// ─── Local "account" state, saved in this browser only ────────────────────────

interface DemoState {
  anticipating: number[];
  watchlist: number[];
  seen: number[];
  ratings: Record<number, string>;
  comments: Record<number, { id: string; text: string }[]>;
  picks: Record<string, number>;
}
const EMPTY: DemoState = { anticipating: [], watchlist: [], seen: [], ratings: {}, comments: {}, picks: {} };
const KEY = 'rp-community-demo-v1';

function useDemoState() {
  const [state, setState] = useState<DemoState>(EMPTY);
  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) setState({ ...EMPTY, ...JSON.parse(raw) }); } catch {}
  }, []);
  const update = (fn: (s: DemoState) => DemoState) => setState(prev => {
    const next = fn(prev);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
    return next;
  });
  return [state, update] as const;
}
const toggle = (list: number[], id: number) => list.includes(id) ? list.filter(x => x !== id) : [...list, id];

// ─── Small building blocks ────────────────────────────────────────────────────

function Hex({ grade, size = 'md', label }: { grade: string | null; size?: 'md' | 'lg'; label?: string }) {
  const dims = size === 'lg' ? 'w-9 h-10 text-xs' : 'w-7 h-8 text-[11px]';
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className={`${dims} clip-hexagon flex items-center justify-center font-bold ${grade ? getGradeColor(grade) : 'bg-muted text-muted-foreground'}`}>
        {grade ?? '–'}
      </div>
      {label && <span className="text-[10px] text-muted-foreground whitespace-nowrap">{label}</span>}
    </div>
  );
}

function Chip({ on, onClick, icon: Icon, onIcon: OnIcon, children, title }: {
  on: boolean; onClick: () => void; icon: React.ElementType; onIcon?: React.ElementType; children: React.ReactNode; title: string;
}) {
  const I = on && OnIcon ? OnIcon : Icon;
  return (
    <button
      onClick={onClick}
      title={title}
      aria-pressed={on}
      className={`inline-flex items-center gap-1.5 h-9 sm:h-8 px-3 rounded-full border text-xs font-medium transition-colors ${
        on ? 'bg-accent text-accent-foreground border-accent' : 'bg-background/40 border-border text-muted-foreground hover:text-foreground hover:border-foreground/40'
      }`}
    >
      <I className="w-3.5 h-3.5" />
      {children}
    </button>
  );
}

function GradePicker({ value, onChange }: { value?: string; onChange: (g: string | undefined) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {GRADES.map(g => (
        <button
          key={g}
          onClick={() => onChange(value === g ? undefined : g)}
          aria-pressed={value === g}
          className={`w-10 h-10 sm:w-9 sm:h-9 clip-hexagon flex items-center justify-center text-xs font-bold transition-transform hover:scale-110 ${
            value === g ? getGradeColor(g) + ' scale-110' : 'bg-secondary text-muted-foreground'
          }`}
        >
          {g}
        </button>
      ))}
    </div>
  );
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
}

function CalendarLinks({ film }: { film: DemoFilm }) {
  if (!film.us_release_date) return <p className="text-xs text-muted-foreground italic">Calendar links appear once a release date is announced.</p>;
  const ymd = film.us_release_date.replace(/-/g, '');
  const next = new Date(film.us_release_date + 'T00:00:00Z'); next.setUTCDate(next.getUTCDate() + 1);
  const ymdNext = next.toISOString().slice(0, 10).replace(/-/g, '');
  const what = `${film.title} — ${film.release_venue === 'Theaters' || !film.release_venue ? 'in theaters' : `on ${film.release_venue}`}`;
  const details = `Anticipated on Rich Picks. ${film.trailer_url ? `Trailer: ${film.trailer_url}` : ''}`;
  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(what)}&dates=${ymd}/${ymdNext}&details=${encodeURIComponent(details)}`;
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Rich Picks//Anticipation Board//EN', 'BEGIN:VEVENT',
    `UID:richpicks-${film.film_id}-${ymd}@richpicks`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART;VALUE=DATE:${ymd}`, `DTEND;VALUE=DATE:${ymdNext}`, `SUMMARY:${what.replace(/[,;]/g, '\\$&')}`,
    `DESCRIPTION:${details.replace(/[,;]/g, '\\$&')}`, 'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  return (
    <div className="flex flex-wrap gap-2">
      <a href={google} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40">
        <CalendarPlus className="w-3.5 h-3.5" /> Google Calendar
      </a>
      <a href={`data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`} download={`${film.title.replace(/[^\w]+/g, '-')}.ics`}
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40">
        <CalendarPlus className="w-3.5 h-3.5" /> Apple Calendar (.ics)
      </a>
    </div>
  );
}

function Comments({ filmId, state, update }: { filmId: number; state: DemoState; update: ReturnType<typeof useDemoState>[1] }) {
  const [draft, setDraft] = useState('');
  const mine = state.comments[filmId] ?? [];
  const all = [...mine.map(c => ({ ...c, who: 'you', when: 'just now' })), ...mockComments(filmId)];
  const left = COMMENT_MAX - draft.length;
  function post() {
    const text = draft.trim();
    if (!text || text.length > COMMENT_MAX) return;
    update(s => ({ ...s, comments: { ...s.comments, [filmId]: [{ id: `u${Date.now()}`, text }, ...(s.comments[filmId] ?? [])] } }));
    setDraft('');
  }
  return (
    <div>
      <div className="flex gap-2 items-start">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value.slice(0, COMMENT_MAX))}
          rows={2}
          maxLength={COMMENT_MAX}
          placeholder="Add a short take (280 characters max)…"
          className="flex-1 min-w-0 rounded-md bg-background border border-border px-2.5 py-2 text-base sm:text-sm focus:outline-none focus:border-accent/60 placeholder:text-muted-foreground/60"
        />
        <button onClick={post} disabled={!draft.trim()}
          className="h-10 px-3 rounded-md bg-accent text-accent-foreground text-xs font-semibold disabled:opacity-40">Post</button>
      </div>
      <p className={`mt-1 text-[11px] ${left < 20 ? 'text-orange-400' : 'text-muted-foreground'}`}>{left} characters left</p>
      <ul className="mt-2 space-y-2">
        {all.map(c => (
          <li key={c.id} className="text-sm leading-snug">
            <span className="font-medium text-foreground/90">@{c.who}</span>
            <span className="text-[11px] text-muted-foreground"> · {c.when}</span>
            <p className="text-foreground/80">{c.text}</p>
          </li>
        ))}
        {all.length === 0 && <li className="text-xs text-muted-foreground italic">No comments yet — be the first.</li>}
      </ul>
    </div>
  );
}

function RatingRow({ filmId, richGrade, state, update }: { filmId: number; richGrade: string | null; state: DemoState; update: ReturnType<typeof useDemoState>[1] }) {
  const mine = state.ratings[filmId];
  const pool = mockRatings(filmId);
  const community = avgGrade(mine ? [...pool, GRADES.indexOf(mine)] : pool);
  const n = pool.length + (mine ? 1 : 0);
  return (
    <div className="space-y-3">
      <div className="flex items-end gap-5">
        <Hex grade={richGrade} size="lg" label={richGrade ? "Rich" : "Rich: not yet"} />
        <Hex grade={community} size="lg" label={`Community · ${n}`} />
        <Hex grade={mine ?? null} size="lg" label="You" />
      </div>
      <GradePicker value={mine} onChange={g => update(s => {
        const ratings = { ...s.ratings };
        if (g) ratings[filmId] = g; else delete ratings[filmId];
        return { ...s, ratings };
      })} />
    </div>
  );
}

// ─── Film cards ───────────────────────────────────────────────────────────────

function AnticipatedCard({ film, state, update }: { film: DemoFilm; state: DemoState; update: ReturnType<typeof useDemoState>[1] }) {
  const [open, setOpen] = useState(false);
  const isAnt = state.anticipating.includes(film.film_id);
  const inList = state.watchlist.includes(film.film_id);
  const seen = state.seen.includes(film.film_id);
  const count = mockAnticipating(film.film_id) + (isAnt ? 1 : 0);
  return (
    <li className="px-3 py-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground leading-snug">{film.title}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {film.us_release_date ? formatDate(film.us_release_date) : 'Date TBA'}{film.release_venue ? ` · ${film.release_venue}` : ''}
            {film.trailer_url && <> · <a href={film.trailer_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:text-accent"><Play className="w-2.5 h-2.5" fill="currentColor" />Trailer</a></>}
          </p>
        </div>
        <button onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label={open ? 'Hide details' : 'Show details'}
          className="w-10 h-10 -mr-1 -mt-1 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Chip on={isAnt} onClick={() => update(s => ({ ...s, anticipating: toggle(s.anticipating, film.film_id) }))} icon={Eye} title="I'm anticipating this">
          Anticipating · {count}
        </Chip>
        <Chip on={inList} onClick={() => update(s => ({ ...s, watchlist: toggle(s.watchlist, film.film_id) }))} icon={Bookmark} onIcon={BookmarkCheck} title="Add to my watchlist">
          {inList ? 'On watchlist' : 'Watchlist'}
        </Chip>
        <Chip on={seen} onClick={() => update(s => ({ ...s, seen: toggle(s.seen, film.film_id) }))} icon={Circle} onIcon={CheckCircle2} title="I've seen it">
          {seen ? 'Seen it' : "I've seen it"}
        </Chip>
      </div>
      {open && (
        <div className="mt-3 rounded-lg border border-border bg-background/40 p-3 space-y-4">
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Your grade</h4>
            {seen
              ? <RatingRow filmId={film.film_id} richGrade={null} state={state} update={update} />
              : <p className="text-xs text-muted-foreground italic">Mark “I’ve seen it” to rate this film on Rich’s A+–F scale.</p>}
          </section>
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Add to calendar</h4>
            <CalendarLinks film={film} />
          </section>
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> Community takes</h4>
            <Comments filmId={film.film_id} state={state} update={update} />
          </section>
        </div>
      )}
    </li>
  );
}

function ReviewedCard({ film, state, update }: { film: DemoReviewed; state: DemoState; update: ReturnType<typeof useDemoState>[1] }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="px-3 py-3">
      <div className="flex items-center gap-2">
        <Link href={`/film/${film.film_id}`} className="flex-1 min-w-0 font-medium text-foreground hover:text-accent leading-snug">{film.title}</Link>
        <Hex grade={film.grade.split('//')[0]} label="Rich" />
        <Hex grade={avgGrade(state.ratings[film.film_id] ? [...mockRatings(film.film_id), GRADES.indexOf(state.ratings[film.film_id])] : mockRatings(film.film_id))} label="Community" />
        <button onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label={open ? 'Hide details' : 'Rate & comment'}
          className="w-10 h-10 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>
      {open && (
        <div className="mt-3 rounded-lg border border-border bg-background/40 p-3 space-y-4">
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Rich vs. the community vs. you</h4>
            <RatingRow filmId={film.film_id} richGrade={film.grade.split('//')[0]} state={state} update={update} />
          </section>
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> Community takes</h4>
            <Comments filmId={film.film_id} state={state} update={update} />
          </section>
        </div>
      )}
    </li>
  );
}

// ─── Community award picks (readers' own choices, not predictions of Rich's) ──

const PICK_CATEGORIES = ['Live-Action Feature', 'Directing', 'Screenplay (Original)', 'Cinematography', 'Original Score'];

function CommunityPicks({ films, state, update }: { films: { film_id: number; title: string }[]; state: DemoState; update: ReturnType<typeof useDemoState>[1] }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2.5 text-xs text-sky-100/90 leading-snug">
        <span className="font-semibold text-sky-300">The community’s own picks.</span>{' '}
        What readers think deserves to win — not guesses at what Rich will choose. Rich’s nominations stay his own and are announced separately.
      </div>
      {PICK_CATEGORIES.map((cat, ci) => {
        const key = `${cat}`;
        const mine = state.picks[key];
        const r = seeded(ci + 101);
        const pool = films.slice(0, 18).map(f => ({ ...f, votes: Math.floor(r() * 60) }));
        if (mine) { const p = pool.find(f => f.film_id === mine); if (p) p.votes += 1; }
        const ranked = pool.filter(f => f.votes > 0).sort((a, b) => b.votes - a.votes).slice(0, 5);
        const total = pool.reduce((a, f) => a + f.votes, 0) || 1;
        return (
          <div key={cat} className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-secondary/40 border-b border-border">
              <Trophy className="w-3.5 h-3.5 text-sky-400" />
              <h4 className="font-serif text-sm font-semibold">{cat}</h4>
              <span className="ml-auto text-[11px] text-muted-foreground">{total} community picks</span>
            </div>
            <ul className="px-3 py-2 space-y-1.5">
              {ranked.map(f => {
                const pct = Math.round((f.votes / total) * 100);
                return (
                  <li key={f.film_id} className="text-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={`truncate ${mine === f.film_id ? 'text-sky-300 font-medium' : 'text-foreground/90'}`}>{f.title}{mine === f.film_id && ' · your pick'}</span>
                      <span className="text-[11px] text-muted-foreground shrink-0">{pct}%</span>
                    </div>
                    <div className="mt-0.5 h-1.5 rounded-full bg-secondary overflow-hidden"><div className="h-full bg-sky-500/70" style={{ width: `${pct}%` }} /></div>
                  </li>
                );
              })}
            </ul>
            <div className="px-3 pb-3">
              <label className="block text-[11px] text-muted-foreground mb-1" htmlFor={`pick-${ci}`}>Your pick</label>
              <select
                id={`pick-${ci}`}
                value={mine ?? ''}
                onChange={e => update(s => ({ ...s, picks: { ...s.picks, [key]: Number(e.target.value) || undefined } as Record<string, number> }))}
                className="w-full h-10 rounded-md bg-background border border-border px-2 text-base sm:text-sm"
              >
                <option value="">Choose a film…</option>
                {films.map(f => <option key={f.film_id} value={f.film_id}>{f.title}</option>)}
              </select>
            </div>
          </div>
        );
      })}
      <p className="text-[11px] text-muted-foreground italic">Demo note: acting categories would let readers pick a performance (actor + film) rather than a film.</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'anticipating' | 'watchlist' | 'reviewed' | 'picks';

export function CommunityDemo({ year, anticipated, reviewed }: { year: number; anticipated: DemoFilm[]; reviewed: DemoReviewed[] }) {
  const [state, update] = useDemoState();
  const [tab, setTab] = useState<Tab>('anticipating');
  const watchlist = useMemo(() => anticipated.filter(f => state.watchlist.includes(f.film_id)), [anticipated, state.watchlist]);
  const pickable = useMemo(() => [...reviewed, ...anticipated].sort((a, b) => a.title.localeCompare(b.title)), [reviewed, anticipated]);

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'anticipating', label: 'Anticipating', count: anticipated.length },
    { key: 'watchlist', label: 'My watchlist', count: watchlist.length },
    { key: 'reviewed', label: 'Seen by Rich', count: reviewed.length },
    { key: 'picks', label: 'Community picks' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-16">
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-100/90">
          <FlaskConical className="w-4 h-4 shrink-0 text-amber-300 mt-0.5" />
          <span><span className="font-semibold text-amber-300">Demo · mock data.</span> A preview of community features for review. Counts, ratings and comments from others are made up; your clicks are saved only in this browser. Not linked from the site.</span>
        </div>

        <h1 className="font-serif text-3xl font-bold tracking-tight">{year} <span className="text-accent">Anticipation</span></h1>
        <p className="mt-1 text-sm text-muted-foreground flex items-center gap-1.5"><Users className="w-4 h-4" /> Join in: flag what you’re looking forward to, track it, rate it, and pick your own winners.</p>

        <div className="mt-5 flex gap-1 overflow-x-auto scrollbar-hide -mx-4 px-4 border-b border-border" role="tablist">
          {tabs.map(t => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
              className={`shrink-0 h-11 px-3 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.key ? 'border-accent text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              {t.label}{t.count !== undefined && <span className="ml-1.5 text-[11px] text-muted-foreground">{t.count}</span>}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {tab === 'anticipating' && (
            <ul className="rounded-lg border border-border bg-card divide-y divide-border/50">
              {anticipated.map(f => <AnticipatedCard key={f.film_id} film={f} state={state} update={update} />)}
            </ul>
          )}
          {tab === 'watchlist' && (watchlist.length === 0
            ? <p className="text-sm text-muted-foreground italic py-8 text-center">Your watchlist is empty — tap “Watchlist” on any anticipated film.</p>
            : <ul className="rounded-lg border border-border bg-card divide-y divide-border/50">
                {watchlist.map(f => <AnticipatedCard key={f.film_id} film={f} state={state} update={update} />)}
              </ul>)}
          {tab === 'reviewed' && (
            <ul className="rounded-lg border border-border bg-card divide-y divide-border/50">
              {reviewed.map(f => <ReviewedCard key={f.film_id} film={f} state={state} update={update} />)}
            </ul>
          )}
          {tab === 'picks' && <CommunityPicks films={pickable} state={state} update={update} />}
        </div>
      </div>
    </div>
  );
}
