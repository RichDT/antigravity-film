import type { Metadata } from 'next';
import Link from 'next/link';
import { Eye, Sparkles, Trophy, Award, ExternalLink } from 'lucide-react';
import { queryCached as query } from '@/lib/db';

export const metadata: Metadata = {
  title: 'About · Rich Picks',
  description: 'What Rich Picks is, where its data comes from, and who Rich is.',
};
export const revalidate = 3600;

const ORG_NAMES: Record<string, string> = {
  Oscars: 'Academy Awards', BAFTA: 'BAFTA Film Awards', Globes: 'Golden Globes', Spirit: 'Independent Spirit Awards', NBR: 'National Board of Review',
  SAG: 'Screen Actors Guild', DGA: 'Directors Guild', PGA: 'Producers Guild', WGA: 'Writers Guild', ASC: 'American Society of Cinematographers',
  ACE: 'American Cinema Editors', ADG: 'Art Directors Guild', CDG: 'Costume Designers Guild', MUAH: 'Make-Up Artists & Hair Stylists Guild',
  VES: 'Visual Effects Society', CAS: 'Cinema Audio Society', MPSE: 'Motion Picture Sound Editors', SCL: 'Society of Composers & Lyricists',
  Annie: 'Annie Awards', Grammy: 'Grammy Awards (visual media)',
};

async function getFacts() {
  const [counts, orgs, stages] = await Promise.all([
    query(`select (select count(*) from reviews where coalesce(grade,'')<>'')::int graded,
      (select count(*) from films)::int films, (select count(*) from people)::int people, (select count(*) from nominations)::int noms`),
    query(`select o.short_name, min(c.year)::int y0, max(c.year)::int y1
      from nominations n join ceremonies c using(ceremony_id) join awards a on a.award_id=c.award_id join organizations o on o.organization_id=a.organization_id
      where o.short_name <> 'Rich Picks' group by o.short_name order by min(c.year), o.short_name`),
    // Each recent year's stage, from the data: winners named → Decided; nominees → Nominated; graded or considered films → Considering
    query(`select y.yr::int,
        (select count(*) from nominations n join ceremonies c using(ceremony_id) join awards a on a.award_id=c.award_id join organizations o on o.organization_id=a.organization_id
          where o.short_name='Rich Picks' and c.year=y.yr)::int noms,
        (select count(*) from nominations n join ceremonies c using(ceremony_id) join awards a on a.award_id=c.award_id join organizations o on o.organization_id=a.organization_id
          where o.short_name='Rich Picks' and c.year=y.yr and n.win)::int wins,
        (select count(*) from reviews r join films f using(film_id) where f.release_year=y.yr and coalesce(r.grade,'')<>'')::int graded,
        (select count(*) from considerations k where k.year=y.yr)::int consid
      from generate_series(extract(year from now())::int - 2, extract(year from now())::int) y(yr) order by 1 desc`),
  ]);
  return { ...counts.rows[0], orgs: orgs.rows as { short_name: string; y0: number; y1: number }[], recent: stages.rows as { yr: number; noms: number; wins: number; graded: number; consid: number }[] };
}

const fmt = (n: number) => n.toLocaleString('en-US');

export default async function AboutPage() {
  const f = await getFacts();
  const year = new Date().getFullYear();
  const firstYear = Math.min(...f.orgs.map((o: { y0: number }) => o.y0));
  type Recent = { yr: number; noms: number; wins: number; graded: number; consid: number };
  const stageOf = (r: Recent) => r.wins ? 'Decided' : r.noms ? 'Nominated' : r.graded || r.consid ? 'Considering' : 'Watching';
  // Every year still open, newest first; if none is, the latest settled year
  const open = (f.recent as Recent[]).filter(r => stageOf(r) !== 'Decided');
  const shownYears = open.length ? open : (f.recent as Recent[]).slice(0, 1);
  const stages = [
    { icon: Eye, name: 'Watching', tone: 'text-sky-300', body: 'Films Rich is waiting to see: festival favorites, awards hopefuls and anything with a pedigree. They sit on the Anticipation Board until he sees them.' },
    { icon: Sparkles, name: 'Considering', tone: 'text-sky-300', body: 'Once seen, a film gets a grade and, if it’s in the running, a place under consideration in the categories it might contend in.' },
    { icon: Award, name: 'Nominated', tone: 'text-sky-300', body: 'After the year’s films are in, Rich names his nominees, usually five per category, fewer when fewer films earn it.' },
    { icon: Trophy, name: 'Decided', tone: 'text-primary', body: 'Then he names the winners, and the year settles into the record alongside every other year’s.' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-3xl mx-auto px-6 pt-14 pb-24">
        <h1 className="font-serif text-4xl md:text-5xl font-bold tracking-tight">About Rich<span className="text-accent"> Picks</span></h1>
        <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
          One critic’s film awards, given every year since 2005, kept side by side with the record of the major awards back to {firstYear}.
        </p>

        <section className="mt-12">
          <h2 className="font-serif text-2xl font-semibold">What this is</h2>
          <div className="mt-3 space-y-4 text-[15px] leading-relaxed text-foreground/85">
            <p>
              Every year Rich grades the films he sees, keeps a Top 10, and names his own nominees and winners across the categories the
              industry awards use, from Best Picture to Sound. There is no voting body: each pick is one person’s considered judgment.
            </p>
            <p>
              Those picks sit next to the industry’s. Wherever a Rich Picks nominee was also recognized by the Oscars, BAFTA, the Globes, the
              guilds or the critics’ groups, the site says so, so you can see where Rich agreed with the consensus and where he didn’t.
            </p>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="font-serif text-2xl font-semibold">How a year unfolds</h2>
          <p className="mt-2 text-sm text-muted-foreground">Every year passes through the same four stages. Right now{' '}
            {shownYears.map((r, i) => (
              <span key={r.yr}>{i > 0 && (i === shownYears.length - 1 ? ' and ' : ', ')}{r.yr} is in <span className={stageOf(r) === 'Decided' ? 'text-primary' : 'text-sky-300'}>{stageOf(r)}</span></span>
            ))}.</p>
          <ol className="mt-5 grid sm:grid-cols-2 gap-3">
            {stages.map((st, i) => (
              <li key={st.name} className="relative rounded-xl border border-border bg-card/70 p-4">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rotate-45 ${st.name === 'Decided' ? 'bg-primary' : 'bg-sky-400'}`} />
                  <h3 className={`font-serif text-lg font-semibold ${st.tone}`}>{st.name}</h3>
                  <span className="ml-auto text-[11px] text-muted-foreground/70">{i + 1} of 4</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{st.body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">Across the site, blue marks what’s still open and gold marks what’s settled.</p>
        </section>

        <section className="mt-12">
          <h2 className="font-serif text-2xl font-semibold">The data</h2>
          <dl className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[{ n: f.graded, l: 'films graded by Rich' }, { n: f.noms, l: 'award nominations' }, { n: f.films, l: 'films' }, { n: f.people, l: 'people' }].map(x => (
              <div key={x.l} className="rounded-lg border border-border bg-card/60 px-3 py-3 text-center">
                <dt className="sr-only">{x.l}</dt>
                <dd className="font-serif text-2xl font-bold">{fmt(x.n)}</dd>
                <p className="text-[11px] text-muted-foreground">{x.l}</p>
              </div>
            ))}
          </dl>
          <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-foreground/85">
            <p>
              <span className="font-semibold text-foreground">Rich’s own records</span> start in 2005: grades, Top 10s, considerations,
              nominations and winners, plus reviews. Grades use a 25-step scale from A+ to F, including split grades like B//B- for films that
              sit between two marks. These records began in Rich’s notes and blog, moved through earlier versions of this database, and now live here.
            </p>
            <p>
              <span className="font-semibold text-foreground">The major awards</span> run back to {firstYear}. Each organization’s
              nominees and winners are included for the years below, matched to Rich’s categories so they can be compared directly:
            </p>
          </div>
          <ul className="mt-4 grid sm:grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
            {f.orgs.map((o: { short_name: string; y0: number; y1: number }) => (
              <li key={o.short_name} className="flex items-baseline gap-2 border-b border-border/40 py-1">
                <span className="text-foreground/90">{ORG_NAMES[o.short_name] ?? o.short_name}</span>
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">{o.y0}–{o.y1}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-foreground/85">
            <p>
              <span className="font-semibold text-foreground">Film details</span> (credits, U.S. release dates, budgets and box office) come from
              Wikipedia and the awards bodies’ own records, and recent films’ box office is refreshed daily. Preview screenings are tracked for
              San Francisco.
            </p>
            <p className="text-sm text-muted-foreground">
              Spot a mistake or a gap? <Link href="/feedback" className="text-accent hover:underline">Send feedback</Link>. Corrections are welcome.
            </p>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="font-serif text-2xl font-semibold">About Rich</h2>
          <div className="mt-3 space-y-4 text-[15px] leading-relaxed text-foreground/85">
            <p>
              Rich is a researcher, artist and critic who has written about film for {year - 2005} years, since 2005: first on his blog{' '}
              <a href="https://ayearinfilm.blogspot.com/" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline inline-flex items-center gap-0.5">A Year in Film<ExternalLink className="w-3 h-3" /></a>{' '}
              and now in <a href="https://richreviews.substack.com/" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline inline-flex items-center gap-0.5">Rich Reviews<ExternalLink className="w-3 h-3" /></a>.
              He attends the Sundance Film Festival every year.
            </p>
          </div>
          <p className="mt-4 text-[15px] leading-relaxed text-foreground/85">
            Rich studied photography and film at Harvard University, where he earned a Bachelor of Arts in psychology, and holds a
            Master’s and a Doctorate in psychological research from Carnegie Mellon University.
          </p>
        </section>
      </main>
    </div>
  );
}
