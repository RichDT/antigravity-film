'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Plus, X, Loader2, Eye, Ticket, Award, TreePalm, Sailboat, PawPrint, Sun, Leaf, MountainSnow, Building2, Landmark, Guitar, Crown, Shell, Waves, Cat, Play, type LucideIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { AnticipationFilm } from '@/lib/awards';
import { AddUnseenFilm } from '@/components/add-unseen-film';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// ─── Festival configuration ──────────────────────────────────────────────────

const FESTIVAL_CONFIG: Record<string, { icon: LucideIcon; name: string; topPrize: RegExp }> = {
  cannes:        { icon: TreePalm,     name: 'Cannes',        topPrize: /palme d'or/i },
  venice:        { icon: Sailboat,     name: 'Venice',        topPrize: /golden lion/i },
  berlin:        { icon: PawPrint,     name: 'Berlin',        topPrize: /golden bear/i },
  sundance:      { icon: Sun,          name: 'Sundance',      topPrize: /^grand jury prize/i },
  tiff:          { icon: Leaf,         name: 'TIFF',          topPrize: /^people's choice award$/i },
  telluride:     { icon: MountainSnow, name: 'Telluride',     topPrize: /$^/ },
  nyff:          { icon: Building2,    name: 'NYFF',          topPrize: /$^/ },
  tribeca:       { icon: Landmark,     name: 'Tribeca',       topPrize: /founders award/i },
  sxsw:          { icon: Guitar,       name: 'SXSW',          topPrize: /grand jury/i },
  bfi:           { icon: Crown,        name: 'BFI London',    topPrize: /best film/i },
  san_sebastian: { icon: Shell,        name: 'San Sebastián', topPrize: /golden shell/i },
  busan:         { icon: Waves,        name: 'Busan',         topPrize: /$^/ },
  locarno:       { icon: Cat,          name: 'Locarno',       topPrize: /golden leopard/i },
};

const FESTIVAL_SOURCES = Object.entries(FESTIVAL_CONFIG).map(([key, val]) => ({ value: key, label: val.name }));

type Accolade = { accolade_id: number; source: string; label: string };

function FestivalBadge({ source, accolades }: { source: string; accolades: Accolade[] }) {
  const config = FESTIVAL_CONFIG[source] ?? { icon: Award, name: source, topPrize: /$^/ };
  const Icon = config.icon;
  const isTop = accolades.some(a => config.topPrize.test(a.label));
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`inline-flex items-center gap-1 text-[8px] font-bold rounded px-1 h-3.5 cursor-pointer transition-all hover:scale-110 hover:shadow-sm ${
            isTop ? 'bg-accent text-accent-foreground shadow-sm' : 'bg-secondary text-secondary-foreground border border-border'
          }`}
          title={`${config.name}: ${accolades.map(a => a.label).join('; ')}`}
        >
          <Icon className="w-2.5 h-2.5" strokeWidth={2.5} />
          {config.name}
          {accolades.length > 1 && <span className="opacity-70">×{accolades.length}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-auto max-w-[260px] px-3 py-2 text-xs">
        <p className="font-semibold text-foreground flex items-center gap-1.5"><Icon className="w-3 h-3" />{config.name}</p>
        <ul className="mt-1 space-y-0.5">
          {accolades.map(a => <li key={a.accolade_id} className="text-muted-foreground">{a.label}</li>)}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function todayInSF(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
}

function formatDate(iso: string, withWeekday = false): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    timeZone: 'UTC', month: 'short', day: 'numeric', ...(withWeekday ? { weekday: 'short' } : {}),
  });
}

// SF preview screenings first, then upcoming releases soonest-first, then films already out (most recent first), then undated
function sortRank(f: AnticipationFilm, today: string): [number, string] {
  if (f.previews.length > 0) return [0, f.previews[0].screening_date];
  if (f.us_release_date && f.us_release_date > today) return [1, f.us_release_date];
  if (f.us_release_date) return [2, String(99999999 - Number(f.us_release_date.replace(/-/g, '')))];
  return [3, ''];
}

function sortBySoonest(films: AnticipationFilm[]): AnticipationFilm[] {
  const today = todayInSF();
  return [...films].sort((a, b) => {
    const [ra, ka] = sortRank(a, today), [rb, kb] = sortRank(b, today);
    return ra - rb || ka.localeCompare(kb) || a.title.localeCompare(b.title);
  });
}

function ReleaseLine({ film }: { film: AnticipationFilm }) {
  const today = todayInSF();
  const venue = film.release_venue ?? 'Release';
  const inTheaters = venue === 'Theaters';
  const service = film.streaming_service;
  const streamingLive = !!service && !!film.streaming_date && film.streaming_date <= today;
  const directToStreaming = !!service && service === film.release_venue;

  let text: string | null;
  if (streamingLive && directToStreaming) {
    text = null;
  } else if (!film.us_release_date) {
    text = `Date TBA${film.release_venue ? ` · ${venue}` : ''}`;
  } else if (film.us_release_date <= today) {
    text = `Released ${formatDate(film.us_release_date)} · ${inTheaters ? 'Theaters' : venue}`;
  } else {
    text = `${formatDate(film.us_release_date)} · ${inTheaters ? 'In theaters' : `On ${venue}`}`;
  }

  const upcomingStreaming = service && !streamingLive && !directToStreaming
    ? ` → ${service} ${film.streaming_date ? formatDate(film.streaming_date) : '(date TBA)'}`
    : '';

  const watchLabel = `${service} · since ${film.streaming_date ? formatDate(film.streaming_date) : ''}`;
  return (
    <p className="mt-0.5 text-[11px] text-muted-foreground flex flex-wrap items-baseline gap-x-2">
      {text && <span>{text}{upcomingStreaming}</span>}
      {streamingLive && (film.streaming_url ? (
        <a
          href={film.streaming_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-baseline gap-1 font-medium text-accent hover:underline"
          title={`Watch ${film.title} on ${service}`}
        >
          <Play className="w-2 h-2 self-center" fill="currentColor" />
          Watch on {watchLabel}
        </a>
      ) : (
        <span className="font-medium text-foreground/80">Streaming on {watchLabel}</span>
      ))}
    </p>
  );
}

function groupBySource(accolades: Accolade[]): Record<string, Accolade[]> {
  const out: Record<string, Accolade[]> = {};
  for (const a of accolades) (out[a.source] ??= []).push(a);
  return out;
}

// ─── Add-accolade inline form ─────────────────────────────────────────────────

function AddAccoladeForm({
  filmId,
  onDone,
}: {
  filmId: number;
  onDone: () => void;
}) {
  const [source, setSource] = useState('cannes');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!label.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/accolades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ film_id: filmId, source, label: label.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setLabel('');
      onDone();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-1.5 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 flex-wrap">
        <select
          value={source}
          onChange={e => setSource(e.target.value)}
          className="text-[11px] bg-background border border-border rounded px-1.5 py-1 focus:outline-none focus:border-accent/60 text-foreground"
        >
          {FESTIVAL_SOURCES.map(f => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <input
          autoFocus
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') onDone();
          }}
          placeholder="Award name…"
          className="flex-1 min-w-[120px] text-[11px] bg-background border border-border rounded px-2 py-1 focus:outline-none focus:border-accent/60 placeholder:text-muted-foreground/50"
        />
        {saving ? (
          <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
        ) : (
          <>
            <button
              onClick={submit}
              className="text-[11px] text-accent hover:underline"
            >
              Add
            </button>
            <button onClick={onDone} className="text-[11px] text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          </>
        )}
      </div>
      {error && <p className="text-[10px] text-destructive">{error}</p>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AnticipationBoard({
  year,
  films: initialFilms,
}: {
  year: number;
  films: AnticipationFilm[];
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const films = useMemo(() => sortBySoonest(initialFilms), [initialFilms]);
  const [addingFor, setAddingFor] = useState<number | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setIsAdmin(!!data.session?.user));
  }, []);

  async function removeAccolade(accoladeId: number) {
    await fetch('/api/admin/accolades', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accolade_id: accoladeId }),
    });
    router.refresh();
  }

  function onAccoladeAdded() {
    setAddingFor(null);
    router.refresh();
  }

  if (films.length === 0 && !isAdmin) return null;

  return (
    <div className="mt-5">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-card border border-border hover:border-border/80 hover:bg-card/80 transition-colors group"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
          <Eye className="w-3.5 h-3.5 shrink-0" />
          {year} Anticipation Board
          {films.length > 0 && (
            <span className="text-xs text-muted-foreground/70 font-normal">
              ({films.length} {films.length === 1 ? 'film' : 'films'})
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
            Films anticipated for {year} awards consideration — not yet screened by Rich.
            Soonest first; U.S. release dates, with San Francisco AMC preview screenings called out.
          </p>

          {films.length === 0 ? (
            <p className="px-3 py-4 text-xs text-muted-foreground italic">
              No anticipated films on record yet for {year}.
            </p>
          ) : (
            <ul className="divide-y divide-border/40">
              {films.map(film => (
                <li key={film.film_id} className="px-3 py-2.5">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <Link
                      href={`/film/${film.film_id}`}
                      className="text-sm text-foreground/90 hover:text-accent transition-colors font-medium leading-snug"
                    >
                      {film.title}
                    </Link>
                    {film.trailer_url && (
                      <a
                        href={film.trailer_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-accent transition-colors"
                        title={`Watch the official trailer for ${film.title} on YouTube`}
                      >
                        <Play className="w-2 h-2 self-center" fill="currentColor" />
                        Trailer
                      </a>
                    )}
                    <div className="flex items-center gap-1 flex-wrap">
                      {Object.entries(groupBySource(film.accolades)).map(([source, accs]) => (
                        <FestivalBadge key={source} source={source} accolades={accs} />
                      ))}
                      {isAdmin && addingFor !== film.film_id && (
                        <button
                          onClick={() => setAddingFor(film.film_id)}
                          className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/50 hover:text-accent transition-colors px-1 py-0.5 rounded border border-dashed border-muted-foreground/30 hover:border-accent/50"
                        >
                          <Plus className="w-2.5 h-2.5" />
                          accolade
                        </button>
                      )}
                    </div>
                  </div>
                  <ReleaseLine film={film} />
                  {film.previews.map(p => (
                    <a
                      key={`${p.event_name}-${p.screening_date}`}
                      href={p.ticket_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 flex items-start gap-2 rounded-md border border-accent/40 bg-accent/10 px-2 py-1.5 hover:bg-accent/20 transition-colors group/preview"
                    >
                      <Ticket className="w-3.5 h-3.5 mt-0.5 shrink-0 text-accent" />
                      <span className="text-[11px] leading-snug text-foreground">
                        <span className="font-semibold text-accent">{p.event_name}</span>
                        {' · '}{formatDate(p.screening_date, true)}{p.showtimes ? ` · ${p.showtimes}` : ''}
                        <span className="block text-muted-foreground">{p.theatre}</span>
                      </span>
                      <span className="ml-auto self-center text-[10px] font-medium text-accent whitespace-nowrap group-hover/preview:underline">Get tickets →</span>
                    </a>
                  ))}
                  {isAdmin && film.accolades.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      {film.accolades.map(acc => (
                        <button
                          key={acc.accolade_id}
                          onClick={() => removeAccolade(acc.accolade_id)}
                          className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/60 hover:text-destructive transition-colors"
                          title="Remove accolade"
                        >
                          <X className="w-2.5 h-2.5" />
                          {FESTIVAL_CONFIG[acc.source]?.name ?? acc.source}: {acc.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {isAdmin && addingFor === film.film_id && (
                    <AddAccoladeForm
                      filmId={film.film_id}
                      onDone={onAccoladeAdded}
                    />
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
