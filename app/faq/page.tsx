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
import { GradeHex } from "@/components/grade-hex";

// ─── FAQ Data ─────────────────────────────────────────────────────────────────

interface FAQItem {
  question: string;
  answer: React.ReactNode;
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
        answer: "Rich Picks is a personal film awards and ranking archive that tracks my top films, grades, and award picks across multiple categories each year. It serves as both a historical record of my film opinions and an alternative perspective to the major ceremonies like the Oscars, BAFTAs, and Golden Globes.",
      },
      {
        question: "Who decides the winners?",
        answer: "All picks, grades, and rankings are my personal opinions based on my own viewing experience and critical assessment. There is no voting body for a consensus-based award; there is only one person's curated perspective on cinema.",
      },
      {
        question: "How far back does the archive go?",
        answer: "While the archive includes data reaching back to the beginning of the major awards for cinema (circa 1928), Rich Picks reaches back to 2005, the first year I started giving my own awards for the best films of the year.",
      },
      {
        question: "How often is the site updated?",
        answer: "New reviews and grades are added throughout the year as I watch films. Annual nominations are typically finalized in early January following each film year, with final picks announced later each spring.",
      },
    ],
  },
  {
    title: "Grading System",
    icon: Star,
    items: [
      {
        question: "How does the letter grade system work?",
        answer: "Films are graded on a traditional academic scale from A+ (masterpiece) to F- (unwatchable). The grades reflect my overall assessment of a film's quality and therefore take into account direction, performances, screenplay, music, technical craft, cultural import, and emotional impact. An A+ is reserved for truly exceptional films, while anything below C- indicates significant issues.",
      },
      {
        question: "What does each grade letter mean?",
        answer: (
          <div className="flex flex-col gap-4 mt-2">
            <div className="flex items-start sm:items-center gap-3">
              <div className="mt-1 sm:mt-0"><GradeHex grade="A" /></div>
              <span>: an excellent film with outstanding qualities.</span>
            </div>
            <div className="flex items-start sm:items-center gap-3">
              <div className="mt-1 sm:mt-0"><GradeHex grade="B" /></div>
              <span>: a good film that succeeds in most areas.</span>
            </div>
            <div className="flex items-start sm:items-center gap-3">
              <div className="mt-1 sm:mt-0"><GradeHex grade="C" /></div>
              <span>: an average or mixed film, with notable strengths and weaknesses.</span>
            </div>
            <div className="flex items-start sm:items-center gap-3">
              <div className="mt-1 sm:mt-0"><GradeHex grade="D" /></div>
              <span>: a below-average film with significant problems.</span>
            </div>
            <div className="flex items-start sm:items-center gap-3">
              <div className="mt-1 sm:mt-0"><GradeHex grade="F" /></div>
              <span>: a failed film with almost no redeeming qualities.</span>
            </div>
          </div>
        ),
      },
      {
        question: "Can grades change over time?",
        answer: "Very rarely. If I rewatch a film and my opinion significantly shifts, I may update the grade. However, the original grade at time of first viewing is typically preserved, with any revision noted in the review.",
      },
    ],
  },
  {
    title: "Award Categories",
    icon: Trophy,
    items: [
      {
        question: "What categories do Rich Picks cover?",
        answer: "Rich Picks covers 23 major categories including Best Picture, Best Director, the four standard acting categories (Actor, Actress, Supporting Actor, Supporting Actress), Best Original and Adapted Screenplay, Best Animated Feature, Best International Feature, Best Documentary, Best Cinematography, Best Production Design, Best Visual Effects, Best Score, and Best Sound Mixing and Editing.",
      },
      {
        question: "How are nominees selected?",
        answer: "Nominees are selected based purely on their own within-category merits especially among their peers in any given year. I typically select 5 nominees per category, but sometimes select fewer than 5 nominees in a category if fewer than 5 films in that category for that year merit the distinction.",
      },
      {
        question: "How do Rich Picks compare with other major awards, like the Oscars and the BAFTAs?",
        answer: "Throughout the site, you can see badges indicating when a Rich Pick nominee or winner also received recognition from the Academy of Motion Picture Arts and Sciences (Oscars), the Hollywood Foreign Press Association (Globe), the British Academy of Film and Television Arts (BAFTAs), Film Independent (Spirit), or any of the major guilds (e.g., the Screen Actors Guild [SAG], the Directors Guild of America [DGA]). Gold badges indicate wins at those ceremonies, while outlined badges indicate nominations only.",
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
        answer: "The small badges next to nominees (e.g., Oscar, Globe, SAG, DGA, BAFTA, Spirit) indicate recognition from other awarding bodies. A filled/gold badge means the nominee won that award, while an outlined badge means they were nominated but didn't win. Click or hover above any badge to see the full nominee and winner list for that external award.",
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
            <div className="pb-5 text-muted-foreground leading-relaxed pr-12">
              {item.answer}
            </div>
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="pt-12 pb-8 px-6 md:px-10 border-b border-border">
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
              <Link
                href="/feedback"
                className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-accent-foreground font-medium rounded-lg hover:bg-accent/90 transition-colors"
              >
                Get in Touch
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
