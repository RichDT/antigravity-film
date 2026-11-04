import type { Metadata } from 'next';
import Link from 'next/link';
import { getConsiderationYears, getConsiderationsGrouped, CATEGORY_GROUPS_MAPPING } from '@/lib/awards';
import { CommunityPicks, type PickCategory } from '@/components/community/CommunityPicks';

export const metadata: Metadata = { title: 'Community Picks · Rich Picks' };
export const revalidate = 3600;

const GROUP_ORDER = ['film', 'directing', 'acting', 'writing', 'visual', 'sound'];

export default async function PicksPage() {
  const [year] = await getConsiderationYears();
  if (!year) return <p className="max-w-3xl mx-auto px-4 py-16 text-muted-foreground">No contenders yet.</p>;
  const grouped = await getConsiderationsGrouped(year);

  // One ballot option per performer in acting categories, one per film elsewhere
  const categories: PickCategory[] = Object.entries(grouped).map(([name, entries]) => {
    const group = CATEGORY_GROUPS_MAPPING[name] || 'film';
    const options: PickCategory['options'] = [];
    const seenFilms = new Set<number>();
    for (const e of entries) {
      if (group === 'acting') {
        options.push({ considerationId: e.consideration_id, filmId: e.film_id, title: e.title, detail: e.detail });
      } else if (!seenFilms.has(e.film_id)) {
        seenFilms.add(e.film_id);
        const names = entries.filter(x => x.film_id === e.film_id && x.detail).map(x => x.detail!);
        options.push({ considerationId: e.consideration_id, filmId: e.film_id, title: e.title, detail: group === 'film' ? null : names.join(', ') || null });
      }
    }
    return { categoryId: entries[0].category_id, name, group, options };
  }).sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || a.name.localeCompare(b.name));

  return (
    <div className="max-w-5xl mx-auto px-4 pt-10 pb-16">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{year} · Community</p>
        <h1 className="font-serif text-3xl font-bold tracking-tight">Community Picks</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
          Choose one contender per category from the films <Link href={`/year/${year}`} className="text-accent hover:underline">Rich is considering for {year}</Link>.
          These are the community’s picks, not Rich’s nominations or winners. Only totals are shown.
        </p>
      </header>
      <CommunityPicks year={year} categories={categories} />
    </div>
  );
}
