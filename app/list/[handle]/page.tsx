import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Bookmark, Play } from 'lucide-react';
import { query } from '@/lib/db';
import { CalendarLinks } from '@/components/account/CalendarLinks';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ handle: string }> };

function cleanHandle(raw: string) {
  return decodeURIComponent(raw).replace(/^@/, '').toLowerCase();
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const handle = cleanHandle((await props.params).handle);
  return { title: `@${handle} wants to see · Rich Picks`, robots: { index: false, follow: false } };
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
}

/** A member's want-to-see list — public by design so it can be shared with anyone, account or not. */
export default async function WantListPage(props: Props) {
  const handle = cleanHandle((await props.params).handle);
  if (!/^[a-z0-9_.]{3,24}$/.test(handle)) notFound();
  const profile = await query(`SELECT user_id FROM profiles WHERE handle = $1`, [handle]);
  if (!profile.rows[0]) notFound();

  const { rows: films } = await query(
    `SELECT f.film_id, f.title, to_char(f.us_release_date, 'YYYY-MM-DD') AS us_release_date, f.release_venue, f.trailer_url
     FROM user_film_status s JOIN films f USING (film_id)
     WHERE s.user_id = $1 AND s.status = 'want'
     ORDER BY f.us_release_date NULLS LAST, f.title`,
    [profile.rows[0].user_id]
  );

  return (
    <div className="max-w-2xl mx-auto px-4 pt-12 pb-16">
      <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><Bookmark className="w-3.5 h-3.5" /> Want-to-see list</p>
      <h1 className="mt-1 font-serif text-3xl font-bold tracking-tight">@{handle} <span className="text-accent">wants to see</span></h1>
      <p className="mt-1 text-sm text-muted-foreground">{films.length} {films.length === 1 ? 'film' : 'films'} from the Rich Picks Anticipation Board.</p>

      <ul className="mt-5 rounded-lg border border-border bg-card divide-y divide-border/50">
        {films.map(film => (
          <li key={film.film_id} className="px-3 py-3 space-y-2">
            <div>
              <Link href={`/film/${film.film_id}`} className="font-medium text-foreground hover:text-accent leading-snug">{film.title}</Link>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {film.us_release_date ? formatDate(film.us_release_date) : 'Date TBA'}{film.release_venue ? ` · ${film.release_venue}` : ''}
                {film.trailer_url && <> · <a href={film.trailer_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:text-accent"><Play className="w-2.5 h-2.5" fill="currentColor" />Trailer</a></>}
              </p>
            </div>
            <CalendarLinks film={film} />
          </li>
        ))}
        {films.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted-foreground italic">Nothing on this list yet.</li>}
      </ul>

      <div className="mt-6 rounded-lg border border-border bg-secondary/30 p-4 text-sm">
        <p className="font-medium">Make your own list</p>
        <p className="mt-1 text-muted-foreground text-xs">Sign in with Google or an email link to keep a want-to-see list, grade what you’ve seen on Rich’s A+–F scale, and share your take.</p>
        <Link href={`/signin?next=/`} className="mt-3 inline-flex h-10 items-center px-4 rounded-md bg-accent text-accent-foreground text-xs font-semibold">Sign in</Link>
      </div>
    </div>
  );
}
