'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EyeOff, ChevronDown, ChevronUp, Plus, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { UnseenFilm } from '@/lib/unseen-films';

interface FilmSearchResult {
  film_id: number;
  title: string;
  release_year: number;
}

export function UnseenFilmsTable({ films, year }: { films: UnseenFilm[]; year: number }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Admin add-film state
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
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setIsAdmin(!!data.session?.user);
    });
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
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

  async function handleSelectFilm(film: FilmSearchResult) {
    setShowDropdown(false);
    setSearchQuery(film.title);
    await submitFilm(film.title);
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

  const unseenCount = films.filter(f => f.status === 'unseen').length;
  const lateCount = films.filter(f => f.status === 'reviewed_late').length;
  const totalDisplay = films.length;

  if (totalDisplay === 0 && !isAdmin) return null;

  return (
    <div className="mt-5">
      {/* Collapsible header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-card border border-border hover:border-border/80 hover:bg-card/80 transition-colors group"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
          <EyeOff className="w-3.5 h-3.5 shrink-0" />
          Films Not Screened
          {totalDisplay > 0 && (
            <span className="text-xs text-muted-foreground/70 font-normal">
              ({unseenCount} unseen{lateCount > 0 ? `, ${lateCount} late` : ''})
            </span>
          )}
        </span>
        {expanded
          ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
      </button>

      {expanded && (
        <div className="mt-2 rounded-lg border border-border bg-card overflow-hidden">
          {/* Scope note */}
          <p className="px-3 pt-3 pb-1 text-[11px] text-muted-foreground/70 italic leading-snug">
            Live-action, animated, and international features only. Tracked from 2021 onward.
            Films reviewed within 3 years are removed; later reviews are noted but this year's
            awards remain permanent.
          </p>

          {films.length === 0 ? (
            <p className="px-3 py-4 text-xs text-muted-foreground italic">No films on record for this year.</p>
          ) : (
            <ul className="divide-y divide-border/40">
              {films.map(film => (
                <li key={film.film_id} className="flex items-start gap-2 px-3 py-2">
                  {film.status === 'reviewed_late' ? (
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-muted-foreground line-through leading-snug">
                        {film.title}
                      </span>
                      <span className="block text-[10px] text-muted-foreground/60 italic mt-0.5">
                        reviewed {film.review_year}; not considered for this year&apos;s awards (frozen)
                      </span>
                    </div>
                  ) : (
                    <Link
                      href={`/film/${film.film_id}`}
                      className="flex-1 min-w-0 text-sm text-foreground/80 hover:text-accent transition-colors leading-snug truncate"
                    >
                      {film.title}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Admin: add film */}
          {isAdmin && (
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

                  {addError && (
                    <p className="mt-1 text-[10px] text-destructive">{addError}</p>
                  )}

                  {showDropdown && searchResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                      {searchResults.map(film => (
                        <button
                          key={film.film_id}
                          onMouseDown={e => { e.preventDefault(); handleSelectFilm(film); }}
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
          )}
        </div>
      )}
    </div>
  );
}
