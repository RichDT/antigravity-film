// One awards season: every film Rich has graded or is waiting to see, by when and where it opens.
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Clapperboard, CircleHelp, Eye } from "lucide-react";
import { FestivalBadge, groupBySource } from "@/components/AnticipationBoard";
import { GradeHex, MetaLinks } from "@/components/home/YearLens";
import type { SeasonFilm } from "@/lib/home-data";
import { MemberActionsProvider, FilmStatusIcons } from "@/components/community/FilmStatusControls";

const todaySF = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
type Show = "all" | "seen" | "unseen";

function Row({ f }: { f: SeasonFilm }) {
  return (
    <li className="group flex items-start gap-3 py-2.5 min-w-0">
      {f.grade ? <GradeHex grade={f.grade} /> : <span className="w-7 h-8 shrink-0 flex items-center justify-center"><Eye className="w-4 h-4 text-sky-400" /></span>}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/film/${f.film_id}`} className="text-sm font-medium hover:text-accent">{f.title}</Link>
          {Object.entries(groupBySource(f.accolades)).map(([src, acc]) => <FestivalBadge key={src} source={src} accolades={acc} />)}
        </div>
        <MetaLinks f={f} />
      </div>
      <FilmStatusIcons filmId={f.film_id} title={f.title} quiet className="-mr-1" />
    </li>
  );
}

function Group({ title, hint, icon: Icon, films }: { title: string; hint: string; icon: React.ElementType; films: SeasonFilm[] }) {
  if (!films.length) return null;
  return (
    <section className="min-w-0">
      <div className="flex items-baseline gap-2 border-b border-border/70 pb-1.5">
        <Icon className="w-4 h-4 text-muted-foreground translate-y-0.5" />
        <h2 className="font-serif text-xl font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground">{films.length}</span>
        <span className="ml-auto text-[11px] text-muted-foreground/80">{hint}</span>
      </div>
      <ul className="divide-y divide-border/40">{films.map(f => <Row key={f.film_id} f={f} />)}</ul>
    </section>
  );
}

export function SeasonPage({ year, currentYear, films }: { year: number; currentYear: number; films: SeasonFilm[] }) {
  const y = year;
  const [show, setShow] = useState<Show>("all");
  const today = todaySF();
  const all = films;
  const visible = all.filter(f => f.grade || f.us_release_date || f.trailer_url); // unseen films appear once there's a date or trailer
  const list = visible.filter(f => show === "all" || (show === "seen" ? !!f.grade : !f.grade));
  const { coming, out, tba } = useMemo(() => {
    const byTitle = (a: SeasonFilm, b: SeasonFilm) => a.title.localeCompare(b.title);
    return {
      // Coming soon: by date, then most festival honors, then title
      coming: list.filter(f => f.us_release_date && f.us_release_date > today)
        .sort((a, b) => a.us_release_date!.localeCompare(b.us_release_date!) || b.accolades.length - a.accolades.length || byTitle(a, b)),
      // Out now (in theaters or streaming): alphabetical
      out: list.filter(f => f.us_release_date && f.us_release_date <= today).sort(byTitle),
      tba: list.filter(f => !f.us_release_date).sort(byTitle),
    };
  }, [list, today]);
  const seenN = visible.filter(f => f.grade).length;

  return (
    <MemberActionsProvider>
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-[1240px] mx-auto px-6 lg:px-12 pt-20 pb-28">
        <Link href="/" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="w-3 h-3" />Rich Picks</Link>
        <div className="mt-4 flex items-end gap-6 flex-wrap">
          <div>
            <h1 className="font-serif text-4xl font-bold tracking-tight">The {y} season</h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-2xl">Every {y} film in contention: the ones Rich has graded and the ones he’s still waiting to see. U.S. release dates.</p>
          </div>
          <div className="ml-auto flex gap-2">
            {[currentYear, currentYear - 1].map(v => (
              <Link key={v} href={v === currentYear ? "/season" : `/season/${v}`} className={`px-3 py-1.5 rounded-full text-xs border ${y === v ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:text-foreground"}`}>{v}</Link>
            ))}
          </div>
        </div>
        <div className="mt-6 mb-8 flex items-center gap-2 text-xs">
          {([["all", `All ${visible.length}`], ["seen", `Graded by Rich ${seenN}`], ["unseen", `Still to see ${visible.length - seenN}`]] as [Show, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setShow(k)} className={`px-3 py-1 rounded-full border ${show === k ? (k === "unseen" ? "border-sky-400 bg-sky-500/15 text-sky-200" : "border-accent bg-accent/10 text-accent") : "border-border text-muted-foreground hover:text-foreground"}`}>{l}</button>
          ))}
          <span className="ml-3 flex items-center gap-1.5 text-muted-foreground"><Eye className="w-3.5 h-3.5 text-sky-400" />still to see · a grade hex means Rich has seen it</span>
        </div>
        <div className="grid lg:grid-cols-2 gap-x-12 gap-y-10 items-start">
          <div className="space-y-10 min-w-0">
            <Group title="Coming soon" hint="By date, then festival honors" icon={CalendarDays} films={coming} />
            <Group title="Date to be announced" hint="Alphabetical" icon={CircleHelp} films={tba} />
          </div>
          <Group title="Out now" hint="In theaters or streaming · alphabetical" icon={Clapperboard} films={out} />
        </div>
        <p className="mt-12 text-[11px] text-muted-foreground">Hover a film for Want to see and I’ve seen it. Marking a film seen asks for a quick grade and take.</p>
      </div>
    </div>
    </MemberActionsProvider>
  );
}
