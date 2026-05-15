"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function NewYearPage() {
  const router = useRouter();
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const yearNum = parseInt(year, 10);
    if (isNaN(yearNum) || yearNum < 1900 || yearNum > new Date().getFullYear() + 1) {
      setError("Please enter a valid year between 1900 and next year.");
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/years", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: yearNum }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create year");
      }

      router.push(`/admin/years/${yearNum}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create year");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      
      <main className="container px-4 py-8 max-w-lg">
        <header className="mb-8">
          <Link href="/admin">
            <Button variant="ghost" size="sm" className="mb-4 gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Admin
            </Button>
          </Link>
          
          <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground">
            Add New Year
          </h1>
          <p className="mt-2 text-muted-foreground">
            Create a new year to start adding your top 10 films and category picks.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="year" className="text-sm font-medium text-foreground">
              Year
            </label>
            <Input
              id="year"
              type="number"
              min={1900}
              max={new Date().getFullYear() + 1}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="text-lg"
              placeholder="2024"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Year
          </Button>
        </form>
      </main>
    </div>
  );
}
