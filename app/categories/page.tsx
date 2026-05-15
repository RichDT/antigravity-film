import { Metadata } from 'next';
import Link from 'next/link';
import { Trophy, Film, Clapperboard, Camera, PenTool, Music, Scissors, User, FileText, Sparkles, Globe, Wand2, Brush, FileVideoCamera, UserStar, BookOpen, Theater, Shirt, MirrorRound, Piano, MicVocal, Headphones, SlidersHorizontal } from "lucide-react";
import { getAllCategories } from "@/lib/awards";

export const metadata: Metadata = {
  title: 'Categories | Rich Picks',
  description: 'Browse all award categories',
};

// Map string icon names to Lucide components statically
const IconMap: Record<string, React.ElementType> = {
  trophy: Trophy,
  film: Film,
  filevideo: FileVideoCamera,
  clapperboard: Clapperboard,
  camera: Camera,
  pen: PenTool,
  pentool: PenTool,
  bookopen: BookOpen,
  music: Music,
  scissors: Scissors,
  user: User,
  userstar: UserStar,
  wand: Wand2,
  brush: Brush,
  file: FileText,
  sparkles: Sparkles,
  globe: Globe,
  theater: Theater,
  shirt: Shirt,
  mirror: MirrorRound,
  piano: Piano,
  micvocal: MicVocal,
  headphones: Headphones,
  sliders: SlidersHorizontal,
};

const HIDDEN_CATEGORIES = new Set(['Special Visionary']);

export default async function CategoriesPage() {
  const allCategories = (await getAllCategories()).filter(c => !HIDDEN_CATEGORIES.has(c.name));

  // Group them by their visual group IDs defined in lib/awards.ts
  const groupsToDisplay = [
    { id: "film", title: "Feature & Short Films", icon: Film, description: "Honoring the best of feature and short films" },
    { id: "acting", title: "Acting", icon: UserStar, description: "Honoring outstanding performances by actors and actresses" },
    { id: "directing", title: "Directing & Editing", icon: Clapperboard, description: "Honoring the creatives who shape the film and structure its storytelling" },
    { id: "writing", title: "Writing", icon: PenTool, description: "Honoring the architects of the story, original and adapted" },
    { id: "visual", title: "Visual Arts", icon: Camera, description: "Honoring the visual artists designing and capturing what we see" },
    { id: "sound", title: "Sound & Music", icon: Music, description: "Honoring the sonic artists creating and arranging what we hear" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground pt-24 pb-20 px-6 md:px-12">
      <div className="max-w-6xl mx-auto">
        <div className="mb-12">
          <h1 className="font-serif text-4xl md:text-5xl font-bold tracking-tight mb-4 flex items-center gap-3">
            <Trophy className="w-8 h-8 md:w-10 md:h-10 text-accent" />
            Categories
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Browse through {allCategories.length} distinct award categories honoring excellence in cinema across history.
          </p>
        </div>

        <div className="space-y-16">
          {groupsToDisplay.map(group => {
            const groupCats = allCategories.filter(c => c.group === group.id);
            if (groupCats.length === 0) return null;

            const GroupIcon = group.icon;

            return (
              <section key={group.id} className="scroll-mt-24" id={group.id}>
                <div className="flex items-center gap-3 mb-6 pb-2 border-b border-border/50">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                    <GroupIcon className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h2 className="font-serif text-2xl font-bold">{group.title}</h2>
                    <p className="text-sm text-muted-foreground">{group.description}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupCats.map(category => {
                    const CatIcon = IconMap[category.icon] || Trophy;

                    return (
                      <Link
                        key={category.slug}
                        href={`/categories/${category.slug}`}
                        className="group flex items-start gap-4 p-5 rounded-lg border border-border bg-card/50 hover:bg-secondary/50 hover:border-accent/40 transition-all duration-300"
                      >
                        <div className="w-12 h-12 flex-shrink-0 clip-hexagon bg-secondary group-hover:bg-accent/20 flex items-center justify-center transition-colors">
                          <CatIcon className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                        </div>
                        <div>
                          <h3 className="font-medium text-foreground group-hover:text-accent transition-colors mb-1 line-clamp-2">
                            {category.name}
                          </h3>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {category.description}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
