"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Database, CheckCircle } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

export default function SeedPage() {
  const router = useRouter();
  const [isSeeding, setIsSeeding] = useState(false);
  const [status, setStatus] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  async function handleSeed() {
    setIsSeeding(true);
    setError(null);
    setStatus([]);

    try {
      // Seed categories
      setStatus(prev => [...prev, "Creating award categories..."]);
      const categoriesRes = await fetch("/api/admin/seed/categories", {
        method: "POST",
      });
      
      if (!categoriesRes.ok) {
        throw new Error("Failed to seed categories");
      }
      
      setStatus(prev => [...prev, "Categories created successfully!"]);

      // Seed sample years
      setStatus(prev => [...prev, "Creating sample years..."]);
      const yearsRes = await fetch("/api/admin/seed/years", {
        method: "POST",
      });
      
      if (!yearsRes.ok) {
        throw new Error("Failed to seed years");
      }
      
      setStatus(prev => [...prev, "Sample years created successfully!"]);
      
      setIsDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Seeding failed");
    } finally {
      setIsSeeding(false);
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
            Seed Demo Data
          </h1>
          <p className="mt-2 text-muted-foreground">
            Populate your database with default award categories and sample data to get started quickly.
          </p>
        </header>

        <div className="rounded-lg border border-border bg-card p-6">
          {!isDone ? (
            <>
              <div className="flex items-start gap-4 mb-6">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold">What will be created:</h2>
                  <ul className="mt-2 text-sm text-muted-foreground space-y-1">
                    <li>- 15+ Award categories (Picture, Director, Acting, Technical, etc.)</li>
                    <li>- Sample years (2023, 2024) for you to edit</li>
                  </ul>
                </div>
              </div>

              {status.length > 0 && (
                <div className="mb-4 space-y-1 text-sm">
                  {status.map((s, i) => (
                    <p key={i} className="text-muted-foreground">{s}</p>
                  ))}
                </div>
              )}

              {error && (
                <p className="mb-4 text-sm text-destructive">{error}</p>
              )}

              <Button 
                onClick={handleSeed} 
                disabled={isSeeding}
                className="w-full"
              >
                {isSeeding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Seed Database
              </Button>
            </>
          ) : (
            <div className="text-center py-4">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <h2 className="font-semibold text-lg mb-2">Database Seeded!</h2>
              <p className="text-muted-foreground mb-4">
                Your database is ready. Start adding your film picks!
              </p>
              <div className="flex gap-2 justify-center">
                <Link href="/admin">
                  <Button>Go to Admin</Button>
                </Link>
                <Link href="/">
                  <Button variant="outline">View Site</Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
