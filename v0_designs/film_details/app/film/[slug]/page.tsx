"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Trophy,
  Circle,
  ChevronLeft,
  Film,
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
  Calendar,
  Search,
  Star,
  PenSquare,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type AwardStatus = "won" | "nominated" | null;

interface OtherAwards {
  oscar?: AwardStatus;
  globe?: AwardStatus;
  sag?: AwardStatus;
  dga?: AwardStatus;
  bafta?: AwardStatus;
}

interface FilmAwardEntry {
  categorySlug: string;
  categoryName: string;
  categoryIcon: string;
  categoryGroup: string;
  year: number;
  nomineeName: string;
  character?: string;
  isWinner: boolean;
  richPickWinner?: string;   // name of the Rich Pick winner when this film was nominated but lost
  otherAwards?: OtherAwards;
}

interface FilmData {
  title: string;
  year: number;
  director: string;
  writer: string;
  grade: string;
  topTenRank?: number;
  overview: string;
  awards: FilmAwardEntry[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCategoryIcon(iconName: string) {
  const icons: Record<string, React.ElementType> = {
    trophy: Trophy, clapperboard: Clapperboard, user: User, camera: Camera,
    music: Music, scissors: Scissors, sparkles: Sparkles, pen: PenTool,
    palette: Palette, globe: Globe, file: FileText, video: Video, volume: Volume2,
  };
  return icons[iconName] || Award;
}

function isActingCategory(slug: string) {
  return slug.includes("actor") || slug.includes("actress");
}

function formatCredits(director: string, writer: string) {
  if (director === writer) return `Written & Directed by ${director}`;
  return `Dir: ${director} · Wri: ${writer}`;
}

function getGradeColor(grade: string) {
  if (grade.startsWith("A")) return "bg-emerald-700/80 text-emerald-100";
  if (grade.startsWith("B")) return "bg-sky-700/80 text-sky-100";
  if (grade.startsWith("C")) return "bg-amber-700/80 text-amber-100";
  if (grade.startsWith("D")) return "bg-orange-700/80 text-orange-100";
  return "bg-red-800/80 text-red-100";
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function GradeHex({ grade }: { grade: string }) {
  return (
    <div className={`w-7 h-8 clip-hexagon flex items-center justify-center flex-shrink-0 text-[9px] font-bold ${getGradeColor(grade)}`}>
      {grade}
    </div>
  );
}

function AwardBadge({ award, status }: { award: string; status: AwardStatus }) {
  if (!status) return null;
  const isWon = status === "won";
  const labels: Record<string, string> = {
    oscar: "O", globe: "GG", sag: "SAG", dga: "DGA", bafta: "B",
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

function OtherAwardsBadges({ awards }: { awards?: OtherAwards }) {
  if (!awards) return null;
  const keys = ["oscar", "globe", "sag", "dga", "bafta"] as const;
  if (!keys.some(k => awards[k])) return null;
  return (
    <span className="inline-flex gap-0.5 ml-1.5 flex-shrink-0">
      {keys.map(k => <AwardBadge key={k} award={k} status={awards[k] || null} />)}
    </span>
  );
}

// ─── Mock film data ────────────────────────────────────────────────────────────

const FILMS_DATA: Record<string, FilmData> = {
  "oppenheimer": {
    title: "Oppenheimer",
    year: 2023,
    director: "Christopher Nolan",
    writer: "Christopher Nolan",
    grade: "A",
    topTenRank: 1,
    overview: "The story of J. Robert Oppenheimer and his pivotal role in the development of the atomic bomb during World War II.",
    awards: [
      { categorySlug: "best-picture", categoryName: "Best Picture", categoryIcon: "trophy", categoryGroup: "film", year: 2023, nomineeName: "Oppenheimer", isWinner: true, otherAwards: { oscar: "won", globe: "won", bafta: "won" } },
      { categorySlug: "best-director", categoryName: "Best Director", categoryIcon: "clapperboard", categoryGroup: "directing", year: 2023, nomineeName: "Christopher Nolan", isWinner: true, otherAwards: { oscar: "won", globe: "won", dga: "won", bafta: "won" } },
      { categorySlug: "best-actor", categoryName: "Best Actor", categoryIcon: "user", categoryGroup: "acting", year: 2023, nomineeName: "Cillian Murphy", character: "J. Robert Oppenheimer", isWinner: true, otherAwards: { oscar: "won", globe: "won", sag: "won", bafta: "won" } },
      { categorySlug: "best-supporting-actor", categoryName: "Best Supporting Actor", categoryIcon: "user", categoryGroup: "acting", year: 2023, nomineeName: "Robert Downey Jr.", character: "Lewis Strauss", isWinner: true, otherAwards: { oscar: "won", globe: "won", sag: "won", bafta: "won" } },
      { categorySlug: "best-adapted-screenplay", categoryName: "Best Adapted Screenplay", categoryIcon: "pen", categoryGroup: "writing", year: 2023, nomineeName: "Christopher Nolan", isWinner: true, otherAwards: { oscar: "won", bafta: "won" } },
      { categorySlug: "best-cinematography", categoryName: "Best Cinematography", categoryIcon: "camera", categoryGroup: "visual", year: 2023, nomineeName: "Hoyte van Hoytema", isWinner: true, otherAwards: { oscar: "won", bafta: "won" } },
      { categorySlug: "best-film-editing", categoryName: "Best Film Editing", categoryIcon: "scissors", categoryGroup: "directing", year: 2023, nomineeName: "Jennifer Lame", isWinner: true, otherAwards: { oscar: "won" } },
      { categorySlug: "best-original-score", categoryName: "Best Original Score", categoryIcon: "music", categoryGroup: "sound", year: 2023, nomineeName: "Ludwig Göransson", isWinner: true, otherAwards: { oscar: "won", globe: "won", bafta: "won" } },
      { categorySlug: "best-production-design", categoryName: "Best Production Design", categoryIcon: "palette", categoryGroup: "visual", year: 2023, nomineeName: "Ruth De Jong", isWinner: false, richPickWinner: "Poor Things — James Price & Shona Heath", otherAwards: { oscar: "nominated" } },
      { categorySlug: "best-sound", categoryName: "Best Sound", categoryIcon: "volume", categoryGroup: "sound", year: 2023, nomineeName: "Richard King, Gary Rizzo", isWinner: false, richPickWinner: "The Zone of Interest — Johnnie Burn", otherAwards: { oscar: "nominated" } },
    ],
  },
  "the-brutalist": {
    title: "The Brutalist",
    year: 2024,
    director: "Brady Corbet",
    writer: "Brady Corbet, Mona Fastvold",
    grade: "A",
    topTenRank: 2,
    overview: "An epic chronicle of visionary Hungarian architect László Tóth, who escapes post-war Europe and begins to rebuild his life in America.",
    awards: [
      { categorySlug: "best-picture", categoryName: "Best Picture", categoryIcon: "trophy", categoryGroup: "film", year: 2024, nomineeName: "The Brutalist", isWinner: false, otherAwards: { oscar: "nominated", globe: "won", bafta: "nominated" } },
      { categorySlug: "best-director", categoryName: "Best Director", categoryIcon: "clapperboard", categoryGroup: "directing", year: 2024, nomineeName: "Brady Corbet", isWinner: true, otherAwards: { oscar: "nominated", globe: "won", dga: "nominated" } },
      { categorySlug: "best-actor", categoryName: "Best Actor", categoryIcon: "user", categoryGroup: "acting", year: 2024, nomineeName: "Adrien Brody", character: "László Tóth", isWinner: true, otherAwards: { oscar: "won", globe: "won", sag: "nominated", bafta: "won" } },
      { categorySlug: "best-supporting-actress", categoryName: "Best Supporting Actress", categoryIcon: "user", categoryGroup: "acting", year: 2024, nomineeName: "Felicity Jones", character: "Erzsébet Tóth", isWinner: false, otherAwards: { oscar: "nominated", globe: "nominated" } },
      { categorySlug: "best-adapted-screenplay", categoryName: "Best Adapted Screenplay", categoryIcon: "pen", categoryGroup: "writing", year: 2024, nomineeName: "Brady Corbet, Mona Fastvold", isWinner: false, otherAwards: { oscar: "nominated" } },
      { categorySlug: "best-cinematography", categoryName: "Best Cinematography", categoryIcon: "camera", categoryGroup: "visual", year: 2024, nomineeName: "Lol Crawley", isWinner: true, otherAwards: { oscar: "won", bafta: "won" } },
      { categorySlug: "best-original-score", categoryName: "Best Original Score", categoryIcon: "music", categoryGroup: "sound", year: 2024, nomineeName: "Daniel Blumberg", isWinner: false, otherAwards: { oscar: "nominated" } },
      { categorySlug: "best-production-design", categoryName: "Best Production Design", categoryIcon: "palette", categoryGroup: "visual", year: 2024, nomineeName: "Judy Becker", isWinner: false, otherAwards: { oscar: "nominated" } },
    ],
  },
  "parasite": {
    title: "Parasite",
    year: 2019,
    director: "Bong Joon-ho",
    writer: "Bong Joon-ho, Han Jin-won",
    grade: "A+",
    topTenRank: 1,
    overview: "Greed and class discrimination threaten the newly formed symbiotic relationship between the wealthy Park family and the destitute Kim clan.",
    awards: [
      { categorySlug: "best-picture", categoryName: "Best Picture", categoryIcon: "trophy", categoryGroup: "film", year: 2019, nomineeName: "Parasite", isWinner: false, otherAwards: { oscar: "won", globe: "won", bafta: "nominated" } },
      { categorySlug: "best-director", categoryName: "Best Director", categoryIcon: "clapperboard", categoryGroup: "directing", year: 2019, nomineeName: "Bong Joon-ho", isWinner: true, otherAwards: { oscar: "won", globe: "nominated", dga: "nominated" } },
      { categorySlug: "best-international-feature", categoryName: "Best International Feature", categoryIcon: "globe", categoryGroup: "film", year: 2019, nomineeName: "Parasite", isWinner: true, otherAwards: { oscar: "won" } },
      { categorySlug: "best-original-screenplay", categoryName: "Best Original Screenplay", categoryIcon: "pen", categoryGroup: "writing", year: 2019, nomineeName: "Bong Joon-ho, Han Jin-won", isWinner: true, otherAwards: { oscar: "won" } },
      { categorySlug: "best-film-editing", categoryName: "Best Film Editing", categoryIcon: "scissors", categoryGroup: "directing", year: 2019, nomineeName: "Yang Jin-mo", isWinner: false, otherAwards: { oscar: "nominated" } },
      { categorySlug: "best-production-design", categoryName: "Best Production Design", categoryIcon: "palette", categoryGroup: "visual", year: 2019, nomineeName: "Lee Ha-jun", isWinner: false, otherAwards: { oscar: "nominated" } },
    ],
  },
};

// ─── Group structure ──────────────────────────────────────────────────────────

const GROUP_ORDER = ["film", "directing", "acting", "writing", "visual", "sound"];
const GROUP_LABELS: Record<string, string> = {
  film: "Film",
  directing: "Directing & Editing",
  acting: "Acting",
  writing: "Writing",
  visual: "Visual",
  sound: "Sound & Music",
};
const GROUP_ICONS: Record<string, string[]> = {
  film: ["trophy", "globe", "video", "file"],
  directing: ["clapperboard", "scissors"],
  acting: ["user"],
  writing: ["pen"],
  visual: ["camera", "palette", "sparkles"],
  sound: ["music", "volume"],
};

// ─── Award Entry Row ──────────────────────────────────────────────────────────

function AwardEntryRow({ entry }: { entry: FilmAwardEntry }) {
  const acting = isActingCategory(entry.categorySlug);
  const Icon = getCategoryIcon(entry.categoryIcon);

  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0">
      {/* Winner/nominee indicator */}
      <div className="flex-shrink-0 mt-0.5">
        {entry.isWinner ? (
          <div className="w-5 h-6 clip-hexagon bg-accent flex items-center justify-center">
            <Trophy className="w-2.5 h-2.5 text-accent-foreground" />
          </div>
        ) : (
          <Circle className="w-1.5 h-1.5 text-muted-foreground/50 mt-2 ml-2" fill="currentColor" />
        )}
      </div>

      {/* Category icon */}
      <div className="w-5 h-6 clip-hexagon bg-muted/50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-2.5 h-2.5 text-muted-foreground" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Category name */}
        <Link
          href={`/categories/${entry.categorySlug}`}
          className="text-xs text-muted-foreground hover:text-accent transition-colors uppercase tracking-wider"
        >
          {entry.categoryName}
        </Link>
        {/* Nominee name */}
        <div className="flex items-center flex-wrap gap-x-1 mt-0.5">
          <span className={`text-sm ${entry.isWinner ? "font-semibold text-foreground" : "text-foreground/80"}`}>
            {entry.nomineeName}
          </span>
          {acting && entry.character && (
            <span className="text-sm text-accent">as {entry.character}</span>
          )}
          <OtherAwardsBadges awards={entry.otherAwards} />
        </div>
      </div>

      {/* Won/Nominated label */}
      <div className="flex-shrink-0 text-right">
        <span className={`text-[10px] font-medium tracking-wide ${entry.isWinner ? "text-accent" : "text-muted-foreground/60"}`}>
          {entry.isWinner ? "WINNER" : "NOM."}
        </span>
      </div>
    </div>
  );
}

// ─── Group Section ────────────────────────────────────────────────────────────

function GroupSection({ groupId, entries, index }: { groupId: string; entries: FilmAwardEntry[]; index: number }) {
  const uniqueIcons = [...new Set(GROUP_ICONS[groupId] || [])];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.06, duration: 0.4 }}
    >
      {/* Group header */}
      {index > 0 && (
        <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent mt-6 mb-5" />
      )}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-1">
          {uniqueIcons.map((iconName, i) => {
            const Icon = getCategoryIcon(iconName);
            return (
              <div key={i} className="w-5 h-6 clip-hexagon bg-muted/60 flex items-center justify-center border border-border/50">
                <Icon className="w-2.5 h-2.5 text-muted-foreground" />
              </div>
            );
          })}
        </div>
        <h3 className="font-serif text-base font-semibold text-foreground tracking-wide">{GROUP_LABELS[groupId]}</h3>
        <div className="h-px flex-1 bg-gradient-to-r from-border/60 to-transparent" />
      </div>

      {/* Entries */}
      <div className="bg-card border border-border rounded-lg overflow-hidden px-3">
        {entries.map((entry, i) => (
          <AwardEntryRow key={i} entry={entry} />
        ))}
      </div>
    </motion.div>
  );
}

// ─── Stats sidebar ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2.5">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{label}</div>
      <div className="font-serif text-xl font-bold text-accent">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FilmPage() {
  const params = useParams();
  const slug = (params.slug as string) || "oppenheimer";

  const film = FILMS_DATA[slug] || FILMS_DATA["oppenheimer"];

  // Group awards by category group
  const grouped: Record<string, FilmAwardEntry[]> = {};
  for (const entry of film.awards) {
    if (!grouped[entry.categoryGroup]) grouped[entry.categoryGroup] = [];
    grouped[entry.categoryGroup].push(entry);
  }
  const orderedGroups = GROUP_ORDER.filter(g => grouped[g]?.length > 0);

  const totalWins = film.awards.filter(a => a.isWinner).length;
  const totalNoms = film.awards.length;
  const externalWins = film.awards.filter(a => {
    const oa = a.otherAwards;
    return oa && (["oscar","globe","sag","dga","bafta"] as const).some(k => oa[k] === "won");
  }).length;

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-serif text-lg font-semibold text-accent tracking-wide">Rich Picks</Link>
          <div className="flex items-center gap-6">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Years</Link>
            <Link href="/categories" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"><Award className="w-3.5 h-3.5" /> Categories</Link>
            <Link href="/search" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"><Search className="w-3.5 h-3.5" /> Search</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="pt-24 pb-6 px-6 md:px-10 border-b border-border">
        <div className="max-w-7xl mx-auto">
          <Link
            href={`/year/${film.year}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-accent transition-colors mb-4"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back to {film.year}
          </Link>

          <div className="flex items-start gap-4">
            {/* Grade hex - prominent */}
            <div className={`w-12 h-14 clip-hexagon flex items-center justify-center text-sm font-bold flex-shrink-0 mt-1 ${getGradeColor(film.grade)}`}>
              {film.grade}
            </div>
            <div>
              <div className="flex items-baseline gap-3 flex-wrap">
                <h1 className="font-serif text-3xl md:text-4xl font-semibold text-foreground">{film.title}</h1>
                <span className="font-serif text-xl text-accent">{film.year}</span>
                {film.topTenRank && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5">
                    <Star className="w-3 h-3 text-accent" /> #{film.topTenRank} of {film.year}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                <Clapperboard className="w-3.5 h-3.5" />
                {formatCredits(film.director, film.writer)}
              </p>
              {film.overview && (
                <p className="text-sm text-foreground/70 mt-2 max-w-2xl leading-relaxed">{film.overview}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_200px] gap-8">

          {/* Left: Awards by group */}
          <div className="space-y-2">
            <h2 className="font-serif text-lg font-semibold text-muted-foreground mb-5 flex items-center gap-2">
              <Award className="w-4 h-4 text-accent" /> Awards History
            </h2>
            {orderedGroups.map((groupId, i) => (
              <GroupSection key={groupId} groupId={groupId} entries={grouped[groupId]} index={i} />
            ))}
          </div>

          {/* Right: Stats */}
          <div className="space-y-3">
            <h2 className="font-serif text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">At a Glance</h2>
            <StatCard label="Rich Picks Grade" value={film.grade} sub="Overall quality" />
            {film.topTenRank && (
              <StatCard label="Top 10 Rank" value={`#${film.topTenRank}`} sub={`Best of ${film.year}`} />
            )}
            <StatCard label="Rich Picks Wins" value={totalWins} sub={`of ${totalNoms} categories`} />
            <StatCard label="External Wins" value={externalWins} sub="Oscar / GG / SAG / DGA / BAFTA" />

            {/* Award ceremony summary */}
            <div className="bg-card border border-border rounded-lg px-3 py-2.5 mt-4">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">By Ceremony</div>
              {(["oscar","globe","sag","dga","bafta"] as const).map(key => {
                const wins = film.awards.filter(a => a.otherAwards?.[key] === "won").length;
                const noms = film.awards.filter(a => a.otherAwards?.[key] !== undefined && a.otherAwards[key] !== null).length;
                if (noms === 0) return null;
                const labels: Record<string, string> = { oscar: "Oscars", globe: "Golden Globes", sag: "SAG Awards", dga: "DGA Awards", bafta: "BAFTAs" };
                return (
                  <div key={key} className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
                    <span className="text-xs text-muted-foreground">{labels[key]}</span>
                    <span className="text-xs font-medium">
                      {wins > 0 && <span className="text-accent font-semibold">{wins}W</span>}
                      {wins > 0 && noms > wins && <span className="text-muted-foreground"> / </span>}
                      {noms > wins && <span className="text-muted-foreground">{noms - wins}N</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
