"use client";

import { useState, useMemo, useEffect, useRef } from "react";
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

const gradeValues: Record<string, number> = {
    "A+": 15, "A": 14, "A-": 13,
    "B+": 12, "B": 11, "B-": 10,
    "C+": 9, "C": 8, "C-": 7,
    "D+": 6, "D": 5, "D-": 4,
    "F": 3
};

function getGradeValue(grade: string): number {
    if (!grade || grade === "-") return 0;
    if (grade.includes("//")) {
        const parts = grade.split("//").map(p => p.trim());
        const sum = (gradeValues[parts[0]] || 0) + (gradeValues[parts[1]] || 0);
        return sum / 2;
    }
    return gradeValues[grade.trim()] || 0;
}

function getGradeColor(grade: string): string {
    if (!grade) return "bg-muted text-muted-foreground";
    const letter = grade.charAt(0).toUpperCase();
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
    let content = <span>{grade || "-"}</span>;
    if (grade && grade.includes("//")) {
        const parts = grade.split("//").map(p => p.trim());
        content = (
            <div className="flex flex-col items-center justify-center leading-none mt-[1px]">
                <span className="text-[8px] leading-none -translate-y-[0.5px]">{parts[0]}</span>
                <div className="w-4 h-[1px] bg-white/80 my-[1px]"></div>
                <span className="text-[8px] leading-none translate-y-[0.5px]">{parts[1]}</span>
            </div>
        );
    } else if (grade) {
        content = <span>{grade.split(" // ")[0]}</span>;
    }

    return (
        <div
            className={`
        w-7 h-8 clip-hexagon flex items-center justify-center flex-shrink-0
        text-[10px] font-bold ${getGradeColor(grade)}
      `}
        >
            {content}
        </div>
    );
}

function formatSubtitle(wins?: number, noms?: number): string {
    if (wins && noms) {
        return `${wins} ${wins === 1 ? 'Win' : 'Wins'} · ${noms} ${noms === 1 ? 'Nomination' : 'Nominations'}`;
    }
    if (wins) return `${wins} ${wins === 1 ? 'Win' : 'Wins'}`;
    if (noms) return `${noms} ${noms === 1 ? 'Nomination' : 'Nominations'}`;
    return "No award data";
}

function YearHex({
    year,
    film,
    index,
    isActive,
    onHover,
    isPreRichPick = false,
    onSelect,
}: {
    year: number;
    film: string;
    index: number;
    isActive: boolean;
    onHover: (year: number) => void;
    isPreRichPick?: boolean;
    onSelect?: (year: number) => void;
}) {
    const [isHovered, setIsHovered] = useState(false);

    const hexVisual = (
        <motion.div
            className="relative cursor-pointer"
            onMouseEnter={() => {
                setIsHovered(true);
                onHover(year);
            }}
            onMouseLeave={() => setIsHovered(false)}
            whileHover={{ scale: 1.08, zIndex: 20 }}
            transition={{ duration: 0.2 }}
            onClick={onSelect ? () => onSelect(year) : undefined}
        >
            <div
                className={`
              w-[72px] h-[82px] md:w-[85px] md:h-[98px]
              clip-hexagon
              flex items-center justify-center
              transition-all duration-300 ease-out
              ${isActive || isHovered
                        ? "bg-accent"
                        : isPreRichPick
                            ? "bg-border/30"
                            : "bg-border"
                    }
            `}
            >
                <div
                    className={`
                clip-hexagon flex items-center justify-center
                transition-all duration-300 ease-out
                ${isActive || isHovered
                            ? "bg-accent"
                            : isPreRichPick
                                ? "bg-background"
                                : "bg-secondary"
                        }
              `}
                    style={{ width: "calc(100% - 3px)", height: "calc(100% - 3px)" }}
                >
                    <div className="flex flex-col items-center justify-center text-center">
                        <span
                            className={`
                    font-serif text-lg md:text-xl font-bold transition-colors duration-300
                    ${isActive || isHovered ? "text-accent-foreground" : "text-foreground"}
                  `}
                        >
                            {year}
                        </span>
                        {(isActive || isHovered) && (
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
            </div>
        </motion.div>
    );

    return (
        <motion.div
            data-active={isActive}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 + index * 0.015, duration: 0.3 }}
        >
            {onSelect ? hexVisual : <Link href={`/year/${year}`}>{hexVisual}</Link>}
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
              clip-hexagon
              flex items-center justify-center
              transition-all duration-300 ease-out
              ${isHovered ? "bg-foreground" : "bg-border"}
            `}
                    >
                        <div
                            className={`
                clip-hexagon flex items-center justify-center gap-1 flex-col
                transition-all duration-300 ease-out
                ${isHovered ? "bg-foreground" : "bg-card"}
              `}
                            style={{ width: "calc(100% - 3px)", height: "calc(100% - 3px)" }}
                        >
                            <Icon
                                className={`w-5 h-5 md:w-6 md:h-6 transition-colors duration-300 ${isHovered ? "text-background" : "text-foreground"
                                    }`}
                            />
                            <span
                                className={`text-[10px] md:text-xs font-medium transition-colors duration-300 ${isHovered ? "text-background" : "text-muted-foreground"
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

export default function HomeClient({ rawFilmsData, dbStats, filmIdMap, dbFilmsData, topFilmsPerYear }: { rawFilmsData: any[], dbStats: Record<number, Record<string, { wins: number, noms: number }>>, filmIdMap: Record<string, number>, dbFilmsData: Array<{ release_year: number; title: string; grade: string; film_id: number }>, topFilmsPerYear: Array<{ year: number; title: string }> }) {
    const filmsData = rawFilmsData;

    const validYears = filmsData
        .map(f => String(f.year).trim())
        .filter(y => y && !isNaN(parseInt(y, 10)));

    const dbOnlyYears = dbFilmsData
        .map(f => String(f.release_year))
        .filter(y => !validYears.includes(y));

    const topFilmYears = topFilmsPerYear
        .map(t => String(t.year))
        .filter(y => !validYears.includes(y) && !dbOnlyYears.includes(y));

    const rawYears = Array.from(new Set([...validYears, ...dbOnlyYears, ...topFilmYears]));
    const sortedYears = rawYears.sort((a, b) => parseInt(b, 10) - parseInt(a, 10));

    const YEARS_DATA = sortedYears.map(year => {
        const yNum = parseInt(year, 10);
        const staticFilms = filmsData.filter(f => String(f.year).trim() === year);
        let topFilm: any;
        if (staticFilms.length > 0) {
            topFilm = staticFilms
                .map(f => {
                    const stats = dbStats[yNum]?.[f.title] || { wins: 0, noms: 0 };
                    return { ...f, dbWins: stats.wins, dbNoms: stats.noms };
                })
                .sort((a, b) => {
                    const valA = getGradeValue(a.grade);
                    const valB = getGradeValue(b.grade);
                    if (valB !== valA) return valB - valA;
                    if (b.dbWins !== a.dbWins) return b.dbWins - a.dbWins;
                    return b.dbNoms - a.dbNoms;
                })[0];
        } else {
            const best = dbFilmsData
                .filter(f => f.release_year === yNum)
                .sort((a, b) => getGradeValue(b.grade) - getGradeValue(a.grade))[0];
            if (best) {
                topFilm = { title: best.title };
            } else {
                const fallback = topFilmsPerYear.find(t => t.year === yNum);
                if (fallback) topFilm = { title: fallback.title };
            }
        }
        return {
            year: yNum,
            film: topFilm ? topFilm.title : "Unknown"
        };
    });

    const [selectedYear, setSelectedYear] = useState(YEARS_DATA[0]?.year || 2024);
    const containerRef = useRef<HTMLDivElement>(null);
    const carouselRef = useRef<HTMLDivElement>(null);
    const [hexesPerRow, setHexesPerRow] = useState(5);

    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const width = entry.contentRect.width;
                const maxHexes = Math.floor(width / 85);
                setHexesPerRow(Math.max(2, maxHexes));
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // Scroll the active year hex into view in the mobile carousel
    useEffect(() => {
        if (!carouselRef.current) return;
        const activeEl = carouselRef.current.querySelector('[data-active="true"]');
        if (activeEl) {
            (activeEl as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }, [selectedYear]);

    const currentTop10 = useMemo(() => {
        const staticFilms = filmsData.filter(f => String(f.year).trim() === String(selectedYear));
        const source = staticFilms.length > 0
            ? staticFilms.map(f => {
                const stats = dbStats[selectedYear]?.[f.title] || { wins: 0, noms: 0 };
                return {
                    id: f.id,
                    film: f.title,
                    filmId: filmIdMap[`${selectedYear}|${f.title.toLowerCase()}`] ?? null,
                    grade: f.grade || "-",
                    wins: stats.wins,
                    noms: stats.noms
                };
            })
            : dbFilmsData
                .filter(f => f.release_year === selectedYear)
                .map(f => {
                    const stats = dbStats[selectedYear]?.[f.title] || { wins: 0, noms: 0 };
                    return {
                        id: f.film_id,
                        film: f.title,
                        filmId: filmIdMap[`${selectedYear}|${f.title.toLowerCase()}`] ?? null,
                        grade: f.grade || "-",
                        wins: stats.wins,
                        noms: stats.noms
                    };
                });
        return source
            .sort((a, b) => {
                const valA = getGradeValue(a.grade);
                const valB = getGradeValue(b.grade);
                if (valB !== valA) return valB - valA;
                if (b.wins !== a.wins) return b.wins - a.wins;
                return b.noms - a.noms;
            })
            .slice(0, 10)
            .map((item, index) => ({ ...item, rank: index + 1 }));
    }, [selectedYear, filmsData, dbStats, filmIdMap, dbFilmsData]);

    const top10List = (
        <div className="space-y-3">
            {currentTop10.map((item) => (
                <div key={item.id} className="group flex items-center gap-2.5">
                    <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center rounded text-[10px] font-bold bg-muted/60 text-muted-foreground">
                        {item.rank}
                    </span>
                    <GradeHex grade={item.grade} />
                    <div className="flex-1 min-w-0 flex items-baseline gap-2 flex-wrap">
                        {item.filmId ? (
                            <Link href={`/film/${item.filmId}`} className="font-medium text-sm text-foreground hover:text-accent transition-colors">
                                {item.film}
                            </Link>
                        ) : (
                            <span className="font-medium text-sm text-foreground">
                                {item.film}
                            </span>
                        )}
                        <span className="text-[10px] text-muted-foreground truncate">
                            {formatSubtitle(item.wins, item.noms)}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );

    return (
        <div className="min-h-screen bg-background text-foreground">

            {/* ── Desktop layout (lg+) ─────────────────────────────────── */}
            <div className="hidden lg:flex min-h-screen overflow-hidden">
                <div className="w-[450px] xl:w-[500px] flex-shrink-0 flex flex-col justify-start px-12 pt-20 pb-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="max-w-lg"
                    >
                        <div className="mb-8">
                            <h1 className="font-serif text-5xl font-bold tracking-tight leading-none text-balance">
                                Rich<span className="text-accent"> Picks</span>
                            </h1>
                            <p className="mt-4 text-base text-muted-foreground leading-relaxed">
                                The best in cinema from Rich's perspective every year since 2005
                            </p>
                        </div>

                        <div className="flex gap-5 mb-8">
                            <div className="flex items-center gap-1.5">
                                <Calendar className="w-4 h-4 text-accent" />
                                <span className="text-xs text-muted-foreground">
                                    <strong className="text-foreground">{YEARS_DATA.filter(d => d.year >= 2005).length}</strong> Years
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Trophy className="w-4 h-4 text-accent" />
                                <span className="text-xs text-muted-foreground">
                                    <strong className="text-foreground">18</strong> Categories
                                </span>
                            </div>
                        </div>

                        <div className="bg-card/90 border border-border rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Star className="w-4 h-4 text-accent" />
                                <h2 className="font-serif text-lg font-semibold">Top 10 of {selectedYear}</h2>
                            </div>
                            {top10List}
                            <Link
                                href={`/year/${selectedYear}`}
                                className="inline-flex items-center gap-1 mt-3 text-xs text-accent hover:underline"
                            >
                                View full year
                                <ChevronRight className="w-3 h-3" />
                            </Link>
                        </div>
                    </motion.div>
                </div>

                <div className="flex flex-1 pt-24 pb-8 pr-12 pl-4 xl:pr-20">
                    <div className="flex flex-col h-full w-full max-w-[1200px] mx-auto" ref={containerRef}>
                        <div className="flex gap-1 justify-end w-full mb-12">
                            <NavHex icon={Award} label="Awards" href="/categories" delay={0.05} />
                            <NavHex icon={Search} label="Search" href="/search" delay={0.1} />
                            <NavHex icon={Calendar} label="Years" href="/years" delay={0.15} />
                        </div>

                        <div className="flex-1 flex flex-col justify-start">
                            {(() => {
                                const richPickYears = YEARS_DATA.filter(d => d.year >= 2005);
                                const preRichPickYears = YEARS_DATA.filter(d => d.year < 2005);

                                function buildRows(data: typeof YEARS_DATA, globalOffset: number) {
                                    const rows = [];
                                    let currentIndex = 0;
                                    let isOffset = false;

                                    while (currentIndex < data.length) {
                                        const expectedItems = isOffset ? hexesPerRow - 1 : hexesPerRow;
                                        const items = data.slice(currentIndex, currentIndex + expectedItems);
                                        const placeholders = expectedItems - items.length;

                                        rows.push({
                                            isOffset,
                                            items,
                                            placeholders,
                                            startIndex: globalOffset + currentIndex
                                        });

                                        currentIndex += expectedItems;
                                        isOffset = !isOffset;
                                    }
                                    return rows;
                                }

                                const richRows = buildRows(richPickYears, 0);
                                const preRows = buildRows(preRichPickYears, richPickYears.length);

                                return (
                                    <>
                                        {richRows.map((row, rowIndex) => (
                                            <div
                                                key={`r-${rowIndex}`}
                                                className="flex justify-center"
                                                style={{
                                                    marginBottom: rowIndex < richRows.length - 1 ? "-25px" : "0",
                                                }}
                                            >
                                                {row.items.map((d, i) => (
                                                    <YearHex
                                                        key={d.year}
                                                        year={d.year}
                                                        film={d.film}
                                                        index={row.startIndex + i}
                                                        isActive={selectedYear === d.year}
                                                        onHover={setSelectedYear}
                                                    />
                                                ))}
                                                {[...Array(row.placeholders)].map((_, i) => (
                                                    <div key={`ph-r-${rowIndex}-${i}`} className="w-[72px] h-[82px] md:w-[85px] md:h-[98px] pointer-events-none invisible" />
                                                ))}
                                            </div>
                                        ))}

                                        {preRichPickYears.length > 0 && (
                                            <div className="flex items-center gap-4 my-4">
                                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                                            </div>
                                        )}

                                        {preRows.map((row, rowIndex) => (
                                            <div
                                                key={`p-${rowIndex}`}
                                                className="flex justify-center"
                                                style={{
                                                    marginBottom: rowIndex < preRows.length - 1 ? "-25px" : "0",
                                                }}
                                            >
                                                {row.items.map((d, i) => (
                                                    <YearHex
                                                        key={d.year}
                                                        year={d.year}
                                                        film={d.film}
                                                        index={row.startIndex + i}
                                                        isActive={selectedYear === d.year}
                                                        onHover={setSelectedYear}
                                                        isPreRichPick
                                                    />
                                                ))}
                                                {[...Array(row.placeholders)].map((_, i) => (
                                                    <div key={`ph-p-${rowIndex}-${i}`} className="w-[72px] h-[82px] md:w-[85px] md:h-[98px] pointer-events-none invisible" />
                                                ))}
                                            </div>
                                        ))}
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Mobile layout (< lg) ─────────────────────────────────── */}
            <div className="lg:hidden flex flex-col">

                {/* Header — scrolls away with the page */}
                <div className="px-6 pt-14 pb-5">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <div className="mb-5">
                            <h1 className="font-serif text-4xl font-bold tracking-tight leading-none text-balance">
                                Rich<span className="text-accent"> Picks</span>
                            </h1>
                            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                                Nominations and awards Rich has given annually since 2005, to celebrate cinematic excellence in his opinion
                            </p>
                        </div>

                        <div className="flex gap-5 mb-5">
                            <div className="flex items-center gap-1.5">
                                <Calendar className="w-4 h-4 text-accent" />
                                <span className="text-xs text-muted-foreground">
                                    <strong className="text-foreground">{YEARS_DATA.filter(d => d.year >= 2005).length}</strong> Years
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Trophy className="w-4 h-4 text-accent" />
                                <span className="text-xs text-muted-foreground">
                                    <strong className="text-foreground">18</strong> Categories
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Link
                                href="/categories"
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                            >
                                <Award className="w-3.5 h-3.5" />
                                Awards
                            </Link>
                            <Link
                                href="/search"
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                            >
                                <Search className="w-3.5 h-3.5" />
                                Search
                            </Link>
                            <Link
                                href="/years"
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                            >
                                <Calendar className="w-3.5 h-3.5" />
                                All Years
                            </Link>
                        </div>
                    </motion.div>
                </div>

                {/* Sticky year carousel */}
                <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-y border-border">
                    <div ref={carouselRef} className="overflow-x-auto scrollbar-hide">
                        <div className="flex gap-1 px-4 py-3 w-max">
                            {YEARS_DATA.map((d, i) => (
                                <YearHex
                                    key={d.year}
                                    year={d.year}
                                    film={d.film}
                                    index={i}
                                    isActive={selectedYear === d.year}
                                    onHover={setSelectedYear}
                                    onSelect={setSelectedYear}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Top 10 */}
                <div className="px-6 pt-4 pb-10">
                    <div className="bg-card/90 border border-border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Star className="w-4 h-4 text-accent" />
                            <h2 className="font-serif text-base font-semibold">Top 10 of {selectedYear}</h2>
                        </div>
                        {top10List}
                        <Link
                            href={`/year/${selectedYear}`}
                            className="inline-flex items-center gap-1 mt-3 text-xs text-accent hover:underline"
                        >
                            View full year
                            <ChevronRight className="w-3 h-3" />
                        </Link>
                    </div>
                </div>

            </div>
        </div>
    );
}
