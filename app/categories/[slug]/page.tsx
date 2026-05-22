import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  Trophy,
  User,
  Clapperboard,
  Camera,
  Music,
  Scissors,
  Sparkles,
  PenTool,
  Palette,
  Globe,
  FileText,
  Wand2,
  Brush,
  Volume2,
  Award,
  Circle,
  Film,
  FileVideoCamera,
  UserStar,
  BookOpen,
  Theater,
  Shirt,
  MirrorRound,
  Piano,
  MicVocal,
  Headphones,
  SlidersHorizontal,
} from "lucide-react";
import { CategoryTimeline } from "@/components/category-timeline";
import { BackButton } from "@/components/back-button";

import {
  getAllCategories,
  getCategoryBySlug,
  getYearsForCategory,
  getTopNomineesForCategory,
  HallOfFameEntry,
} from "@/lib/awards";

// ISR: Re-generate this page at most once per hour on production.
export const revalidate = 86400;

export async function generateStaticParams() {
  const categories = await getAllCategories();
  return categories.map((cat: { slug: string }) => ({ slug: cat.slug }));
}

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata(props: Props) {
  const params = await props.params;
  const category = await getCategoryBySlug(params.slug);
  if (!category) return { title: 'Category Not Found' };

  return {
    title: `${category.name} Winners | Rich Picks`,
    description: `A historical timeline of ${category.name} winners and nominees.`
  };
}

function getCategoryIcon(iconName: string) {
  const icons: Record<string, React.ElementType> = {
    trophy: Trophy, clapperboard: Clapperboard, user: User, camera: Camera,
    music: Music, scissors: Scissors, sparkles: Sparkles, pen: PenTool,
    palette: Palette, globe: Globe, file: FileText, wand: Wand2, brush: Brush, volume: Volume2,
    film: Film, filevideo: FileVideoCamera, userstar: UserStar, pentool: PenTool,
    bookopen: BookOpen, theater: Theater, shirt: Shirt, mirror: MirrorRound,
    piano: Piano, micvocal: MicVocal, headphones: Headphones, sliders: SlidersHorizontal,
  };
  return icons[iconName] || Award;
}

function isActingCategory(name: string): boolean {
  return name.toLowerCase().includes("actor") || name.toLowerCase().includes("actress");
}


function HallOfFameTable({ entries }: { entries: HallOfFameEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden sticky top-24 shadow-sm animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="p-4 border-b border-border/50 bg-secondary/30">
        <h3 className="font-serif text-lg font-semibold flex items-center gap-2 text-foreground/90 tracking-tight">
          <Trophy className="w-4 h-4 text-accent" />
          Hall of Fame
        </h3>
        <p className="text-xs text-muted-foreground mt-1">All-time leading nominees & winners</p>
      </div>
      <div className="divide-y divide-border/50">
        {entries.map((entry, index) => (
          <div key={index} className="p-3 flex items-center justify-between hover:bg-secondary/20 transition-colors">
            <span className="text-sm font-medium truncate pr-4 text-foreground/90" title={entry.name}>
              {entry.name}
            </span>
            <div className="flex items-center gap-3 text-xs flex-shrink-0">
              <span className="flex items-center gap-1 w-8 justify-end" title="Wins">
                <span className="font-bold text-accent">{entry.wins}</span>
                <Trophy className="w-3 h-3 text-accent" />
              </span>
              <span className="flex items-center gap-1 w-8 justify-end text-muted-foreground" title="Nominations">
                <span className="font-medium">{entry.nominations}</span>
                <Circle className="w-2.5 h-2.5" fill="currentColor" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function CategoryDetailPage(props: Props) {
  const params = await props.params;
  const categoryDef = await getCategoryBySlug(params.slug);

  if (!categoryDef) {
    notFound();
  }

  const years = await getYearsForCategory(categoryDef.name);
  const topNominees = await getTopNomineesForCategory(categoryDef.name);
  const Icon = getCategoryIcon(categoryDef.icon);
  const isActing = isActingCategory(categoryDef.name);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <div className="pt-24 pb-8 px-6 md:px-10 border-b border-border bg-card/30">
        <div className="max-w-4xl mx-auto">
          <BackButton
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
            iconClassName="w-4 h-4"
            label="All Categories"
          />

          <div className="flex items-center gap-4">
            <div className="w-12 h-14 clip-hexagon bg-accent flex items-center justify-center shadow-[0_0_15px_rgba(212,175,55,0.15)]">
              <div
                className="clip-hexagon flex items-center justify-center"
                style={{ width: "calc(100% - 3px)", height: "calc(100% - 3px)", backgroundColor: "color-mix(in srgb, var(--accent) 20%, var(--background) 80%)" }}
              >
                <Icon className="w-6 h-6 text-accent drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]" />
              </div>
            </div>
            <div>
              <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground tracking-tight">
                {categoryDef.name}
              </h1>
              <p className="text-sm text-muted-foreground mt-1.5">{categoryDef.description}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content - Timeline of years */}
      <main className="max-w-6xl mx-auto px-6 md:px-10 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-12 items-start">

          {/* Timeline */}
          <CategoryTimeline
            years={years}
            isActing={isActing}
            categoryGroup={categoryDef.group}
            categoryName={categoryDef.name}
          />

          {/* Hall of Fame Sidebar (Desktop) */}
          <div className="hidden lg:block">
            <HallOfFameTable entries={topNominees} />
          </div>
        </div>

        {/* Hall of Fame Sidebar (Mobile) */}
        <div className="mt-12 lg:hidden">
          <HallOfFameTable entries={topNominees} />
        </div>

        {/* Stats summary at bottom */}
        {years.length > 0 && (
          <div className="mt-8 pt-8 border-t border-border/50">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{years.length} years of recorded history</span>
              <Link href="/categories" className="hover:text-foreground transition-colors flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" /> Back to taxonomy
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
