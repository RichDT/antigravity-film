"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import Image from "next/image"
import Link from "next/link"

const DEMO_YEARS = [
  { year: 2024, film: "Anora", poster: "https://image.tmdb.org/t/p/w500/7MrgIUeq0DD2iF7GR6wqJfYZNeC.jpg", director: "Sean Baker" },
  { year: 2023, film: "Oppenheimer", poster: "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg", director: "Christopher Nolan" },
  { year: 2022, film: "Everything Everywhere All at Once", poster: "https://image.tmdb.org/t/p/w500/w3LxiVYdWWRvEVdn5RYq6jIqkb1.jpg", director: "Daniels" },
  { year: 2019, film: "Parasite", poster: "https://image.tmdb.org/t/p/w500/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg", director: "Bong Joon-ho" },
  { year: 1999, film: "The Matrix", poster: "https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg", director: "The Wachowskis" },
  { year: 1994, film: "Pulp Fiction", poster: "https://image.tmdb.org/t/p/w500/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg", director: "Quentin Tarantino" },
  { year: 1972, film: "The Godfather", poster: "https://image.tmdb.org/t/p/w500/3bhkrj58Vtu7enYsRolD1fZdja1.jpg", director: "Francis Ford Coppola" },
]

export default function MarqueeDemo() {
  const [selectedYear, setSelectedYear] = useState(DEMO_YEARS[0])

  return (
    <div className="min-h-screen bg-[#1a1510] text-[#f5e6d3]">
      {/* Decorative top border */}
      <div className="h-2 bg-gradient-to-r from-[#8b6914] via-[#d4a824] to-[#8b6914]" />
      
      {/* Header */}
      <header className="border-b border-[#3d3225] bg-[#1a1510]/90 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <nav className="flex items-center justify-between">
            <Link href="/" className="text-sm tracking-widest uppercase text-[#d4a824]/60 hover:text-[#d4a824]">
              Back to Hexagon Demo
            </Link>
            <div className="flex gap-8 text-sm tracking-widest uppercase">
              <span className="text-[#d4a824]">Years</span>
              <span className="text-[#f5e6d3]/40 hover:text-[#f5e6d3]/80 cursor-pointer">Categories</span>
              <span className="text-[#f5e6d3]/40 hover:text-[#f5e6d3]/80 cursor-pointer">Search</span>
            </div>
          </nav>
        </div>
      </header>

      {/* Hero with marquee lights effect */}
      <section className="relative overflow-hidden py-20">
        {/* Ambient glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#d4a824]/5 to-transparent" />
        
        {/* Marquee lights border */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 flex gap-4">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="w-3 h-3 rounded-full bg-[#d4a824]"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
            />
          ))}
        </div>

        <div className="relative mx-auto max-w-7xl px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 text-[#d4a824] tracking-[0.3em] uppercase text-sm"
          >
            Now Showing
          </motion.div>
          <h1 className="font-serif text-7xl md:text-9xl font-light tracking-tight mb-6">
            Rich Picks
          </h1>
          <p className="text-xl text-[#f5e6d3]/60 font-light tracking-wide">
            A Curated Collection of Cinema&apos;s Finest
          </p>
        </div>
      </section>

      {/* Main content - Split view */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left - Featured film display */}
          <motion.div 
            key={selectedYear.year}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative"
          >
            {/* Art deco frame */}
            <div className="absolute -inset-4 border-2 border-[#d4a824]/30" />
            <div className="absolute -inset-2 border border-[#d4a824]/50" />
            
            {/* Corner ornaments */}
            <div className="absolute -top-6 -left-6 w-12 h-12 border-t-2 border-l-2 border-[#d4a824]" />
            <div className="absolute -top-6 -right-6 w-12 h-12 border-t-2 border-r-2 border-[#d4a824]" />
            <div className="absolute -bottom-6 -left-6 w-12 h-12 border-b-2 border-l-2 border-[#d4a824]" />
            <div className="absolute -bottom-6 -right-6 w-12 h-12 border-b-2 border-r-2 border-[#d4a824]" />

            <div className="relative aspect-[2/3] overflow-hidden bg-[#0d0a07]">
              <Image
                src={selectedYear.poster}
                alt={selectedYear.film}
                fill
                className="object-cover"
              />
              {/* Film grain overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#1a1510] via-transparent to-transparent" />
            </div>
            
            {/* Film info plaque */}
            <div className="mt-8 text-center">
              <div className="inline-block px-8 py-4 bg-[#0d0a07] border border-[#d4a824]/40">
                <div className="text-[#d4a824] text-6xl font-serif mb-2">{selectedYear.year}</div>
                <div className="text-2xl font-serif tracking-wide mb-1">{selectedYear.film}</div>
                <div className="text-sm text-[#f5e6d3]/50 tracking-widest uppercase">
                  Directed by {selectedYear.director}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right - Year selection */}
          <div>
            <h2 className="text-sm tracking-[0.3em] uppercase text-[#d4a824] mb-8">
              Select a Year
            </h2>
            <div className="space-y-4">
              {DEMO_YEARS.map((year, index) => (
                <motion.button
                  key={year.year}
                  onClick={() => setSelectedYear(year)}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`w-full text-left group flex items-center gap-6 p-4 border transition-all ${
                    selectedYear.year === year.year
                      ? "border-[#d4a824] bg-[#d4a824]/10"
                      : "border-[#3d3225] hover:border-[#d4a824]/50 hover:bg-[#d4a824]/5"
                  }`}
                >
                  <span className={`text-4xl font-serif ${
                    selectedYear.year === year.year ? "text-[#d4a824]" : "text-[#f5e6d3]/30 group-hover:text-[#f5e6d3]/60"
                  }`}>
                    {year.year}
                  </span>
                  <div className="flex-1">
                    <div className={`font-serif text-lg ${
                      selectedYear.year === year.year ? "text-[#f5e6d3]" : "text-[#f5e6d3]/60"
                    }`}>
                      {year.film}
                    </div>
                    <div className="text-sm text-[#f5e6d3]/40">{year.director}</div>
                  </div>
                  <div className={`w-16 h-24 relative overflow-hidden border ${
                    selectedYear.year === year.year ? "border-[#d4a824]" : "border-[#3d3225]"
                  }`}>
                    <Image
                      src={year.poster}
                      alt={year.film}
                      fill
                      className="object-cover"
                    />
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Categories teaser */}
      <section className="border-t border-[#3d3225] bg-[#0d0a07] py-20">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-center text-sm tracking-[0.3em] uppercase text-[#d4a824] mb-12">
            Award Categories
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {["Best Picture", "Best Director", "Best Actor", "Best Actress", "Cinematography", "Original Score", "Visual Effects", "Screenplay"].map((cat, i) => (
              <motion.div
                key={cat}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="group cursor-pointer p-6 border border-[#3d3225] hover:border-[#d4a824]/50 hover:bg-[#d4a824]/5 transition-all text-center"
              >
                <div className="text-3xl mb-2 text-[#d4a824]/60 group-hover:text-[#d4a824]">
                  {["🏆", "🎬", "🎭", "👗", "📷", "🎵", "✨", "📝"][i]}
                </div>
                <div className="text-sm tracking-wide text-[#f5e6d3]/60 group-hover:text-[#f5e6d3]">
                  {cat}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Decorative bottom border */}
      <div className="h-2 bg-gradient-to-r from-[#8b6914] via-[#d4a824] to-[#8b6914]" />
    </div>
  )
}
