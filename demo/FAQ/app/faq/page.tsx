"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Plus,
  Minus,
  Film,
  Award,
  HelpCircle,
  ChevronLeft,
  Star,
  Trophy,
  Calendar,
  Search,
} from "lucide-react";

// ─── FAQ Data ─────────────────────────────────────────────────────────────────

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSection {
  title: string;
  icon: React.ElementType;
  items: FAQItem[];
}

const FAQ_SECTIONS: FAQSection[] = [
  {
    title: "About Rich Picks",
    icon: Film,
    items: [
      {
        question: "What is Rich Picks?",
        answer: "Rich Picks is a personal film awards and ranking archive that tracks my top films, grades, and award picks across multiple categories each year. It serves as both a historical record of my film opinions and an alternative awards perspective to the major ceremonies like the Oscars, BAFTAs, and Golden Globes.",
      },
      {
        question: "Who decides the winners?",
        answer: "All picks, grades, and rankings are my personal opinions based on my own viewing experience and critical assessment. This is not a voting body or consensus-based award - it represents one person's curated perspective on cinema.",
      },
      {
        question: "How far back does the archive go?",
        answer: "The archive currently spans from 1972 to the present day, with varying levels of completeness for different years. Earlier years may have fewer categories tracked, while recent years have full coverage across all award categories.",
      },
      {
        question: "How often is the site updated?",
        answer: "New reviews and grades are added throughout the year as I watch films. Annual award picks are finalized in early January following each film year, typically after the major award ceremonies have announced their nominations.",
      },
    ],
  },
  {
    title: "Grading System",
    icon: Star,
    items: [
      {
        question: "How does the letter grade system work?",
        answer: "Films are graded on a traditional academic scale from A+ (masterpiece) to F (unwatchable). The grades reflect my overall assessment of a film's quality, taking into account direction, performances, screenplay, technical craft, and emotional impact. An A+ is reserved for truly exceptional films, while anything below C- indicates significant issues.",
      },
      {
        question: "What does each grade mean?",
        answer: "A+/A/A- indicates an excellent film with outstanding qualities. B+/B/B- represents a good film that succeeds in most areas. C+/C/C- is average or mixed, with notable strengths and weaknesses. D+/D/D- indicates a below-average film with significant problems. F is reserved for films with almost no redeeming qualities.",
      },
      {
        question: "Can grades change over time?",
        answer: "Occasionally, yes. If I rewatch a film and my opinion significantly shifts, I may update the grade. However, the original grade at time of first viewing is typically preserved, with any revision noted in the review.",
      },
    ],
  },
  {
    title: "Award Categories",
    icon: Trophy,
    items: [
      {
        question: "What categories do Rich Picks cover?",
        answer: "Rich Picks covers 16 major categories including Best Picture, Best Director, the four acting categories (Actor, Actress, Supporting Actor, Supporting Actress), Best Original and Adapted Screenplay, Best Animated Feature, Best International Feature, Best Documentary, Best Cinematography, Best Production Design, Best Visual Effects, Best Score, and Best Sound.",
      },
      {
        question: "How are nominees selected?",
        answer: "Nominees are selected based on the most notable and acclaimed work in each category for a given year. I consider both critical consensus and my personal assessment when determining the nominee pool, typically selecting 5 nominees per category.",
      },
      {
        question: "How do Rich Picks compare to Oscar/BAFTA picks?",
        answer: "Throughout the site, you can see badges indicating when a Rich Pick nominee or winner also received recognition from the Academy Awards (O), Golden Globes (GG), SAG, DGA, and BAFTA (B). Gold badges indicate wins at those ceremonies, while outlined badges indicate nominations only.",
      },
    ],
  },
  {
    title: "Using the Site",
    icon: Search,
    items: [
      {
        question: "How do I explore by year?",
        answer: "Click on any year hexagon on the homepage or navigate to the Years section. Each year page shows my Top 10 films for that year along with all award category winners and nominees.",
      },
      {
        question: "How do I explore by category?",
        answer: "Visit the Categories section to see all 16 award categories. Click on any category to view its complete history of winners and nominees across all years in the database.",
      },
      {
        question: "Can I see a specific film's full awards history?",
        answer: "Yes! Click on any film title throughout the site to view its dedicated page, which shows every category the film was nominated in, whether it won the Rich Pick, and how it fared at other major award ceremonies.",
      },
      {
        question: "What do the award badges mean?",
        answer: "The small badges next to nominees (O, GG, SAG, DGA, B) indicate recognition from other award bodies. A filled/gold badge means the nominee won that award, while an outlined badge means they were nominated but didn't win. Click any badge to see the full nominee list for that external award.",
      },
    ],
  },
];

// ─── Components ───────────────────────────────────────────────────────────────

function FAQAccordionItem({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-5 text-left group"
      >
        <h3 className="font-serif text-lg md:text-xl font-medium text-foreground group-hover:text-accent transition-colors pr-4">
          {item.question}
        </h3>
        <div className="flex-shrink-0 w-8 h-8 rounded-full border border-border flex items-center justify-center group-hover:border-accent group-hover:bg-accent/10 transition-all">
          {isOpen ? (
            <Minus className="w-4 h-4 text-accent" />
          ) : (
            <Plus className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors" />
          )}
        </div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-muted-foreground leading-relaxed pr-12">
              {item.answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FAQSection({ section, openIndex, setOpenIndex, sectionIndex }: { 
  section: FAQSection; 
  openIndex: number | null; 
  setOpenIndex: (index: number | null) => void;
  sectionIndex: number;
}) {
  const Icon = section.icon;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: sectionIndex * 0.1, duration: 0.4 }}
      className="mb-12 last:mb-0"
    >
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-11 clip-hexagon bg-accent/20 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-accent" />
        </div>
        <h2 className="font-serif text-2xl font-semibold text-foreground">
          {section.title}
        </h2>
        <div className="h-px flex-1 bg-gradient-to-r from-border/60 to-transparent" />
      </div>
      
      {/* Questions */}
      <div className="bg-card border border-border rounded-lg px-6">
        {section.items.map((item, index) => {
          const globalIndex = sectionIndex * 100 + index;
          return (
            <FAQAccordionItem
              key={index}
              item={item}
              isOpen={openIndex === globalIndex}
              onToggle={() => setOpenIndex(openIndex === globalIndex ? null : globalIndex)}
            />
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Nav Hex ──────────────────────────────────────────────────────────────────

function NavHex({ icon: Icon, label, href, delay = 0 }: { icon: React.ElementType; label: string; href: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.3 }}
    >
      <Link
        href={href}
        className="group flex flex-col items-center gap-1"
      >
        <div className="w-12 h-14 clip-hexagon bg-secondary flex items-center justify-center group-hover:bg-accent transition-colors duration-200">
          <Icon className="w-5 h-5 text-foreground group-hover:text-accent-foreground transition-colors" />
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground group-hover:text-accent transition-colors">
          {label}
        </span>
      </Link>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-9 clip-hexagon bg-accent flex items-center justify-center">
              <Film className="w-4 h-4 text-accent-foreground" />
            </div>
            <span className="font-serif text-lg font-semibold">Rich Picks</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <NavHex icon={Award} label="Awards" href="/categories" delay={0.05} />
            <NavHex icon={Calendar} label="Years" href="/years" delay={0.1} />
            <NavHex icon={Search} label="Search" href="/search" delay={0.15} />
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="pt-24 pb-8 px-6 md:px-10 border-b border-border">
        <div className="max-w-4xl mx-auto">
          <Link 
            href="/" 
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Home
          </Link>
          
          <div className="flex items-center gap-4">
            <div className="w-14 h-16 clip-hexagon bg-accent/20 flex items-center justify-center flex-shrink-0">
              <HelpCircle className="w-7 h-7 text-accent" />
            </div>
            <div>
              <h1 className="font-serif text-3xl md:text-4xl font-semibold text-foreground">
                Frequently Asked Questions
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Everything you need to know about Rich Picks
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Content */}
      <div className="px-6 md:px-10 py-12">
        <div className="max-w-4xl mx-auto">
          {FAQ_SECTIONS.map((section, sectionIndex) => (
            <FAQSection
              key={section.title}
              section={section}
              openIndex={openIndex}
              setOpenIndex={setOpenIndex}
              sectionIndex={sectionIndex}
            />
          ))}
          
          {/* Contact CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="mt-16 text-center"
          >
            <div className="inline-flex flex-col items-center">
              <p className="text-muted-foreground mb-4">
                Have a question that isn&apos;t answered here?
              </p>
              <a 
                href="mailto:hello@richpicks.film" 
                className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-accent-foreground font-medium rounded-lg hover:bg-accent/90 transition-colors"
              >
                Get in Touch
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
