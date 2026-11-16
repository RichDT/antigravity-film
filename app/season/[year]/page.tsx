import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { SeasonPage } from '@/components/season/SeasonPage';
import { loadSeason } from '@/lib/home-data';

export const revalidate = 3600;

type Props = { params: Promise<{ year: string }> };

// Cached like the year pages: last season is built ahead; any other year is built on its first visit, then cached
export async function generateStaticParams() {
  return [{ year: String(new Date().getFullYear() - 1) }];
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { year } = await props.params;
  return { title: `The ${year} season · Rich Picks` };
}

export default async function Page(props: Props) {
  const { year } = await props.params;
  const y = Number(year);
  const current = new Date().getFullYear();
  if (!Number.isInteger(y) || y < 2005 || y > current) notFound();
  if (y === current) redirect('/season');
  return <SeasonPage year={y} currentYear={current} films={await loadSeason(y)} />;
}
