'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Plus, X, Loader2, Eye, Ticket, CalendarDays, Clapperboard, Tv, CircleHelp, EyeOff, Award, TreePalm, Sailboat, PawPrint, Sun, Leaf, MountainSnow, Building2, Landmark, Guitar, Crown, Shell, Waves, Cat, Play, type LucideIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { AnticipationFilm, RPPedigree } from '@/lib/awards';
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

type SectionKey = 'previews' | 'coming' | 'out' | 'streaming' | 'tba' | 'hidden';

const SECTIONS: { key: SectionKey; label: string; hint: string; icon: LucideIcon; adminOnly?: boolean }[] = [
  { key: 'previews',  label: 'Preview screenings', hint: 'SF early access', icon: Ticket },
  { key: 'coming',    label: 'Coming soon',        hint: 'Soonest first',                     icon: CalendarDays },
  { key: 'out',       label: 'Out now',            hint: 'Not streaming yet',       icon: Clapperboard },
  { key: 'streaming', label: 'Streaming now',      hint: 'Watch at home',                     icon: Tv },
  { key: 'tba',       label: 'Date TBA',           hint: 'Trailer, no date',  icon: CircleHelp },
  { key: 'hidden',    label: 'Hidden',             hint: 'Admin only', icon: EyeOff, adminOnly: true },
];

function isStreamingLive(f: AnticipationFilm, today: string): boolean {
  return !!f.streaming_service && !!f.streaming_date && f.streaming_date <= today;
}

function sectionOf(f: AnticipationFilm, today: string): SectionKey {
  if (f.previews.length > 0) return 'previews';
  if (isStreamingLive(f, today)) return 'streaming';
  if (f.us_release_date && f.us_release_date > today) return 'coming';
  if (f.us_release_date) return 'out';
  return f.trailer_url ? 'tba' : 'hidden';
}

function sectionize(films: AnticipationFilm[]): Record<SectionKey, AnticipationFilm[]> {
  const today = todayInSF();
  const out: Record<SectionKey, AnticipationFilm[]> = { previews: [], coming: [], out: [], streaming: [], tba: [], hidden: [] };
  for (const f of films) out[sectionOf(f, today)].push(f);
  const byTitle = (a: AnticipationFilm, b: AnticipationFilm) => a.title.localeCompare(b.title);
  out.previews.sort((a, b) => a.previews[0].screening_date.localeCompare(b.previews[0].screening_date) || byTitle(a, b));
  out.coming.sort((a, b) => a.us_release_date!.localeCompare(b.us_release_date!) || byTitle(a, b));
  out.out.sort((a, b) => b.us_release_date!.localeCompare(a.us_release_date!) || byTitle(a, b));
  out.streaming.sort((a, b) => b.streaming_date!.localeCompare(a.streaming_date!) || byTitle(a, b));
  out.tba.sort(byTitle);
  out.hidden.sort(byTitle);
  return out;
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

function PedigreeBadge({ pedigree }: { pedigree: RPPedigree[] }) {
  if (pedigree.length === 0) return null;
  const anyWin = pedigree.some(p => p.won);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`inline-flex items-center justify-center text-[8px] font-bold rounded px-1 h-3.5 cursor-pointer transition-all hover:scale-110 hover:shadow-sm ${
            anyWin ? 'bg-accent text-accent-foreground shadow-sm' : 'bg-secondary text-secondary-foreground border border-border'
          }`}
          title={`Made by past Rich Picks ${anyWin ? 'winners' : 'nominees'}: ${pedigree.map(p => p.name).join(', ')}`}
        >
          RICH
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-auto max-w-[300px] px-3 py-2 text-xs">
        <p className="font-semibold text-foreground">Rich Picks alumni</p>
        <ul className="mt-1 space-y-1.5">
          {pedigree.map(p => {
            const wins = p.history.filter(h => h.win);
            const noms = p.history.filter(h => !h.win);
            return (
              <li key={p.person_id}>
                <Link href={`/person/${p.person_id}`} className="font-medium text-foreground hover:text-accent">{p.name}</Link>
                <span className="text-muted-foreground"> · {p.roles.replace('Writer', 'writer').replace('Director', 'director').replace('Cinematographer', 'cinematographer')}</span>
                {wins.length > 0 && (
                  <p className="text-accent">Won: {wins.map(h => `${h.category} ${h.year}`).join('; ')}</p>
                )}
                {noms.length > 0 && (
                  <p className="text-muted-foreground">Nominated: {noms.map(h => `${h.category} ${h.year}`).join('; ')}</p>
                )}
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
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
  const sections = useMemo(() => sectionize(initialFilms), [initialFilms]);
  const visibleCount = initialFilms.length - sections.hidden.length;
  const firstVisible = SECTIONS.find(sec => !sec.adminOnly && sections[sec.key].length > 0)?.key;
  const [open, setOpen] = useState<Record<SectionKey, boolean>>(
    () => Object.fromEntries(SECTIONS.map(sec => [sec.key, sec.key === firstVisible])) as Record<SectionKey, boolean>
  );
  const [addingFor, setAddingFor] = useState<number | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setIsAdmin(!!data.session?.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setIsAdmin(!!session?.user));
    return () => sub.subscription.unsubscribe();
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

  if (visibleCount === 0 && !isAdmin) return null;

  return (
    <div className="mt-5">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-card border border-border hover:border-border/80 hover:bg-card/80 transition-colors group"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
          <Eye className="w-3.5 h-3.5 shrink-0" />
          {year} Anticipation Board
          {visibleCount > 0 && (
            <span className="text-xs text-muted-foreground/70 font-normal">
              ({visibleCount} {visibleCount === 1 ? 'film' : 'films'})
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
            Films anticipated for {year} awards consideration — not yet screened by Rich. U.S. release dates.
            {sections.hidden.length > 0 && ` ${sections.hidden.length} more ${sections.hidden.length === 1 ? 'film appears' : 'films appear'} once a release date or trailer is announced.`}
          </p>

          {visibleCount === 0 && !isAdmin ? (
            <p className="px-3 py-4 text-xs text-muted-foreground italic">
              No anticipated films on record yet for {year}.
            </p>
          ) : (
            SECTIONS.filter(sec => sections[sec.key].length > 0 && (!sec.adminOnly || isAdmin)).map(sec => (
              <section key={sec.key} className="border-t border-border">
                <button
                  onClick={() => setOpen(o => ({ ...o, [sec.key]: !o[sec.key] }))}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left group transition-colors bg-secondary/40 hover:bg-secondary/70 ${open[sec.key] ? 'border-b border-border/60' : ''}`}
                  aria-expanded={open[sec.key]}
                >
                  <span className={`w-6 h-7 clip-hexagon flex items-center justify-center shrink-0 ${sec.key === 'previews' ? 'bg-accent/40' : 'bg-border/60'}`}>
                    <span className={`clip-hexagon flex items-center justify-center ${sec.key === 'previews' ? 'bg-accent/20' : 'bg-muted/70'}`} style={{ width: 'calc(100% - 3px)', height: 'calc(100% - 3px)' }}>
                      <sec.icon className={`w-3 h-3 ${sec.key === 'previews' ? 'text-accent' : 'text-muted-foreground group-hover:text-foreground'}`} />
                    </span>
                  </span>
                  <span className="font-serif text-sm font-semibold tracking-wide text-foreground group-hover:text-accent transition-colors whitespace-nowrap shrink-0">{sec.label}</span>
                  <span className="inline-flex items-center justify-center min-w-[1.25rem] h-4 px-1 rounded-full bg-background/70 border border-border text-[10px] font-medium text-muted-foreground shrink-0">
                    {sections[sec.key].length}
                  </span>
                  <span className="flex-1 text-[10px] text-muted-foreground/60 italic whitespace-nowrap">{sec.hint}</span>
                  {open[sec.key]
                    ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                </button>
                {open[sec.key] && (
                  <ul className="divide-y divide-border/40">
                    {sections[sec.key].map(film => (
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
                            // Phones: a bordered pill with an invisible margin, so the tap area is ~44px tall.
                            // From sm up: the original compact inline link aligned to the title.
                            className="relative inline-flex items-center gap-1 h-7 px-2.5 rounded-full border border-border bg-background/40 text-xs text-muted-foreground hover:text-accent hover:border-accent/50 active:bg-secondary transition-colors after:absolute after:-inset-2 after:content-[''] sm:h-auto sm:px-0 sm:gap-0.5 sm:rounded-none sm:border-0 sm:bg-transparent sm:text-[10px] sm:after:hidden"
                            title={`Watch the official trailer for ${film.title} on YouTube`}
                            aria-label={`Watch the official trailer for ${film.title}`}
                          >
                            <Play className="w-2.5 h-2.5 sm:w-2 sm:h-2 self-center" fill="currentColor" />
                            Trailer
                          </a>
                        )}
                        <div className="flex items-center gap-1 flex-wrap">
                          <PedigreeBadge pedigree={film.pedigree} />
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
              </section>
            ))
          )}
          {isAdmin && <AddUnseenFilm year={year} />}
        </div>
      )}
    </div>
  );
}
