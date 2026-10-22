'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getGradeColor } from '@/components/grade-hex';
import { GRADES, COMMENT_MAX, saveQuickReview } from '@/lib/community';

/** Prompted the moment a member marks a film as seen: a grade on Rich's scale and an optional short take. */
export function QuickReview({ userId, filmId, title, onClose }: { userId: string; filmId: number; title: string; onClose: () => void }) {
  const [grade, setGrade] = useState<string | undefined>();
  const [take, setTake] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setSaving(true); setError('');
    const err = await saveQuickReview(userId, filmId, grade, take);
    setSaving(false);
    if (err) setError(err); else onClose();
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby={`qr-${filmId}`} onClick={onClose}
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 sm:p-4">
      <div onClick={e => e.stopPropagation()} className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border bg-card p-4 space-y-4">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Quick review</p>
          <h3 id={`qr-${filmId}`} className="font-serif text-lg font-semibold leading-snug">How was {title}?</h3>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-2">Your grade, on Rich’s scale</p>
          <div className="flex flex-wrap gap-1.5">
            {GRADES.map(g => (
              <button key={g} onClick={() => setGrade(grade === g ? undefined : g)} aria-pressed={grade === g}
                className={`w-10 h-10 sm:w-9 sm:h-9 clip-hexagon flex items-center justify-center text-xs font-bold transition-transform hover:scale-110 ${
                  grade === g ? getGradeColor(g) + ' scale-110' : 'bg-secondary text-muted-foreground'}`}>
                {g}
              </button>
            ))}
          </div>
        </div>
        <div>
          <textarea value={take} onChange={e => setTake(e.target.value.slice(0, COMMENT_MAX))} rows={3} maxLength={COMMENT_MAX}
            placeholder="Add a short take (optional, 280 characters)…" aria-label="Your take"
            className="w-full rounded-md bg-background border border-border px-2.5 py-2 text-base sm:text-sm focus:outline-none focus:border-accent/60 placeholder:text-muted-foreground/60" />
          <p className="text-[11px] text-muted-foreground">{COMMENT_MAX - take.length} characters left · shown publicly with your handle</p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="h-10 px-4 rounded-md text-sm text-muted-foreground hover:text-foreground">Skip</button>
          <button onClick={save} disabled={saving || (!grade && !take.trim())}
            className="h-10 px-4 rounded-md bg-accent text-accent-foreground text-sm font-semibold disabled:opacity-40 inline-flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save review
          </button>
        </div>
      </div>
    </div>
  );
}
