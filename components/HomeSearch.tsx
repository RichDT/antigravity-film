// Homepage search: instant film and person suggestions from /api/search; Enter opens the full search page.
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Film, User, Calendar, CornerDownLeft } from "lucide-react";

type Results = { films: { id: number; title: string; year: number | null; director: string | null }[]; people: { id: number; name: string }[] };

/**
 * Search films and people from the homepage. Suggestions appear as you type (films first, then people);
 * Enter opens the full search page. Typing a year offers to jump the year lens to it.
 */
export function HomeSearch({ size = "md", placeholder = "Search films and people", onYear, minYear, maxYear, className = "" }: {
  size?: "md" | "lg"; placeholder?: string; onYear?: (y: number) => void; minYear?: number; maxYear?: number; className?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Results | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) { setRes(null); return; }
    const t = setTimeout(async () => {
      try { const r = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`); setRes(await r.json()); setActive(0); } catch { /* offline */ }
    }, 180);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close);
  }, []);

  const yr = /^\d{4}$/.test(q.trim()) ? Number(q.trim()) : null;
  const yearOk = yr !== null && onYear && (!minYear || yr >= minYear) && (!maxYear || yr <= maxYear);
  const items: { key: string; href?: string; run?: () => void; icon: React.ElementType; label: string; sub?: string }[] = [
    ...(yearOk ? [{ key: "y", run: () => { onYear!(yr!); setOpen(false); setQ(""); }, icon: Calendar, label: `Show ${yr} in the year view`, sub: "Jump the timeline" }] : []),
    ...(res?.films.slice(0, 6).map(f => ({ key: `f${f.id}`, href: `/film/${f.id}`, icon: Film, label: f.title, sub: [f.year, f.director].filter(Boolean).join(" · ") })) ?? []),
    ...(res?.people.slice(0, 4).map(p => ({ key: `p${p.id}`, href: `/person/${p.id}`, icon: User, label: p.name })) ?? []),
  ];
  const go = (i: number) => { const it = items[i]; if (!it) return router.push(`/search?q=${encodeURIComponent(q.trim())}`); if (it.run) it.run(); else router.push(it.href!); };

  const big = size === "lg";
  return (
    <div ref={box} className={`relative ${className}`}>
      <div className={`flex items-center gap-2 rounded-full border bg-card/80 focus-within:border-accent/70 transition-colors ${big ? "h-12 px-5 border-border" : "h-9 px-3.5 border-border"}`}>
        <Search className={`${big ? "w-5 h-5" : "w-4 h-4"} text-muted-foreground shrink-0`} />
        <input value={q} onChange={e => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(items.length - 1, a + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
            if (e.key === "Enter") { e.preventDefault(); if (q.trim()) go(items.length && open ? active : -1); }
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder={placeholder} aria-label="Search films and people"
          className={`flex-1 min-w-0 bg-transparent outline-none placeholder:text-muted-foreground/70 ${big ? "text-base" : "text-sm"}`} />
        {q && <kbd className="hidden md:inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/70"><CornerDownLeft className="w-3 h-3" />all results</kbd>}
      </div>
      {open && q.trim().length >= 2 && (
        <div className="absolute z-40 mt-1.5 left-0 right-0 min-w-[300px] rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
          {items.length === 0 ? <p className="px-4 py-3 text-xs text-muted-foreground">{res ? "No matches" : "Searching…"}</p> : (
            <ul className="py-1">
              {items.map((it, i) => (
                <li key={it.key}>
                  {it.href ? (
                    <Link href={it.href} onMouseEnter={() => setActive(i)} className={`flex items-center gap-2.5 px-3.5 py-2 ${i === active ? "bg-secondary/80" : ""}`}>
                      <it.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{it.label}</span>
                      {it.sub && <span className="ml-auto text-[11px] text-muted-foreground truncate">{it.sub}</span>}
                    </Link>
                  ) : (
                    <button onClick={it.run} onMouseEnter={() => setActive(i)} className={`w-full text-left flex items-center gap-2.5 px-3.5 py-2 ${i === active ? "bg-secondary/80" : ""}`}>
                      <it.icon className="w-4 h-4 text-accent shrink-0" />
                      <span className="text-sm">{it.label}</span>
                      <span className="ml-auto text-[11px] text-muted-foreground">{it.sub}</span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Link href={`/search?q=${encodeURIComponent(q.trim())}`} className="block border-t border-border px-3.5 py-2 text-xs text-accent hover:bg-secondary/60">See all results for “{q.trim()}”</Link>
        </div>
      )}
    </div>
  );
}
