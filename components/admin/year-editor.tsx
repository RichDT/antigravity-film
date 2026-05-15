"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { YearWithDetails, Category } from "@/lib/types";

interface YearEditorProps {
  year: YearWithDetails;
  categories: Category[];
  updateYearAction: (formData: FormData) => Promise<void>;
}

export function YearEditor({ year, categories, updateYearAction }: YearEditorProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
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
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No pick</p>
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
