"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ChevronLeft,
  Trophy,
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
  Award,
  Circle,
  Calendar,
  Search,
} from "lucide-react";

// Award ceremony icons - filled = won, outline = nominated
type AwardStatus = "won" | "nominated" | null;

interface OtherAwards {
  oscar?: AwardStatus;
  globe?: AwardStatus;
  sag?: AwardStatus;
  dga?: AwardStatus;
  bafta?: AwardStatus;
}

interface Nominee {
  name: string;
  film: string;
  character?: string;
  otherAwards?: OtherAwards;
}

interface YearData {
  year: number;
  winner: Nominee;
  nominees: Nominee[];
}

interface CategoryData {
  slug: string;
  name: string;
  icon: string;
  group: string;
  description: string;
  years: YearData[];
}

// Category definitions
const CATEGORIES: Record<string, Omit<CategoryData, "years">> = {
  "best-picture": { slug: "best-picture", name: "Best Picture", icon: "trophy", group: "film", description: "Outstanding motion picture of the year" },
  "best-international-feature": { slug: "best-international-feature", name: "Best International Feature", icon: "globe", group: "film", description: "Outstanding international film" },
  "best-animated-feature": { slug: "best-animated-feature", name: "Best Animated Feature", icon: "video", group: "film", description: "Outstanding animated feature film" },
  "best-documentary": { slug: "best-documentary", name: "Best Documentary", icon: "file", group: "film", description: "Outstanding documentary feature" },
  "best-director": { slug: "best-director", name: "Best Director", icon: "clapperboard", group: "directing", description: "Outstanding achievement in directing" },
  "best-film-editing": { slug: "best-film-editing", name: "Best Film Editing", icon: "scissors", group: "directing", description: "Outstanding achievement in film editing" },
  "best-actor": { slug: "best-actor", name: "Best Actor", icon: "user", group: "acting", description: "Outstanding performance by a lead actor" },
  "best-actress": { slug: "best-actress", name: "Best Actress", icon: "user", group: "acting", description: "Outstanding performance by a lead actress" },
  "best-supporting-actor": { slug: "best-supporting-actor", name: "Best Supporting Actor", icon: "user", group: "acting", description: "Outstanding performance by a supporting actor" },
  "best-supporting-actress": { slug: "best-supporting-actress", name: "Best Supporting Actress", icon: "user", group: "acting", description: "Outstanding performance by a supporting actress" },
  "best-original-screenplay": { slug: "best-original-screenplay", name: "Best Original Screenplay", icon: "pen", group: "writing", description: "Outstanding original screenplay" },
  "best-adapted-screenplay": { slug: "best-adapted-screenplay", name: "Best Adapted Screenplay", icon: "pen", group: "writing", description: "Outstanding adapted screenplay" },
  "best-cinematography": { slug: "best-cinematography", name: "Best Cinematography", icon: "camera", group: "visual", description: "Outstanding achievement in cinematography" },
  "best-production-design": { slug: "best-production-design", name: "Best Production Design", icon: "palette", group: "visual", description: "Outstanding achievement in production design" },
  "best-visual-effects": { slug: "best-visual-effects", name: "Best Visual Effects", icon: "sparkles", group: "visual", description: "Outstanding achievement in visual effects" },
  "best-original-score": { slug: "best-original-score", name: "Best Original Score", icon: "music", group: "sound", description: "Outstanding original musical score" },
  "best-sound": { slug: "best-sound", name: "Best Sound", icon: "volume", group: "sound", description: "Outstanding achievement in sound" },
};

// Mock historical data for Best Actor (as an example - this pattern would be repeated)
const MOCK_CATEGORY_DATA: Record<string, YearData[]> = {
  "best-actor": [
    {
      year: 2024,
      winner: { name: "Adrien Brody", film: "The Brutalist", character: "László Tóth", otherAwards: { oscar: "won", globe: "won", sag: "nominated", bafta: "won" } },
      nominees: [
        { name: "Timothée Chalamet", film: "A Complete Unknown", character: "Bob Dylan", otherAwards: { oscar: "nominated", globe: "won", sag: "nominated" } },
        { name: "Colman Domingo", film: "Sing Sing", character: "Divine G", otherAwards: { oscar: "nominated", sag: "nominated" } },
        { name: "Ralph Fiennes", film: "Conclave", character: "Cardinal Lawrence", otherAwards: { oscar: "nominated", globe: "nominated", bafta: "nominated" } },
        { name: "Sebastian Stan", film: "The Apprentice", character: "Donald Trump", otherAwards: { oscar: "nominated", globe: "nominated" } },
      ],
    },
    {
      year: 2023,
      winner: { name: "Cillian Murphy", film: "Oppenheimer", character: "J. Robert Oppenheimer", otherAwards: { oscar: "won", globe: "won", sag: "won", bafta: "won" } },
      nominees: [
        { name: "Paul Giamatti", film: "The Holdovers", character: "Paul Hunham", otherAwards: { oscar: "nominated", globe: "won" } },
        { name: "Bradley Cooper", film: "Maestro", character: "Leonard Bernstein", otherAwards: { oscar: "nominated", globe: "nominated" } },
        { name: "Colman Domingo", film: "Rustin", character: "Bayard Rustin", otherAwards: { oscar: "nominated" } },
        { name: "Jeffrey Wright", film: "American Fiction", character: "Monk", otherAwards: { oscar: "nominated", globe: "nominated" } },
      ],
    },
    {
      year: 2022,
      winner: { name: "Austin Butler", film: "Elvis", character: "Elvis Presley", otherAwards: { oscar: "nominated", globe: "won", sag: "nominated", bafta: "won" } },
      nominees: [
        { name: "Brendan Fraser", film: "The Whale", character: "Charlie", otherAwards: { oscar: "won", sag: "won" } },
        { name: "Colin Farrell", film: "The Banshees of Inisherin", character: "Pádraic Súilleabháin", otherAwards: { oscar: "nominated", globe: "won" } },
        { name: "Bill Nighy", film: "Living", character: "Williams", otherAwards: { oscar: "nominated", bafta: "nominated" } },
        { name: "Paul Mescal", film: "Aftersun", character: "Calum", otherAwards: { oscar: "nominated" } },
      ],
    },
    {
      year: 2019,
      winner: { name: "Adam Driver", film: "Marriage Story", character: "Charlie Barber", otherAwards: { oscar: "nominated", globe: "nominated", sag: "nominated" } },
      nominees: [
        { name: "Joaquin Phoenix", film: "Joker", character: "Arthur Fleck", otherAwards: { oscar: "won", globe: "won", sag: "won", bafta: "won" } },
        { name: "Antonio Banderas", film: "Pain and Glory", character: "Salvador Mallo", otherAwards: { oscar: "nominated", globe: "nominated" } },
        { name: "Leonardo DiCaprio", film: "Once Upon a Time in Hollywood", character: "Rick Dalton", otherAwards: { oscar: "nominated", globe: "nominated" } },
        { name: "Jonathan Pryce", film: "The Two Popes", character: "Cardinal Jorge Bergoglio", otherAwards: { oscar: "nominated", globe: "nominated" } },
      ],
    },
    {
      year: 1999,
      winner: { name: "Kevin Spacey", film: "American Beauty", character: "Lester Burnham", otherAwards: { oscar: "won", globe: "won", sag: "won", bafta: "won" } },
      nominees: [
        { name: "Russell Crowe", film: "The Insider", character: "Jeffrey Wigand", otherAwards: { oscar: "nominated", globe: "nominated" } },
        { name: "Denzel Washington", film: "The Hurricane", character: "Rubin Carter", otherAwards: { oscar: "nominated", globe: "won" } },
        { name: "Richard Farnsworth", film: "The Straight Story", character: "Alvin Straight", otherAwards: { oscar: "nominated" } },
        { name: "Sean Penn", film: "Sweet and Lowdown", character: "Emmet Ray", otherAwards: { oscar: "nominated" } },
      ],
    },
    {
      year: 1994,
      winner: { name: "John Travolta", film: "Pulp Fiction", character: "Vincent Vega", otherAwards: { oscar: "nominated", globe: "nominated" } },
      nominees: [
        { name: "Tom Hanks", film: "Forrest Gump", character: "Forrest Gump", otherAwards: { oscar: "won", globe: "won", sag: "won" } },
        { name: "Morgan Freeman", film: "The Shawshank Redemption", character: "Red", otherAwards: { oscar: "nominated" } },
        { name: "Paul Newman", film: "Nobody's Fool", character: "Sully", otherAwards: { oscar: "nominated" } },
        { name: "Nigel Hawthorne", film: "The Madness of King George", character: "King George III", otherAwards: { oscar: "nominated" } },
      ],
    },
  ],
  "best-actress": [
    {
      year: 2024,
      winner: { name: "Mikey Madison", film: "Anora", character: "Ani", otherAwards: { oscar: "won", globe: "nominated", sag: "nominated" } },
      nominees: [
        { name: "Demi Moore", film: "The Substance", character: "Elisabeth Sparkle", otherAwards: { oscar: "nominated", globe: "won", sag: "nominated" } },
        { name: "Karla Sofía Gascón", film: "Emilia Pérez", character: "Emilia Pérez", otherAwards: { oscar: "nominated", globe: "nominated" } },
        { name: "Cynthia Erivo", film: "Wicked", character: "Elphaba", otherAwards: { oscar: "nominated", globe: "nominated", sag: "nominated" } },
        { name: "Fernanda Torres", film: "I'm Still Here", character: "Eunice Paiva", otherAwards: { oscar: "nominated", globe: "won" } },
      ],
    },
    {
      year: 2023,
      winner: { name: "Emma Stone", film: "Poor Things", character: "Bella Baxter", otherAwards: { oscar: "won", globe: "won", bafta: "won" } },
      nominees: [
        { name: "Lily Gladstone", film: "Killers of the Flower Moon", character: "Mollie Burkhart", otherAwards: { oscar: "nominated", globe: "won", sag: "won" } },
        { name: "Sandra Hüller", film: "Anatomy of a Fall", character: "Sandra Voyter", otherAwards: { oscar: "nominated", globe: "nominated" } },
        { name: "Carey Mulligan", film: "Maestro", character: "Felicia Montealegre", otherAwards: { oscar: "nominated" } },
        { name: "Annette Bening", film: "Nyad", character: "Diana Nyad", otherAwards: { oscar: "nominated", globe: "nominated", sag: "nominated" } },
      ],
    },
    {
      year: 2022,
      winner: { name: "Michelle Yeoh", film: "Everything Everywhere All at Once", character: "Evelyn Wang", otherAwards: { oscar: "won", globe: "won", sag: "won" } },
      nominees: [
        { name: "Cate Blanchett", film: "Tár", character: "Lydia Tár", otherAwards: { oscar: "nominated", globe: "nominated", bafta: "won" } },
        { name: "Ana de Armas", film: "Blonde", character: "Marilyn Monroe", otherAwards: { oscar: "nominated", globe: "nominated" } },
        { name: "Andrea Riseborough", film: "To Leslie", character: "Leslie", otherAwards: { oscar: "nominated" } },
        { name: "Michelle Williams", film: "The Fabelmans", character: "Mitzi Schildkraut-Fabelman", otherAwards: { oscar: "nominated", globe: "nominated" } },
      ],
    },
  ],
  "best-director": [
    {
      year: 2024,
      winner: { name: "Brady Corbet", film: "The Brutalist", otherAwards: { oscar: "nominated", globe: "won", dga: "nominated" } },
      nominees: [
        { name: "Sean Baker", film: "Anora", otherAwards: { oscar: "won", globe: "nominated", dga: "nominated" } },
        { name: "Denis Villeneuve", film: "Dune: Part Two", otherAwards: { oscar: "nominated", dga: "nominated" } },
        { name: "Edward Berger", film: "Conclave", otherAwards: { oscar: "nominated" } },
        { name: "Coralie Fargeat", film: "The Substance", otherAwards: { oscar: "nominated", globe: "nominated" } },
      ],
    },
    {
      year: 2023,
      winner: { name: "Christopher Nolan", film: "Oppenheimer", otherAwards: { oscar: "won", globe: "won", dga: "won", bafta: "won" } },
      nominees: [
        { name: "Martin Scorsese", film: "Killers of the Flower Moon", otherAwards: { oscar: "nominated", globe: "nominated", dga: "nominated" } },
        { name: "Yorgos Lanthimos", film: "Poor Things", otherAwards: { oscar: "nominated", globe: "nominated" } },
        { name: "Jonathan Glazer", film: "The Zone of Interest", otherAwards: { oscar: "nominated", bafta: "won" } },
        { name: "Justine Triet", film: "Anatomy of a Fall", otherAwards: { oscar: "nominated", globe: "nominated" } },
      ],
    },
    {
      year: 2022,
      winner: { name: "Daniel Kwan, Daniel Scheinert", film: "Everything Everywhere All at Once", otherAwards: { oscar: "won", globe: "nominated", dga: "won" } },
      nominees: [
        { name: "Martin McDonagh", film: "The Banshees of Inisherin", otherAwards: { oscar: "nominated", globe: "nominated" } },
        { name: "Steven Spielberg", film: "The Fabelmans", otherAwards: { oscar: "nominated", globe: "won", dga: "nominated" } },
        { name: "Todd Field", film: "Tár", otherAwards: { oscar: "nominated" } },
        { name: "Ruben Östlund", film: "Triangle of Sadness", otherAwards: { oscar: "nominated" } },
      ],
    },
  ],
  "best-cinematography": [
    {
      year: 2024,
      winner: { name: "Lol Crawley", film: "The Brutalist", otherAwards: { oscar: "won", bafta: "won" } },
      nominees: [
        { name: "Greig Fraser", film: "Dune: Part Two", otherAwards: { oscar: "nominated", bafta: "nominated" } },
        { name: "Stéphane Fontaine", film: "Conclave", otherAwards: { oscar: "nominated" } },
        { name: "Jarin Blaschke", film: "Nosferatu", otherAwards: { oscar: "nominated" } },
        { name: "Paul Guilhaume", film: "Emilia Pérez", otherAwards: { oscar: "nominated" } },
      ],
    },
    {
      year: 2023,
      winner: { name: "Hoyte van Hoytema", film: "Oppenheimer", otherAwards: { oscar: "won", bafta: "won" } },
      nominees: [
        { name: "Rodrigo Prieto", film: "Killers of the Flower Moon", otherAwards: { oscar: "nominated" } },
        { name: "Robbie Ryan", film: "Poor Things", otherAwards: { oscar: "nominated" } },
        { name: "Matthew Libatique", film: "Maestro", otherAwards: { oscar: "nominated" } },
        { name: "Janusz Kamiński", film: "The Zone of Interest", otherAwards: { oscar: "nominated" } },
      ],
    },
    {
      year: 2022,
      winner: { name: "Claudio Miranda", film: "Top Gun: Maverick", otherAwards: { oscar: "nominated" } },
      nominees: [
        { name: "Greig Fraser", film: "The Batman", otherAwards: { oscar: "nominated" } },
        { name: "Darius Khondji", film: "Bardo", otherAwards: { oscar: "nominated" } },
        { name: "Florian Hoffmeister", film: "Tár", otherAwards: { oscar: "nominated" } },
        { name: "James Friend", film: "All Quiet on the Western Front", otherAwards: { oscar: "won", bafta: "won" } },
      ],
    },
  ],
};

// For categories without mock data, generate placeholder
function getPlaceholderYears(): YearData[] {
  return [
    { year: 2024, winner: { name: "Winner 2024", film: "Film 2024" }, nominees: [{ name: "Nominee A", film: "Film A" }, { name: "Nominee B", film: "Film B" }] },
    { year: 2023, winner: { name: "Winner 2023", film: "Film 2023" }, nominees: [{ name: "Nominee A", film: "Film A" }, { name: "Nominee B", film: "Film B" }] },
    { year: 2022, winner: { name: "Winner 2022", film: "Film 2022" }, nominees: [{ name: "Nominee A", film: "Film A" }, { name: "Nominee B", film: "Film B" }] },
  ];
}

function getCategoryIcon(iconName: string) {
  const icons: Record<string, React.ElementType> = {
    trophy: Trophy, clapperboard: Clapperboard, user: User, camera: Camera,
    music: Music, scissors: Scissors, sparkles: Sparkles, pen: PenTool,
    palette: Palette, globe: Globe, file: FileText, video: Video, volume: Volume2,
  };
  return icons[iconName] || Award;
}

// Award Icons - small inline indicators
function AwardIcon({ award, status }: { award: string; status: AwardStatus }) {
  if (!status) return null;
  
  const isWon = status === "won";
  const labels: Record<string, string> = {
    oscar: "O",
    globe: "GG",
    sag: "SAG",
    dga: "DGA",
    bafta: "B",
  };
  
  return (
    <span
      className={`inline-flex items-center justify-center text-[8px] font-bold rounded px-1 h-3.5 ${
        isWon 
          ? "bg-accent text-accent-foreground" 
          : "bg-muted text-muted-foreground border border-muted-foreground/30"
      }`}
      title={`${labels[award]} ${isWon ? "Winner" : "Nominee"}`}
    >
      {labels[award]}
    </span>
  );
}

function OtherAwardsRow({ awards }: { awards?: OtherAwards }) {
  if (!awards) return null;
  
  const awardKeys = ["oscar", "globe", "sag", "dga", "bafta"] as const;
  const hasAnyAward = awardKeys.some(k => awards[k]);
  if (!hasAnyAward) return null;
  
  return (
    <span className="inline-flex gap-0.5 ml-2">
      {awardKeys.map(key => (
        <AwardIcon key={key} award={key} status={awards[key] || null} />
      ))}
    </span>
  );
}

function isActingCategory(name: string): boolean {
  return name.toLowerCase().includes("actor") || name.toLowerCase().includes("actress");
}

function NomineeRow({ nominee, isWinner, isActing }: { nominee: Nominee; isWinner: boolean; isActing: boolean }) {
  const preposition = isActing ? "in" : "for";
  const showFilm = nominee.name !== nominee.film;
  
  return (
    <div className={`flex items-start gap-2 py-1 ${isWinner ? "" : ""}`}>
      {isWinner ? (
        <div className="w-4 h-5 clip-hexagon bg-accent flex items-center justify-center flex-shrink-0 mt-0.5">
          <Trophy className="w-2 h-2 text-accent-foreground" />
        </div>
      ) : (
        <Circle className="w-1.5 h-1.5 text-muted-foreground/50 flex-shrink-0 mt-2 ml-1" fill="currentColor" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center flex-wrap gap-x-1">
          <span className={`text-sm ${isWinner ? "font-semibold text-foreground" : "text-foreground/80"}`}>
            {nominee.name}
          </span>
          {isActing && nominee.character && (
            <span className="text-sm text-accent">as {nominee.character}</span>
          )}
          {showFilm && (
            <span className="text-sm text-muted-foreground">{preposition} {nominee.film}</span>
          )}
          <OtherAwardsRow awards={nominee.otherAwards} />
        </div>
      </div>
    </div>
  );
}

function YearBlock({ yearData, isActing, index }: { yearData: YearData; isActing: boolean; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      className="relative"
    >
      {/* Year header - left aligned over the golden line */}
      <div className="flex items-center gap-3 mb-2">
        <Link 
          href={`/year/${yearData.year}`}
          className="font-serif text-lg font-semibold text-muted-foreground hover:text-accent transition-colors"
        >
          {yearData.year}
        </Link>
        <div className="h-px flex-1 bg-gradient-to-r from-border/50 to-transparent" />
      </div>
      
      {/* Winner and nominees */}
      <div className="pl-4 border-l-2 border-accent/30 space-y-0.5">
        <NomineeRow nominee={yearData.winner} isWinner={true} isActing={isActing} />
        {yearData.nominees.map((nominee, i) => (
          <NomineeRow key={i} nominee={nominee} isWinner={false} isActing={isActing} />
        ))}
      </div>
    </motion.div>
  );
}

export default function CategoryDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  
  const categoryDef = CATEGORIES[slug];
  if (!categoryDef) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Category not found</p>
      </div>
    );
  }
  
  const years = MOCK_CATEGORY_DATA[slug] || getPlaceholderYears();
  const Icon = getCategoryIcon(categoryDef.icon);
  const isActing = isActingCategory(categoryDef.name);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="font-serif text-lg font-semibold text-accent hover:text-accent/80 transition-colors">
            Rich Picks
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/years" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Calendar className="w-4 h-4" /> Years
            </Link>
            <Link href="/categories" className="flex items-center gap-1.5 text-sm text-foreground font-medium">
              <Award className="w-4 h-4" /> Categories
            </Link>
            <Link href="/search" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Search className="w-4 h-4" /> Search
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="pt-24 pb-8 px-6 md:px-10 border-b border-border">
        <div className="max-w-4xl mx-auto">
          <Link 
            href="/categories" 
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ChevronLeft className="w-4 h-4" /> All Categories
          </Link>
          
          <div className="flex items-center gap-4">
            <div className="w-12 h-14 clip-hexagon bg-accent/20 flex items-center justify-center border border-accent/30">
              <Icon className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h1 className="font-serif text-3xl md:text-4xl font-semibold text-foreground">
                {categoryDef.name}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">{categoryDef.description}</p>
            </div>
          </div>
          
          {/* Legend */}
          <div className="flex items-center gap-4 mt-6 text-xs text-muted-foreground">
            <span>Other Awards:</span>
            <span className="flex items-center gap-1">
              <span className="bg-accent text-accent-foreground px-1 rounded text-[8px] font-bold">O</span> Oscar
            </span>
            <span className="flex items-center gap-1">
              <span className="bg-accent text-accent-foreground px-1 rounded text-[8px] font-bold">GG</span> Globe
            </span>
            <span className="flex items-center gap-1">
              <span className="bg-accent text-accent-foreground px-1 rounded text-[8px] font-bold">SAG</span> SAG
            </span>
            <span className="flex items-center gap-1">
              <span className="bg-accent text-accent-foreground px-1 rounded text-[8px] font-bold">B</span> BAFTA
            </span>
            <span className="text-muted-foreground/70">| Filled = Won</span>
          </div>
        </div>
      </div>

      {/* Main content - Timeline of years */}
      <main className="max-w-4xl mx-auto px-6 md:px-10 py-10">
        <div className="space-y-8">
          {years.map((yearData, index) => (
            <YearBlock 
              key={yearData.year} 
              yearData={yearData} 
              isActing={isActing} 
              index={index} 
            />
          ))}
        </div>
        
        {/* Stats summary at bottom */}
        <div className="mt-12 pt-8 border-t border-border">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{years.length} years of {categoryDef.name}</span>
            <Link href="/categories" className="hover:text-foreground transition-colors flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" /> Back to all categories
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
