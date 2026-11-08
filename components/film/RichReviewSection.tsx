'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PenLine, Pencil } from 'lucide-react';
import { useAuthStatus } from '@/lib/use-auth-status';
import { pasteAsReviewMarkup } from '@/lib/paste-markup';

/** "Rich's Review" on the film page. The formatted review comes in as children (rendered on the
 *  server); the admin gets an inline editor for the raw text. */
export function RichReviewSection({ filmId, rawText, children }: { filmId: number; rawText: string; children: React.ReactNode }) {
  const { isAdmin } = useAuthStatus();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(rawText);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, startRefresh] = useTransition();

  if (!rawText && !isAdmin) return null;

  async function save() {
    setSaving(true); setError(null);
    const res = await fetch('/api/admin/grade', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filmId, reviewText: draft, replaceReview: true }),
    });
    setSaving(false);
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? 'Couldn’t save the review.'); return; }
    startRefresh(() => { router.refresh(); setEditing(false); });
  }

  const busy = saving || refreshing;

  return (
    <section id="review" className="mt-12 scroll-mt-24" aria-labelledby="review-heading">
      <div className="flex items-center gap-3 mb-6">
        <PenLine className="w-5 h-5 text-accent" />
        <h2 id="review-heading" className="font-serif text-xl font-bold text-foreground">Rich&apos;s Review</h2>
        <div className="h-px flex-1 bg-gradient-to-r from-border/60 to-transparent" />
        {isAdmin && !editing && (
          <button onClick={() => { setDraft(rawText); setEditing(true); }}
            className="touch-target inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-accent border border-border hover:border-accent/50 rounded-md px-2.5 py-1 transition-colors">
            <Pencil className="w-3.5 h-3.5" /> {rawText ? 'Edit review' : 'Add review'}
          </button>
        )}
      </div>

      {editing ? (
        <div className="rounded-lg border border-accent/40 bg-card px-5 py-5 md:px-6 max-w-3xl space-y-3">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onPaste={e => pasteAsReviewMarkup(e, draft, setDraft)}
            rows={16}
            autoFocus
            className="w-full font-reading text-[17px] leading-[1.7] bg-background/60 border border-border rounded-md px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 resize-y"
            placeholder="Write the review…"
          />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Wrap words in <span className="font-mono">*asterisks*</span> to italicize them. Pasting from Substack keeps its italics.
            Titles cited as <span className="font-mono">Director’s (2002) Title</span> or <span className="font-mono">Title (2020)</span>, borrowed words like
            <em> début</em>, and names of people on the site are styled and linked automatically.
          </p>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => { setEditing(false); setError(null); }} disabled={busy}
              className="px-3 py-1.5 text-sm rounded-md border border-border text-muted-foreground hover:text-foreground disabled:opacity-50">Cancel</button>
            <button onClick={save} disabled={busy || draft === rawText}
              className="px-3 py-1.5 text-sm font-semibold rounded-md bg-accent text-accent-foreground hover:opacity-90 disabled:opacity-50">
              {saving ? 'Saving…' : refreshing ? 'Updating page…' : 'Save review'}
            </button>
          </div>
        </div>
      ) : rawText ? (
        <div className="rounded-lg border border-border bg-card px-5 py-6 md:px-8 md:py-7 max-w-3xl">
          {children}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">No written review yet.</p>
      )}
    </section>
  );
}
