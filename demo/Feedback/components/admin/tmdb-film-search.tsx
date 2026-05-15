"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Search, X, Loader2, Film as FilmIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Film, TMDBSearchResult } from "@/lib/types";

interface TMDBFilmSearchProps {
  year?: number;
  onSelect: (film: Film) => void;
  onClose: () => void;
}

export function TMDBFilmSearch({ year, onSelect, onClose }: TMDBFilmSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TMDBSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isImporting, setIsImporting] = useState<number | null>(null);

  const searchTMDB = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const params = new URLSearchParams({ q: searchQuery });
      if (year) params.append("year", year.toString());
      
      const res = await fetch(`/api/admin/tmdb/search?${params}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
      }
    } catch (error) {
      console.error("TMDB search error:", error);
    } finally {
      setIsSearching(false);
    }
  }, [year]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchTMDB(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, searchTMDB]);

  async function importFilm(tmdbResult: TMDBSearchResult) {
    setIsImporting(tmdbResult.id);
    
    try {
      const res = await fetch("/api/admin/films", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId: tmdbResult.id }),
      });

      if (!res.ok) {
        throw new Error("Failed to import film");
      }

      const film = await res.json();
      onSelect(film);
    } catch (error) {
      console.error("Import error:", error);
    } finally {
      setIsImporting(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed inset-x-4 top-[10%] max-w-2xl mx-auto rounded-lg border border-border bg-card shadow-xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="font-serif text-lg font-semibold">Search Films</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={year ? `Search films from ${year}...` : "Search films..."}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10"
              autoFocus
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Powered by TMDB. Search will auto-import film details and poster.
          </p>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {results.length > 0 ? (
            <div className="space-y-2">
              {results.map((result) => {
                const releaseYear = result.release_date?.split("-")[0];
                const posterUrl = result.poster_path
                  ? `https://image.tmdb.org/t/p/w92${result.poster_path}`
                  : null;

                return (
                  <button
                    key={result.id}
                    onClick={() => importFilm(result)}
                    disabled={isImporting !== null}
                    className="flex items-start gap-3 w-full rounded-lg border border-border bg-secondary/30 p-3 text-left transition-colors hover:bg-secondary/50 disabled:opacity-50"
                  >
                    {/* Poster */}
                    <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded bg-secondary">
                      {posterUrl ? (
                        <Image
                          src={posterUrl}
                          alt={result.title}
                          fill
                          className="object-cover"
                          sizes="44px"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <FilmIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{result.title}</p>
                      <p className="text-sm text-muted-foreground">{releaseYear}</p>
                      {result.overview && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {result.overview}
                        </p>
                      )}
                    </div>

                    {/* Loading indicator */}
                    {isImporting === result.id && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          ) : query.length >= 2 && !isSearching ? (
            <div className="text-center py-8 text-muted-foreground">
              No films found matching "{query}"
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Start typing to search for films
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
