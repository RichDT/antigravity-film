"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Film,
  Trophy,
  Search,
  Calendar,
  Star,
  Award,
  ChevronRight,
} from "lucide-react";

// All years with their #1 film
const YEARS_DATA = [
  { year: 2024, film: "Anora" },
  { year: 2023, film: "Oppenheimer" },
  { year: 2022, film: "Everything Everywhere" },
  { year: 2021, film: "Power of the Dog" },
  { year: 2020, film: "Nomadland" },
  { year: 2019, film: "Parasite" },
  { year: 2018, film: "Roma" },
  { year: 2017, film: "Shape of Water" },
  { year: 2016, film: "Moonlight" },
  { year: 2015, film: "Mad Max: Fury Road" },
  { year: 2014, film: "Boyhood" },
  { year: 2013, film: "12 Years a Slave" },
  { year: 2012, film: "The Master" },
  { year: 2010, film: "Social Network" },
  { year: 2008, film: "The Dark Knight" },
  { year: 2007, film: "No Country" },
  { year: 2005, film: "Brokeback Mountain" },
  { year: 2003, film: "Lost in Translation" },
  { year: 1999, film: "The Matrix" },
  { year: 1994, film: "Pulp Fiction" },
  { year: 1990, film: "Goodfellas" },
  { year: 1980, film: "Raging Bull" },
  { year: 1975, film: "Jaws" },
  { year: 1972, film: "The Godfather" },
];

// Top 10 for 2024 with grades, directors, and writers
const TOP_10_2024 = [
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
];

// Grade color mapping (F- to A+)
function getGradeColor(grade: string): string {
  const letter = grade.charAt(0);
  switch (letter) {
    case "A":
      return "bg-emerald-600 text-white";
    case "B":
      return "bg-sky-600 text-white";
    case "C":
      return "bg-amber-500 text-black";
    case "D":
      return "bg-orange-600 text-white";
    case "F":
      return "bg-red-600 text-white";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function GradeHex({ grade }: { grade: string }) {
  return (
    <div
      className={`
        w-7 h-8 clip-hexagon flex items-center justify-center flex-shrink-0
        text-[10px] font-bold ${getGradeColor(grade)}
      `}
    >
      {grade}
    </div>
  );
}

// Format credits - combine if director and writer are the same
function formatCredits(director: string, writer: string): string {
  if (director === writer) {
    return `Written & Directed by ${director}`;
  }
  return `Dir: ${director} · Wri: ${writer}`;
}

function YearHex({
  year,
  film,
  index,
}: {
  year: number;
  film: string;
  index: number;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.2 + index * 0.015, duration: 0.3 }}
    >
      <Link href={`/year/${year}`}>
        <motion.div
          className="relative cursor-pointer"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          whileHover={{ scale: 1.08, zIndex: 20 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className={`
              w-[72px] h-[82px] md:w-[85px] md:h-[98px]
              clip-hexagon relative
              transition-all duration-300 ease-out
              flex items-center justify-center
              ${isHovered
                ? "bg-accent shadow-[0_0_30px_rgba(212,175,55,0.6)]"
                : "bg-secondary border border-border"
              }
            `}
          >
            <div className="flex flex-col items-center justify-center text-center">
              <span
                className={`
                  font-serif text-lg md:text-xl font-bold transition-colors duration-300
                  ${isHovered ? "text-accent-foreground" : "text-foreground"}
                `}
              >
                {year}
              </span>
              {isHovered && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[8px] md:text-[9px] text-accent-foreground/90 leading-tight mt-0.5 px-2 font-medium"
                >
                  {film.length > 14 ? film.slice(0, 12) + "..." : film}
                </motion.span>
              )}
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}

function NavHex({
  icon: Icon,
  label,
  href,
  delay,
}: {
  icon: React.ElementType;
  label: string;
  href: string;
  delay: number;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.3 }}
    >
      <Link href={href}>
        <motion.div
          className="relative cursor-pointer"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          whileHover={{ scale: 1.08, zIndex: 20 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className={`
              w-[72px] h-[82px] md:w-[85px] md:h-[98px]
              clip-hexagon relative
              transition-all duration-300 ease-out
              flex items-center justify-center
              ${isHovered
                ? "bg-foreground shadow-[0_0_25px_rgba(255,255,255,0.25)]"
                : "bg-card border border-border"
              }
            `}
          >
            <div className="flex flex-col items-center justify-center gap-1">
              <Icon
                className={`w-5 h-5 md:w-6 md:h-6 transition-colors duration-300 ${
                  isHovered ? "text-background" : "text-foreground"
                }`}
              />
              <span
                className={`text-[10px] md:text-xs font-medium transition-colors duration-300 ${
                  isHovered ? "text-background" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between bg-gradient-to-b from-background via-background/95 to-transparent">
        <Link href="/" className="flex items-center gap-2">
          <Film className="w-6 h-6 text-accent" />
          <span className="font-serif text-xl font-semibold">Rich Picks</span>
        </Link>
        <div className="flex items-center gap-6 text-sm">
          <Link
            href="/years"
            className="text-muted-foreground hover:text-foreground transition-colors hidden sm:flex items-center gap-1.5"
          >
            <Calendar className="w-4 h-4" />
            Years
          </Link>
          <Link
            href="/categories"
            className="text-muted-foreground hover:text-foreground transition-colors hidden sm:flex items-center gap-1.5"
          >
            <Award className="w-4 h-4" />
            Categories
          </Link>
          <Link
            href="/search"
            className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">Search</span>
          </Link>
        </div>
      </nav>

      {/* Main content */}
      <div className="min-h-screen flex">
        {/* Left section: Title + Top 10 */}
        <div className="w-full lg:w-[50%] flex flex-col justify-center px-6 md:px-10 lg:px-12 pt-20 pb-8 lg:pt-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-lg"
          >
            {/* Title */}
            <div className="mb-5">
              <h1 className="font-serif text-4xl md:text-5xl font-bold tracking-tight leading-none text-balance">
                Rich<span className="text-accent"> Picks</span>
              </h1>
              <p className="mt-2 text-sm md:text-base text-muted-foreground leading-relaxed">
                A personal archive of cinema excellence. Top 10 films and award picks spanning five decades.
              </p>
            </div>

            {/* Stats row */}
            <div className="flex gap-5 mb-5">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-accent" />
                <span className="text-xs text-muted-foreground">
                  <strong className="text-foreground">{YEARS_DATA.length}</strong> Years
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-accent" />
                <span className="text-xs text-muted-foreground">
                  <strong className="text-foreground">18</strong> Categories
                </span>
              </div>
            </div>

            {/* Top 10 of 2024 */}
            <div className="bg-card/90 border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-4 h-4 text-accent" />
                <h2 className="font-serif text-base md:text-lg font-semibold">Top 10 of 2024</h2>
              </div>
              <div className="space-y-2">
                {TOP_10_2024.map((item) => (
                  <div key={item.rank} className="group flex items-center gap-2.5">
                    {/* Rank */}
                    <span
                      className={`
                        w-5 h-5 flex-shrink-0 flex items-center justify-center rounded text-[10px] font-bold
                        ${item.rank === 1
                          ? "bg-accent text-accent-foreground"
                          : "bg-muted/60 text-muted-foreground"
                        }
                      `}
                    >
                      {item.rank}
                    </span>
                    
                    {/* Grade hex */}
                    <GradeHex grade={item.grade} />
                    
                    {/* Film info - title and credits on same line */}
                    <div className="flex-1 min-w-0 flex items-baseline gap-2 flex-wrap">
                      <span className="font-medium text-sm text-foreground group-hover:text-accent transition-colors">
                        {item.film}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {formatCredits(item.director, item.writer)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <Link
                href="/year/2024"
                className="inline-flex items-center gap-1 mt-3 text-xs text-accent hover:underline"
              >
                View full year
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Right section: Hexagon hive - full height grid */}
        <div className="hidden lg:flex w-[50%] pt-20 pb-8 pr-6 pl-4">
          <div className="flex flex-col justify-between h-full w-full">
            {/* Nav hexes row - top */}
            <div className="flex gap-1 justify-center mb-2">
              <NavHex icon={Award} label="Awards" href="/categories" delay={0.05} />
              <NavHex icon={Search} label="Search" href="/search" delay={0.1} />
              <NavHex icon={Calendar} label="Years" href="/years" delay={0.15} />
            </div>

            {/* Year hexes - proper honeycomb pattern */}
            {/* 
              For proper honeycomb: offset rows shift right by half a hex width.
              Hex = 85px wide, gap = 4px between. 
              Offset = (85 + 4) / 2 = 44.5px
              Vertical overlap: hex height 98px, rows overlap ~25px
            */}
            <div className="flex-1 flex flex-col justify-center">
              {[0, 1, 2, 3, 4].map((rowIndex) => {
                const isOffsetRow = rowIndex % 2 === 1;
                const startIndex = rowIndex * 5;
                const rowData = YEARS_DATA.slice(startIndex, startIndex + 5);
                
                return (
                  <div
                    key={rowIndex}
                    className="flex gap-1 justify-center"
                    style={{
                      marginBottom: rowIndex < 4 ? "-25px" : "0",
                      transform: isOffsetRow ? "translateX(44.5px)" : "none",
                    }}
                  >
                    {rowData.map((d, i) => (
                      <YearHex key={d.year} year={d.year} film={d.film} index={startIndex + i} />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Mobile hex grid - horizontal scroll */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent py-4 px-4">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <NavHex icon={Award} label="Awards" href="/categories" delay={0} />
            <NavHex icon={Search} label="Search" href="/search" delay={0} />
            {YEARS_DATA.slice(0, 8).map((d, i) => (
              <YearHex key={d.year} year={d.year} film={d.film} index={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
