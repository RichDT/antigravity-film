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
  CheckCircle2,
  Clock,
  Archive,
  ExternalLink,
  Mail,
  Trash2,
  ChevronRight,
  Filter,
  X,
  Circle,
  Reply,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type FeedbackType = "thought" | "question" | "bug" | "factual_error";
type FeedbackStatus = "new" | "in_progress" | "resolved" | "archived";

interface FeedbackItem {
  id: string;
  type: FeedbackType;
  subject: string;
  body: string;
  email?: string;
  pageUrl?: string;
  status: FeedbackStatus;
  createdAt: Date;
  updatedAt?: Date;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<FeedbackType, { label: string; icon: React.ElementType; color: string }> = {
  thought: { label: "Thought", icon: Sparkles, color: "text-purple-400" },
  question: { label: "Question", icon: HelpCircle, color: "text-sky-400" },
  bug: { label: "Bug", icon: Bug, color: "text-red-400" },
  factual_error: { label: "Factual Error", icon: AlertTriangle, color: "text-amber-400" },
};

const STATUS_CONFIG: Record<FeedbackStatus, { label: string; icon: React.ElementType; bgClass: string; textClass: string }> = {
  new: { label: "New", icon: Circle, bgClass: "bg-accent/20", textClass: "text-accent" },
  in_progress: { label: "In Progress", icon: Clock, bgClass: "bg-sky-500/20", textClass: "text-sky-400" },
  resolved: { label: "Resolved", icon: CheckCircle2, bgClass: "bg-emerald-500/20", textClass: "text-emerald-400" },
  archived: { label: "Archived", icon: Archive, bgClass: "bg-muted/50", textClass: "text-muted-foreground" },
};

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_FEEDBACK: FeedbackItem[] = [
  {
    id: "fb-001",
    type: "factual_error",
    subject: "Incorrect director credit for Parasite",
    body: "On the 2019 Best Picture page, the director for Parasite is listed as 'Bong Joon Ho' but I believe the standard romanization used by the Academy is 'Bong Joon-ho' with a hyphen. The Korean Film Council also uses this spelling. Would be great to have consistency with official sources.",
    email: "filmfan@example.com",
    pageUrl: "https://richpicks.film/year/2019",
    status: "new",
    createdAt: new Date("2024-12-18T14:32:00"),
  },
  {
    id: "fb-002",
    type: "bug",
    subject: "Popover not appearing on mobile Safari",
    body: "When I tap on the award badges (the O, GG, B icons) on my iPhone, nothing happens. I'm using Safari on iOS 17.2. On desktop Chrome it works fine. Tried refreshing the page but same issue.",
    email: "mobiletester@example.com",
    pageUrl: "https://richpicks.film/year/2024",
    status: "in_progress",
    createdAt: new Date("2024-12-17T09:15:00"),
    updatedAt: new Date("2024-12-17T16:42:00"),
  },
  {
    id: "fb-003",
    type: "question",
    subject: "How are nominees selected for each category?",
    body: "I've been browsing the site and I'm curious about the methodology. Do you watch every film released in a given year? How do you narrow down the nominees? And what makes a film eligible for a particular year — release date or awards season?",
    email: "curious.viewer@example.com",
    status: "new",
    createdAt: new Date("2024-12-16T20:08:00"),
  },
  {
    id: "fb-004",
    type: "thought",
    subject: "Love the hexagon design motif",
    body: "Just wanted to say the design of this site is beautiful. The hexagonal elements throughout create such a unique visual identity. The warm brown and gold palette feels cinematic without being cliché. Really well done!",
    status: "resolved",
    createdAt: new Date("2024-12-15T11:23:00"),
    updatedAt: new Date("2024-12-15T14:00:00"),
  },
  {
    id: "fb-005",
    type: "factual_error",
    subject: "Wrong character name for Cillian Murphy",
    body: "On the Best Actor category page, Cillian Murphy's character in Oppenheimer is listed as 'Robert Oppenheimer' but I think for consistency it should be 'J. Robert Oppenheimer' since that's how he's credited in the film and how he referred to himself.",
    email: "detailoriented@example.com",
    pageUrl: "https://richpicks.film/categories/best-actor",
    status: "new",
    createdAt: new Date("2024-12-14T16:45:00"),
  },
  {
    id: "fb-006",
    type: "bug",
    subject: "Year navigation arrows not working",
    body: "On the year detail pages, clicking the left/right arrows to go to previous/next year doesn't do anything. The hover state works but clicking has no effect.",
    status: "resolved",
    createdAt: new Date("2024-12-10T08:30:00"),
    updatedAt: new Date("2024-12-11T10:15:00"),
  },
  {
    id: "fb-007",
    type: "thought",
    subject: "Suggestion: Add a watchlist feature",
    body: "It would be amazing if users could create accounts and save films to a watchlist. I keep finding films I haven't seen through your picks and it would be helpful to track them. Maybe even integrate with Letterboxd?",
    email: "featurerequest@example.com",
    status: "archived",
    createdAt: new Date("2024-12-05T19:12:00"),
    updatedAt: new Date("2024-12-06T09:00:00"),
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${diffMins}m ago`;
    }
    return `${diffHours}h ago`;
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
}

// ─── Filter Pills ─────────────────────────────────────────────────────────────

function FilterPills({
  selectedTypes,
  selectedStatuses,
  onToggleType,
  onToggleStatus,
  onClearAll,
}: {
  selectedTypes: FeedbackType[];
  selectedStatuses: FeedbackStatus[];
  onToggleType: (t: FeedbackType) => void;
  onToggleStatus: (s: FeedbackStatus) => void;
  onClearAll: () => void;
}) {
  const hasFilters = selectedTypes.length > 0 || selectedStatuses.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Filter className="w-3 h-3" /> Filter
      </span>
      
      {/* Type filters */}
      {(Object.keys(TYPE_CONFIG) as FeedbackType[]).map((type) => {
        const config = TYPE_CONFIG[type];
        const isSelected = selectedTypes.includes(type);
        const Icon = config.icon;
        return (
          <button
            key={type}
            onClick={() => onToggleType(type)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
              isSelected
                ? "bg-accent text-accent-foreground"
                : "bg-card border border-border text-muted-foreground hover:border-accent/50 hover:text-foreground"
            }`}
          >
            <Icon className="w-3 h-3" />
            {config.label}
          </button>
        );
      })}

      <span className="w-px h-4 bg-border mx-1" />

      {/* Status filters */}
      {(Object.keys(STATUS_CONFIG) as FeedbackStatus[]).map((status) => {
        const config = STATUS_CONFIG[status];
        const isSelected = selectedStatuses.includes(status);
        return (
          <button
            key={status}
            onClick={() => onToggleStatus(status)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
              isSelected
                ? `${config.bgClass} ${config.textClass}`
                : "bg-card border border-border text-muted-foreground hover:border-accent/50 hover:text-foreground"
            }`}
          >
            {config.label}
          </button>
        );
      })}

      {hasFilters && (
        <button
          onClick={onClearAll}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-3 h-3" /> Clear
        </button>
      )}
    </div>
  );
}

// ─── Feedback Row ─────────────────────────────────────────────────────────────

function FeedbackRow({
  item,
  isSelected,
  onSelect,
}: {
  item: FeedbackItem;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const typeConfig = TYPE_CONFIG[item.type];
  const statusConfig = STATUS_CONFIG[item.status];
  const TypeIcon = typeConfig.icon;
  const StatusIcon = statusConfig.icon;

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-4 border-b border-border/50 transition-all ${
        isSelected ? "bg-accent/10" : "hover:bg-secondary/30"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Type icon */}
        <div className={`w-8 h-9 clip-hexagon bg-muted/50 flex items-center justify-center flex-shrink-0 mt-0.5`}>
          <TypeIcon className={`w-3.5 h-3.5 ${typeConfig.color}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-sm font-medium ${isSelected ? "text-accent" : "text-foreground"} truncate`}>
              {item.subject}
            </span>
            {item.status === "new" && (
              <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {item.body}
          </p>
        </div>

        {/* Meta */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className="text-[10px] text-muted-foreground">
            {formatDate(item.createdAt)}
          </span>
          <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${statusConfig.bgClass} ${statusConfig.textClass}`}>
            <StatusIcon className="w-2.5 h-2.5" />
            {statusConfig.label}
          </span>
        </div>
      </div>
    </button>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  item,
  onClose,
  onUpdateStatus,
}: {
  item: FeedbackItem;
  onClose: () => void;
  onUpdateStatus: (status: FeedbackStatus) => void;
}) {
  const typeConfig = TYPE_CONFIG[item.type];
  const statusConfig = STATUS_CONFIG[item.status];
  const TypeIcon = typeConfig.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.25 }}
      className="h-full flex flex-col bg-card border-l border-border"
    >
      {/* Header */}
      <div className="p-5 border-b border-border">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-11 clip-hexagon bg-muted/50 flex items-center justify-center flex-shrink-0`}>
              <TypeIcon className={`w-5 h-5 ${typeConfig.color}`} />
            </div>
            <div>
              <span className={`text-[10px] uppercase tracking-wider ${typeConfig.color}`}>
                {typeConfig.label}
              </span>
              <h2 className="font-serif text-lg font-semibold text-foreground leading-snug mt-0.5">
                {item.subject}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Status & date */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className={`inline-flex items-center gap-1 font-medium px-2 py-1 rounded ${statusConfig.bgClass} ${statusConfig.textClass}`}>
            {statusConfig.label}
          </span>
          <span>Received {item.createdAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
          {item.updatedAt && (
            <span className="text-muted-foreground/60">
              · Updated {formatDate(item.updatedAt)}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="prose prose-sm prose-invert max-w-none">
          <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {item.body}
          </p>
        </div>

        {/* Metadata */}
        <div className="mt-6 pt-4 border-t border-border/50 space-y-3">
          {item.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <a href={`mailto:${item.email}`} className="text-accent hover:underline">
                {item.email}
              </a>
            </div>
          )}
          {item.pageUrl && (
            <div className="flex items-center gap-2 text-sm">
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
              <a href={item.pageUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline font-mono text-xs">
                {item.pageUrl}
              </a>
            </div>
          )}
          {!item.email && !item.pageUrl && (
            <p className="text-xs text-muted-foreground italic">No additional context provided</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="p-5 border-t border-border bg-muted/20">
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-xs uppercase tracking-wider text-muted-foreground mr-2 self-center">
            Set status:
          </span>
          {(Object.keys(STATUS_CONFIG) as FeedbackStatus[]).map((status) => {
            const config = STATUS_CONFIG[status];
            const isActive = item.status === status;
            return (
              <button
                key={status}
                onClick={() => onUpdateStatus(status)}
                disabled={isActive}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? `${config.bgClass} ${config.textClass} cursor-default`
                    : "bg-card border border-border text-muted-foreground hover:border-accent/50 hover:text-foreground"
                }`}
              >
                {config.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {item.email && (
            <a
              href={`mailto:${item.email}?subject=Re: ${encodeURIComponent(item.subject)}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent text-accent-foreground font-medium text-sm rounded-lg hover:bg-accent/90 transition-colors"
            >
              <Reply className="w-4 h-4" />
              Reply via Email
            </a>
          )}
          <button
            onClick={() => onUpdateStatus("archived")}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-card border border-border text-muted-foreground font-medium text-sm rounded-lg hover:border-destructive/50 hover:text-destructive transition-colors"
          >
            <Archive className="w-4 h-4" />
            Archive
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminFeedbackPage() {
  const [feedback, setFeedback] = useState<FeedbackItem[]>(MOCK_FEEDBACK);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<FeedbackType[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<FeedbackStatus[]>([]);

  const selectedItem = feedback.find((f) => f.id === selectedId) || null;

  // Filtering
  const filteredFeedback = feedback.filter((item) => {
    if (selectedTypes.length > 0 && !selectedTypes.includes(item.type)) return false;
    if (selectedStatuses.length > 0 && !selectedStatuses.includes(item.status)) return false;
    return true;
  });

  // Counts
  const counts = {
    total: feedback.length,
    new: feedback.filter((f) => f.status === "new").length,
    bugs: feedback.filter((f) => f.type === "bug" && f.status !== "resolved" && f.status !== "archived").length,
    errors: feedback.filter((f) => f.type === "factual_error" && f.status !== "resolved" && f.status !== "archived").length,
  };

  function handleToggleType(type: FeedbackType) {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  function handleToggleStatus(status: FeedbackStatus) {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  }

  function handleClearFilters() {
    setSelectedTypes([]);
    setSelectedStatuses([]);
  }

  function handleUpdateStatus(id: string, status: FeedbackStatus) {
    setFeedback((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, status, updatedAt: new Date() } : f
      )
    );
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
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded ml-1">Admin</span>
          </Link>
          <div className="flex items-center gap-4">
            <NavHex icon={Award} label="Awards" href="/categories" delay={0.05} />
            <NavHex icon={Calendar} label="Years" href="/years" delay={0.1} />
            <NavHex icon={Search} label="Search" href="/search" delay={0.15} />
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="pt-24 pb-6 px-6 md:px-10 border-b border-border">
        <div className="max-w-7xl mx-auto">
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
            <ChevronLeft className="w-4 h-4" /> Back to Site
          </Link>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-16 clip-hexagon bg-accent/20 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-7 h-7 text-accent" />
              </div>
              <div>
                <h1 className="font-serif text-3xl md:text-4xl font-semibold text-foreground">
                  Feedback Review
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage user submissions
                </p>
              </div>
            </div>

            {/* Quick stats */}
            <div className="hidden md:flex items-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">{counts.total}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</div>
              </div>
              <div className="w-px h-10 bg-border" />
              <div className="text-center">
                <div className="text-2xl font-bold text-accent">{counts.new}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">New</div>
              </div>
              <div className="w-px h-10 bg-border" />
              <div className="text-center">
                <div className="text-2xl font-bold text-red-400">{counts.bugs}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Bugs</div>
              </div>
              <div className="w-px h-10 bg-border" />
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-400">{counts.errors}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Errors</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 md:px-10 py-4 border-b border-border/50 bg-muted/10">
        <div className="max-w-7xl mx-auto">
          <FilterPills
            selectedTypes={selectedTypes}
            selectedStatuses={selectedStatuses}
            onToggleType={handleToggleType}
            onToggleStatus={handleToggleStatus}
            onClearAll={handleClearFilters}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto">
        <div className="flex h-[calc(100vh-280px)] min-h-[500px]">
          {/* List */}
          <div className={`${selectedItem ? "w-1/2 lg:w-2/5" : "w-full"} overflow-y-auto border-r border-border/50 transition-all`}>
            {filteredFeedback.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <div className="w-16 h-18 clip-hexagon bg-muted/30 flex items-center justify-center mb-4">
                  <MessageSquare className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground">No feedback matches your filters</p>
                <button
                  onClick={handleClearFilters}
                  className="mt-3 text-sm text-accent hover:underline"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              filteredFeedback.map((item) => (
                <FeedbackRow
                  key={item.id}
                  item={item}
                  isSelected={selectedId === item.id}
                  onSelect={() => setSelectedId(item.id)}
                />
              ))
            )}
          </div>

          {/* Detail panel */}
          <AnimatePresence>
            {selectedItem && (
              <div className="flex-1 overflow-hidden">
                <DetailPanel
                  item={selectedItem}
                  onClose={() => setSelectedId(null)}
                  onUpdateStatus={(status) => handleUpdateStatus(selectedItem.id, status)}
                />
              </div>
            )}
          </AnimatePresence>

          {/* Empty state for detail */}
          {!selectedItem && (
            <div className="hidden lg:flex flex-1 items-center justify-center bg-muted/5">
              <div className="text-center">
                <div className="w-20 h-23 clip-hexagon bg-muted/20 flex items-center justify-center mx-auto mb-4">
                  <ChevronRight className="w-8 h-8 text-muted-foreground/30" />
                </div>
                <p className="text-muted-foreground text-sm">Select a message to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
