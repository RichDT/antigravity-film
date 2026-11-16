import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { SeasonPage } from '@/components/season/SeasonPage';
import { loadSeason } from '@/lib/home-data';

export const revalidate = 3600;

type Props = { params: Promise<{ year: string }> };

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
