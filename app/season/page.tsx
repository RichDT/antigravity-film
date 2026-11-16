import type { Metadata } from 'next';
import { SeasonPage } from '@/components/season/SeasonPage';
import { loadSeason } from '@/lib/home-data';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const year = new Date().getFullYear();
  return { title: `The ${year} season · Rich Picks`, description: `Every ${year} film Rich has graded or is waiting to see, coming soon and out now.` };
}

export default async function Page() {
  const year = new Date().getFullYear();
  return <SeasonPage year={year} currentYear={year} films={await loadSeason(year)} />;
}
