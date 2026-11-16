// The homepage "year lens": a century timeline of every year on record, and below it one stage that shows the
// same sections for any year (Top 10, Rich's pick and the peer awards, still to see). It opens on the current
// year, still being decided; earlier years fill the same sections with what was settled.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, ChevronLeft, Trophy, Eye, Star, Ticket, CalendarDays, Clapperboard, Tv, CircleHelp, Play } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ThisWeekStrip } from "@/components/ThisWeekStrip";
import { MemberActionsProvider, FilmStatusIcons } from "@/components/community/FilmStatusControls";
import { HomeSearch } from "@/components/HomeSearch";
import { FestivalBadge, groupBySource, ReleaseLine } from "@/components/AnticipationBoard";
import type { AnticipationFilm } from "@/lib/awards";
import type { YearSummary, PeerWin, PreTop, RpNominee } from "@/lib/home-data";

// ── shared helpers ───────────────────────────────────────────────────────
const GV: Record<string, number> = { "A+": 15, A: 14, "A-": 13, "B+": 12, B: 11, "B-": 10, "C+": 9, C: 8, "C-": 7, "D+": 6, D: 5, "D-": 4, F: 3 };
const gv = (g: string) => !g || g === "-" ? 0 : g.includes("//") ? g.split("//").reduce((s, p) => s + (GV[p.trim()] || 0), 0) / 2 : GV[g.trim()] || 0;
const gradeColor = (g: string) => ({ A: "bg-emerald-600 text-white", B: "bg-sky-600 text-white", C: "bg-amber-500 text-black", D: "bg-orange-600 text-white", F: "bg-red-600 text-white" } as Record<string, string>)[g?.[0]] ?? "bg-muted text-muted-foreground";

export function GradeHex({ grade, size = "sm" }: { grade: string; size?: "sm" | "lg" }) {
  const cls = size === "lg" ? "w-11 h-12 text-[15px]" : "w-7 h-8 text-[10px]";
  const split = grade?.includes("//");
  return (
    <div className={`${cls} clip-hexagon flex items-center justify-center shrink-0 font-bold font-serif ${gradeColor(grade)}`}>
      {split ? <span className={`flex flex-col items-center leading-none ${size === "lg" ? "text-[11px]" : "text-[8px]"}`}>{grade.split("//")[0]}<span className="w-4 h-px bg-current opacity-80 my-[1px]" />{grade.split("//")[1]}</span> : grade || "–"}
    </div>
  );
}

/** Section header matching "This week": serif title, muted one-line description, optional right-side link. */
function SectionHead({ title, sub, right, icon }: { title: string; sub?: React.ReactNode; right?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-end gap-3 mb-3">
      <div className="min-w-0">
        <h2 className="font-serif text-xl font-semibold leading-tight flex items-center gap-2">{icon}{title}</h2>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      {right && <div className="ml-auto shrink-0 text-xs">{right}</div>}
    </div>
  );
}

type Stage = "watching" | "considering" | "nominated" | "decided" | "record";
const STAGES = [
  { key: "watching", label: "Watching" }, { key: "considering", label: "Considering" },
  { key: "nominated", label: "Nominated" }, { key: "decided", label: "Decided" },
] as const;
const RP_START = 2005;
function stageOf(s: YearSummary): Stage {
  if (s.yr < RP_START) return "record";
  if (s.wins > 0) return "decided";
  if (s.noms > 0) return "nominated";
  if (s.consid > 0 || s.reviewed > 0) return "considering";
  return "watching";
}
const isOpen = (st: Stage) => st === "watching" || st === "considering" || st === "nominated";

function StageTrack({ stage, wide = false }: { stage: Stage; wide?: boolean }) {
  if (stage === "record") return <span className="text-xs text-muted-foreground">Before Rich Picks · the record of the major awards</span>;
  const at = STAGES.findIndex(s => s.key === stage);
  return (
    <div className={`flex items-center gap-1.5 ${wide ? "w-full max-w-xl" : ""}`} aria-label={`Stage: ${STAGES[at].label}`}>
      {STAGES.map((s, i) => {
        const done = i < at, here = i === at;
        const tone = here ? (stage === "decided" ? "bg-primary border-primary" : "bg-sky-400 border-sky-400") : done ? "bg-primary/70 border-primary/70" : "bg-transparent border-border";
        return (
          <div key={s.key} className={`flex items-center gap-1.5 ${wide && i < STAGES.length - 1 ? "flex-1" : ""}`}>
            <span className={`relative w-2.5 h-2.5 rotate-45 border ${tone}`}>{here && stage !== "decided" && <span className="absolute inset-0 animate-ping bg-sky-400/60" />}</span>
            <span className={`text-[11px] ${here ? (stage === "decided" ? "text-primary" : "text-sky-300") : done ? "text-foreground/70" : "text-muted-foreground/60"}`}>{s.label}</span>
            {i < STAGES.length - 1 && <span className={`h-px ${wide ? "flex-1 min-w-4" : "w-4"} ${i < at ? "bg-primary/60" : "bg-border"}`} />}
          </div>
        );
      })}
    </div>
  );
}

const ORG_LABEL: Record<string, string> = { Oscars: "Academy Awards", BAFTA: "BAFTA", Globes: "Golden Globes", NBR: "National Board of Review", PGA: "Producers Guild", SAG: "Screen Actors Guild", Spirit: "Independent Spirit" };
function peerCat(org: string, cat: string) {
  if (org === "Globes") return /comedy/i.test(cat) ? "Musical or Comedy" : "Drama";
  if (org === "SAG") return "Ensemble cast";
  return null;
}

// Board grouping (mirrors the Anticipation Board's own sections, minus "Rich has seen" and admin-only)
type GroupKey = "previews" | "coming" | "out" | "streaming" | "tba";
const GROUPS: { key: GroupKey; label: string; hint: string; icon: LucideIcon }[] = [
  { key: "previews", label: "Preview screenings", hint: "Early screenings in San Francisco", icon: Ticket },
  { key: "coming", label: "Coming soon", hint: "Opening in the weeks ahead", icon: CalendarDays },
  { key: "out", label: "Out now", hint: "In theaters, not yet streaming", icon: Clapperboard },
  { key: "streaming", label: "Streaming now", hint: "Watch at home", icon: Tv },
  { key: "tba", label: "Date TBA", hint: "Trailer out, no date yet", icon: CircleHelp },
];
const todaySF = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
function groupOf(f: AnticipationFilm, today: string): GroupKey | null {
  if (f.rich_grade) return null;
  if (f.previews.length) return "previews";
  if (f.streaming_service && f.streaming_date && f.streaming_date <= today) return "streaming";
  if (f.us_release_date && f.us_release_date > today) return "coming";
  if (f.us_release_date) return "out";
  return f.trailer_url ? "tba" : null;
}
/** Most accolades first, then soonest release. */
const byPriority = (a: AnticipationFilm, b: AnticipationFilm) => b.accolades.length - a.accolades.length || (a.us_release_date ?? "9").localeCompare(b.us_release_date ?? "9") || a.title.localeCompare(b.title);

function shortDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
}

/** One quiet line: when and where it opens, then links out to the trailer and (when live) the streaming page. */
export function MetaLinks({ f }: { f: Pick<AnticipationFilm, "us_release_date" | "release_venue" | "trailer_url" | "streaming_date" | "streaming_service" | "streaming_url"> & { previews?: AnticipationFilm["previews"] } }) {
  const today = todaySF();
  const streamingLive = !!f.streaming_service && !!f.streaming_date && f.streaming_date <= today;
  const venue = f.release_venue === "Theaters" || !f.release_venue ? "theaters" : f.release_venue;
  const when = !f.us_release_date ? "Date TBA"
    : f.us_release_date > today ? `${shortDate(f.us_release_date)} · ${venue === "theaters" ? "in theaters" : `on ${venue}`}`
    : `Out ${shortDate(f.us_release_date)}${streamingLive ? "" : ` · ${venue === "theaters" ? "in theaters" : `on ${venue}`}`}`;
  const preview = f.previews?.[0];
  return (
    <p className="mt-0.5 text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
      <span>{when}</span>
      {preview && <a href={preview.ticket_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline"><Ticket className="w-3 h-3" />Preview {shortDate(preview.screening_date)}</a>}
      {streamingLive && (f.streaming_url
        ? <a href={f.streaming_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sky-300 hover:underline"><Tv className="w-3 h-3" />Stream on {f.streaming_service}</a>
        : <span className="inline-flex items-center gap-1"><Tv className="w-3 h-3" />Streaming on {f.streaming_service}</span>)}
      {f.trailer_url && <a href={f.trailer_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground"><Play className="w-2.5 h-2.5" fill="currentColor" />Trailer</a>}
    </p>
  );
}

function StillRow({ f, dense = false, links = false }: { f: AnticipationFilm; dense?: boolean; links?: boolean }) {
  const groups = groupBySource(f.accolades);
  return (
    <li className={`group flex items-start gap-2.5 min-w-0 ${dense ? "py-1.5" : "py-2.5"}`}>
      <Eye className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/film/${f.film_id}`} className="text-sm font-medium hover:text-accent">{f.title}</Link>
          {Object.entries(groups).map(([src, acc]) => <FestivalBadge key={src} source={src} accolades={acc} />)}
        </div>
        {links ? <MetaLinks f={f} /> : !dense && <ReleaseLine film={f} />}
      </div>
      {links && <FilmStatusIcons filmId={f.film_id} title={f.title} quiet className="-mr-1" />}
    </li>
  );
}

// ── the homepage variations ───────────────────────────────────────────────
type Props = {
  rawFilmsData: any[];
  dbStats: Record<number, Record<string, { wins: number; noms: number }>>;
  filmIdMap: Record<string, number>;
  dbFilmsData: Array<{ release_year: number; title: string; grade: string; film_id: number }>;
  topFilmsPerYear: Array<{ year: number; title: string }>;
  anticipationFilms: AnticipationFilm[];
  prevAnticipation: AnticipationFilm[];
  anticipationYear: number;
  considerationCounts: Record<string, number>;
  summaries: YearSummary[];
  peers: PeerWin[];
  preTop: PreTop[];
  rpNoms: RpNominee[];
};
type TopItem = { key: string | number; film: string; filmId: number | null; grade: string; wins: number; noms: number; rank: number };
type Metric = "graded" | "aCount" | "nominated" | "awarded" | "dominance";

export default function YearLens(p: Props) {
  const { rawFilmsData, dbStats, filmIdMap, dbFilmsData, anticipationFilms, prevAnticipation, anticipationYear, considerationCounts, summaries, peers, preTop, rpNoms } = p;
  const asc = useMemo(() => [...summaries].sort((a, b) => a.yr - b.yr), [summaries]);
  const byYear = useMemo(() => new Map(summaries.map(s => [s.yr, s])), [summaries]);
  const [selected, setSelected] = useState(anticipationYear);
  const [hover, setHover] = useState<number | null>(null);
  const [metric, setMetric] = useState<Metric>("graded");
  const shown = hover ?? selected;

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowLeft") setSelected(y => Math.max(asc[0].yr, y - 1));
      if (e.key === "ArrowRight") setSelected(y => Math.min(anticipationYear, y + 1));
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [asc, anticipationYear]);

  const topTen = useMemo(() => {
    const cache = new Map<number, TopItem[]>();
    return (year: number): TopItem[] => {
      if (cache.has(year)) return cache.get(year)!;
      const stat = (t: string) => dbStats[year]?.[t] || { wins: 0, noms: 0 };
      const st = rawFilmsData.filter(f => String(f.year).trim() === String(year));
      const src = st.length
        ? st.map(f => ({ key: f.id, film: f.title, filmId: filmIdMap[`${year}|${f.title.toLowerCase()}`] ?? null, grade: f.grade || "-", ...stat(f.title) }))
        : dbFilmsData.filter(f => f.release_year === year).map(f => ({ key: f.film_id, film: f.title, filmId: f.film_id, grade: f.grade || "-", ...stat(f.title) }));
      const out = src.sort((a, b) => gv(b.grade) - gv(a.grade) || b.wins - a.wins || b.noms - a.noms).slice(0, 10).map((x, i) => ({ ...x, rank: i + 1 }));
      cache.set(year, out); return out;
    };
  }, [rawFilmsData, dbStats, filmIdMap, dbFilmsData]);

  const peersBy = useMemo(() => {
    const m = new Map<number, PeerWin[]>();
    for (const w of peers) { if (!m.has(w.yr)) m.set(w.yr, []); const arr = m.get(w.yr)!; if (!arr.some(x => x.org === w.org && x.cat === w.cat && x.title === w.title)) arr.push(w); }
    return m;
  }, [peers]);
  // Per-year measures for the timeline: grades (quality across years) and Rich Picks spread (concentration within a year)
  const yearStats = useMemo(() => {
    const m = new Map<number, { graded: number; aLevel: number; nominated: number; awarded: number; wins: number; topWins: number; topWinner: string }>();
    for (const s of asc) {
      const st = rawFilmsData.filter(f => String(f.year).trim() === String(s.yr)).map(f => gv(f.grade)).filter(Boolean);
      const vals = st.length ? st : dbFilmsData.filter(f => f.release_year === s.yr).map(f => gv(f.grade)).filter(Boolean);
      const films = Object.entries(dbStats[s.yr] ?? {});
      const top = films.reduce<[string, { wins: number; noms: number }] | null>((b, f) => !b || f[1].wins > b[1].wins ? f : b, null);
      m.set(s.yr, {
        graded: s.reviewed, aLevel: vals.filter(v => v >= 12.5).length, // A- // B+ and above
        nominated: films.filter(([, x]) => x.noms > 0).length, awarded: films.filter(([, x]) => x.wins > 0).length,
        wins: films.reduce((a, [, x]) => a + x.wins, 0), topWins: top?.[1].wins ?? 0, topWinner: top?.[0] ?? "",
      });
    }
    return m;
  }, [asc, rawFilmsData, dbFilmsData, dbStats]);

  const stillFor = (year: number) => year === anticipationYear ? anticipationFilms : year === anticipationYear - 1 ? prevAnticipation : [];
  const today = todaySF();
  const stillList = (year: number) => stillFor(year).filter(f => groupOf(f, today)).sort(byPriority);

  const s = byYear.get(shown)!;
  const st = stageOf(s);
  const open = isOpen(st);
  const peerList = peersBy.get(shown) ?? [];
  const top = topTen(shown);

  // ── scrubber: bars, a label that always names the year under the pointer, and decade ticks ──
  const metricVal = (x: YearSummary): number => {
    const y = yearStats.get(x.yr)!;
    if (metric === "graded") return y.graded;
    if (metric === "aCount") return y.aLevel;
    if (metric === "nominated") return y.nominated;
    if (metric === "awarded") return y.awarded;
    return y.wins ? y.topWins / y.wins : 0;
  };
  const maxV = Math.max(1, ...asc.map(metricVal));
  const pos = (yr: number) => ((yr - asc[0].yr + 0.5) / asc.length) * 100;
  const tall = true;
  const labelFor = (x: YearSummary) => {
    if (x.yr < RP_START) return (peersBy.get(x.yr)?.find(w => w.org === "Oscars")?.title) ?? preTop.find(t => t.yr === x.yr)?.title ?? "";
    if (x.rp_bp) return x.rp_bp;
    const t = topTen(x.yr)[0]; return t ? `${t.film} · so far` : "";
  };
  const metricText = (x: YearSummary) => {
    const y = yearStats.get(x.yr)!;
    if (x.yr < RP_START && metric !== "graded") return "before Rich Picks";
    if (metric === "graded") return `${y.graded} films graded`;
    if (metric === "aCount") return `${y.aLevel} ${y.aLevel === 1 ? "film" : "films"} graded A- // B+ or higher`;
    if (metric === "nominated") return y.nominated ? `${y.nominated} distinct films nominated` : "no nominations yet";
    if (metric === "awarded") return y.awarded ? `${y.awarded} distinct films awarded` : "no winners yet";
    return y.wins ? `${y.topWinner} took ${y.topWins} of ${y.wins} wins (${Math.round(100 * y.topWins / y.wins)}%)` : "no winners yet";
  };
  const METRICS: [Metric, string, string][] = [
    ["graded", "Films graded", "How many films Rich graded"],
    ["aCount", "A-level films", "Films graded A- // B+ or higher: quality across years"],
    ["nominated", "Distinct films nominated", "Different films with at least one Rich Picks nomination: how widely quality spread"],
    ["awarded", "Distinct films awarded", "Different films that won at least one Rich Pick"],
    ["dominance", "Biggest winner’s share", "The top winner’s share of all wins: how much one film dominated"],
  ];

  const yearSearch = { onYear: (y: number) => { setSelected(y); setHover(null); }, minYear: asc[0].yr, maxYear: anticipationYear };
  const scrubber = (
    <div className="sticky top-14 z-30 -mx-4 px-4 pt-3 pb-2 bg-background/95 backdrop-blur border-b border-border/60">
      {tall && (
        <div className="flex items-center gap-1 text-[11px] mb-9">
          <span className="text-muted-foreground mr-1">Bars show</span>
          {METRICS.map(([k, l, t]) => (
            <button key={k} title={t} onClick={() => setMetric(k)} className={`px-2.5 py-0.5 rounded-full border ${metric === k ? "border-accent text-accent bg-accent/10" : "border-border text-muted-foreground hover:text-foreground"}`}>{l}</button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-3">
        <button onClick={() => setSelected(y => Math.max(asc[0].yr, y - 1))} className="w-8 h-8 mb-6 rounded-full border border-border flex items-center justify-center hover:border-accent shrink-0" aria-label="Earlier year"><ChevronLeft className="w-4 h-4" /></button>
        <div className="flex-1 relative">
          {/* the label: follows the pointer while hovering, otherwise rests on the selected year */}
          {(() => {
            const x = byYear.get(shown)!;
            const l = pos(shown);
            return (
              <div className="absolute -top-9 z-10 pointer-events-none transition-[left] duration-75" style={{ left: `${l}%`, transform: `translateX(${l > 85 ? "-92%" : l < 12 ? "-8%" : "-50%"})` }}>
                <div className={`whitespace-nowrap rounded-md px-2 py-1 text-[11px] shadow-lg border ${hover !== null && hover !== selected ? "bg-secondary border-foreground/25" : "bg-card border-accent/60"}`}>
                  <span className={`font-serif font-bold text-[13px] mr-1.5 ${hover !== null && hover !== selected ? "text-foreground" : "text-accent"}`}>{x.yr}</span>
                  <span className="text-muted-foreground">{labelFor(x)}{tall ? ` · ${metricText(x)}` : ""}</span>
                </div>
              </div>
            );
          })()}
          <div className={`relative flex items-end gap-[2px] ${tall ? "h-24" : "h-14"}`} onMouseLeave={() => setHover(null)}>
            <span className="absolute bottom-0 top-0 border-l border-dashed border-primary/50 pointer-events-none" style={{ left: `${((RP_START - asc[0].yr) / asc.length) * 100}%` }} />
            {asc.map(x => {
              const xs = stageOf(x), sel = x.yr === selected, hov = x.yr === hover;
              const v = metricVal(x);
              const max = tall ? 88 : 52;
              const h = x.yr < RP_START ? 12 : Math.max(6, Math.round(max * (metric === "graded" ? Math.sqrt(v / maxV) : v / maxV)));
              const tone = sel ? "bg-accent" : hov ? "bg-accent/60" : isOpen(xs) ? "bg-sky-400/70" : x.yr < RP_START ? "bg-border/70" : "bg-primary/45";
              return (
                <button key={x.yr} onMouseEnter={() => setHover(x.yr)} onFocus={() => setHover(x.yr)} onClick={() => { setSelected(x.yr); setHover(null); }}
                  aria-label={`${x.yr}`} style={{ height: h }}
                  className={`relative flex-1 rounded-t-sm transition-all duration-100 ${tone} ${hov ? "scale-x-[1.8] z-10" : ""}`} />
              );
            })}
          </div>
          <div className="relative h-8 text-[10px] text-muted-foreground">
            {asc.filter(x => x.yr % 10 === 0).map(x => (
              <span key={x.yr} className="absolute -translate-x-1/2 top-1" style={{ left: `${pos(x.yr)}%` }}>
                <span className="block mx-auto w-px h-1.5 bg-border mb-0.5" />{x.yr}
              </span>
            ))}
            <span className="absolute top-1 text-primary/80 -translate-x-1/2" style={{ left: `${pos(RP_START)}%` }}><span className="block mx-auto w-px h-1.5 bg-primary/60 mb-0.5" />2005</span>
          </div>
        </div>
        <button onClick={() => setSelected(y => Math.min(anticipationYear, y + 1))} className="w-8 h-8 mb-6 rounded-full border border-border flex items-center justify-center hover:border-accent shrink-0" aria-label="Later year"><ChevronRight className="w-4 h-4" /></button>
      </div>
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground pl-11">
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-sky-400/70 rounded-sm" />Still open</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-primary/45 rounded-sm" />Settled</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-border/70 rounded-sm" />Before Rich Picks</span>
        <span className="ml-auto pr-11">Hover to preview a year · click to keep it · ← → to step</span>
      </div>
    </div>
  );

  // ── stage pieces ──
  const stageHead = (
    <div className="flex items-center gap-5 mb-6">
      <h2 className="font-serif text-3xl font-bold leading-none">{shown}</h2>
      <StageTrack stage={st} />
      <div className="ml-auto flex items-center gap-4 text-xs">
        {hover !== null && hover !== selected
          ? <span className="text-muted-foreground">Previewing · click the bar to keep {shown}</span>
          : shown !== anticipationYear && <button onClick={() => setSelected(anticipationYear)} className="text-sky-300 hover:underline">Back to {anticipationYear}</button>}
        <Link href={`/year/${shown}`} className="text-sm text-accent hover:underline inline-flex items-center gap-1">Open the {shown} page <ChevronRight className="w-4 h-4" /></Link>
      </div>
    </div>
  );

  const subtitle = (it: TopItem) => {
    if (it.wins) return `${it.wins} ${it.wins === 1 ? "win" : "wins"} · ${it.noms} ${it.noms === 1 ? "nomination" : "nominations"}`;
    if (it.noms) return `${it.noms} ${it.noms === 1 ? "nomination" : "nominations"}`;
    if (shown === anticipationYear) { const n = considerationCounts[it.film.toLowerCase()] ?? 0; return n ? `${n} ${n === 1 ? "consideration" : "considerations"}` : "Not yet considered"; }
    return "";
  };
  const topTenBlock = (cols: 1 | 2 = 1) => shown < RP_START ? (
    <div>
      <SectionHead title="Most honored films" sub={`Before Rich Picks: the films the major awards honored most in ${shown}`} />
      <ol className={cols === 2 ? "grid grid-cols-2 grid-rows-5 grid-flow-col gap-x-8 gap-y-2.5" : "space-y-2.5"}>
        {preTop.filter(t => t.yr === shown).map((t, i) => (
          <li key={t.film_id} className="flex items-center gap-2.5">
            <span className="w-5 h-5 shrink-0 flex items-center justify-center rounded text-[10px] font-bold bg-muted/60 text-muted-foreground">{i + 1}</span>
            <Link href={`/film/${t.film_id}`} className="text-sm font-medium hover:text-accent">{t.title}</Link>
            <span className="text-[10px] text-muted-foreground">{t.wins ? `${t.wins} ${t.wins === 1 ? "win" : "wins"} · ` : ""}{t.noms} {t.noms === 1 ? "nomination" : "nominations"}</span>
          </li>
        ))}
      </ol>
    </div>
  ) : (
    <div>
      <SectionHead title={open ? "Top 10 so far" : "Top 10"} icon={<Star className={`w-4 h-4 ${open ? "text-sky-400" : "text-accent"}`} />}
        sub={open ? `Rich’s highest-graded ${shown} films to date` : `Rich’s ten best films of ${shown}`} />
      <ol className={cols === 2 ? "grid grid-cols-2 grid-rows-5 grid-flow-col gap-x-8 gap-y-2.5" : "space-y-2.5"}>
        {top.map(it => (
          <li key={it.key} className="group flex items-center gap-2.5 min-w-0">
            <span className={`w-5 h-5 shrink-0 flex items-center justify-center rounded text-[10px] font-bold ${open ? "border border-dashed border-sky-500/50 text-sky-300" : "bg-muted/60 text-muted-foreground"}`}>{it.rank}</span>
            <GradeHex grade={it.grade} />
            <div className="min-w-0 flex items-baseline gap-2 flex-wrap">
              {it.filmId ? <Link href={`/film/${it.filmId}`} className="font-medium text-sm hover:text-accent">{it.film}</Link> : <span className="font-medium text-sm">{it.film}</span>}
              <span className="text-[10px] text-muted-foreground">{subtitle(it)}</span>
            </div>
            {it.filmId && <FilmStatusIcons filmId={it.filmId} title={it.film} quiet className="ml-auto" />}
          </li>
        ))}
      </ol>
    </div>
  );

  const nominees = rpNoms.filter(n => n.yr === shown);
  const leader = top[0];
  const pickBlock = shown >= RP_START && (
    <div className={`rounded-xl p-5 ${s.rp_bp ? "border border-primary/40 bg-card/90" : "border border-dashed border-sky-500/40 bg-sky-500/[0.04]"}`}>
      <p className={`text-[11px] uppercase tracking-[0.1em] mb-2 flex items-center gap-1.5 ${s.rp_bp ? "text-primary" : "text-sky-300"}`}><Trophy className="w-3.5 h-3.5" />Rich’s Best Picture</p>
      {s.rp_bp ? (() => {
        const g = top.find(t => t.film === s.rp_bp)?.grade;
        return (
          <div className="flex items-center gap-3">
            {g && <GradeHex grade={g} size="lg" />}
            <Link href={`/film/${s.rp_bp_id}`} className="font-serif text-2xl font-semibold leading-tight hover:text-accent">{s.rp_bp}</Link>
          </div>
        );
      })() : nominees.length ? (
        <div>
          <p className="font-serif text-lg text-foreground/85">Winner still to come</p>
          <p className="text-xs text-muted-foreground mt-1 mb-2">The nominees:</p>
          <ul className="space-y-1">{nominees.map(n => <li key={n.film_id}><Link href={`/film/${n.film_id}`} className="text-sm hover:text-accent">{n.title}</Link></li>)}</ul>
        </div>
      ) : (
        <div>
          <p className="font-serif text-lg text-foreground/85">Not yet named</p>
          {leader && <p className="text-xs text-muted-foreground mt-1">Highest graded so far: <Link href={`/film/${leader.filmId}`} className="text-foreground hover:text-accent">{leader.film}</Link></p>}
        </div>
      )}
    </div>
  );

  const peersBlock = (layout: "list" | "chips" | "stack") => {
    const title = shown < RP_START ? "Best Picture across the awards" : "Peer awards for Best Picture";
    const empty = shown >= anticipationYear - 1 && !peerList.length;
    const agree = (w: PeerWin) => s.rp_bp && w.title === s.rp_bp;
    if (layout === "chips") return (
      <div className="flex items-baseline gap-x-4 gap-y-1.5 flex-wrap text-xs text-muted-foreground">
        <span className="uppercase tracking-[0.1em] text-[10px]">{title}</span>
        {empty ? <span>None announced yet</span> : peerList.map(w => (
          <span key={w.org + w.cat + w.film_id} className="whitespace-nowrap">{ORG_LABEL[w.org] ?? w.org}{peerCat(w.org, w.cat) ? ` (${peerCat(w.org, w.cat)})` : ""} · <Link href={`/film/${w.film_id}`} className={agree(w) ? "text-primary hover:underline" : "text-foreground/80 hover:text-accent"}>{w.title}</Link></span>
        ))}
      </div>
    );
    return (
      <div className={shown < RP_START ? "rounded-xl border border-border bg-card/80 p-5" : "px-1"}>
        <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground mb-2">{title}</p>
        {empty ? <p className="text-xs text-muted-foreground">None announced yet for {shown}.</p> : (
          <ul className="space-y-1">
            {peerList.map(w => (
              <li key={w.org + w.cat + w.film_id} className={layout === "stack" ? "text-xs leading-snug py-0.5" : "grid grid-cols-[220px_1fr] gap-2 text-xs"}>
                <span className={`text-muted-foreground truncate ${layout === "stack" ? "block text-[10px]" : ""}`}>{ORG_LABEL[w.org] ?? w.org}{peerCat(w.org, w.cat) ? <span className="text-muted-foreground/60"> · {peerCat(w.org, w.cat)}</span> : null}</span>
                <Link href={`/film/${w.film_id}`} className={`truncate ${agree(w) ? "text-primary" : "text-foreground/80"} hover:text-accent`}>{w.title}{agree(w) && <span className="text-[10px] text-primary/80"> · agreed with Rich</span>}</Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  // Stats: open years count what's still accumulating; settled years show the timeline's own measures for that
  // year (click one to chart it across every year), plus who dominated
  const numbers = shown >= RP_START && (() => {
    const stillN = stillList(shown).length;
    const ys = yearStats.get(shown)!;
    type Cell = { n: number; l: string; blue?: boolean; m?: Metric };
    const cells: Cell[] = st === "decided"
      ? [{ n: ys.graded, l: "films graded", m: "graded" }, { n: ys.aLevel, l: "A-level films", m: "aCount" }, { n: ys.nominated, l: "distinct films nominated", m: "nominated" }]
      : st === "nominated" ? [{ n: s.reviewed, l: "films graded so far", m: "graded" }, { n: ys.nominated, l: "distinct films nominated", m: "nominated" }, { n: stillN, l: "still to see", blue: true }]
      : [{ n: s.reviewed, l: "films graded so far", m: "graded" }, { n: s.consid, l: "in the running" }, { n: stillN, l: "still to see", blue: true }];
    return (
      <div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {cells.map(x => {
            const body = <><p className={`font-serif text-xl font-bold ${x.blue ? "text-sky-300" : ""}`}>{x.n}</p><p className="text-[10px] leading-tight text-muted-foreground">{x.l}</p></>;
            return x.m && tall && st === "decided"
              ? <button key={x.l} onClick={() => setMetric(x.m!)} title="Chart this across every year" className="rounded-lg py-1.5 hover:bg-secondary/60 transition-colors">{body}</button>
              : <div key={x.l} className="py-1.5">{body}</div>;
          })}
        </div>
        {st === "decided" && ys.topWins > 0 && (
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Biggest winner: <span className="text-foreground/85">{ys.topWinner}</span>, {ys.topWins} of {ys.wins} wins ({Math.round(100 * ys.topWins / ys.wins)}%)
          </p>
        )}
      </div>
    );
  })();

  const still = stillList(shown);
  const [filter, setFilter] = useState<GroupKey | "all">("all");
  useEffect(() => setFilter("all"), [shown]);

  const header = (
    <div className="mb-8 flex items-end gap-8">
      <div>
        <h1 className="font-serif text-5xl font-bold tracking-tight leading-none">Rich<span className="text-accent"> Picks</span></h1>
        <p className="mt-3 text-base text-muted-foreground max-w-2xl">Rich’s picks for the best in film every year since 2005, alongside the major awards back to {asc[0].yr}. <Link href="/about" className="ml-1 inline-flex items-center gap-0.5 whitespace-nowrap text-xs text-muted-foreground/80 hover:text-accent transition-colors">More about the site<ChevronRight className="w-3 h-3" /></Link></p>
      </div>
      <HomeSearch className="ml-auto w-80 mb-1" {...yearSearch} placeholder="Search films, people or a year" />
    </div>
  );

  // ── Phones and tablets (< 1024px) ─────────────────────────────────────────
  const [tab, setTab] = useState<"top" | "picks" | "still">("top");

  // Century strip: drag (or tap) across the bars to scrub; the page previews the year under your finger
  const yearAt = (el: Element, clientX: number) => {
    const r = el.getBoundingClientRect();
    const i = Math.min(asc.length - 1, Math.max(0, Math.floor(((clientX - r.left) / r.width) * asc.length)));
    return asc[i].yr;
  };
  const metricSelect = (
    <label className="relative inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      Bars:
      <select value={metric} onChange={e => setMetric(e.target.value as Metric)}
        className="appearance-none bg-transparent text-foreground pr-4 focus:outline-none">
        {METRICS.map(([k, l]) => <option key={k} value={k} className="bg-card">{l}</option>)}
      </select>
      <ChevronRight className="w-3 h-3 rotate-90 absolute right-0 pointer-events-none" />
    </label>
  );
  const barTone = (x: YearSummary) => x.yr === selected ? "bg-accent" : x.yr === hover ? "bg-accent/60" : isOpen(stageOf(x)) ? "bg-sky-400/70" : x.yr < RP_START ? "bg-border/70" : "bg-primary/45";
  const barH = (x: YearSummary, max: number) => {
    const v = metricVal(x);
    return x.yr < RP_START ? Math.round(max * 0.2) : Math.max(4, Math.round(max * (metric === "graded" ? Math.sqrt(v / maxV) : v / maxV)));
  };
  const scrubLabel = (
    <div className="absolute top-0.5 z-10 pointer-events-none" style={{ left: `${pos(shown)}%`, transform: `translateX(${pos(shown) > 80 ? "-90%" : pos(shown) < 20 ? "-10%" : "-50%"})` }}>
      <div className={`whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] border shadow ${hover !== null && hover !== selected ? "bg-secondary border-foreground/25" : "bg-card border-accent/60"}`}>
        <span className={`font-serif font-bold mr-1 ${hover !== null && hover !== selected ? "text-foreground" : "text-accent"}`}>{shown}</span>
        <span className="text-muted-foreground">{labelFor(byYear.get(shown)!)}</span>
      </div>
    </div>
  );
  const centuryStrip = (h: number) => (
    <div className="relative pt-8">
      {scrubLabel}
      <div className="relative flex items-end gap-px select-none cursor-pointer" style={{ height: h, touchAction: "pan-y" }}
        onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); setHover(yearAt(e.currentTarget, e.clientX)); }}
        onPointerMove={e => setHover(yearAt(e.currentTarget, e.clientX))}
        onPointerUp={e => { setSelected(yearAt(e.currentTarget, e.clientX)); setHover(null); }}
        onPointerLeave={e => { if (e.pointerType === "mouse") setHover(null); }}
        onPointerCancel={() => setHover(null)}>
        <span className="absolute bottom-0 top-0 border-l border-dashed border-primary/50 pointer-events-none" style={{ left: `${((RP_START - asc[0].yr) / asc.length) * 100}%` }} />
        {asc.map(x => <span key={x.yr} className={`flex-1 rounded-t-[1px] ${barTone(x)}`} style={{ height: barH(x, h) }} />)}
      </div>
      <div className="relative h-4 mt-1 text-[9px] text-muted-foreground">
        {asc.filter(x => (x.yr % 20 === 0 && Math.abs(x.yr - RP_START) > 8) || x.yr === RP_START).map(x => (
          <span key={x.yr} className={`absolute -translate-x-1/2 ${x.yr === RP_START ? "text-primary/80" : ""}`} style={{ left: `${pos(x.yr)}%` }}>{x.yr}</span>
        ))}
      </div>
    </div>
  );
  // Swipeable bars: whichever bar sits under the centre line is the year shown
  const swipeRef = useRef<HTMLDivElement>(null);
  const BAR = 14, GAP = 4;
  const programmatic = useRef(false);   // ignore scroll events caused by our own scrollTo
  const firstScroll = useRef(true);
  useEffect(() => {
    const el = swipeRef.current; if (!el) return;
    const i = asc.findIndex(x => x.yr === selected);
    if (Math.round(el.scrollLeft / (BAR + GAP)) === i) return;
    programmatic.current = true;
    el.scrollTo({ left: i * (BAR + GAP), behavior: firstScroll.current ? "auto" : "smooth" });
    firstScroll.current = false;
    const t = setTimeout(() => { programmatic.current = false; }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  const swipeFrame = useRef<number | null>(null);
  const onSwipe = () => {
    if (programmatic.current) return;
    if (swipeFrame.current) cancelAnimationFrame(swipeFrame.current);
    swipeFrame.current = requestAnimationFrame(() => {
      const el = swipeRef.current; if (!el || !el.clientWidth) return;
      const i = Math.min(asc.length - 1, Math.max(0, Math.round(el.scrollLeft / (BAR + GAP))));
      if (asc[i].yr !== selected) setSelected(asc[i].yr);
    });
  };
  // The strip may be hidden when the page loads (e.g. a wide window narrowed later): re-centre the selected year
  // whenever it gains size, since a hidden element can't be scrolled
  const selectedRef = useRef(selected); selectedRef.current = selected;
  useEffect(() => {
    const el = swipeRef.current; if (!el) return;
    let lastW = 0;
    const ro = new ResizeObserver(() => {
      if (!el.clientWidth || el.clientWidth === lastW) return;
      lastW = el.clientWidth;
      programmatic.current = true;
      el.scrollTo({ left: asc.findIndex(x => x.yr === selectedRef.current) * (BAR + GAP), behavior: "auto" });
      setTimeout(() => { programmatic.current = false; }, 100);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [asc]);
  // Mouse support: drag the strip, or use the scroll wheel, to move through the years (touch swipes work natively)
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  useEffect(() => {
    const el = swipeRef.current; if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const atEdge = e.deltaY > 0 ? el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 : el.scrollLeft <= 2;
      if (atEdge) return;
      e.preventDefault(); el.scrollBy({ left: e.deltaY });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);
  const swipeBars = (
    <div className="relative">
      <div className="text-center mb-1">
        <span className="font-serif text-2xl font-bold">{selected}</span>
        <span className="ml-2 text-[11px] text-muted-foreground">{labelFor(byYear.get(selected)!)}</span>
      </div>
      <div className="relative">
        <span className="absolute left-1/2 -translate-x-1/2 top-0 bottom-5 w-px bg-accent/70 z-10 pointer-events-none" />
        <div ref={swipeRef} onScroll={onSwipe} className="overflow-x-auto scrollbar-hide snap-x snap-mandatory cursor-grab active:cursor-grabbing select-none"
          onPointerDown={e => { if (e.pointerType !== "mouse") return; drag.current = { x: e.clientX, left: e.currentTarget.scrollLeft, moved: false }; e.currentTarget.style.scrollSnapType = "none"; }}
          onPointerMove={e => { const d = drag.current; if (!d) return; if (Math.abs(e.clientX - d.x) > 3) d.moved = true; e.currentTarget.scrollLeft = d.left - (e.clientX - d.x); }}
          onPointerUp={e => { const d = drag.current; drag.current = null; const el = e.currentTarget; el.style.scrollSnapType = "";
            const i = Math.min(asc.length - 1, Math.max(0, Math.round(el.scrollLeft / (BAR + GAP)))); el.scrollTo({ left: i * (BAR + GAP), behavior: "smooth" });
            if (d?.moved) { const stop = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); }; el.addEventListener("click", stop, { capture: true, once: true }); } }}
          onPointerLeave={e => { if (drag.current) { drag.current = null; e.currentTarget.style.scrollSnapType = ""; } }}>
          <div className="flex items-end h-16" style={{ gap: GAP, paddingLeft: `calc(50% - ${BAR / 2}px)`, paddingRight: `calc(50% - ${BAR / 2}px)`, width: "max-content" }}>
            {asc.map((x, i) => (
              <button key={x.yr} aria-label={String(x.yr)} onClick={() => setSelected(asc[i].yr)}
                className={`snap-center shrink-0 rounded-t-sm ${barTone(x)}`} style={{ width: BAR, height: barH(x, 60) }} />
            ))}
          </div>
          <div className="flex h-5 text-[9px] text-muted-foreground" style={{ gap: GAP, paddingLeft: `calc(50% - ${BAR / 2}px)`, paddingRight: `calc(50% - ${BAR / 2}px)`, width: "max-content" }}>
            {asc.map(x => <span key={x.yr} className="shrink-0 text-center" style={{ width: BAR }}>{x.yr % 10 === 0 ? `’${String(x.yr).slice(2)}` : ""}</span>)}
          </div>
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent" />
      </div>
    </div>
  );

  const compactStage = (
    <div className="flex items-center gap-1.5">
      {st === "record" ? <span className="text-[11px] text-muted-foreground">Before Rich Picks</span> : STAGES.map((x, i) => {
        const at = STAGES.findIndex(y => y.key === st);
        return <span key={x.key} className={`w-2 h-2 rotate-45 border ${i === at ? (st === "decided" ? "bg-primary border-primary" : "bg-sky-400 border-sky-400") : i < at ? "bg-primary/70 border-primary/70" : "border-border"}`} />;
      })}
      {st !== "record" && <span className={`ml-1 text-[11px] ${st === "decided" ? "text-primary" : "text-sky-300"}`}>{STAGES.find(x => x.key === st)?.label}</span>}
    </div>
  );
  const mobileStageHead = (
    <div className="flex items-center gap-3 mb-4">
      {/* on phones the timeline already names the year */}
      <h2 className="hidden md:block font-serif text-2xl font-bold leading-none">{shown}</h2>
      <div className="md:hidden">{compactStage}</div>
      <div className="hidden md:block flex-1 min-w-0"><StageTrack stage={st} wide /></div>
      <Link href={`/year/${shown}`} className="ml-auto text-xs text-accent inline-flex items-center gap-0.5">{shown} page <ChevronRight className="w-3 h-3" /></Link>
    </div>
  );
  const stillPanel = (full: boolean) => open && still.length > 0 && (
    <div className={full ? "" : "rounded-xl border border-sky-500/25 bg-sky-500/[0.03] p-4"}>
      {!full && <SectionHead title="Still to see" icon={<Eye className="w-4 h-4 text-sky-400" />} sub={`Pending ${shown} films · most festival honors first`} />}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {([{ key: "all", label: "All" }, ...GROUPS] as { key: GroupKey | "all"; label: string }[]).map(g => {
          const n = g.key === "all" ? still.length : still.filter(f => groupOf(f, today) === g.key).length;
          if (!n) return null;
          return <button key={g.key} onClick={() => setFilter(g.key)} className={`touch-target px-2.5 py-1 rounded-full text-[11px] border ${filter === g.key ? "border-sky-400 bg-sky-500/15 text-sky-200" : "border-border text-muted-foreground"}`}>{g.label} {n}</button>;
        })}
      </div>
      <ul className="divide-y divide-border/40">{still.filter(f => filter === "all" || groupOf(f, today) === filter).slice(0, 12).map(f => <StillRow key={f.film_id} f={f} links />)}</ul>
      <Link href="/season" className="mt-3 pt-3 border-t border-sky-500/20 flex items-center justify-center gap-1 text-xs text-accent">The full {shown} season <ChevronRight className="w-3 h-3" /></Link>
    </div>
  );
  const picksPanel = (
    <div className="space-y-5">
      {shown >= RP_START ? pickBlock : null}
      {peersBlock("stack")}
    </div>
  );
  const tabs = (
    <div>
      <div className="flex rounded-lg border border-border bg-card/60 p-1 mb-4 text-[12px]" role="tablist">
        {([["top", shown < RP_START ? "Most honored" : open ? "Top 10 so far" : "Top 10"], ["picks", shown < RP_START ? "Best Picture" : "Picks & awards"], ["still", open ? `Still to see` : ""]] as ["top" | "picks" | "still", string][]).filter(([, l]) => l).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`touch-target flex-1 rounded-md py-2 ${tab === k ? (k === "still" ? "bg-sky-500/15 text-sky-200" : "bg-secondary text-foreground") : "text-muted-foreground"}`}>
            {k === "still" && <Eye className="inline w-3.5 h-3.5 mr-1 -translate-y-px text-sky-400" />}{l}
          </button>
        ))}
      </div>
      {tab === "top" && topTenBlock()}
      {tab === "picks" && picksPanel}
      {tab === "still" && stillPanel(true)}
    </div>
  );
  useEffect(() => { if (tab === "still" && !(open && still.length)) setTab("top"); }, [shown]); // eslint-disable-line react-hooks/exhaustive-deps

  const mobileView = (
    <div className="pb-16">
      {/* header: title, intro, search full-width below (beside the title on tablets) */}
      <div className="px-4 md:px-8 pt-10 md:pt-14">
        <div className="md:flex md:items-end md:gap-6">
          <div className="min-w-0">
            <h1 className="font-serif text-4xl md:text-5xl font-bold tracking-tight leading-none">Rich<span className="text-accent"> Picks</span></h1>
            <p className="mt-3 text-sm md:text-base text-muted-foreground">Rich’s picks for the best in film every year since 2005, alongside the major awards back to {asc[0].yr}. <Link href="/about" className="ml-1 inline-flex items-center gap-0.5 whitespace-nowrap text-xs text-muted-foreground/80 hover:text-accent transition-colors">More about the site<ChevronRight className="w-3 h-3" /></Link></p>
          </div>
          <HomeSearch className="mt-4 md:mt-0 md:ml-auto md:w-72 md:shrink-0" {...yearSearch} placeholder="Search films, people or a year" />
        </div>
      </div>
      <div className="px-6 md:px-8 mt-7"><ThisWeekStrip films={anticipationFilms} boardAnchor="/season" boardLabel={`Full ${anticipationYear} season`} /></div>

      {/* timeline: sticky under the site header */}
      <div className="sticky top-14 z-30 mt-6 px-4 md:px-8 pt-2 pb-2 bg-background/95 backdrop-blur border-y border-border/60">
        {/* phones */}
        <div className="md:hidden">
          {swipeBars}
          <div className="flex justify-end">{metricSelect}</div>
        </div>
        {/* tablets */}
        <div className="hidden md:block">
          <div className="flex items-center justify-between">{metricSelect}<span className="text-[10px] text-muted-foreground">Drag across the bars to move through the years</span></div>
          <div className="flex items-end gap-3">
            <button onClick={() => setSelected(y => Math.max(asc[0].yr, y - 1))} aria-label="Earlier year" className="mb-5 w-9 h-9 shrink-0 rounded-full border border-border flex items-center justify-center"><ChevronLeft className="w-4 h-4" /></button>
            <div className="flex-1 min-w-0">{centuryStrip(64)}</div>
            <button onClick={() => setSelected(y => Math.min(anticipationYear, y + 1))} aria-label="Later year" className="mb-5 w-9 h-9 shrink-0 rounded-full border border-border flex items-center justify-center"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 mt-6">
        {mobileStageHead}
        {/* phones */}
        <div className="md:hidden">
          {shown >= RP_START && <div className="mb-5">{numbers}</div>}
          {tabs}
        </div>
        {/* tablets */}
        <div className="hidden md:block">
          {shown >= RP_START && <div className="mb-5 max-w-lg mx-auto">{numbers}</div>}
          {tabs}
        </div>
      </div>
    </div>
  );

  const fade = { initial: { opacity: 0.55 }, animate: { opacity: 1 }, transition: { duration: 0.12 } };

  return (
    <MemberActionsProvider>
    <div className="min-h-screen bg-background text-foreground">
      <div className="lg:hidden">{mobileView}</div>
      <div className="hidden lg:block">
        <div className="max-w-[1240px] mx-auto px-12 pt-20 pb-28">
          {header}
          <div className="mb-10"><ThisWeekStrip films={anticipationFilms} boardAnchor="/season" boardLabel={`Full ${anticipationYear} season`} /></div>
          {scrubber}
          <motion.div key={shown} {...fade} className="mt-8">
            {stageHead}
            <div className={`grid gap-8 items-start ${open && still.length ? "grid-cols-[1.1fr_0.95fr_1fr]" : "grid-cols-[1.3fr_1fr]"}`}>
              {topTenBlock()}
              <div className="space-y-5 min-w-0">
                {numbers}
                {shown >= RP_START ? pickBlock : null}
                {peersBlock("stack")}
              </div>
              {open && still.length > 0 && (
                <div className="rounded-xl border border-sky-500/25 bg-sky-500/[0.03] p-4 min-w-0">
                  <SectionHead title="Still to see" icon={<Eye className="w-4 h-4 text-sky-400" />} sub={`Pending ${shown} films · most festival honors first`} />
                  <div className="flex flex-wrap gap-1 mb-2">
                    {([{ key: "all", label: "All" }, ...GROUPS] as { key: GroupKey | "all"; label: string }[]).map(g => {
                      const n = g.key === "all" ? still.length : still.filter(f => groupOf(f, today) === g.key).length;
                      if (!n) return null;
                      return <button key={g.key} onClick={() => setFilter(g.key)} className={`px-2 py-0.5 rounded-full text-[11px] border ${filter === g.key ? "border-sky-400 bg-sky-500/15 text-sky-200" : "border-border text-muted-foreground hover:text-foreground"}`}>{g.label} {n}</button>;
                    })}
                  </div>
                  <ul className="divide-y divide-border/40 max-h-[520px] overflow-y-auto pr-1">
                    {still.filter(f => filter === "all" || groupOf(f, today) === filter).map(f => <StillRow key={f.film_id} f={f} links />)}
                  </ul>
                  <Link href="/season" className="mt-3 pt-3 border-t border-sky-500/20 flex items-center justify-center gap-1 text-xs text-accent hover:underline">The full {shown} season: seen and still to see <ChevronRight className="w-3 h-3" /></Link>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
    </MemberActionsProvider>
  );
}
