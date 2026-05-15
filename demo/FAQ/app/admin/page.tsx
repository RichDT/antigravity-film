import Link from "next/link";
import { Calendar, Award, Film, Database, Plus } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { getYearsWithTopFilms, getCategories } from "@/lib/data";

export default async function AdminPage() {
  const [years, categories] = await Promise.all([
    getYearsWithTopFilms(),
    getCategories(),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      
      <main className="container px-4 py-8">
        <header className="mb-8">
          <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground">
            Admin Dashboard
          </h1>
          <p className="mt-2 text-muted-foreground">
            Manage your film collection, years, and award categories.
          </p>
        </header>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{years.length}</p>
                <p className="text-sm text-muted-foreground">Years</p>
              </div>
            </div>
          </div>
          
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{categories.length}</p>
                <p className="text-sm text-muted-foreground">Categories</p>
              </div>
            </div>
          </div>
          
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary">
                <Film className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {years.filter(y => y.top_film).length}
                </p>
                <p className="text-sm text-muted-foreground">Top Films Set</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          <Link href="/admin/years/new" className="block">
            <div className="rounded-lg border border-border bg-card p-5 transition-all hover:border-primary/50 hover:bg-card/80">
              <div className="flex items-center gap-3">
                <Plus className="h-5 w-5 text-primary" />
                <span className="font-medium">Add New Year</span>
              </div>
            </div>
          </Link>
          
          <Link href="/admin/categories" className="block">
            <div className="rounded-lg border border-border bg-card p-5 transition-all hover:border-primary/50 hover:bg-card/80">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-primary" />
                <span className="font-medium">Manage Categories</span>
              </div>
            </div>
          </Link>
          
          <Link href="/admin/seed" className="block">
            <div className="rounded-lg border border-border bg-card p-5 transition-all hover:border-primary/50 hover:bg-card/80">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-primary" />
                <span className="font-medium">Seed Demo Data</span>
              </div>
            </div>
          </Link>
        </div>

        {/* Years List */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl font-semibold">Years</h2>
            <Link href="/admin/years/new">
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Year
              </Button>
            </Link>
          </div>
          
          {years.length > 0 ? (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <table className="w-full">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Year</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Top Film</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {years.map((year) => (
                    <tr key={year.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-serif font-semibold text-primary">{year.year}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-foreground">
                          {year.top_film?.title || <span className="text-muted-foreground">Not set</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/admin/years/${year.year}`}>
                          <Button variant="ghost" size="sm">Edit</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <Calendar className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No years added yet.</p>
              <Link href="/admin/years/new">
                <Button>Add Your First Year</Button>
              </Link>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
