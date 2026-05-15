"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Film,
  Trophy,
  Search,
  Calendar,
  Award,
  User,
  Clapperboard,
  Camera,
  Music,
  Scissors,
  Sparkles,
  PenTool,
  Palette,
  Globe,
  FileText,
  Video,
  Volume2,
  ChevronRight,
} from "lucide-react";

// Category data with groups matching the Year page
const CATEGORIES = [
  // Film categories
  { name: "Best Picture", slug: "best-picture", icon: "trophy", group: "film", description: "Outstanding motion picture of the year" },
  { name: "Best International Feature", slug: "best-international-feature", icon: "globe", group: "film", description: "Outstanding international feature film" },
  { name: "Best Animated Feature", slug: "best-animated-feature", icon: "video", group: "film", description: "Outstanding animated feature film" },
  { name: "Best Documentary", slug: "best-documentary", icon: "file", group: "film", description: "Outstanding documentary feature" },
  // Directing & Editing
  { name: "Best Director", slug: "best-director", icon: "clapperboard", group: "directing", description: "Outstanding achievement in directing" },
  { name: "Best Film Editing", slug: "best-film-editing", icon: "scissors", group: "directing", description: "Outstanding achievement in film editing" },
  // Acting
  { name: "Best Actor", slug: "best-actor", icon: "user", group: "acting", description: "Outstanding performance by a lead actor" },
  { name: "Best Actress", slug: "best-actress", icon: "user", group: "acting", description: "Outstanding performance by a lead actress" },
  { name: "Best Supporting Actor", slug: "best-supporting-actor", icon: "user", group: "acting", description: "Outstanding performance by a supporting actor" },
  { name: "Best Supporting Actress", slug: "best-supporting-actress", icon: "user", group: "acting", description: "Outstanding performance by a supporting actress" },
  // Writing
  { name: "Best Original Screenplay", slug: "best-original-screenplay", icon: "pen", group: "writing", description: "Outstanding original screenplay" },
  { name: "Best Adapted Screenplay", slug: "best-adapted-screenplay", icon: "pen", group: "writing", description: "Outstanding adapted screenplay" },
  // Visual
  { name: "Best Cinematography", slug: "best-cinematography", icon: "camera", group: "visual", description: "Outstanding achievement in cinematography" },
  { name: "Best Production Design", slug: "best-production-design", icon: "palette", group: "visual", description: "Outstanding achievement in production design" },
  { name: "Best Visual Effects", slug: "best-visual-effects", icon: "sparkles", group: "visual", description: "Outstanding achievement in visual effects" },
  // Sound & Music
  { name: "Best Original Score", slug: "best-original-score", icon: "music", group: "sound", description: "Outstanding original musical score" },
  { name: "Best Sound", slug: "best-sound", icon: "volume", group: "sound", description: "Outstanding achievement in sound" },
];

// Category groups with their unique icons (matching Year page)
const CATEGORY_GROUPS = [
  { id: "film", label: "Film", icons: ["trophy", "globe", "video", "file"] },
  { id: "directing", label: "Directing & Editing", icons: ["clapperboard", "scissors"] },
  { id: "acting", label: "Acting", icons: ["user"] },
  { id: "writing", label: "Writing", icons: ["pen"] },
  { id: "visual", label: "Visual", icons: ["camera", "palette", "sparkles"] },
  { id: "sound", label: "Sound & Music", icons: ["music", "volume"] },
];

function getCategoryIcon(iconName: string) {
  const icons: Record<string, React.ElementType> = {
    trophy: Trophy, clapperboard: Clapperboard, user: User, camera: Camera,
    music: Music, scissors: Scissors, sparkles: Sparkles, pen: PenTool,
    palette: Palette, globe: Globe, file: FileText, video: Video, volume: Volume2,
  };
  return icons[iconName] || Award;
}

// Group header component matching Year page design
function GroupHeader({ group, index }: { group: typeof CATEGORY_GROUPS[0]; index: number }) {
  const uniqueIcons = [...new Set(group.icons)];
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1 + index * 0.05, duration: 0.4 }}
      className="col-span-full mt-8 first:mt-0 mb-4"
    >
      {/* Divider line above (not on first group) */}
      {index > 0 && (
        <div className="flex items-center gap-4 mb-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
        </div>
      )}
      
      {/* Header with hex icons */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          {uniqueIcons.map((iconName, i) => {
            const Icon = getCategoryIcon(iconName);
            return (
              <div
                key={i}
                className="w-6 h-7 clip-hexagon bg-muted/60 flex items-center justify-center border border-border/50"
              >
                <Icon className="w-3 h-3 text-muted-foreground" />
              </div>
            );
          })}
        </div>
        
        <h2 className="font-serif text-lg font-semibold text-foreground tracking-wide">
          {group.label}
        </h2>
        
        <div className="h-px flex-1 bg-gradient-to-r from-border/60 to-transparent" />
      </div>
    </motion.div>
  );
}

// Category card matching the Year page nominee card style
function CategoryCard({ category, index }: { category: typeof CATEGORIES[0]; index: number }) {
  const Icon = getCategoryIcon(category.icon);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.3 }}
    >
      <Link
        href={`/categories/${category.slug}`}
        className="group block bg-card border border-border rounded-lg p-4 hover:border-accent/50 hover:bg-card/80 transition-all duration-200"
      >
        <div className="flex items-start gap-3">
          {/* Hex icon */}
          <div className="w-8 h-9 clip-hexagon bg-secondary flex items-center justify-center flex-shrink-0 group-hover:bg-accent/20 transition-colors">
            <Icon className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
                {category.name}
              </h3>
              <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-accent group-hover:translate-x-0.5 transition-all flex-shrink-0" />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {category.description}
            </p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function CategoriesPage() {
  // Group categories
  const categoriesByGroup = CATEGORY_GROUPS.map(group => ({
    ...group,
    categories: CATEGORIES.filter(c => c.group === group.id),
  }));

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-serif text-xl font-bold text-accent hover:text-accent/80 transition-colors">
            Rich Picks
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/years" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
              <Calendar className="w-4 h-4" /> Years
            </Link>
            <Link href="/categories" className="text-sm text-foreground font-medium flex items-center gap-1.5">
              <Award className="w-4 h-4 text-accent" /> Categories
            </Link>
            <Link href="/search" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
              <Search className="w-4 h-4" /> Search
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="pt-24 pb-6 px-6 md:px-10 border-b border-border">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-baseline gap-4">
            <h1 className="font-serif text-3xl md:text-4xl font-semibold text-foreground">
              Award Categories
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1.5">
            Explore historical picks across all categories of cinematic excellence
          </p>
        </div>
      </div>

      {/* Main content */}
      <main className="px-6 md:px-10 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categoriesByGroup.map((group, groupIndex) => (
              <React.Fragment key={group.id}>
                <GroupHeader group={group} index={groupIndex} />
                {group.categories.map((category, i) => (
                  <CategoryCard key={category.slug} category={category} index={groupIndex * 10 + i} />
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
