"use client";

import { Hexagon } from "./hexagon";
import type { YearWithTopFilm } from "@/lib/types";

interface HexagonGridProps {
  years: YearWithTopFilm[];
}

export function HexagonGrid({ years }: HexagonGridProps) {
  // Sort years in descending order (most recent first)
  const sortedYears = [...years].sort((a, b) => b.year - a.year);

  return (
    <div className="w-full overflow-hidden py-8">
      <div 
        className="mx-auto grid justify-center"
        style={{
          gridTemplateColumns: 'repeat(auto-fill, 140px)',
          gap: '8px 4px',
          maxWidth: '900px',
        }}
      >
        {sortedYears.map((year, index) => {
          // Create honeycomb offset pattern - every other row shifts right
          const row = Math.floor(index / 5);
          const isOffsetRow = row % 2 === 1;
          
          return (
            <div
              key={year.id}
              className="flex justify-center transition-all duration-300"
              style={{
                marginTop: row > 0 ? '-20px' : '0',
                marginLeft: isOffsetRow ? '70px' : '0',
              }}
            >
              <Hexagon
                href={`/year/${year.year}`}
                imageUrl={year.top_film?.poster_url}
                label={year.year.toString()}
                sublabel={year.top_film?.title}
                priority={index < 10}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
