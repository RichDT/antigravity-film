"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Award, User, Film as FilmIcon } from "lucide-react";
import type { CategoryPick, Category, Film, Person } from "@/lib/types";

interface CategoryPicksGridProps {
  picks: (CategoryPick & { category: Category; film?: Film; person?: Person })[];
}

export function CategoryPicksGrid({ picks }: CategoryPicksGridProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  
  // Group by category
  const groupedPicks = picks.reduce((acc, pick) => {
    const categoryName = pick.category.name;
    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }
    acc[categoryName].push(pick);
    return acc;
  }, {} as Record<string, typeof picks>);

  // Sort categories by display order
  const sortedCategories = Object.entries(groupedPicks).sort((a, b) => {
    const orderA = a[1][0]?.category.display_order ?? 0;
    const orderB = b[1][0]?.category.display_order ?? 0;
    return orderA - orderB;
  });

  return (
    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
      {sortedCategories.map(([categoryName, categoryPicks]) => (
        <div key={categoryName} className="space-y-3">
          <h3 className="flex items-center gap-2 font-serif text-lg font-semibold text-primary">
            <Award className="h-4 w-4" />
            {categoryName}
          </h3>
          
          <div className="space-y-2">
            {categoryPicks.map((pick) => {
              const isHovered = hoveredId === pick.id;
              const displayName = pick.person?.name || pick.film?.title || "Unknown";
              const imageUrl = pick.person?.photo_url || pick.film?.poster_url;
              
              return (
                <div
                  key={pick.id}
                  className={cn(
                    "relative flex items-center gap-3 rounded-lg border p-3 transition-all duration-300",
                    pick.is_winner 
                      ? "border-primary/30 bg-card" 
                      : "border-border bg-card/30",
                    isHovered && "border-primary bg-card"
                  )}
                  onMouseEnter={() => setHoveredId(pick.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {/* Image */}
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-secondary">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={displayName}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        {pick.person ? (
                          <User className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <FilmIcon className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "font-medium truncate transition-colors",
                        isHovered ? "text-primary" : "text-foreground"
                      )}
                    >
                      {displayName}
                    </p>
                    {pick.person && pick.film && (
                      <p className="text-xs text-muted-foreground truncate">
                        {pick.film.title}
                      </p>
                    )}
                  </div>

                  {/* Winner indicator */}
                  {pick.is_winner && (
                    <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary shadow-lg shadow-primary/50" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
