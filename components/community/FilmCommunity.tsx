'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Users, Bookmark, BookmarkCheck, CheckCircle2, Circle, Flag, Trash2, EyeOff, Loader2, Pencil } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getGradeColor } from '@/components/grade-hex';
import { GRADES, COMMENT_MAX, TAKE_EDIT_WINDOW_MS, useMember, saveRichGrade, type CommunityStats } from '@/lib/community';
import { useAuthStatus } from '@/lib/use-auth-status';

interface Take { comment_id: number; handle: string; body: string; created_at: string; edited_at: string | null; is_mine: boolean }

function Hex({ grade, label }: { grade: string | null; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 min-w-[4.5rem]">
      <div className={`w-11 h-12 clip-hexagon flex items-center justify-center text-sm font-bold font-serif ${grade ? getGradeColor(grade) : 'bg-muted text-muted-foreground'}`}>
        {grade ?? '–'}
      </div>
      <span className="text-[11px] text-muted-foreground text-center leading-tight">{label}</span>
    </div>
  );
}

function ago(iso: string) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Film-page community section: Rich · community median · you, want/seen, and short takes. */
export function FilmCommunity({ filmId, richGrade }: { filmId: number; richGrade: string | null }) {
  const router = useRouter();
  const member = useMember();
  const { isAdmin } = useAuthStatus();
  const [statsKey, setStatsKey] = useState(0);
  const [liveStats, setLiveStats] = useState<CommunityStats | null>(null);
  const [myGrade, setMyGrade] = useState<string | null>(null);
  const [takes, setTakes] = useState<Take[]>([]);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [reported, setReported] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<{ id: number; body: string } | null>(null);
  // The admin's grade is Rich's grade, kept locally so it updates the moment it's saved
  const [richLocal, setRichLocal] = useState(richGrade);

  const status = member.statuses[filmId];
  const signIn = () => router.push(`/signin?next=${encodeURIComponent(window.location.pathname)}`);

  const loadTakes = useCallback(async () => {
    const { data } = await createClient().rpc('film_takes', { p_film_id: filmId });
    setTakes((data as Take[]) ?? []);
  }, [filmId]);

  useEffect(() => { loadTakes(); }, [loadTakes, member.userId]);
  useEffect(() => {
    if (!member.userId) { setMyGrade(null); return; }
    createClient().from('user_ratings').select('grade').eq('film_id', filmId).maybeSingle().then(({ data }) => setMyGrade(data?.grade ?? null));
  }, [filmId, member.userId]);

  async function rate(g: string) {
    if (!member.userId) return signIn();
    if (isAdmin) {
      setError('');
      const err = await saveRichGrade(filmId, g);
      if (err) { setError(err); return; }
      setRichLocal(g);
      if (status !== 'seen') await member.setStatus(filmId, 'seen');
      return;
    }
    const next = myGrade === g ? null : g;
    const supabase = createClient();
    const { error: err } = next
      ? await supabase.from('user_ratings').upsert({ user_id: member.userId, film_id: filmId, grade: next, updated_at: new Date().toISOString() })
      : await supabase.from('user_ratings').delete().eq('user_id', member.userId).eq('film_id', filmId);
    if (err) { setError(err.message); return; }
    setMyGrade(next);
    if (next && status !== 'seen') await member.setStatus(filmId, 'seen'); // grading a film means you've seen it
    setStatsKey(k => k + 1);
  }

  async function toggle(target: 'want' | 'seen') {
    if (!member.userId) return signIn();
    await member.setStatus(filmId, status === target ? null : target);
    setStatsKey(k => k + 1);
  }

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!member.userId) return signIn();
    const body = draft.trim();
    if (!body) return;
    setPosting(true); setError('');
    const { error: err } = await createClient().from('film_comments').insert({ user_id: member.userId, film_id: filmId, body });
    setPosting(false);
    if (err) { setError(err.message.includes('Too many') ? 'You’ve posted a lot in the last hour. Please try again later.' : err.message); return; }
    setDraft('');
    loadTakes();
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const body = editing.body.trim();
    if (!body) return;
    setError('');
    const { data, error: err } = await createClient().from('film_comments').update({ body }).eq('comment_id', editing.id).select('comment_id');
    if (err) { setError(err.message); return; }
    if (!data?.length) { setError('Takes can be edited for one hour after posting.'); setEditing(null); return; }
    setEditing(null);
    loadTakes();
  }

  async function remove(id: number) {
    await createClient().from('film_comments').delete().eq('comment_id', id);
    loadTakes();
  }

  async function hide(id: number) {
    await createClient().from('film_comments').update({ hidden: true, hidden_reason: 'Hidden by admin' }).eq('comment_id', id);
    loadTakes();
  }

  async function report(id: number) {
    if (!member.userId) return signIn();
    const reason = window.prompt('What’s wrong with this take? (optional)') ?? '';
    const { error: err } = await createClient().from('comment_reports').insert({ comment_id: id, reporter_id: member.userId, reason: reason.slice(0, 200) || null });
    if (!err || err.code === '23505') setReported(s => new Set(s).add(id));
  }

  // Re-fetch the public totals after each of this member's changes
  useEffect(() => {
    createClient().rpc('film_community_stats', { film_ids: [filmId] }).then(({ data }) => setLiveStats((data as CommunityStats[] | null)?.[0] ?? null));
  }, [statsKey, filmId]);

  const btn = 'inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-xs font-medium transition-colors';
  const off = 'bg-background/40 border-border text-muted-foreground hover:text-foreground hover:border-foreground/40';
  const on = 'bg-accent text-accent-foreground border-accent';

  return (
    <section className="mt-12" aria-labelledby="community-heading">
      <div className="flex items-center gap-3 mb-6">
        <Users className="w-5 h-5 text-accent" />
        <h2 id="community-heading" className="font-serif text-xl font-bold text-foreground">Community</h2>
        <div className="h-px flex-1 bg-gradient-to-r from-border/60 to-transparent" />
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-5">
        <div className="flex flex-wrap items-end gap-4 sm:gap-6">
          <Hex grade={richLocal ? richLocal.split('//')[0].trim() : null} label={richLocal ? 'Rich' : 'Rich: not yet'} />
          <Hex grade={liveStats?.rating_median ?? null} label={`Community median${liveStats?.rating_count ? ` · ${liveStats.rating_count}` : ''}`} />
          {!isAdmin && <Hex grade={myGrade} label={member.userId ? 'You' : 'You (sign in)'} />}
          <div className="ml-auto flex flex-wrap gap-2">
            <button onClick={() => toggle('want')} disabled={status === 'seen'} aria-pressed={status === 'want'}
              className={`${btn} ${status === 'want' ? on : off} disabled:opacity-35 disabled:pointer-events-none`}>
              {status === 'want' ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
              Want to see{liveStats?.want_count ? ` · ${liveStats.want_count}` : ''}
            </button>
            <button onClick={() => toggle('seen')} aria-pressed={status === 'seen'} className={`${btn} ${status === 'seen' ? on : off}`}>
              {status === 'seen' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
              {status === 'seen' ? 'Seen it' : "I've seen it"}
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-2">{isAdmin ? 'Your grade, saved as Rich’s grade' : member.userId ? 'Your grade, on Rich’s scale' : 'Sign in to grade this film on Rich’s A+–F scale'}</p>
          <div className="flex flex-wrap gap-1.5">
            {GRADES.map(g => { const picked = isAdmin ? richLocal === g : myGrade === g; return (
              <button key={g} onClick={() => rate(g)} aria-pressed={picked} aria-label={`Grade ${g}`}
                className={`w-10 h-10 sm:w-9 sm:h-9 clip-hexagon flex items-center justify-center text-xs font-bold transition-transform hover:scale-110 ${picked ? getGradeColor(g) + ' scale-110' : 'bg-secondary text-muted-foreground'}`}>
                {g}
              </button>
            ); })}
          </div>
        </div>

        <div className="border-t border-border/60 pt-4">
          <h3 className="font-serif text-base font-semibold mb-3">Takes</h3>
          {member.userId ? (
            <form onSubmit={post} className="mb-4">
              <div className="flex gap-2 items-start">
                <textarea value={draft} onChange={e => setDraft(e.target.value.slice(0, COMMENT_MAX))} rows={2} maxLength={COMMENT_MAX}
                  placeholder={`Your take as @${member.handle ?? 'you'} (280 characters)…`} aria-label="Your take"
                  className="flex-1 min-w-0 rounded-md bg-background border border-border px-2.5 py-2 text-base sm:text-sm focus:outline-none focus:border-accent/60 placeholder:text-muted-foreground/60" />
                <button disabled={posting || !draft.trim()} className="h-10 px-4 rounded-md bg-accent text-accent-foreground text-xs font-semibold disabled:opacity-40 inline-flex items-center gap-1.5">
                  {posting && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Post
                </button>
              </div>
              <p className={`mt-1 text-[11px] ${COMMENT_MAX - draft.length < 20 ? 'text-orange-400' : 'text-muted-foreground'}`}>{COMMENT_MAX - draft.length} characters left</p>
            </form>
          ) : (
            <p className="mb-4 text-sm text-muted-foreground"><Link href={`/signin?next=/film/${filmId}`} className="text-accent hover:underline">Sign in</Link> to add your take.</p>
          )}
          {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

          <ul className="space-y-3">
            {takes.map(t => (
              <li key={t.comment_id} className="text-sm leading-snug">
                <div className="flex items-baseline gap-2">
                  <Link href={`/list/${t.handle}`} className="font-medium text-foreground/90 hover:text-accent">@{t.handle}</Link>
                  <span className="text-[11px] text-muted-foreground">{ago(t.created_at)}{t.edited_at ? ' · edited' : ''}</span>
                  <span className="ml-auto flex items-center gap-1">
                    {t.is_mine && Date.now() - Date.parse(t.created_at) < TAKE_EDIT_WINDOW_MS && editing?.id !== t.comment_id && (
                      <button onClick={() => setEditing({ id: t.comment_id, body: t.body })} title="Edit your take (for an hour after posting)" aria-label="Edit your take" className="touch-target p-1 text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                    )}
                    {t.is_mine && (
                      <button onClick={() => remove(t.comment_id)} title="Delete your take" aria-label="Delete your take" className="touch-target p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                    {isAdmin && !t.is_mine && (
                      <button onClick={() => hide(t.comment_id)} title="Hide (admin)" aria-label="Hide this take" className="touch-target p-1 text-muted-foreground hover:text-destructive"><EyeOff className="w-3.5 h-3.5" /></button>
                    )}
                    {!t.is_mine && !isAdmin && (
                      reported.has(t.comment_id)
                        ? <span className="text-[11px] text-muted-foreground">Reported</span>
                        : <button onClick={() => report(t.comment_id)} title="Report this take" aria-label="Report this take" className="touch-target p-1 text-muted-foreground hover:text-foreground"><Flag className="w-3.5 h-3.5" /></button>
                    )}
                  </span>
                </div>
                {editing?.id === t.comment_id ? (
                  <form onSubmit={saveEdit} className="mt-1">
                    <textarea value={editing.body} onChange={e => setEditing({ id: t.comment_id, body: e.target.value.slice(0, COMMENT_MAX) })} rows={3} maxLength={COMMENT_MAX} aria-label="Edit your take" autoFocus
                      className="w-full rounded-md bg-background border border-border px-2.5 py-2 text-base sm:text-sm focus:outline-none focus:border-accent/60" />
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground mr-auto">{COMMENT_MAX - editing.body.length} characters left</span>
                      <button type="button" onClick={() => setEditing(null)} className="h-9 px-3 rounded-md text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                      <button disabled={!editing.body.trim() || editing.body.trim() === t.body} className="h-9 px-3 rounded-md bg-accent text-accent-foreground text-xs font-semibold disabled:opacity-40">Save</button>
                    </div>
                  </form>
                ) : (
                  <p className="text-foreground/80 mt-0.5 whitespace-pre-line break-words">{t.body}</p>
                )}
              </li>
            ))}
            {takes.length === 0 && <li className="text-xs text-muted-foreground italic">No takes yet.</li>}
          </ul>
        </div>
      </div>
    </section>
  );
}
