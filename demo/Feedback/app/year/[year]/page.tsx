"use client";

import React from "react";
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
  Circle,
  Volume2,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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
  character?: string; // For acting categories
  otherAwards?: OtherAwards;
}

interface Category {
  name: string;
  icon: string;
  group: string;
  winner: Nominee & { isWinner: true };
  nominees: Nominee[];
}

// Category groups in display order with their unique icons (deduplicated)
const CATEGORY_GROUPS = [
  { id: "film", label: "Film", icons: ["trophy", "globe", "video", "file"] },
  { id: "directing", label: "Directing & Editing", icons: ["clapperboard", "scissors"] },
  { id: "acting", label: "Acting", icons: ["user"] },
  { id: "writing", label: "Writing", icons: ["pen"] },
  { id: "visual", label: "Visual", icons: ["camera", "palette", "sparkles"] },
  { id: "sound", label: "Sound & Music", icons: ["music", "volume"] },
];

// Group header component with hex icons and divider line
function GroupHeader({ group, index }: { group: typeof CATEGORY_GROUPS[0]; index: number }) {
  // Deduplicate icons
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
        {/* Small hex icons - side by side, no overlap */}
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
        
        {/* Group label */}
        <h2 className="font-serif text-lg font-semibold text-foreground tracking-wide">
          {group.label}
        </h2>
        
        {/* Decorative line extending from label */}
        <div className="h-px flex-1 bg-gradient-to-r from-border/60 to-transparent" />
      </div>
    </motion.div>
  );
}

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
    // Film categories
    {
      name: "Best Picture",
      icon: "trophy",
      group: "film",
      winner: { name: "Anora", film: "Anora", isWinner: true, otherAwards: { oscar: "won", globe: "won", bafta: "nominated" } },
      nominees: [
        { name: "The Brutalist", film: "The Brutalist", otherAwards: { oscar: "nominated", globe: "won", bafta: "nominated" } },
        { name: "Conclave", film: "Conclave", otherAwards: { oscar: "nominated", globe: "nominated" } },
        { name: "Dune: Part Two", film: "Dune: Part Two", otherAwards: { oscar: "nominated" } },
        { name: "Emilia Pérez", film: "Emilia Pérez", otherAwards: { oscar: "nominated", globe: "won" } },
      ],
    },
    {
      name: "Best International Feature",
      icon: "globe",
      group: "film",
      winner: { name: "I'm Still Here", film: "Brazil", isWinner: true, otherAwards: { oscar: "won", globe: "won" } },
      nominees: [
        { name: "Emilia Pérez", film: "France", otherAwards: { oscar: "nominated" } },
        { name: "The Seed of the Sacred Fig", film: "Germany", otherAwards: { oscar: "nominated" } },
        { name: "Flow", film: "Latvia", otherAwards: { oscar: "nominated" } },
        { name: "The Girl with the Needle", film: "Denmark", otherAwards: { oscar: "nominated" } },
      ],
    },
    {
      name: "Best Animated Feature",
      icon: "video",
      group: "film",
      winner: { name: "Flow", film: "Flow", isWinner: true, otherAwards: { oscar: "won", globe: "won" } },
      nominees: [
        { name: "Inside Out 2", film: "Inside Out 2", otherAwards: { oscar: "nominated", globe: "nominated" } },
        { name: "The Wild Robot", film: "The Wild Robot", otherAwards: { oscar: "nominated", globe: "nominated" } },
        { name: "Memoir of a Snail", film: "Memoir of a Snail", otherAwards: { oscar: "nominated" } },
        { name: "Wallace & Gromit: Vengeance Most Fowl", film: "Vengeance Most Fowl", otherAwards: { oscar: "nominated", bafta: "won" } },
      ],
    },
    {
      name: "Best Documentary",
      icon: "file",
      group: "film",
      winner: { name: "No Other Land", film: "No Other Land", isWinner: true, otherAwards: { oscar: "won" } },
      nominees: [
        { name: "Soundtrack to a Coup d'Etat", film: "Soundtrack to a Coup d'Etat", otherAwards: { oscar: "nominated" } },
        { name: "Sugarcane", film: "Sugarcane", otherAwards: { oscar: "nominated" } },
        { name: "Dahomey", film: "Dahomey", otherAwards: { oscar: "nominated", bafta: "nominated" } },
        { name: "Porcelain War", film: "Porcelain War", otherAwards: { oscar: "nominated" } },
      ],
    },
    // Directing & Editing
    {
      name: "Best Director",
      icon: "clapperboard",
      group: "directing",
      winner: { name: "Brady Corbet", film: "The Brutalist", isWinner: true, otherAwards: { oscar: "nominated", globe: "won", dga: "nominated" } },
      nominees: [
        { name: "Sean Baker", film: "Anora", otherAwards: { oscar: "won", globe: "nominated", dga: "nominated" } },
        { name: "Denis Villeneuve", film: "Dune: Part Two", otherAwards: { oscar: "nominated", dga: "nominated" } },
        { name: "Edward Berger", film: "Conclave", otherAwards: { oscar: "nominated" } },
        { name: "Coralie Fargeat", film: "The Substance", otherAwards: { oscar: "nominated", globe: "nominated" } },
      ],
    },
    {
      name: "Best Film Editing",
      icon: "scissors",
      group: "directing",
      winner: { name: "Sean Baker", film: "Anora", isWinner: true, otherAwards: { oscar: "won" } },
      nominees: [
        { name: "David Crockett", film: "The Brutalist", otherAwards: { oscar: "nominated" } },
        { name: "Joe Walker", film: "Dune: Part Two", otherAwards: { oscar: "nominated" } },
        { name: "Nick Emerson", film: "Conclave", otherAwards: { oscar: "nominated" } },
        { name: "Juliette Welfling", film: "Emilia Pérez", otherAwards: { oscar: "nominated" } },
      ],
    },
    // Acting categories
    {
      name: "Best Actor",
      icon: "user",
      group: "acting",
      winner: { name: "Adrien Brody", film: "The Brutalist", character: "László Tóth", isWinner: true, otherAwards: { oscar: "won", globe: "won", sag: "nominated", bafta: "won" } },
      nominees: [
        { name: "Timothée Chalamet", film: "A Complete Unknown", character: "Bob Dylan", otherAwards: { oscar: "nominated", globe: "won", sag: "nominated" } },
        { name: "Colman Domingo", film: "Sing Sing", character: "Divine G", otherAwards: { oscar: "nominated", sag: "nominated" } },
        { name: "Ralph Fiennes", film: "Conclave", character: "Cardinal Lawrence", otherAwards: { oscar: "nominated", globe: "nominated", bafta: "nominated" } },
        { name: "Sebastian Stan", film: "The Apprentice", character: "Donald Trump", otherAwards: { oscar: "nominated", globe: "nominated" } },
      ],
    },
    {
      name: "Best Actress",
      icon: "user",
      group: "acting",
      winner: { name: "Mikey Madison", film: "Anora", character: "Ani", isWinner: true, otherAwards: { oscar: "won", globe: "nominated", sag: "nominated" } },
      nominees: [
        { name: "Demi Moore", film: "The Substance", character: "Elisabeth Sparkle", otherAwards: { oscar: "nominated", globe: "won", sag: "nominated" } },
        { name: "Karla Sofía Gascón", film: "Emilia Pérez", character: "Emilia Pérez", otherAwards: { oscar: "nominated", globe: "nominated" } },
        { name: "Cynthia Erivo", film: "Wicked", character: "Elphaba", otherAwards: { oscar: "nominated", globe: "nominated", sag: "nominated" } },
        { name: "Fernanda Torres", film: "I'm Still Here", character: "Eunice Paiva", otherAwards: { oscar: "nominated", globe: "won" } },
      ],
    },
    {
      name: "Best Supporting Actor",
      icon: "user",
      group: "acting",
      winner: { name: "Kieran Culkin", film: "A Real Pain", character: "Benji Kaplan", isWinner: true, otherAwards: { oscar: "won", globe: "won", sag: "nominated", bafta: "won" } },
      nominees: [
        { name: "Yura Borisov", film: "Anora", character: "Igor", otherAwards: { oscar: "nominated" } },
        { name: "Guy Pearce", film: "The Brutalist", character: "Harrison Lee Van Buren", otherAwards: { oscar: "nominated", globe: "nominated" } },
        { name: "Edward Norton", film: "A Complete Unknown", character: "Pete Seeger", otherAwards: { oscar: "nominated", sag: "nominated" } },
        { name: "Stanley Tucci", film: "Conclave", character: "Cardinal Bellini", otherAwards: { oscar: "nominated", bafta: "nominated" } },
      ],
    },
    {
      name: "Best Supporting Actress",
      icon: "user",
      group: "acting",
      winner: { name: "Zoe Saldaña", film: "Emilia Pérez", character: "Rita Moro Castro", isWinner: true, otherAwards: { oscar: "won", globe: "won", sag: "nominated" } },
      nominees: [
        { name: "Monica Barbaro", film: "A Complete Unknown", character: "Joan Baez", otherAwards: { oscar: "nominated", globe: "nominated" } },
        { name: "Ariana Grande", film: "Wicked", character: "Glinda", otherAwards: { oscar: "nominated", globe: "nominated", sag: "nominated" } },
        { name: "Felicity Jones", film: "The Brutalist", character: "Erzsébet Tóth", otherAwards: { oscar: "nominated" } },
        { name: "Isabella Rossellini", film: "Conclave", character: "Sister Agnes", otherAwards: { oscar: "nominated", bafta: "nominated" } },
      ],
    },
    // Writing categories
    {
      name: "Best Original Screenplay",
      icon: "pen",
      group: "writing",
      winner: { name: "Sean Baker", film: "Anora", isWinner: true, otherAwards: { oscar: "won", globe: "nominated" } },
      nominees: [
        { name: "Brady Corbet, Mona Fastvold", film: "The Brutalist", otherAwards: { oscar: "nominated" } },
        { name: "Jesse Eisenberg", film: "A Real Pain", otherAwards: { oscar: "nominated" } },
        { name: "Coralie Fargeat", film: "The Substance", otherAwards: { oscar: "nominated" } },
        { name: "Justin Kuritzkes", film: "Challengers", otherAwards: { globe: "nominated" } },
      ],
    },
    {
      name: "Best Adapted Screenplay",
      icon: "pen",
      group: "writing",
      winner: { name: "Peter Straughan", film: "Conclave", isWinner: true, otherAwards: { oscar: "won", bafta: "nominated" } },
      nominees: [
        { name: "Denis Villeneuve, Jon Spaihts", film: "Dune: Part Two", otherAwards: { oscar: "nominated" } },
        { name: "Greg Kwedar, Clint Bentley", film: "Sing Sing", otherAwards: { oscar: "nominated" } },
        { name: "Jacques Audiard", film: "Emilia Pérez", otherAwards: { oscar: "nominated", globe: "nominated" } },
        { name: "RaMell Ross, Joslyn Barnes", film: "Nickel Boys", otherAwards: { oscar: "nominated" } },
      ],
    },
    // Visual categories
    {
      name: "Best Cinematography",
      icon: "camera",
      group: "visual",
      winner: { name: "Lol Crawley", film: "The Brutalist", isWinner: true, otherAwards: { oscar: "won", bafta: "won" } },
      nominees: [
        { name: "Greig Fraser", film: "Dune: Part Two", otherAwards: { oscar: "nominated", bafta: "nominated" } },
        { name: "Stéphane Fontaine", film: "Conclave", otherAwards: { oscar: "nominated" } },
        { name: "Jarin Blaschke", film: "Nosferatu", otherAwards: { oscar: "nominated" } },
        { name: "Paul Guilhaume", film: "Emilia Pérez", otherAwards: { oscar: "nominated" } },
      ],
    },
    {
      name: "Best Production Design",
      icon: "palette",
      group: "visual",
      winner: { name: "Judy Becker", film: "The Brutalist", isWinner: true, otherAwards: { oscar: "nominated", bafta: "nominated" } },
      nominees: [
        { name: "Patrice Vermette", film: "Dune: Part Two", otherAwards: { oscar: "won", bafta: "nominated" } },
        { name: "Suzie Davies", film: "Conclave", otherAwards: { oscar: "nominated" } },
        { name: "Nathan Crowley", film: "Wicked", otherAwards: { oscar: "nominated" } },
        { name: "Craig Lathrop", film: "Nosferatu", otherAwards: { oscar: "nominated" } },
      ],
    },
    {
      name: "Best Visual Effects",
      icon: "sparkles",
      group: "visual",
      winner: { name: "Paul Lambert", film: "Dune: Part Two", isWinner: true, otherAwards: { oscar: "won", bafta: "won" } },
      nominees: [
        { name: "Pablo Helman", film: "Wicked", otherAwards: { oscar: "nominated" } },
        { name: "Erik Winquist", film: "Kingdom of the Planet of the Apes", otherAwards: { oscar: "nominated" } },
        { name: "Eric Barba", film: "Better Man", otherAwards: { oscar: "nominated" } },
        { name: "Nelson Sepulveda", film: "Alien: Romulus", otherAwards: { oscar: "nominated" } },
      ],
    },
    // Sound & Music
    {
      name: "Best Original Score",
      icon: "music",
      group: "sound",
      winner: { name: "Daniel Blumberg", film: "The Brutalist", isWinner: true, otherAwards: { oscar: "won", globe: "nominated" } },
      nominees: [
        { name: "Hans Zimmer", film: "Dune: Part Two", otherAwards: { oscar: "nominated", globe: "nominated" } },
        { name: "Volker Bertelmann", film: "Conclave", otherAwards: { oscar: "nominated" } },
        { name: "Clément Ducol, Camille", film: "Emilia Pérez", otherAwards: { oscar: "nominated", globe: "nominated" } },
        { name: "Kris Bowers", film: "The Wild Robot", otherAwards: { oscar: "nominated", globe: "nominated" } },
      ],
    },
    {
      name: "Best Sound",
      icon: "volume",
      group: "sound",
      winner: { name: "Richard King", film: "Dune: Part Two", isWinner: true, otherAwards: { oscar: "won", bafta: "won" } },
      nominees: [
        { name: "Tod Maitland", film: "A Complete Unknown", otherAwards: { oscar: "nominated" } },
        { name: "Stéphane Bucher", film: "Emilia Pérez", otherAwards: { oscar: "nominated" } },
        { name: "Simon Chase", film: "Wicked", otherAwards: { oscar: "nominated" } },
        { name: "David Lee", film: "The Brutalist", otherAwards: { oscar: "nominated" } },
      ],
    },
  ] as Category[],
};

const AVAILABLE_YEARS = [2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2010, 2008, 2007, 2005, 2003, 1999, 1994, 1990, 1980, 1975, 1972];

// ─── External Award Context Data (mock) ───────────────────────────────────────

interface ExternalNominee {
  name: string;
  film: string;
  isWinner: boolean;
}

interface ExternalAwardContext {
  ceremony: string;
  category: string;
  year: number;
  nominees: ExternalNominee[];
}

// Mock data for external award contexts - keyed by "awardKey-categorySlug-year"
const EXTERNAL_AWARD_CONTEXTS: Record<string, ExternalAwardContext> = {
  "oscar-best-picture-2024": {
    ceremony: "Academy Awards",
    category: "Best Picture",
    year: 2024,
    nominees: [
      { name: "Anora", film: "Anora", isWinner: true },
      { name: "The Brutalist", film: "The Brutalist", isWinner: false },
      { name: "Conclave", film: "Conclave", isWinner: false },
      { name: "Emilia Pérez", film: "Emilia Pérez", isWinner: false },
      { name: "Wicked", film: "Wicked", isWinner: false },
    ],
  },
  "bafta-best-picture-2024": {
    ceremony: "BAFTA Awards",
    category: "Best Film",
    year: 2024,
    nominees: [
      { name: "Anora", film: "Anora", isWinner: true },
      { name: "The Brutalist", film: "The Brutalist", isWinner: false },
      { name: "Conclave", film: "Conclave", isWinner: false },
      { name: "A Complete Unknown", film: "A Complete Unknown", isWinner: false },
      { name: "Emilia Pérez", film: "Emilia Pérez", isWinner: false },
    ],
  },
  "globe-best-picture-2024": {
    ceremony: "Golden Globe Awards",
    category: "Best Motion Picture - Drama",
    year: 2024,
    nominees: [
      { name: "The Brutalist", film: "The Brutalist", isWinner: true },
      { name: "A Complete Unknown", film: "A Complete Unknown", isWinner: false },
      { name: "Conclave", film: "Conclave", isWinner: false },
      { name: "Dune: Part Two", film: "Dune: Part Two", isWinner: false },
      { name: "September 5", film: "September 5", isWinner: false },
    ],
  },
  "oscar-best-actor-2024": {
    ceremony: "Academy Awards",
    category: "Best Actor",
    year: 2024,
    nominees: [
      { name: "Adrien Brody", film: "The Brutalist", isWinner: true },
      { name: "Timothée Chalamet", film: "A Complete Unknown", isWinner: false },
      { name: "Colman Domingo", film: "Sing Sing", isWinner: false },
      { name: "Ralph Fiennes", film: "Conclave", isWinner: false },
      { name: "Sebastian Stan", film: "The Apprentice", isWinner: false },
    ],
  },
  "globe-best-actor-2024": {
    ceremony: "Golden Globe Awards",
    category: "Best Actor - Drama",
    year: 2024,
    nominees: [
      { name: "Adrien Brody", film: "The Brutalist", isWinner: true },
      { name: "Timothée Chalamet", film: "A Complete Unknown", isWinner: false },
      { name: "Daniel Craig", film: "Queer", isWinner: false },
      { name: "Colman Domingo", film: "Sing Sing", isWinner: false },
      { name: "Ralph Fiennes", film: "Conclave", isWinner: false },
    ],
  },
  "bafta-best-actor-2024": {
    ceremony: "BAFTA Awards",
    category: "Best Actor in a Leading Role",
    year: 2024,
    nominees: [
      { name: "Adrien Brody", film: "The Brutalist", isWinner: true },
      { name: "Timothée Chalamet", film: "A Complete Unknown", isWinner: false },
      { name: "Ralph Fiennes", film: "Conclave", isWinner: false },
      { name: "Colman Domingo", film: "Sing Sing", isWinner: false },
      { name: "Sebastian Stan", film: "The Apprentice", isWinner: false },
    ],
  },
  "sag-best-actor-2024": {
    ceremony: "SAG Awards",
    category: "Outstanding Male Actor in a Leading Role",
    year: 2024,
    nominees: [
      { name: "Adrien Brody", film: "The Brutalist", isWinner: true },
      { name: "Timothée Chalamet", film: "A Complete Unknown", isWinner: false },
      { name: "Colman Domingo", film: "Sing Sing", isWinner: false },
      { name: "Ralph Fiennes", film: "Conclave", isWinner: false },
      { name: "Sebastian Stan", film: "The Apprentice", isWinner: false },
    ],
  },
  "oscar-best-actress-2024": {
    ceremony: "Academy Awards",
    category: "Best Actress",
    year: 2024,
    nominees: [
      { name: "Mikey Madison", film: "Anora", isWinner: true },
      { name: "Demi Moore", film: "The Substance", isWinner: false },
      { name: "Karla Sofía Gascón", film: "Emilia Pérez", isWinner: false },
      { name: "Cynthia Erivo", film: "Wicked", isWinner: false },
      { name: "Fernanda Torres", film: "I'm Still Here", isWinner: false },
    ],
  },
  "globe-best-actress-2024": {
    ceremony: "Golden Globe Awards",
    category: "Best Actress - Drama",
    year: 2024,
    nominees: [
      { name: "Fernanda Torres", film: "I'm Still Here", isWinner: true },
      { name: "Nicole Kidman", film: "Babygirl", isWinner: false },
      { name: "Angelina Jolie", film: "Maria", isWinner: false },
      { name: "Kate Winslet", film: "Lee", isWinner: false },
      { name: "Tilda Swinton", film: "The Room Next Door", isWinner: false },
    ],
  },
  // 2023 data
  "oscar-best-picture-2023": {
    ceremony: "Academy Awards",
    category: "Best Picture",
    year: 2023,
    nominees: [
      { name: "Oppenheimer", film: "Oppenheimer", isWinner: true },
      { name: "Poor Things", film: "Poor Things", isWinner: false },
      { name: "Killers of the Flower Moon", film: "Killers of the Flower Moon", isWinner: false },
      { name: "Barbie", film: "Barbie", isWinner: false },
      { name: "The Holdovers", film: "The Holdovers", isWinner: false },
    ],
  },
  "bafta-best-picture-2023": {
    ceremony: "BAFTA Awards",
    category: "Best Film",
    year: 2023,
    nominees: [
      { name: "Oppenheimer", film: "Oppenheimer", isWinner: true },
      { name: "Poor Things", film: "Poor Things", isWinner: false },
      { name: "Killers of the Flower Moon", film: "Killers of the Flower Moon", isWinner: false },
      { name: "The Holdovers", film: "The Holdovers", isWinner: false },
      { name: "Anatomy of a Fall", film: "Anatomy of a Fall", isWinner: false },
    ],
  },
  "globe-best-picture-2023": {
    ceremony: "Golden Globe Awards",
    category: "Best Motion Picture - Drama",
    year: 2023,
    nominees: [
      { name: "Oppenheimer", film: "Oppenheimer", isWinner: true },
      { name: "Killers of the Flower Moon", film: "Killers of the Flower Moon", isWinner: false },
      { name: "Anatomy of a Fall", film: "Anatomy of a Fall", isWinner: false },
      { name: "Past Lives", film: "Past Lives", isWinner: false },
      { name: "The Zone of Interest", film: "The Zone of Interest", isWinner: false },
    ],
  },
  "oscar-best-actor-2023": {
    ceremony: "Academy Awards",
    category: "Best Actor",
    year: 2023,
    nominees: [
      { name: "Cillian Murphy", film: "Oppenheimer", isWinner: true },
      { name: "Paul Giamatti", film: "The Holdovers", isWinner: false },
      { name: "Bradley Cooper", film: "Maestro", isWinner: false },
      { name: "Colman Domingo", film: "Rustin", isWinner: false },
      { name: "Jeffrey Wright", film: "American Fiction", isWinner: false },
    ],
  },
  "bafta-best-actor-2023": {
    ceremony: "BAFTA Awards",
    category: "Best Actor in a Leading Role",
    year: 2023,
    nominees: [
      { name: "Cillian Murphy", film: "Oppenheimer", isWinner: true },
      { name: "Paul Giamatti", film: "The Holdovers", isWinner: false },
      { name: "Bradley Cooper", film: "Maestro", isWinner: false },
      { name: "Teo Yoo", film: "Past Lives", isWinner: false },
      { name: "Barry Keoghan", film: "Saltburn", isWinner: false },
    ],
  },
  "globe-best-actor-2023": {
    ceremony: "Golden Globe Awards",
    category: "Best Actor - Drama",
    year: 2023,
    nominees: [
      { name: "Cillian Murphy", film: "Oppenheimer", isWinner: true },
      { name: "Leonardo DiCaprio", film: "Killers of the Flower Moon", isWinner: false },
      { name: "Paul Giamatti", film: "The Holdovers", isWinner: false },
      { name: "Barry Keoghan", film: "Saltburn", isWinner: false },
      { name: "Bradley Cooper", film: "Maestro", isWinner: false },
    ],
  },
  "sag-best-actor-2023": {
    ceremony: "SAG Awards",
    category: "Outstanding Male Actor in a Leading Role",
    year: 2023,
    nominees: [
      { name: "Cillian Murphy", film: "Oppenheimer", isWinner: true },
      { name: "Paul Giamatti", film: "The Holdovers", isWinner: false },
      { name: "Bradley Cooper", film: "Maestro", isWinner: false },
      { name: "Colman Domingo", film: "Rustin", isWinner: false },
      { name: "Jeffrey Wright", film: "American Fiction", isWinner: false },
    ],
  },
  "oscar-best-actress-2023": {
    ceremony: "Academy Awards",
    category: "Best Actress",
    year: 2023,
    nominees: [
      { name: "Emma Stone", film: "Poor Things", isWinner: true },
      { name: "Lily Gladstone", film: "Killers of the Flower Moon", isWinner: false },
      { name: "Sandra Hüller", film: "Anatomy of a Fall", isWinner: false },
      { name: "Carey Mulligan", film: "Maestro", isWinner: false },
      { name: "Annette Bening", film: "Nyad", isWinner: false },
    ],
  },
  "bafta-best-actress-2023": {
    ceremony: "BAFTA Awards",
    category: "Best Actress in a Leading Role",
    year: 2023,
    nominees: [
      { name: "Emma Stone", film: "Poor Things", isWinner: true },
      { name: "Sandra Hüller", film: "Anatomy of a Fall", isWinner: false },
      { name: "Margot Robbie", film: "Barbie", isWinner: false },
      { name: "Carey Mulligan", film: "Maestro", isWinner: false },
      { name: "Fantasia Barrino", film: "The Color Purple", isWinner: false },
    ],
  },
  "globe-best-actress-2023": {
    ceremony: "Golden Globe Awards",
    category: "Best Actress - Drama",
    year: 2023,
    nominees: [
      { name: "Lily Gladstone", film: "Killers of the Flower Moon", isWinner: true },
      { name: "Sandra Hüller", film: "Anatomy of a Fall", isWinner: false },
      { name: "Carey Mulligan", film: "Maestro", isWinner: false },
      { name: "Greta Lee", film: "Past Lives", isWinner: false },
      { name: "Cailee Spaeny", film: "Priscilla", isWinner: false },
    ],
  },
};

function getExternalAwardContext(awardKey: string, categoryName: string, year: number): ExternalAwardContext | null {
  // Convert category name to slug format
  const slug = categoryName.toLowerCase().replace(/\s+/g, "-");
  const key = `${awardKey}-${slug}-${year}`;
  return EXTERNAL_AWARD_CONTEXTS[key] || null;
}

const AWARD_LABELS: Record<string, string> = {
  oscar: "O", globe: "GG", sag: "SAG", dga: "DGA", bafta: "B",
};

const AWARD_FULL_NAMES: Record<string, string> = {
  oscar: "Academy Awards",
  globe: "Golden Globe Awards",
  sag: "SAG Awards",
  dga: "DGA Awards",
  bafta: "BAFTA Awards",
};

// Award Icons with popover
function AwardBadgeWithPopover({ 
  award, 
  status, 
  categoryName, 
  year, 
  currentFilm 
}: { 
  award: string; 
  status: AwardStatus; 
  categoryName: string; 
  year: number;
  currentFilm: string;
}) {
  if (!status) return null;
  const isWon = status === "won";
  const context = getExternalAwardContext(award, categoryName, year);
  
  const badge = (
    <span
      className={`inline-flex items-center justify-center text-[8px] font-bold rounded px-1 h-3.5 cursor-pointer transition-all hover:scale-110 ${
        isWon
          ? "bg-accent text-accent-foreground"
          : "bg-muted text-muted-foreground border border-muted-foreground/30 hover:border-accent/50"
      }`}
    >
      {AWARD_LABELS[award]}
    </span>
  );

  // If no context data, just show the badge with title
  if (!context) {
    return (
      <span title={`${AWARD_FULL_NAMES[award]} ${isWon ? "Winner" : "Nominee"}`}>
        {badge}
      </span>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        {badge}
      </PopoverTrigger>
      <PopoverContent 
        className="w-72 p-0 bg-card border-border shadow-xl"
        align="start"
        sideOffset={4}
      >
        {/* Header */}
        <div className="px-3 py-2 border-b border-border bg-muted/30">
          <div className="text-xs font-semibold text-foreground">{context.ceremony}</div>
          <div className="text-[10px] text-muted-foreground">{context.category} — {context.year}</div>
        </div>
        
        {/* Nominees list */}
        <div className="py-1.5">
          {context.nominees.map((nominee, i) => {
            const isCurrentFilm = nominee.film.toLowerCase() === currentFilm.toLowerCase();
            return (
              <div 
                key={i} 
                className={`flex items-center gap-2 px-3 py-1.5 ${isCurrentFilm ? "bg-accent/10" : ""}`}
              >
                {/* Winner indicator */}
                <div className="w-4 flex-shrink-0">
                  {nominee.isWinner ? (
                    <div className="w-4 h-4.5 clip-hexagon bg-accent flex items-center justify-center">
                      <Trophy className="w-2 h-2 text-accent-foreground" />
                    </div>
                  ) : (
                    <Circle className="w-1.5 h-1.5 text-muted-foreground/40 ml-1" fill="currentColor" />
                  )}
                </div>
                
                {/* Nominee info */}
                <div className="flex-1 min-w-0">
                  <span className={`text-xs ${nominee.isWinner ? "font-semibold text-foreground" : "text-foreground/80"} ${isCurrentFilm ? "text-accent" : ""}`}>
                    {nominee.name}
                  </span>
                  {nominee.name !== nominee.film && (
                    <span className="text-[10px] text-muted-foreground ml-1">
                      in {nominee.film}
                    </span>
                  )}
                </div>

                {/* Labels */}
                <div className="flex-shrink-0">
                  {nominee.isWinner && (
                    <span className="text-[9px] font-medium text-accent">WON</span>
                  )}
                  {isCurrentFilm && !nominee.isWinner && (
                    <span className="text-[9px] font-medium text-muted-foreground">THIS FILM</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function OtherAwardsRow({ awards, categoryName, year, currentFilm }: { awards?: OtherAwards; categoryName: string; year: number; currentFilm: string }) {
  if (!awards) return null;
  
  const awardKeys = ["oscar", "globe", "sag", "dga", "bafta"] as const;
  const hasAnyAward = awardKeys.some(k => awards[k]);
  if (!hasAnyAward) return null;
  
  return (
    <span className="inline-flex gap-0.5 ml-2">
      {awardKeys.map(key => (
        <AwardBadgeWithPopover 
          key={key} 
          award={key} 
          status={awards[key] || null}
          categoryName={categoryName}
          year={year}
          currentFilm={currentFilm}
        />
      ))}
    </span>
  );
}

function getCategoryIcon(iconName: string) {
  const icons: Record<string, React.ElementType> = {
    trophy: Trophy, clapperboard: Clapperboard, user: User, camera: Camera,
    music: Music, scissors: Scissors, sparkles: Sparkles, pen: PenTool,
    palette: Palette, globe: Globe, file: FileText, video: Video, volume: Volume2,
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
    <div className={`w-5 h-6 clip-hexagon flex items-center justify-center flex-shrink-0 text-[9px] font-bold ${getGradeColor(grade)}`}>
      {grade}
    </div>
  );
}

function formatCredits(director: string, writer: string): string {
  return director === writer ? `Written & Directed by ${director}` : `Dir: ${director} · Wri: ${writer}`;
}

function isActingCategory(name: string): boolean {
  return name.toLowerCase().includes("actor") || name.toLowerCase().includes("actress");
}

function NomineeRow({ nominee, isWinner, isActing, categoryName, year }: { nominee: Nominee; isWinner: boolean; isActing: boolean; categoryName: string; year: number }) {
  // For acting: "Name as Character in Film"
  // For non-acting: "Name for Film"
  const preposition = isActing ? "in" : "for";
  const showFilm = nominee.name !== nominee.film;
  
  return (
    <div className={`flex items-start gap-2.5 py-1.5 ${isWinner ? "bg-accent/10 -mx-3 px-3 rounded" : ""}`}>
      {isWinner ? (
        <div className="w-5 h-6 clip-hexagon bg-accent flex items-center justify-center flex-shrink-0 mt-0.5">
          <Trophy className="w-2.5 h-2.5 text-accent-foreground" />
        </div>
      ) : (
        <Circle className="w-2 h-2 text-muted-foreground/50 flex-shrink-0 mt-1.5 ml-1.5" fill="currentColor" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center flex-wrap gap-x-1">
          <span className={`text-sm ${isWinner ? "font-semibold text-foreground" : "text-foreground/90"}`}>
            {nominee.name}
          </span>
          {isActing && nominee.character && (
            <span className="text-sm text-accent">as {nominee.character}</span>
          )}
          {showFilm && (
            <span className="text-sm text-muted-foreground">{preposition} {nominee.film}</span>
          )}
          <OtherAwardsRow awards={nominee.otherAwards} categoryName={categoryName} year={year} currentFilm={nominee.film} />
        </div>
      </div>
    </div>
  );
}

function CategoryCard({ category, index, year }: { category: Category; index: number; year: number }) {
  const Icon = getCategoryIcon(category.icon);
  const isActing = isActingCategory(category.name);

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

      <div className="p-3 space-y-0.5">
        {/* Winner */}
        <NomineeRow nominee={category.winner} isWinner={true} isActing={isActing} categoryName={category.name} year={year} />
        
        {/* Divider */}
        {category.nominees.length > 0 && (
          <div className="border-t border-border/30 my-1.5" />
        )}
        
        {/* All other nominees - always visible */}
        {category.nominees.map((nominee, i) => (
          <NomineeRow key={i} nominee={nominee} isWinner={false} isActing={isActing} categoryName={category.name} year={year} />
        ))}
      </div>
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

  // Group categories
  const categoriesByGroup = CATEGORY_GROUPS.map(group => ({
    ...group,
    categories: yearData.categories.filter(c => c.group === group.id),
  })).filter(g => g.categories.length > 0);

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
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            {prevYear ? (
              <Link href={`/year/${prevYear}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft className="w-4 h-4" /> {prevYear}
              </Link>
            ) : <div />}
            {nextYear ? (
              <Link href={`/year/${nextYear}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                {nextYear} <ChevronRight className="w-4 h-4" />
              </Link>
            ) : <div />}
          </div>
          <div className="flex items-baseline gap-4">
            <h1 className="font-serif text-3xl md:text-4xl font-semibold text-foreground">
              Awards & Top Films
            </h1>
            <span className="font-serif text-3xl md:text-4xl font-bold text-accent">{year}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1.5">Rich Picks for Film Excellence</p>
          
          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="font-medium">Other Awards:</span>
            <span className="flex items-center gap-1"><span className="bg-accent text-accent-foreground px-1 rounded text-[8px] font-bold">O</span> Oscar</span>
            <span className="flex items-center gap-1"><span className="bg-accent text-accent-foreground px-1 rounded text-[8px] font-bold">GG</span> Golden Globe</span>
            <span className="flex items-center gap-1"><span className="bg-accent text-accent-foreground px-1 rounded text-[8px] font-bold">SAG</span> Screen Actors Guild</span>
            <span className="flex items-center gap-1"><span className="bg-accent text-accent-foreground px-1 rounded text-[8px] font-bold">DGA</span> Directors Guild</span>
            <span className="flex items-center gap-1"><span className="bg-accent text-accent-foreground px-1 rounded text-[8px] font-bold">B</span> BAFTA</span>
            <span className="ml-2 border-l border-border pl-3">Gold = Won, Outline = Nominated</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="px-6 md:px-10 py-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-8">
          {/* Left: Top 10 - compact version */}
          <div>
            <h2 className="font-serif text-lg font-semibold mb-3 flex items-center gap-2 text-muted-foreground">
              <Star className="w-4 h-4 text-accent" />
              Top 10 Films
            </h2>
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              {yearData.topTen.map((item, i) => (
                <div key={item.rank} className={`flex items-center gap-2 py-1.5 px-2.5 ${i > 0 ? "border-t border-border/50" : ""}`}>
                  <span className="font-serif text-base font-bold text-accent w-5 text-center">{item.rank}</span>
                  <GradeHex grade={item.grade} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-sm font-medium">{item.film}</span>
                      <span className="text-xs text-muted-foreground">{formatCredits(item.director, item.writer)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Categories by group */}
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categoriesByGroup.map((group, groupIndex) => {
                const groupData = CATEGORY_GROUPS.find(g => g.id === group.id);
                return (
                  <React.Fragment key={group.id}>
                    {groupData && <GroupHeader group={groupData} index={groupIndex} />}
                    {group.categories.map((category, i) => (
                      <CategoryCard key={category.name} category={category} index={groupIndex * 10 + i} year={year} />
                    ))}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="px-6 md:px-10 py-8 border-t border-border">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {prevYear ? (
            <Link href={`/year/${prevYear}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="w-5 h-5" />
              <div className="text-left">
                <div className="text-xs">Previous</div>
                <div className="font-serif text-2xl font-semibold text-foreground">{prevYear}</div>
              </div>
            </Link>
          ) : <div />}
          
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            All Years
          </Link>
          
          {nextYear ? (
            <Link href={`/year/${nextYear}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <div className="text-right">
                <div className="text-xs">Next</div>
                <div className="font-serif text-2xl font-semibold text-foreground">{nextYear}</div>
              </div>
              <ChevronRight className="w-5 h-5" />
            </Link>
          ) : <div />}
        </div>
      </div>
    </div>
  );
}
