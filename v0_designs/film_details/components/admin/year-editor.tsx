"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TMDBFilmSearch } from "./tmdb-film-search";
import type { YearWithDetails, Category, Film } from "@/lib/types";

interface YearEditorProps {
  year: YearWithDetails;
  categories: Category[];
  updateYearAction: (formData: FormData) => Promise<void>;
}

export function YearEditor({ year, categories, updateYearAction }: YearEditorProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [showFilmSearch, setShowFilmSearch] = useState(false);
  const [searchContext, setSearchContext] = useState<{ type: "top10" | "category"; rank?: number; categoryId?: string } | null>(null);
  const [topTen, setTopTen] = useState(year.top_ten);
  const [notes, setNotes] = useState(year.notes || "");

  async function handleSave() {
    setIsSaving(true);
    const formData = new FormData();
    formData.set("notes", notes);
    
    try {
      await updateYearAction(formData);
      router.refresh();
    } catch (error) {
      console.error("Save error:", error);
    } finally {
      setIsSaving(false);
    }
  }

  function openFilmSearch(type: "top10" | "category", rank?: number, categoryId?: string) {
    setSearchContext({ type, rank, categoryId });
    setShowFilmSearch(true);
  }

  async function handleFilmSelected(film: Film) {
    if (!searchContext) return;

    try {
      const res = await fetch("/api/admin/picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yearId: year.id,
          filmId: film.id,
          type: searchContext.type,
          rank: searchContext.rank,
          categoryId: searchContext.categoryId,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to add pick");
      }

      router.refresh();
    } catch (error) {
      console.error("Error adding pick:", error);
    } finally {
      setShowFilmSearch(false);
      setSearchContext(null);
    }
  }

  async function removeTopTenPick(pickId: string) {
    try {
      const res = await fetch(`/api/admin/picks/${pickId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to remove pick");
      }

      setTopTen(topTen.filter(p => p.id !== pickId));
      router.refresh();
    } catch (error) {
      console.error("Error removing pick:", error);
    }
  }

  return (
    <div className="space-y-8">
      {/* Film Search Modal */}
      {showFilmSearch && (
        <TMDBFilmSearch
          year={year.year}
          onSelect={handleFilmSelected}
          onClose={() => {
            setShowFilmSearch(false);
            setSearchContext(null);
          }}
        />
      )}

      {/* Year Notes */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="font-serif text-lg font-semibold mb-4">Year Notes</h2>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes about this year in film..."
          className="min-h-[100px]"
        />
        <Button onClick={handleSave} disabled={isSaving} className="mt-4">
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Notes
        </Button>
      </section>

      {/* Top 10 Films */}
      <section className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg font-semibold">Top 10 Films</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openFilmSearch("top10", topTen.length + 1)}
            disabled={topTen.length >= 10}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Film
          </Button>
        </div>

        {topTen.length > 0 ? (
          <div className="space-y-2">
            {topTen.map((pick) => (
              <div
                key={pick.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 p-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary/20 font-serif font-bold text-primary">
                  {pick.rank}
                </div>
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{pick.film?.title}</p>
                  <p className="text-xs text-muted-foreground">{pick.film?.director}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeTopTenPick(pick.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No films added yet.</p>
            <Button
              variant="link"
              onClick={() => openFilmSearch("top10", 1)}
              className="mt-2"
            >
              Add your #1 film
            </Button>
          </div>
        )}
      </section>

      {/* Category Picks */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="font-serif text-lg font-semibold mb-4">Category Picks</h2>
        
        {categories.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => {
              const pick = year.category_picks.find(
                (p) => p.category_id === category.id && p.is_winner
              );
              
              return (
                <div key={category.id} className="rounded-lg border border-border p-4">
                  <h3 className="font-medium text-sm text-primary mb-2">
                    {category.name}
                  </h3>
                  
                  {pick ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm truncate">
                        {pick.person?.name || pick.film?.title || "Unknown"}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-6 w-6 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-muted-foreground"
                      onClick={() => openFilmSearch("category", undefined, category.id)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add pick
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-4">
            No categories defined yet. Add categories first.
          </p>
        )}
      </section>
    </div>
  );
}
