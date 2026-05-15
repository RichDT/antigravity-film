"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Search, Film as FilmIcon, User, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Film, Person } from "@/lib/types";

interface SearchResults {
  films: Film[];
  people: Person[];
}

export function SearchInterface() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResults>({ films: [], people: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults({ films: [], people: [] });
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
      
      // Update URL
      if (query) {
        router.replace(`/search?q=${encodeURIComponent(query)}`, { scroll: false });
      } else {
        router.replace("/search", { scroll: false });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, performSearch, router]);

  const totalResults = results.films.length + results.people.length;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Search Input */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search films, directors, actors..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-14 pl-12 pr-4 text-lg bg-card border-border focus:border-primary"
        />
        {isLoading && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground animate-spin" />
        )}
      </div>

      {/* Results */}
      {hasSearched && !isLoading && (
        <>
          <p className="text-sm text-muted-foreground mb-6">
            {totalResults === 0 
              ? "No results found" 
              : `Found ${totalResults} result${totalResults === 1 ? "" : "s"}`}
          </p>

          <div className="space-y-8">
            {/* Films */}
            {results.films.length > 0 && (
              <section>
                <h2 className="flex items-center gap-2 font-serif text-lg font-semibold text-primary mb-4">
                  <FilmIcon className="h-4 w-4" />
                  Films ({results.films.length})
                </h2>
                <div className="grid gap-3">
                  {results.films.map((film) => (
                    <FilmResult key={film.id} film={film} />
                  ))}
                </div>
              </section>
            )}

            {/* People */}
            {results.people.length > 0 && (
              <section>
                <h2 className="flex items-center gap-2 font-serif text-lg font-semibold text-primary mb-4">
                  <User className="h-4 w-4" />
                  People ({results.people.length})
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {results.people.map((person) => (
                    <PersonResult key={person.id} person={person} />
                  ))}
                </div>
              </section>
            )}
          </div>
        </>
      )}

      {/* Initial state */}
      {!hasSearched && (
        <div className="text-center py-12">
          <Search className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">
            Start typing to search the archive
          </p>
        </div>
      )}
    </div>
  );
}

function FilmResult({ film }: { film: Film }) {
  const router = useRouter();
  
  return (
    <button
      onClick={() => router.push(`/film/${film.id}`)}
      className={cn(
        "group flex items-center gap-4 w-full rounded-lg border border-border bg-card p-4 text-left",
        "transition-all duration-300 hover:border-primary/50 hover:bg-card/80"
      )}
    >
      {/* Poster */}
      <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-md bg-secondary">
        {film.poster_url ? (
          <Image
            src={film.poster_url}
            alt={film.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="56px"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <FilmIcon className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-serif font-semibold text-foreground transition-colors group-hover:text-primary">
          {film.title}
        </h3>
        <p className="text-sm text-muted-foreground">
          {film.year}
          {film.director && ` • ${film.director}`}
        </p>
        {film.synopsis && (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {film.synopsis}
          </p>
        )}
      </div>
    </button>
  );
}

function PersonResult({ person }: { person: Person }) {
  const router = useRouter();
  
  return (
    <button
      onClick={() => router.push(`/person/${person.id}`)}
      className={cn(
        "group flex items-center gap-3 w-full rounded-lg border border-border bg-card p-3 text-left",
        "transition-all duration-300 hover:border-primary/50 hover:bg-card/80"
      )}
    >
      {/* Photo */}
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-secondary">
        {person.photo_url ? (
          <Image
            src={person.photo_url}
            alt={person.name}
            fill
            className="object-cover"
            sizes="48px"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <User className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-foreground transition-colors group-hover:text-primary truncate">
          {person.name}
        </h3>
      </div>
    </button>
  );
}
