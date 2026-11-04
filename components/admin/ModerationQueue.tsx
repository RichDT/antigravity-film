'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Flag, Eye, EyeOff, Trash2, X, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface QueueItem {
  comment_id: number; film_id: number; film_title: string; handle: string; body: string;
  created_at: string; hidden: boolean; reports: number; reasons: string[] | null;
}

const navLink = 'px-3 py-1.5 rounded-lg bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all';

/** Admin: reported and recent takes, hide/unhide/delete, and the blocked-terms list. */
export function ModerationQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [filter, setFilter] = useState<'reported' | 'hidden' | 'all'>('reported');
  const [terms, setTerms] = useState<string[]>([]);
  const [newTerm, setNewTerm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: q, error: qErr }, { data: t }] = await Promise.all([
      supabase.rpc('moderation_queue'),
      supabase.from('blocked_terms').select('term').order('term'),
    ]);
    if (qErr) setError(qErr.message);
    setItems((q as QueueItem[]) ?? []);
    setTerms((t ?? []).map(r => r.term));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function setHidden(id: number, hidden: boolean) {
    const { error: err } = await createClient().from('film_comments')
      .update({ hidden, hidden_reason: hidden ? 'Hidden by admin' : null }).eq('comment_id', id);
    if (err) setError(err.message); else load();
  }

  async function remove(id: number) {
    if (!window.confirm('Delete this take permanently?')) return;
    const { error: err } = await createClient().from('film_comments').delete().eq('comment_id', id);
    if (err) setError(err.message); else load();
  }

  async function addTerm(e: React.FormEvent) {
    e.preventDefault();
    const term = newTerm.trim().toLowerCase();
    if (!term) return;
    const { error: err } = await createClient().from('blocked_terms').insert({ term });
    if (err && err.code !== '23505') { setError(err.message); return; }
    setNewTerm('');
    load();
  }

  async function removeTerm(term: string) {
    const { error: err } = await createClient().from('blocked_terms').delete().eq('term', term);
    if (err) setError(err.message); else load();
  }

  const shown = items.filter(i => filter === 'all' ? true : filter === 'hidden' ? i.hidden : i.reports > 0 && !i.hidden);
  const counts = { reported: items.filter(i => i.reports > 0 && !i.hidden).length, hidden: items.filter(i => i.hidden).length, all: items.length };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="font-serif text-2xl font-bold mb-4">Moderation</h1>

      <div className="flex gap-2 mb-8 text-sm flex-wrap">
        <Link href="/admin/add-review" className={navLink}>Add Review</Link>
        <Link href="/admin/nominations" className={navLink}>Nominations</Link>
        <Link href="/admin/winners" className={navLink}>Winners</Link>
        <Link href="/admin/share" className={navLink}>Share</Link>
        <Link href="/admin/feedback" className={navLink}>Feedback</Link>
        <span className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-medium">Moderation</span>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 mb-4 text-xs">
        {(['reported', 'hidden', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`h-9 px-3 rounded-full border capitalize ${filter === f ? 'bg-accent text-accent-foreground border-accent' : 'border-border text-muted-foreground hover:text-foreground'}`}>
            {f} · {counts[f]}
          </button>
        ))}
      </div>

      <ul className="space-y-3 mb-12">
        {loading && <li className="text-sm text-muted-foreground">Loading…</li>}
        {!loading && shown.length === 0 && <li className="text-sm text-muted-foreground italic">Nothing here.</li>}
        {shown.map(i => (
          <li key={i.comment_id} className={`rounded-lg border bg-card p-3 text-sm ${i.hidden ? 'border-border opacity-60' : i.reports ? 'border-orange-500/50' : 'border-border'}`}>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-medium">@{i.handle}</span>
              <span className="text-muted-foreground">on</span>
              <Link href={`/film/${i.film_id}`} className="text-accent hover:underline">{i.film_title}</Link>
              <span className="text-[11px] text-muted-foreground">{new Date(i.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
              {i.reports > 0 && <span className="inline-flex items-center gap-1 text-[11px] text-orange-400"><Flag className="w-3 h-3" />{i.reports} report{i.reports > 1 ? 's' : ''}</span>}
              {i.hidden && <span className="text-[11px] text-muted-foreground">Hidden</span>}
            </div>
            <p className="mt-1 text-foreground/85 whitespace-pre-line break-words">{i.body}</p>
            {i.reasons && i.reasons.filter(Boolean).length > 0 && (
              <ul className="mt-1 text-[11px] text-muted-foreground list-disc pl-4">
                {i.reasons.filter(Boolean).map((r, n) => <li key={n}>{r}</li>)}
              </ul>
            )}
            <div className="mt-2 flex gap-2">
              <button onClick={() => setHidden(i.comment_id, !i.hidden)} className="h-9 px-3 rounded-md border border-border text-xs inline-flex items-center gap-1.5 hover:border-foreground/40">
                {i.hidden ? <><Eye className="w-3.5 h-3.5" />Unhide</> : <><EyeOff className="w-3.5 h-3.5" />Hide</>}
              </button>
              <button onClick={() => remove(i.comment_id)} className="h-9 px-3 rounded-md border border-border text-xs inline-flex items-center gap-1.5 text-destructive hover:border-destructive/60">
                <Trash2 className="w-3.5 h-3.5" />Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      <h2 className="font-serif text-lg font-semibold mb-1">Blocked terms</h2>
      <p className="text-xs text-muted-foreground mb-3">Takes containing any of these as a whole word are rejected when posted. Keep this to unambiguous slurs; words with innocent uses cause false positives.</p>
      <form onSubmit={addTerm} className="flex gap-2 mb-3">
        <input value={newTerm} onChange={e => setNewTerm(e.target.value)} placeholder="Add a term…" aria-label="New blocked term"
          className="flex-1 min-w-0 h-10 rounded-md bg-background border border-border px-2.5 text-base sm:text-sm focus:outline-none focus:border-accent/60" />
        <button className="h-10 px-3 rounded-md bg-accent text-accent-foreground text-xs font-semibold inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Add</button>
      </form>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">{terms.length} terms (click to show)</summary>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {terms.map(t => (
            <span key={t} className="inline-flex items-center gap-1 h-8 pl-2.5 pr-1 rounded-full border border-border text-xs">
              {t}
              <button onClick={() => removeTerm(t)} aria-label={`Remove ${t}`} className="p-1 text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      </details>
    </div>
  );
}
