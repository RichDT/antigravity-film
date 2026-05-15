"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Film,
  Trophy,
  Search,
  Calendar,
  Star,
  Award,
  ChevronLeft,
  ChevronRight,
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
} from "lucide-react";

// Mock data for 2024
const YEAR_2024 = {
  topTen: [
    { rank: 1, film: "Anora", grade: "A", director: "Sean Baker", writer: "Sean Baker" },
    { rank: 2, film: "The Brutalist", grade: "A", director: "Brady Corbet", writer: "Brady Corbet, Mona Fastvold" },
    { rank: 3, film: "Conclave", grade: "A-", director: "Edward Berger", writer: "Peter Straughan" },
    { rank: 4, film: "Dune: Part Two", grade: "A-", director: "Denis Villeneuve", writer: "Denis Villeneuve, Jon Spaihts" },
    { rank: 5, film: "The Substance", grade: "B+", director: "Coralie Fargeat", writer: "Coralie Fargeat" },
    { rank: 6, film: "A Real Pain", grade: "B+", director: "Jesse Eisenberg", writer: "Jesse Eisenberg" },
    { rank: 7, film: "Emilia Pérez", grade: "B+", director: "Jacques Audiard", writer: "Jacques Audiard" },
    { rank: 8, film: "Wicked", grade: "B", director: "Jon M. Chu", writer: "Winnie Holzman" },
    { rank: 9, film: "A Complete Unknown", grade: "B", director: "James Mangold", writer: "James Mangold, Jay Cocks" },
    { rank: 10, film: "Nosferatu", grade: "B", director: "Robert Eggers", writer: "Robert Eggers" },
  ],
  categories: [
    {
      name: "Best Picture",
      icon: "trophy",
      winner: { name: "Anora", film: "Anora", note: "A stunning Cinderella story in reverse" },
      nominees: [
        { name: "The Brutalist", film: "The Brutalist" },
        { name: "Conclave", film: "Conclave" },
        { name: "Dune: Part Two", film: "Dune: Part Two" },
        { name: "Emilia Pérez", film: "Emilia Pérez" },
      ],
    },
    {
      name: "Best Director",
      icon: "clapperboard",
      winner: { name: "Brady Corbet", film: "The Brutalist", note: "Epic vision in VistaVision" },
      nominees: [
        { name: "Sean Baker", film: "Anora" },
        { name: "Denis Villeneuve", film: "Dune: Part Two" },
        { name: "Edward Berger", film: "Conclave" },
        { name: "Coralie Fargeat", film: "The Substance" },
      ],
    },
    {
      name: "Best Actor",
      icon: "user",
      winner: { name: "Adrien Brody", film: "The Brutalist", note: "Career-defining work" },
      nominees: [
        { name: "Timothée Chalamet", film: "A Complete Unknown" },
        { name: "Colman Domingo", film: "Sing Sing" },
        { name: "Ralph Fiennes", film: "Conclave" },
        { name: "Sebastian Stan", film: "The Apprentice" },
      ],
    },
    {
      name: "Best Actress",
      icon: "user",
      winner: { name: "Mikey Madison", film: "Anora", note: "A star is born" },
      nominees: [
        { name: "Demi Moore", film: "The Substance" },
        { name: "Karla Sofía Gascón", film: "Emilia Pérez" },
        { name: "Cynthia Erivo", film: "Wicked" },
        { name: "Fernanda Torres", film: "I'm Still Here" },
      ],
    },
    {
      name: "Best Supporting Actor",
      icon: "user",
      winner: { name: "Kieran Culkin", film: "A Real Pain", note: "Painfully funny" },
      nominees: [
        { name: "Yura Borisov", film: "Anora" },
        { name: "Guy Pearce", film: "The Brutalist" },
        { name: "Edward Norton", film: "A Complete Unknown" },
        { name: "Stanley Tucci", film: "Conclave" },
      ],
    },
    {
      name: "Best Supporting Actress",
      icon: "user",
      winner: { name: "Zoe Saldaña", film: "Emilia Pérez", note: "Magnetic presence" },
      nominees: [
        { name: "Monica Barbaro", film: "A Complete Unknown" },
        { name: "Ariana Grande", film: "Wicked" },
        { name: "Felicity Jones", film: "The Brutalist" },
        { name: "Isabella Rossellini", film: "Conclave" },
      ],
    },
    {
      name: "Best Cinematography",
      icon: "camera",
      winner: { name: "Lol Crawley", film: "The Brutalist", note: "Stunning VistaVision imagery" },
      nominees: [
        { name: "Greig Fraser", film: "Dune: Part Two" },
        { name: "Stéphane Fontaine", film: "Conclave" },
        { name: "Jarin Blaschke", film: "Nosferatu" },
        { name: "Paul Guilhaume", film: "Emilia Pérez" },
      ],
    },
    {
      name: "Best Original Screenplay",
      icon: "pen",
      winner: { name: "Sean Baker", film: "Anora" },
      nominees: [
        { name: "Brady Corbet, Mona Fastvold", film: "The Brutalist" },
        { name: "Jesse Eisenberg", film: "A Real Pain" },
        { name: "Coralie Fargeat", film: "The Substance" },
        { name: "Justin Kuritzkes", film: "Challengers" },
      ],
    },
    {
      name: "Best Adapted Screenplay",
      icon: "pen",
      winner: { name: "Peter Straughan", film: "Conclave" },
      nominees: [
        { name: "Denis Villeneuve", film: "Dune: Part Two" },
        { name: "Greg Kwedar", film: "Sing Sing" },
        { name: "Jacques Audiard", film: "Emilia Pérez" },
        { name: "RaMell Ross", film: "Nickel Boys" },
      ],
    },
    {
      name: "Best Film Editing",
      icon: "scissors",
      winner: { name: "David Crockett", film: "The Brutalist" },
      nominees: [
        { name: "Sean Baker", film: "Anora" },
        { name: "Joe Walker", film: "Dune: Part Two" },
        { name: "Nick Emerson", film: "Conclave" },
        { name: "Juliette Welfling", film: "Emilia Pérez" },
      ],
    },
    {
      name: "Best Original Score",
      icon: "music",
      winner: { name: "Daniel Blumberg", film: "The Brutalist", note: "Haunting and unforgettable" },
      nominees: [
        { name: "Hans Zimmer", film: "Dune: Part Two" },
        { name: "Volker Bertelmann", film: "Conclave" },
        { name: "Clément Ducol", film: "Emilia Pérez" },
        { name: "Kris Bowers", film: "The Wild Robot" },
      ],
    },
    {
      name: "Best Visual Effects",
      icon: "sparkles",
      winner: { name: "Paul Lambert", film: "Dune: Part Two", note: "Desert worm perfection" },
      nominees: [
        { name: "Wicked Team", film: "Wicked" },
        { name: "Kingdom Team", film: "Kingdom of the Planet of the Apes" },
        { name: "Alien Team", film: "Alien: Romulus" },
        { name: "Better Man Team", film: "Better Man" },
      ],
    },
    {
      name: "Best Production Design",
      icon: "palette",
      winner: { name: "Judy Becker", film: "The Brutalist" },
      nominees: [
        { name: "Patrice Vermette", film: "Dune: Part Two" },
        { name: "Suzie Davies", film: "Conclave" },
        { name: "Nathan Crowley", film: "Wicked" },
        { name: "Craig Lathrop", film: "Nosferatu" },
      ],
    },
    {
      name: "Best Animated Feature",
      icon: "video",
      winner: { name: "Flow", film: "Flow", note: "Wordless wonder" },
      nominees: [
        { name: "Inside Out 2", film: "Inside Out 2" },
        { name: "The Wild Robot", film: "The Wild Robot" },
        { name: "Memoir of a Snail", film: "Memoir of a Snail" },
        { name: "Wallace & Gromit", film: "Vengeance Most Fowl" },
      ],
    },
    {
      name: "Best International Feature",
      icon: "globe",
      winner: { name: "I'm Still Here", film: "Brazil" },
      nominees: [
        { name: "Emilia Pérez", film: "France" },
        { name: "The Seed of the Sacred Fig", film: "Germany" },
        { name: "Flow", film: "Latvia" },
        { name: "The Girl with the Needle", film: "Denmark" },
      ],
    },
    {
      name: "Best Documentary",
      icon: "file",
      winner: { name: "No Other Land", film: "No Other Land" },
      nominees: [
        { name: "Soundtrack to a Coup d'Etat", film: "Soundtrack to a Coup d'Etat" },
        { name: "Sugarcane", film: "Sugarcane" },
        { name: "Dahomey", film: "Dahomey" },
        { name: "Porcelain War", film: "Porcelain War" },
      ],
    },
  ],
};

const AVAILABLE_YEARS = [2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2010, 2008, 2007, 2005, 2003, 1999, 1994, 1990, 1980, 1975, 1972];

function getCategoryIcon(iconName: string) {
  const icons: Record<string, React.ElementType> = {
    trophy: Trophy, clapperboard: Clapperboard, user: User, camera: Camera,
    music: Music, scissors: Scissors, sparkles: Sparkles, pen: PenTool,
    palette: Palette, globe: Globe, file: FileText, video: Video,
  };
  return icons[iconName] || Award;
}

function getGradeColor(grade: string): string {
  const letter = grade.charAt(0);
  const colors: Record<string, string> = {
    A: "bg-emerald-600 text-white", B: "bg-sky-600 text-white",
    C: "bg-amber-500 text-black", D: "bg-orange-600 text-white", F: "bg-red-600 text-white",
  };
  return colors[letter] || "bg-muted text-muted-foreground";
}

function GradeHex({ grade }: { grade: string }) {
  return (
    <div className={`w-7 h-8 clip-hexagon flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${getGradeColor(grade)}`}>
      {grade}
    </div>
  );
}

function formatCredits(director: string, writer: string): string {
  return director === writer ? `Written & Directed by ${director}` : `Dir: ${director} · Wri: ${writer}`;
}

function CategoryCard({ category, index }: { category: typeof YEAR_2024.categories[0]; index: number }) {
  const Icon = getCategoryIcon(category.icon);
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + index * 0.02, duration: 0.4 }}
      className="bg-card border border-border rounded-lg overflow-hidden"
    >
      <div className="p-3 border-b border-border/50 flex items-center gap-2.5">
        <div className="w-8 h-9 clip-hexagon bg-accent/20 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-accent" />
        </div>
        <h3 className="font-serif text-sm font-semibold">{category.name}</h3>
      </div>

      <div className="p-3 bg-accent/5">
        <div className="flex items-start gap-2.5">
          <div className="w-6 h-7 clip-hexagon bg-accent flex items-center justify-center flex-shrink-0 mt-0.5">
            <Trophy className="w-3 h-3 text-accent-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-sm text-foreground">{category.winner.name}</span>
            {category.winner.name !== category.winner.film && (
              <span className="text-xs text-muted-foreground ml-1.5">in {category.winner.film}</span>
            )}
            {category.winner.note && (
              <p className="text-[10px] text-accent mt-0.5 italic">{category.winner.note}</p>
            )}
          </div>
        </div>
      </div>

      {category.nominees.length > 0 && (
        <div className="border-t border-border/50">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full px-3 py-1.5 flex items-center justify-between text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors"
          >
            <span>{category.nominees.length} nominees</span>
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-90" : ""}`} />
          </button>

          {expanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="px-3 pb-2.5 space-y-1.5">
              {category.nominees.map((nominee, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs">
                  <div className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                  <span className="text-foreground">{nominee.name}</span>
                  {nominee.name !== nominee.film && <span className="text-muted-foreground">· {nominee.film}</span>}
                </div>
              ))}
            </motion.div>
          )}
        </div>
      )}
    </motion.div>
  );
}

export default function YearPage() {
  const params = useParams();
  const year = parseInt(params.year as string);
  const yearData = YEAR_2024; // Use 2024 data as demo for all years

  const currentIndex = AVAILABLE_YEARS.indexOf(year);
  const prevYear = currentIndex < AVAILABLE_YEARS.length - 1 ? AVAILABLE_YEARS[currentIndex + 1] : null;
  const nextYear = currentIndex > 0 ? AVAILABLE_YEARS[currentIndex - 1] : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between bg-gradient-to-b from-background via-background/95 to-transparent">
        <Link href="/" className="flex items-center gap-2">
          <Film className="w-6 h-6 text-accent" />
          <span className="font-serif text-xl font-semibold">Rich Picks</span>
        </Link>
        <div className="flex items-center gap-6 text-sm">
          <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors hidden sm:flex items-center gap-1.5">
            <Calendar className="w-4 h-4" /> Years
          </Link>
          <Link href="/categories" className="text-muted-foreground hover:text-foreground transition-colors hidden sm:flex items-center gap-1.5">
            <Award className="w-4 h-4" /> Categories
          </Link>
          <Link href="/search" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
            <Search className="w-4 h-4" />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="pt-24 pb-6 px-6 md:px-10 border-b border-border">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            {prevYear ? (
              <Link href={`/year/${prevYear}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ChevronLeft className="w-4 h-4" /> {prevYear}
              </Link>
            ) : <div />}
            {nextYear ? (
              <Link href={`/year/${nextYear}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                {nextYear} <ChevronRight className="w-4 h-4" />
              </Link>
            ) : <div />}
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-23 clip-hexagon bg-accent mb-3">
              <span className="font-serif text-2xl font-bold text-accent-foreground">{year}</span>
            </div>
            <h1 className="font-serif text-2xl md:text-3xl font-bold">Rich Picks {year}</h1>
            <p className="text-sm text-muted-foreground mt-1">Top 10 films and award category picks</p>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-8">
        <div className="grid lg:grid-cols-[280px,1fr] gap-8">
          {/* Left: Top 10 */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-4 h-4 text-accent" />
              <h2 className="font-serif text-lg font-semibold">Top 10</h2>
            </div>

            <div className="bg-card border border-border rounded-lg p-3 space-y-2">
              {yearData.topTen.map((item) => (
                <div key={item.rank} className="group flex items-center gap-2">
                  <span className={`w-5 h-5 flex-shrink-0 flex items-center justify-center rounded text-[10px] font-bold ${
                    item.rank === 1 ? "bg-accent text-accent-foreground" : "bg-muted/60 text-muted-foreground"
                  }`}>
                    {item.rank}
                  </span>
                  <GradeHex grade={item.grade} />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm text-foreground group-hover:text-accent transition-colors">{item.film}</span>
                    <span className="text-[9px] text-muted-foreground ml-1.5 hidden sm:inline">{formatCredits(item.director, item.writer)}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right: Categories */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-4 h-4 text-accent" />
              <h2 className="font-serif text-lg font-semibold">Award Categories</h2>
            </div>

            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {yearData.categories.map((category, index) => (
                <CategoryCard key={category.name} category={category} index={index} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer nav */}
      <div className="border-t border-border py-6 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {prevYear ? (
            <Link href={`/year/${prevYear}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground group">
              <ChevronLeft className="w-5 h-5" />
              <div>
                <div className="text-[10px] text-muted-foreground">Previous</div>
                <div className="font-serif font-semibold group-hover:text-accent">{prevYear}</div>
              </div>
            </Link>
          ) : <div />}
          <Link href="/" className="text-sm text-accent hover:underline">All Years</Link>
          {nextYear ? (
            <Link href={`/year/${nextYear}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground group text-right">
              <div>
                <div className="text-[10px] text-muted-foreground">Next</div>
                <div className="font-serif font-semibold group-hover:text-accent">{nextYear}</div>
              </div>
              <ChevronRight className="w-5 h-5" />
            </Link>
          ) : <div />}
        </div>
      </div>
    </div>
  );
}
