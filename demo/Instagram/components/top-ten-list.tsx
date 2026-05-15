"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { TopTenPick, Film } from "@/lib/types";

interface TopTenListProps {
  picks: (TopTenPick & { film: Film })[];
}

export function TopTenList({ picks }: TopTenListProps) {
  const [hoveredRank, setHoveredRank] = useState<number | null>(null);
  
  // Sort by rank
  const sortedPicks = [...picks].sort((a, b) => a.rank - b.rank);

  return (
    <div className="grid gap-4 max-w-4xl mx-auto">
      {sortedPicks.map((pick, index) => {
        const isHovered = hoveredRank === pick.rank;
        const isTop3 = pick.rank <= 3;
        
        return (
          <div
            key={pick.id}
            className={cn(
              "group relative flex items-center gap-4 rounded-lg border p-4 transition-all duration-300",
              isTop3 ? "border-primary/30 bg-card" : "border-border bg-card/50",
              isHovered && "border-primary bg-card shadow-lg shadow-primary/10"
            )}
            onMouseEnter={() => setHoveredRank(pick.rank)}
            onMouseLeave={() => setHoveredRank(null)}
            style={{
              animationDelay: `${index * 100}ms`,
            }}
          >
            {/* Rank Number */}
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg font-serif text-2xl font-bold transition-colors",
                isTop3 
                  ? "bg-primary/20 text-primary" 
                  : "bg-secondary text-muted-foreground",
                isHovered && "bg-primary text-primary-foreground"
              )}
            >
              {pick.rank}
            </div>

            {/* Poster */}
            <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-md bg-secondary">
              {pick.film.poster_url ? (
                <Image
                  src={pick.film.poster_url}
                  alt={pick.film.title}
                  fill
                  className={cn(
                    "object-cover transition-all duration-300",
                    isHovered ? "scale-105" : "scale-100"
                  )}
                  sizes="56px"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  No Image
                </div>
              )}
            </div>

            {/* Film Info */}
            <div className="flex-1 min-w-0">
              <h3
                className={cn(
                  "font-serif text-lg font-semibold truncate transition-colors",
                  isHovered ? "text-primary" : "text-foreground"
                )}
              >
                {pick.film.title}
              </h3>
              {pick.film.director && (
                <p className="text-sm text-muted-foreground">
                  Directed by {pick.film.director}
                </p>
              )}
              {pick.notes && (
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                  {pick.notes}
                </p>
              )}
            </div>

            {/* Golden accent for top 3 */}
            {isTop3 && (
              <div
                className={cn(
                  "absolute left-0 top-0 bottom-0 w-1 rounded-l-lg transition-all",
                  pick.rank === 1 && "bg-primary",
                  pick.rank === 2 && "bg-primary/70",
                  pick.rank === 3 && "bg-primary/50"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
