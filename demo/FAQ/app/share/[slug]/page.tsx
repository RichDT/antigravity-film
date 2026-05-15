"use client";

import React, { useRef } from "react";
import { motion } from "framer-motion";
import { useParams } from "next/navigation";
import { Download, Share2, Instagram, Twitter } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReviewData {
  title: string;
  year: number;
  grade: string;
  director: string;
  review: string;
  rank?: number; // Top 10 rank if applicable
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const REVIEWS: Record<string, ReviewData> = {
  "anora": {
    title: "Anora",
    year: 2024,
    grade: "A",
    director: "Sean Baker",
    review: "A wild, exhilarating ride that proves love is messy, complicated, and occasionally involves Russian oligarchs. Mikey Madison delivers a star-making performance.",
    rank: 1,
  },
  "the-brutalist": {
    title: "The Brutalist",
    year: 2024,
    grade: "A",
    director: "Brady Corbet",
    review: "An architectural epic that builds its emotional foundations as carefully as its protagonist designs his structures. Brody is monumental.",
    rank: 2,
  },
  "oppenheimer": {
    title: "Oppenheimer",
    year: 2023,
    grade: "A+",
    director: "Christopher Nolan",
    review: "Nolan crafts a devastating portrait of genius and guilt. Murphy disappears into the father of the atomic bomb with haunting precision.",
    rank: 1,
  },
  "poor-things": {
    title: "Poor Things",
    year: 2023,
    grade: "A",
    director: "Yorgos Lanthimos",
    review: "A deliriously inventive feminist fable. Stone is fearless, hilarious, and deeply moving as Bella discovers the world and herself.",
    rank: 3,
  },
  "conclave": {
    title: "Conclave",
    year: 2024,
    grade: "A-",
    director: "Edward Berger",
    review: "A papal thriller that crackles with intrigue. Fiennes commands every frame as a cardinal navigating faith and politics in the Vatican.",
    rank: 4,
  },
};

// ─── Grade Styling ────────────────────────────────────────────────────────────

function getGradeColor(grade: string): string {
  const letter = grade.charAt(0).toUpperCase();
  switch (letter) {
    case "A": return "bg-emerald-500 text-white";
    case "B": return "bg-sky-500 text-white";
    case "C": return "bg-amber-500 text-white";
    case "D": return "bg-orange-500 text-white";
    case "F": return "bg-red-500 text-white";
    default: return "bg-muted text-muted-foreground";
  }
}

function getGradeGlow(grade: string): string {
  const letter = grade.charAt(0).toUpperCase();
  switch (letter) {
    case "A": return "shadow-[0_0_60px_rgba(16,185,129,0.4)]";
    case "B": return "shadow-[0_0_60px_rgba(14,165,233,0.4)]";
    case "C": return "shadow-[0_0_60px_rgba(245,158,11,0.4)]";
    case "D": return "shadow-[0_0_60px_rgba(249,115,22,0.4)]";
    case "F": return "shadow-[0_0_60px_rgba(239,68,68,0.4)]";
    default: return "";
  }
}

// ─── Share Card Component ─────────────────────────────────────────────────────

function ShareCard({ review }: { review: ReviewData }) {
  return (
    <div 
      className="w-[1080px] h-[1350px] bg-[#4a3b3b] flex flex-col relative overflow-hidden"
      style={{ fontFamily: "'Georgia', serif" }}
    >
      {/* Background decorative hexagons */}
      <div className="absolute inset-0 overflow-hidden opacity-[0.03]">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute clip-hexagon bg-white"
            style={{
              width: `${150 + i * 30}px`,
              height: `${173 + i * 35}px`,
              left: `${(i % 4) * 300 - 50}px`,
              top: `${Math.floor(i / 4) * 400 + 100}px`,
              transform: `rotate(${i * 15}deg)`,
            }}
          />
        ))}
      </div>

      {/* Top section: Brand */}
      <div className="pt-16 px-16 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-14 clip-hexagon bg-[#d4af37] flex items-center justify-center">
            <span className="text-[#2a2222] font-bold text-lg">R</span>
          </div>
          <span className="text-[#f5f0eb] text-2xl tracking-wider font-semibold">
            RICH PICKS
          </span>
        </div>
        <span className="text-[#b8a8a0] text-xl">{review.year}</span>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-16 relative z-10">
        {/* Grade hexagon - large and prominent */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className={`w-48 h-56 clip-hexagon flex items-center justify-center mb-12 ${getGradeColor(review.grade)} ${getGradeGlow(review.grade)}`}
        >
          <span className="text-8xl font-bold tracking-tight">{review.grade}</span>
        </motion.div>

        {/* Film title */}
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-[#f5f0eb] text-7xl font-bold text-center mb-6 leading-tight tracking-tight"
          style={{ fontFamily: "'Georgia', serif" }}
        >
          {review.title}
        </motion.h1>

        {/* Director */}
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-[#d4af37] text-2xl mb-12 tracking-wide"
        >
          Directed by {review.director}
        </motion.p>

        {/* Decorative line */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="w-32 h-0.5 bg-gradient-to-r from-transparent via-[#d4af37] to-transparent mb-12"
        />

        {/* Review quote */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="max-w-3xl"
        >
          <p className="text-[#f5f0eb]/90 text-3xl text-center leading-relaxed italic">
            &ldquo;{review.review}&rdquo;
          </p>
        </motion.div>
      </div>

      {/* Bottom section: Rank badge if applicable */}
      <div className="pb-16 px-16 flex items-center justify-between relative z-10">
        {review.rank ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-12 clip-hexagon bg-[#d4af37]/20 flex items-center justify-center border border-[#d4af37]/40">
              <span className="text-[#d4af37] font-bold text-lg">#{review.rank}</span>
            </div>
            <span className="text-[#b8a8a0] text-lg">Top 10 of {review.year}</span>
          </div>
        ) : (
          <div />
        )}
        
        <div className="text-[#b8a8a0] text-lg tracking-wider">
          richpicks.film
        </div>
      </div>

      {/* Corner accents */}
      <div className="absolute top-0 right-0 w-32 h-32 border-t-2 border-r-2 border-[#d4af37]/20 rounded-tr-3xl" />
      <div className="absolute bottom-0 left-0 w-32 h-32 border-b-2 border-l-2 border-[#d4af37]/20 rounded-bl-3xl" />
    </div>
  );
}

// ─── Preview Wrapper ──────────────────────────────────────────────────────────

function ShareCardPreview({ review }: { review: ReviewData }) {
  return (
    <div 
      className="w-full max-w-md aspect-[4/5] bg-[#4a3b3b] flex flex-col relative overflow-hidden rounded-xl border border-border shadow-2xl"
    >
      {/* Background decorative hexagons */}
      <div className="absolute inset-0 overflow-hidden opacity-[0.03]">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute clip-hexagon bg-white"
            style={{
              width: `${40 + i * 10}px`,
              height: `${46 + i * 12}px`,
              left: `${(i % 3) * 120 - 20}px`,
              top: `${Math.floor(i / 3) * 150 + 40}px`,
              transform: `rotate(${i * 15}deg)`,
            }}
          />
        ))}
      </div>

      {/* Top section: Brand */}
      <div className="pt-6 px-6 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-7 clip-hexagon bg-[#d4af37] flex items-center justify-center">
            <span className="text-[#2a2222] font-bold text-xs">R</span>
          </div>
          <span className="text-[#f5f0eb] text-sm tracking-wider font-semibold">
            RICH PICKS
          </span>
        </div>
        <span className="text-[#b8a8a0] text-sm">{review.year}</span>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
        {/* Grade hexagon */}
        <div className={`w-20 h-24 clip-hexagon flex items-center justify-center mb-5 ${getGradeColor(review.grade)} ${getGradeGlow(review.grade)}`}>
          <span className="text-4xl font-bold">{review.grade}</span>
        </div>

        {/* Film title */}
        <h1 className="text-[#f5f0eb] text-2xl font-bold text-center mb-2 leading-tight font-serif">
          {review.title}
        </h1>

        {/* Director */}
        <p className="text-[#d4af37] text-sm mb-5">
          Directed by {review.director}
        </p>

        {/* Decorative line */}
        <div className="w-16 h-px bg-gradient-to-r from-transparent via-[#d4af37] to-transparent mb-5" />

        {/* Review quote */}
        <p className="text-[#f5f0eb]/90 text-sm text-center leading-relaxed italic px-2">
          &ldquo;{review.review}&rdquo;
        </p>
      </div>

      {/* Bottom section */}
      <div className="pb-6 px-6 flex items-center justify-between relative z-10">
        {review.rank ? (
          <div className="flex items-center gap-2">
            <div className="w-5 h-6 clip-hexagon bg-[#d4af37]/20 flex items-center justify-center border border-[#d4af37]/40">
              <span className="text-[#d4af37] font-bold text-[10px]">#{review.rank}</span>
            </div>
            <span className="text-[#b8a8a0] text-xs">Top 10</span>
          </div>
        ) : (
          <div />
        )}
        <span className="text-[#b8a8a0] text-xs tracking-wider">richpicks.film</span>
      </div>

      {/* Corner accents */}
      <div className="absolute top-0 right-0 w-12 h-12 border-t border-r border-[#d4af37]/20 rounded-tr-xl" />
      <div className="absolute bottom-0 left-0 w-12 h-12 border-b border-l border-[#d4af37]/20 rounded-bl-xl" />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SharePage() {
  const params = useParams();
  const slug = params.slug as string;
  const cardRef = useRef<HTMLDivElement>(null);

  const review = REVIEWS[slug];

  if (!review) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-serif font-semibold text-foreground mb-2">Review not found</h1>
          <p className="text-muted-foreground">No review exists for this film.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-serif font-semibold text-foreground">Share Review</h1>
            <p className="text-sm text-muted-foreground">Instagram-ready card for {review.title}</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Preview */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">Preview</h2>
            <ShareCardPreview review={review} />
          </div>

          {/* Actions */}
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">Share Options</h2>
              <div className="space-y-3">
                <Button className="w-full justify-start gap-3" variant="outline">
                  <Download className="w-4 h-4" />
                  Download as PNG (1080 x 1350)
                </Button>
                <Button className="w-full justify-start gap-3" variant="outline">
                  <Instagram className="w-4 h-4" />
                  Share to Instagram Stories
                </Button>
                <Button className="w-full justify-start gap-3" variant="outline">
                  <Twitter className="w-4 h-4" />
                  Share to Twitter/X
                </Button>
                <Button className="w-full justify-start gap-3" variant="outline">
                  <Share2 className="w-4 h-4" />
                  Copy Share Link
                </Button>
              </div>
            </div>

            <div className="border-t border-border pt-6">
              <h2 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">Card Details</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Film</span>
                  <span className="font-medium">{review.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Year</span>
                  <span className="font-medium">{review.year}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Grade</span>
                  <span className={`font-bold px-2 py-0.5 rounded ${getGradeColor(review.grade)}`}>{review.grade}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Director</span>
                  <span className="font-medium">{review.director}</span>
                </div>
                {review.rank && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rank</span>
                    <span className="font-medium">#{review.rank} of {review.year}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-border pt-6">
              <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Dimensions</h2>
              <p className="text-sm text-muted-foreground">
                The share card is optimized for Instagram at <span className="font-medium text-foreground">1080 x 1350px</span> (4:5 aspect ratio), 
                perfect for feed posts. It also works great for Stories when cropped to 9:16.
              </p>
            </div>
          </div>
        </div>

        {/* Full-size card for download (hidden, but rendered) */}
        <div className="sr-only" aria-hidden="true">
          <div ref={cardRef}>
            <ShareCard review={review} />
          </div>
        </div>
      </div>
    </div>
  );
}
