'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Loader2 } from 'lucide-react';

interface FilmSearchResult {
  film_id: number;
  title: string;
  release_year: number;
}

/** Admin control: search for a film (or type a new title) and add it to unseen_films for the year. */
export function AddUnseenFilm({ year }: { year: number }) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FilmSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const searchFilms = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults([]); setShowDropdown(false); return; }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/admin/films-search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSearchResults(data.films || []);
      setShowDropdown(true);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  function handleSearchInput(value: string) {
    setSearchQuery(value);
    setAddError('');
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => searchFilms(value), 300);
  }

  async function submitFilm(title: string) {
    if (!title.trim()) return;
    setIsAdding(true);
    setAddError('');
    try {
      const res = await fetch('/api/admin/unseen-films', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filmTitle: title.trim(), year }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add film');
      setSearchQuery('');
      setShowAdd(false);
      router.refresh();
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <div className="border-t border-border/40 px-3 py-2">
      {!showAdd ? (
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-accent transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add film
        </button>
      ) : (
        <div ref={dropdownRef} className="relative">
          <div className="flex items-center gap-2">
            <input
              autoFocus
              type="text"
              value={searchQuery}
              onChange={e => handleSearchInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && searchQuery.trim()) submitFilm(searchQuery);
                if (e.key === 'Escape') { setShowAdd(false); setSearchQuery(''); }
              }}
              placeholder="Search or type title…"
              className="flex-1 text-xs bg-background border border-border rounded px-2 py-1.5 focus:outline-none focus:border-accent/60 placeholder:text-muted-foreground/50"
            />
            {isSearching || isAdding ? (
              <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin shrink-0" />
            ) : (
              <button
                onClick={() => { setShowAdd(false); setSearchQuery(''); setAddError(''); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            )}
          </div>

          {addError && <p className="mt-1 text-[10px] text-destructive">{addError}</p>}

          {showDropdown && searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
              {searchResults.map(film => (
                <button
                  key={film.film_id}
                  onMouseDown={e => { e.preventDefault(); setShowDropdown(false); setSearchQuery(film.title); submitFilm(film.title); }}
                  className="w-full text-left flex items-center justify-between gap-3 px-3 py-2 hover:bg-secondary/40 transition-colors"
                >
                  <span className="text-xs text-foreground truncate">{film.title}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{film.release_year}</span>
                </button>
              ))}
              <button
                onMouseDown={e => { e.preventDefault(); submitFilm(searchQuery); }}
                className="w-full text-left flex items-center gap-2 px-3 py-2 border-t border-border/50 hover:bg-secondary/40 transition-colors"
              >
                <Plus className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Add &ldquo;{searchQuery}&rdquo; as new entry</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
