import { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SearchInterface } from "@/components/search-interface";

export const metadata: Metadata = {
  title: "Search | Rich Picks",
  description: "Search for films, directors, actors, and more across the entire film archive.",
};

export default function SearchPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      
      <main className="container px-4 py-8">
        {/* Header */}
        <header className="mb-12 text-center">
          <h1 className="font-serif text-4xl font-bold tracking-tight text-foreground md:text-5xl">
            Search Archive
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Find any film, director, actor, or crew member across the entire collection.
          </p>
        </header>

        {/* Search Interface */}
        <SearchInterface />
      </main>
    </div>
  );
}
