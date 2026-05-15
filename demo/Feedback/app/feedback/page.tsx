"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Film,
  Award,
  Calendar,
  Search,
  ChevronLeft,
  MessageSquare,
  Bug,
  HelpCircle,
  AlertTriangle,
  Sparkles,
  Send,
  CheckCircle2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type FeedbackType = "thought" | "question" | "bug" | "factual_error";

interface FormState {
  type: FeedbackType | null;
  subject: string;
  body: string;
  email: string;
  pageUrl: string;
}

// ─── Feedback Types ───────────────────────────────────────────────────────────

const FEEDBACK_TYPES: {
  id: FeedbackType;
  label: string;
  icon: React.ElementType;
  description: string;
  placeholder: string;
  subjectPlaceholder: string;
}[] = [
  {
    id: "thought",
    label: "Share a Thought",
    icon: Sparkles,
    description: "A reaction, opinion, or idea about the site or its picks",
    placeholder: "Tell me what's on your mind — agreement, disagreement, a film you think deserves more recognition, or anything else...",
    subjectPlaceholder: "e.g. Thoughts on the 2023 picks",
  },
  {
    id: "question",
    label: "Ask a Question",
    icon: HelpCircle,
    description: "Something you'd like to understand better about how this site works",
    placeholder: "What would you like to know? Check the FAQ first — if your question isn't answered there, I'd love to hear it.",
    subjectPlaceholder: "e.g. How are nominees selected?",
  },
  {
    id: "bug",
    label: "Report a Bug",
    icon: Bug,
    description: "Something broken, behaving unexpectedly, or not displaying correctly",
    placeholder: "Describe what happened, what you expected to happen, and how to reproduce it if possible...",
    subjectPlaceholder: "e.g. Popover not appearing on mobile",
  },
  {
    id: "factual_error",
    label: "Flag a Factual Error",
    icon: AlertTriangle,
    description: "An incorrect name, date, credit, or other factual detail",
    placeholder: "Describe the error and, if you know it, what the correct information should be...",
    subjectPlaceholder: "e.g. Incorrect director credit for Parasite",
  },
];

// ─── Nav Hex ──────────────────────────────────────────────────────────────────

function NavHex({ icon: Icon, label, href, delay = 0 }: { icon: React.ElementType; label: string; href: string; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay, duration: 0.3 }}>
      <Link href={href} className="group flex flex-col items-center gap-1">
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

// ─── Type Selector Card ───────────────────────────────────────────────────────

function TypeCard({
  type,
  isSelected,
  onSelect,
}: {
  type: typeof FEEDBACK_TYPES[0];
  isSelected: boolean;
  onSelect: () => void;
}) {
  const Icon = type.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-lg border transition-all duration-200 group ${
        isSelected
          ? "border-accent bg-accent/10"
          : "border-border bg-card hover:border-border/80 hover:bg-secondary/30"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-9 h-10 clip-hexagon flex items-center justify-center flex-shrink-0 transition-colors ${
            isSelected ? "bg-accent" : "bg-muted/60 group-hover:bg-muted"
          }`}
        >
          <Icon className={`w-4 h-4 transition-colors ${isSelected ? "text-accent-foreground" : "text-muted-foreground"}`} />
        </div>
        <div className="min-w-0">
          <div className={`font-serif text-sm font-semibold transition-colors ${isSelected ? "text-accent" : "text-foreground"}`}>
            {type.label}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {type.description}
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FeedbackPage() {
  const [form, setForm] = useState<FormState>({
    type: null,
    subject: "",
    body: "",
    email: "",
    pageUrl: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedType = FEEDBACK_TYPES.find((t) => t.id === form.type) || null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.type || !form.subject || !form.body) return;
    setIsSubmitting(true);
    // Simulate submission
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
    }, 1200);
  }

  function handleReset() {
    setForm({ type: null, subject: "", body: "", email: "", pageUrl: "" });
    setSubmitted(false);
  }

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
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
            <ChevronLeft className="w-4 h-4" /> Back to Home
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-14 h-16 clip-hexagon bg-accent/20 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-7 h-7 text-accent" />
            </div>
            <div>
              <h1 className="font-serif text-3xl md:text-4xl font-semibold text-foreground text-balance">
                Get in Touch
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Thoughts, questions, bugs, or errors — all welcome
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form / Confirmation */}
      <div className="px-6 md:px-10 py-12">
        <div className="max-w-3xl mx-auto">
          <AnimatePresence mode="wait">
            {submitted ? (
              /* ── Confirmation ── */
              <motion.div
                key="confirmation"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-center text-center py-16"
              >
                <div className="w-20 h-23 clip-hexagon bg-accent/20 flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-10 h-10 text-accent" />
                </div>
                <h2 className="font-serif text-2xl font-semibold text-foreground mb-3">
                  Message received
                </h2>
                <p className="text-muted-foreground leading-relaxed max-w-md mb-8">
                  Thank you for taking the time to reach out. I read every submission personally and will follow up if a reply seems warranted.
                </p>
                <button
                  onClick={handleReset}
                  className="text-sm text-accent hover:text-accent/80 underline underline-offset-4 transition-colors"
                >
                  Submit another message
                </button>
              </motion.div>
            ) : (
              /* ── Form ── */
              <motion.form
                key="form"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                onSubmit={handleSubmit}
                className="space-y-10"
              >
                {/* Step 1: Type selection */}
                <section>
                  <div className="flex items-center gap-3 mb-5">
                    <span className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-[11px] font-bold text-accent-foreground flex-shrink-0">
                      1
                    </span>
                    <h2 className="font-serif text-lg font-semibold text-foreground">
                      What kind of message is this?
                    </h2>
                    <div className="h-px flex-1 bg-gradient-to-r from-border/50 to-transparent" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {FEEDBACK_TYPES.map((type) => (
                      <TypeCard
                        key={type.id}
                        type={type}
                        isSelected={form.type === type.id}
                        onSelect={() => setForm((f) => ({ ...f, type: type.id, subject: "", body: "" }))}
                      />
                    ))}
                  </div>
                </section>

                {/* Step 2: Details — only show when type is selected */}
                <AnimatePresence>
                  {form.type && (
                    <motion.section
                      key="details"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.35 }}
                    >
                      <div className="flex items-center gap-3 mb-5">
                        <span className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-[11px] font-bold text-accent-foreground flex-shrink-0">
                          2
                        </span>
                        <h2 className="font-serif text-lg font-semibold text-foreground">
                          Tell me more
                        </h2>
                        <div className="h-px flex-1 bg-gradient-to-r from-border/50 to-transparent" />
                      </div>

                      <div className="space-y-4">
                        {/* Subject */}
                        <div>
                          <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
                            Subject <span className="text-accent">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={form.subject}
                            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                            placeholder={selectedType?.subjectPlaceholder}
                            className="w-full bg-card border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors"
                          />
                        </div>

                        {/* Body */}
                        <div>
                          <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
                            Message <span className="text-accent">*</span>
                          </label>
                          <textarea
                            required
                            rows={6}
                            value={form.body}
                            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                            placeholder={selectedType?.placeholder}
                            className="w-full bg-card border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors resize-none leading-relaxed"
                          />
                        </div>

                        {/* Conditional: page URL for bugs/errors */}
                        {(form.type === "bug" || form.type === "factual_error") && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25 }}
                          >
                            <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
                              {form.type === "bug" ? "Page where this occurred" : "Page with the error"}
                              <span className="text-muted-foreground/50 ml-1 normal-case">(optional)</span>
                            </label>
                            <input
                              type="url"
                              value={form.pageUrl}
                              onChange={(e) => setForm((f) => ({ ...f, pageUrl: e.target.value }))}
                              placeholder="https://richpicks.film/year/2023"
                              className="w-full bg-card border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors font-mono"
                            />
                          </motion.div>
                        )}
                      </div>
                    </motion.section>
                  )}
                </AnimatePresence>

                {/* Step 3: Contact — only show once body is non-empty */}
                <AnimatePresence>
                  {form.type && form.body.length > 10 && (
                    <motion.section
                      key="contact"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.35 }}
                    >
                      <div className="flex items-center gap-3 mb-5">
                        <span className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-[11px] font-bold text-accent-foreground flex-shrink-0">
                          3
                        </span>
                        <h2 className="font-serif text-lg font-semibold text-foreground">
                          How can I reach you back?
                        </h2>
                        <div className="h-px flex-1 bg-gradient-to-r from-border/50 to-transparent" />
                      </div>

                      <div>
                        <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
                          Email address
                          <span className="text-muted-foreground/50 ml-1 normal-case">(optional — leave blank to submit anonymously)</span>
                        </label>
                        <input
                          type="email"
                          value={form.email}
                          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                          placeholder="you@example.com"
                          className="w-full bg-card border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors"
                        />
                        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                          Your email is only used to reply to your message and will never be shared.
                        </p>
                      </div>
                    </motion.section>
                  )}
                </AnimatePresence>

                {/* Submit */}
                <AnimatePresence>
                  {form.type && form.subject && form.body.length > 10 && (
                    <motion.div
                      key="submit"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="flex items-center justify-between pt-2 border-t border-border/50"
                    >
                      <p className="text-xs text-muted-foreground">
                        Fields marked <span className="text-accent">*</span> are required
                      </p>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-accent-foreground font-medium text-sm rounded-lg hover:bg-accent/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                      >
                        {isSubmitting ? (
                          <>
                            <span className="w-4 h-4 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" />
                            Sending
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            Send Message
                          </>
                        )}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
