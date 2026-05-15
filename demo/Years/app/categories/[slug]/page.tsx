import { notFound } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Award, User, Film as FilmIcon } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { getCategoryWithPicks } from "@/lib/data";
import { cn } from "@/lib/utils";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { category } = await getCategoryWithPicks(slug);
  
  if (!category) {
    return { title: "Category Not Found | Rich Picks" };
  }
  
  return {
    title: `${category.name} | Rich Picks`,
    description: category.description || `View all ${category.name} selections across the years.`,
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const { category, picks } = await getCategoryWithPicks(slug);
  
  if (!category) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      
      <main className="container px-4 py-8">
        {/* Header */}
        <header className="mb-12">
          <Link href="/categories">
            <Button variant="ghost" size="sm" className="mb-4 gap-2">
              <ArrowLeft className="h-4 w-4" />
              All Categories
            </Button>
          </Link>
          
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/20 text-primary">
              <Award className="h-7 w-7" />
            </div>
            <div>
              <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                {category.name}
              </h1>
              {category.description && (
                <p className="mt-1 text-muted-foreground">
                  {category.description}
                </p>
              )}
            </div>
          </div>
        </header>

        {/* Timeline of Picks */}
        {picks.length > 0 ? (
          <div className="max-w-3xl mx-auto">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-6 top-0 bottom-0 w-px bg-border" />
              
              {/* Picks */}
              <div className="space-y-6">
                {picks.map((pick, index) => {
                  const displayName = pick.person?.name || pick.film?.title || "Unknown";
                  const imageUrl = pick.person?.photo_url || pick.film?.poster_url;
                  const year = pick.year?.year;
                  
                  return (
                    <div
                      key={pick.id}
                      className="relative flex gap-6 pl-0"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      {/* Year marker */}
                      <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary font-serif font-bold text-primary-foreground text-sm shadow-lg shadow-primary/20">
                        {year ? year.toString().slice(-2) : "??"}
                      </div>

                      {/* Card */}
                      <Link
                        href={year ? `/year/${year}` : "#"}
                        className={cn(
                          "group flex-1 flex items-center gap-4 rounded-lg border border-border bg-card p-4",
                          "transition-all duration-300 hover:border-primary/50 hover:bg-card/80"
                        )}
                      >
                        {/* Image */}
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-secondary">
                          {imageUrl ? (
                            <Image
                              src={imageUrl}
                              alt={displayName}
                              fill
                              className="object-cover transition-transform duration-300 group-hover:scale-105"
                              sizes="64px"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              {pick.person ? (
                                <User className="h-6 w-6 text-muted-foreground" />
                              ) : (
                                <FilmIcon className="h-6 w-6 text-muted-foreground" />
                              )}
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground mb-1">
                            {year}
                          </p>
                          <h3 className="font-serif font-semibold text-foreground transition-colors group-hover:text-primary truncate">
                            {displayName}
                          </h3>
                          {pick.person && pick.film && (
                            <p className="text-sm text-muted-foreground truncate">
                              {pick.film.title}
                            </p>
                          )}
                          {pick.notes && (
                            <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                              {pick.notes}
                            </p>
                          )}
                        </div>
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <Award className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No picks have been made for this category yet.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
