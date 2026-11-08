'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bookmark, CheckCircle2, Loader2, Pencil, Play, Share2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { COMMENT_MAX } from '@/lib/community';
import { GradePicker, GradeHexLarge } from '@/components/community/GradePicker';
import { CalendarLinks } from '@/components/account/CalendarLinks';

type FilmInfo = { title: string; release_year: number | null; us_release_date: string | null; release_venue: string | null; trailer_url: string | null };
type Seen = { film_id: number; film: FilmInfo | null; grade: string | null; take: { id: number; body: string; hidden: boolean } | null; at: string };
type Want = { film_id: number; film: FilmInfo | null };

const FILM_COLS = 'title, release_year, us_release_date, release_venue, trailer_url';

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
}

/** The member's films on their account page: what they've seen (with grades and takes, editable in
 *  place) and their want-to-see list. */
export function MyFilms({ handle }: { handle: string }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [seen, setSeen] = useState<Seen[] | null>(null);
  const [want, setWant] = useState<Want[] | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSeen([]); setWant([]); return; }
    setUserId(user.id);
    const [status, ratings, takes] = await Promise.all([
      supabase.from('user_film_status').select(`film_id, status, updated_at, films(${FILM_COLS})`).eq('user_id', user.id),
      supabase.from('user_ratings').select(`film_id, grade, updated_at, films(${FILM_COLS})`).eq('user_id', user.id),
      supabase.from('film_comments').select(`comment_id, film_id, body, hidden, created_at, films(${FILM_COLS})`).eq('user_id', user.id),
    ]);
    // Seen = marked seen, graded, or reviewed — one row per film
    const byFilm = new Map<number, Seen>();
    const row = (id: number, film: FilmInfo | null, at: string) => {
      if (!byFilm.has(id)) byFilm.set(id, { film_id: id, film, grade: null, take: null, at });
      const r = byFilm.get(id)!; if (at > r.at) r.at = at; return r;
    };
    for (const s of (status.data ?? []) as any[]) if (s.status === 'seen') row(s.film_id, s.films, s.updated_at);
    for (const g of (ratings.data ?? []) as any[]) row(g.film_id, g.films, g.updated_at).grade = g.grade;
    for (const t of (takes.data ?? []) as any[]) row(t.film_id, t.films, t.created_at).take = { id: t.comment_id, body: t.body, hidden: t.hidden };
    setSeen([...byFilm.values()].sort((a, b) => b.at.localeCompare(a.at)));
    setWant(((status.data ?? []) as any[]).filter(s => s.status === 'want')
      .map(s => ({ film_id: s.film_id, film: s.films as FilmInfo | null }))
      .sort((a, b) => (a.film?.us_release_date ?? '9999').localeCompare(b.film?.us_release_date ?? '9999') || (a.film?.title ?? '').localeCompare(b.film?.title ?? '')));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function share() {
    const url = `${window.location.origin}/list/${handle}`;
    try {
      if (navigator.share) await navigator.share({ title: `@${handle} wants to see`, url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } catch { /* dismissed */ }
  }

  return (
    <>
      <section className="rounded-lg border border-border bg-card p-4" aria-labelledby="seen-heading">
        <h2 id="seen-heading" className="font-serif text-xl font-bold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-accent" /> Films you’ve seen{seen?.length ? <span className="text-sm font-sans font-normal text-muted-foreground">· {seen.length}</span> : null}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">Your grades and takes. Adjust any of them here.</p>
        {seen === null ? <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
          : seen.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">When you mark a film as seen, or grade it, it appears here.</p>
          : <ul className="mt-3 divide-y divide-border/60">{seen.map(s => <SeenRow key={s.film_id} item={s} userId={userId} onSaved={load} />)}</ul>}
      </section>

      <section className="rounded-lg border border-border bg-card p-4" aria-labelledby="want-heading">
        <div className="flex items-center gap-2">
          <h2 id="want-heading" className="font-serif text-xl font-bold flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-accent" /> Want to see{want?.length ? <span className="text-sm font-sans font-normal text-muted-foreground">· {want.length}</span> : null}
          </h2>
          {handle && (
            <button onClick={share} className="ml-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40">
              <Share2 className="w-3.5 h-3.5" /> {copied ? 'Link copied' : 'Share list'}
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Anyone with the link can see this list at <Link href={`/list/${handle}`} className="hover:text-accent underline-offset-2 hover:underline">richpicks.app/list/{handle}</Link>.</p>
        {want === null ? <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
          : want.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Tap “Want to see” on any film to add it here.</p>
          : (
            <ul className="mt-3 divide-y divide-border/60">
              {want.map(w => (
                <li key={w.film_id} className="py-3 space-y-2">
                  <div>
                    <Link href={`/film/${w.film_id}`} className="font-medium hover:text-accent leading-snug">{w.film?.title ?? 'Film'}</Link>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {w.film?.us_release_date ? formatDate(w.film.us_release_date) : 'Date TBA'}{w.film?.release_venue ? ` · ${w.film.release_venue}` : ''}
                      {w.film?.trailer_url && <> · <a href={w.film.trailer_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:text-accent"><Play className="w-2.5 h-2.5" fill="currentColor" />Trailer</a></>}
                    </p>
                  </div>
                  {w.film && <CalendarLinks film={{ film_id: w.film_id, title: w.film.title, us_release_date: w.film.us_release_date, release_venue: w.film.release_venue, trailer_url: w.film.trailer_url }} />}
                </li>
              ))}
            </ul>
          )}
      </section>
    </>
  );
}

function SeenRow({ item, userId, onSaved }: { item: Seen; userId: string | null; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [grade, setGrade] = useState<string | null>(item.grade);
  const [take, setTake] = useState(item.take?.body ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!userId) return;
    setBusy(true); setError('');
    const supabase = createClient();
    const now = new Date().toISOString();
    const g = grade
      ? await supabase.from('user_ratings').upsert({ user_id: userId, film_id: item.film_id, grade, updated_at: now })
      : await supabase.from('user_ratings').delete().eq('user_id', userId).eq('film_id', item.film_id);
    const body = take.trim();
    const t = body
      ? (body === item.take?.body ? { error: null } : await supabase.from('film_comments').upsert({ user_id: userId, film_id: item.film_id, body }, { onConflict: 'user_id,film_id' }))
      : item.take ? await supabase.from('film_comments').delete().eq('comment_id', item.take.id) : { error: null };
    await supabase.from('user_film_status').upsert({ user_id: userId, film_id: item.film_id, status: 'seen', updated_at: now });
    setBusy(false);
    const err = g.error ?? t.error;
    if (err) { setError(err.message.includes('Too many') ? 'You’ve posted a lot in the last hour. Try again later.' : err.message); return; }
    setOpen(false); onSaved();
  }

  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        {item.grade ? <GradeHexLarge grade={item.grade} className="w-10 h-11 shrink-0" />
          : <div className="w-10 h-11 shrink-0 clip-hexagon bg-secondary flex items-center justify-center text-[10px] text-muted-foreground">–</div>}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <Link href={`/film/${item.film_id}`} className="font-medium hover:text-accent leading-snug">{item.film?.title ?? 'Film'}</Link>
            {item.film?.release_year && <span className="text-xs text-accent font-serif">{item.film.release_year}</span>}
            {!open && (
              <button onClick={() => setOpen(true)} className="ml-auto touch-target inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <Pencil className="w-3.5 h-3.5" /> {item.grade || item.take ? 'Edit' : 'Grade it'}
              </button>
            )}
          </div>
          {!open && item.take && (
            <p className="mt-1 text-sm text-foreground/80 whitespace-pre-line break-words">
              {item.take.body}{item.take.hidden && <span className="ml-1 text-[11px] text-orange-400">· Hidden by a moderator</span>}
            </p>
          )}
          {!open && !item.grade && !item.take && <p className="mt-0.5 text-xs text-muted-foreground">Not graded yet.</p>}
        </div>
      </div>
      {open && (
        <div className="mt-3 space-y-3">
          <GradePicker value={grade} onChange={setGrade} onClear={() => setGrade(null)} />
          <div>
            <textarea value={take} onChange={e => setTake(e.target.value.slice(0, COMMENT_MAX))} rows={3} maxLength={COMMENT_MAX}
              placeholder="Your take (optional, 280 characters)…" aria-label="Your take"
              className="w-full rounded-md bg-background border border-border px-2.5 py-2 text-base sm:text-sm focus:outline-none focus:border-accent/60 placeholder:text-muted-foreground/60" />
            <p className="text-[11px] text-muted-foreground">{COMMENT_MAX - take.length} characters left · shown publicly with your handle</p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => { setOpen(false); setGrade(item.grade); setTake(item.take?.body ?? ''); setError(''); }} className="h-9 px-3 rounded-md text-xs text-muted-foreground hover:text-foreground">Cancel</button>
            <button onClick={save} disabled={busy} className="h-9 px-4 rounded-md bg-accent text-accent-foreground text-xs font-semibold disabled:opacity-40 inline-flex items-center gap-1.5">
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
