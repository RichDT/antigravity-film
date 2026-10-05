import type { Metadata } from 'next';
import { getAnticipationBoardFilms } from '@/lib/awards';
import { query } from '@/lib/db';
import { CommunityDemo, type DemoFilm, type DemoReviewed } from '@/components/demo/CommunityDemo';

// Hidden mockup: not linked anywhere, not indexed, read-only (all interaction is saved in the visitor's browser only)
export const metadata: Metadata = {
  title: 'Community features demo · Rich Picks',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

export default async function CommunityDemoPage() {
  const year = new Date().getFullYear();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
  const [board, reviewed] = await Promise.all([
    getAnticipationBoardFilms(year),
    query(
      `SELECT f.film_id, f.title, r.grade
       FROM reviews r JOIN films f USING (film_id)
       WHERE f.release_year = $1 AND r.grade IS NOT NULL AND r.grade <> ''
       ORDER BY f.title`,
      [year]
    ),
  ]);

  const anticipated: DemoFilm[] = board
    .filter(f => f.us_release_date || f.trailer_url)
    // Upcoming soonest first, then already released (most recent first), then undated — like the live board
    .sort((a, b) => {
      const rank = (d: string | null) => (!d ? 2 : d >= today ? 0 : 1);
      const ra = rank(a.us_release_date), rb = rank(b.us_release_date);
      if (ra !== rb) return ra - rb;
      if (ra === 0) return a.us_release_date!.localeCompare(b.us_release_date!);
      if (ra === 1) return b.us_release_date!.localeCompare(a.us_release_date!);
      return a.title.localeCompare(b.title);
    })
    .map(f => ({
      film_id: f.film_id,
      title: f.title,
      us_release_date: f.us_release_date,
      release_venue: f.release_venue,
      trailer_url: f.trailer_url,
    }));

  return <CommunityDemo year={year} anticipated={anticipated} reviewed={reviewed.rows as DemoReviewed[]} />;
}
