import { Metadata } from "next";
import Link from "next/link";
import { Award, Camera, Film, Mic, Music, Palette, Scissors, User, Users, Clapperboard, Globe, FileText, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { getCategories } from "@/lib/data";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Award Categories | Rich Picks",
  description: "Explore film picks across all award categories including Best Picture, Acting, Directing, and Technical achievements.",
};

// Map category slugs to icons
const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  "best-picture": Film,
  "directing": Clapperboard,
  "actor": User,
  "actress": User,
  "supporting-actor": Users,
  "supporting-actress": Users,
  "original-screenplay": FileText,
  "adapted-screenplay": FileText,
  "cinematography": Camera,
  "editing": Scissors,
  "score": Music,
  "sound": Mic,
  "visual-effects": Sparkles,
  "production-design": Palette,
  "international": Globe,
  "animated": Sparkles,
  "documentary": Film,
};

export default async function CategoriesPage() {
  const categories = await getCategories();

  // Group categories by type for better organization
  const coreCategories = categories.filter(c => 
    ["best-picture", "directing", "actor", "actress", "supporting-actor", "supporting-actress", "original-screenplay", "adapted-screenplay"].includes(c.slug)
  );
  
  const technicalCategories = categories.filter(c => 
    ["cinematography", "editing", "score", "sound", "visual-effects", "production-design"].includes(c.slug)
  );
  
  const otherCategories = categories.filter(c => 
    !coreCategories.includes(c) && !technicalCategories.includes(c)
  );

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      
      <main className="container px-4 py-8">
        {/* Header */}
        <header className="mb-12 text-center">
          <h1 className="font-serif text-4xl font-bold tracking-tight text-foreground md:text-5xl">
            Award Categories
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Explore winning selections across all categories of cinematic excellence.
          </p>
        </header>

        {/* Category Sections */}
        {categories.length > 0 ? (
          <div className="space-y-12 max-w-5xl mx-auto">
            {/* Core Categories */}
            {coreCategories.length > 0 && (
              <section>
                <h2 className="font-serif text-xl font-semibold mb-4 text-primary">
                  Core Categories
                </h2>
                <CategoryGrid categories={coreCategories} />
              </section>
            )}

            {/* Technical Categories */}
            {technicalCategories.length > 0 && (
              <section>
                <h2 className="font-serif text-xl font-semibold mb-4 text-primary">
                  Technical Excellence
                </h2>
                <CategoryGrid categories={technicalCategories} />
              </section>
            )}

            {/* Other Categories */}
            {otherCategories.length > 0 && (
              <section>
                <h2 className="font-serif text-xl font-semibold mb-4 text-primary">
                  Special Categories
                </h2>
                <CategoryGrid categories={otherCategories} />
              </section>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <Award className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No categories have been added yet.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function CategoryGrid({ categories }: { categories: Awaited<ReturnType<typeof getCategories>> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((category) => {
        const Icon = categoryIcons[category.slug] || Award;
        
        return (
          <Link
            key={category.id}
            href={`/categories/${category.slug}`}
            className={cn(
              "group relative flex items-start gap-4 rounded-lg border border-border bg-card p-5",
              "transition-all duration-300 hover:border-primary/50 hover:bg-card/80"
            )}
          >
            {/* Icon */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition-colors group-hover:bg-primary/20 group-hover:text-primary">
              <Icon className="h-5 w-5" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="font-serif font-semibold text-foreground transition-colors group-hover:text-primary">
                {category.name}
              </h3>
              {category.description && (
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                  {category.description}
                </p>
              )}
            </div>

            {/* Hover accent */}
            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        );
      })}
    </div>
  );
}
