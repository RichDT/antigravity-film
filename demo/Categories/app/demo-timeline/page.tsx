"use client"

import { useRef, useState } from "react"
import { motion, useScroll, useTransform } from "framer-motion"
import Image from "next/image"
import Link from "next/link"

const DEMO_YEARS = [
  { year: 2024, film: "Anora", poster: "https://image.tmdb.org/t/p/w500/7MrgIUeq0DD2iF7GR6wqJfYZNeC.jpg", director: "Sean Baker", color: "#4a6741" },
  { year: 2023, film: "Oppenheimer", poster: "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg", director: "Christopher Nolan", color: "#b35c1e" },
  { year: 2022, film: "Everything Everywhere All at Once", poster: "https://image.tmdb.org/t/p/w500/w3LxiVYdWWRvEVdn5RYq6jIqkb1.jpg", director: "Daniels", color: "#8b4a6b" },
  { year: 2019, film: "Parasite", poster: "https://image.tmdb.org/t/p/w500/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg", director: "Bong Joon-ho", color: "#2d5a4a" },
  { year: 1999, film: "The Matrix", poster: "https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg", director: "The Wachowskis", color: "#1a3d1a" },
  { year: 1994, film: "Pulp Fiction", poster: "https://image.tmdb.org/t/p/w500/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg", director: "Quentin Tarantino", color: "#8b7355" },
  { year: 1972, film: "The Godfather", poster: "https://image.tmdb.org/t/p/w500/3bhkrj58Vtu7enYsRolD1fZdja1.jpg", director: "Francis Ford Coppola", color: "#3d2d1f" },
]

function YearCard({ data, index }: { data: typeof DEMO_YEARS[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  })
  
  const y = useTransform(scrollYProgress, [0, 1], [100, -100])
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0])
  const scale = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0.8, 1, 1, 0.8])

  return (
    <motion.section
      ref={ref}
      style={{ backgroundColor: data.color }}
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
    >
      {/* Background poster with parallax */}
      <motion.div 
        style={{ y }}
        className="absolute inset-0 opacity-20"
      >
        <Image
          src={data.poster}
          alt=""
          fill
          className="object-cover blur-2xl scale-110"
        />
      </motion.div>
      
      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/60" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/30" />

      <motion.div 
        style={{ opacity, scale }}
        className="relative z-10 mx-auto max-w-7xl px-6 py-20 grid lg:grid-cols-2 gap-16 items-center"
      >
        {/* Text content */}
        <div className={index % 2 === 0 ? "lg:order-1" : "lg:order-2"}>
          <motion.div
            initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="text-white/40 text-sm tracking-[0.5em] uppercase mb-4">
              Chapter {index + 1}
            </div>
            <h2 className="text-[12rem] leading-none font-bold text-white/10 absolute -top-10 -left-10 select-none pointer-events-none">
              {data.year}
            </h2>
            <div className="relative">
              <div className="text-8xl md:text-9xl font-bold text-white mb-6">
                {data.year}
              </div>
              <h3 className="text-4xl md:text-5xl font-light text-white mb-4 leading-tight">
                {data.film}
              </h3>
              <p className="text-xl text-white/60 mb-8">
                Directed by {data.director}
              </p>
              <button className="group flex items-center gap-3 text-white/80 hover:text-white transition-colors">
                <span className="tracking-widest uppercase text-sm">Explore Year</span>
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
            </div>
          </motion.div>
        </div>

        {/* Poster */}
        <div className={index % 2 === 0 ? "lg:order-2" : "lg:order-1"}>
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            {/* Poster shadow/glow */}
            <div 
              className="absolute inset-0 blur-3xl opacity-50 translate-y-10"
              style={{ backgroundColor: data.color }}
            />
            <div className="relative aspect-[2/3] max-w-md mx-auto rounded-lg overflow-hidden shadow-2xl">
              <Image
                src={data.poster}
                alt={data.film}
                fill
                className="object-cover"
              />
            </div>
            {/* Rank badge */}
            <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-white text-black rounded-full flex items-center justify-center shadow-xl">
              <div className="text-center">
                <div className="text-xs font-bold uppercase tracking-wider">#1</div>
                <div className="text-lg font-bold">{data.year}</div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Scroll indicator */}
      {index < DEMO_YEARS.length - 1 && (
        <motion.div 
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </motion.div>
      )}
    </motion.section>
  )
}

export default function TimelineDemo() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ container: containerRef })
  
  return (
    <div className="h-screen overflow-hidden bg-black">
      {/* Fixed header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/10">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <nav className="flex items-center justify-between">
            <Link href="/" className="text-sm tracking-widest uppercase text-white/40 hover:text-white">
              Back to Hexagon Demo
            </Link>
            <div className="text-2xl font-bold text-white">Rich Picks</div>
            <div className="flex gap-6 text-sm tracking-widest uppercase text-white/40">
              <span className="hover:text-white cursor-pointer">Categories</span>
              <span className="hover:text-white cursor-pointer">Search</span>
            </div>
          </nav>
        </div>
        {/* Progress bar */}
        <motion.div 
          className="h-0.5 bg-white origin-left"
          style={{ scaleX: scrollYProgress }}
        />
      </header>

      {/* Scrollable content */}
      <div ref={containerRef} className="h-screen overflow-y-auto snap-y snap-mandatory">
        {/* Hero */}
        <section className="min-h-screen flex items-center justify-center bg-black snap-start">
          <div className="text-center px-6">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1 }}
            >
              <h1 className="text-7xl md:text-9xl font-bold text-white mb-6">
                Rich Picks
              </h1>
              <p className="text-xl md:text-2xl text-white/50 mb-12 max-w-2xl mx-auto">
                A journey through decades of cinema. Scroll to explore the greatest films of each year.
              </p>
              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-white/30"
              >
                <div className="text-sm tracking-widest uppercase mb-2">Scroll to begin</div>
                <svg className="w-6 h-6 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Year sections */}
        {DEMO_YEARS.map((year, index) => (
          <div key={year.year} className="snap-start">
            <YearCard data={year} index={index} />
          </div>
        ))}

        {/* Footer */}
        <section className="min-h-screen flex items-center justify-center bg-black snap-start">
          <div className="text-center px-6">
            <h2 className="text-5xl md:text-7xl font-bold text-white mb-6">
              Explore More
            </h2>
            <p className="text-xl text-white/50 mb-12">
              Dive deeper into categories, search the archive, or browse all years.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <button className="px-8 py-4 bg-white text-black font-medium tracking-wide hover:bg-white/90 transition-colors">
                All Years
              </button>
              <button className="px-8 py-4 border border-white/30 text-white font-medium tracking-wide hover:bg-white/10 transition-colors">
                Categories
              </button>
              <button className="px-8 py-4 border border-white/30 text-white font-medium tracking-wide hover:bg-white/10 transition-colors">
                Search
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
