'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Users, Bookmark, BookmarkCheck, CheckCircle2, Circle, Flag, Trash2, EyeOff, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getGradeColor } from '@/components/grade-hex';
import { COMMENT_MAX, useMember, saveRichGrade, type CommunityStats } from '@/lib/community';
import { useAuthStatus } from '@/lib/use-auth-status';
import { GradePicker } from '@/components/community/GradePicker';

interface Take { comment_id: number; handle: string; body: string; created_at: string; edited_at: string | null; is_mine: boolean }

function Hex({ grade, label }: { grade: string | null; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 min-w-[4.5rem]">
      {grade?.includes('//') ? (() => {
        const [hi, lo] = grade.split('//').map(s => s.trim());
        return (
          <div className={`w-11 h-12 clip-hexagon flex flex-col items-center justify-center font-bold font-serif leading-none ${getGradeColor(hi)}`}>
            <span className="text-[11px] leading-none">{hi}</span>
            <div className="w-6 h-[1px] bg-white/80 my-[2px]" />
            <span className="text-[11px] leading-none">{lo}</span>
          </div>
        );
      })() : (
        <div className={`w-11 h-12 clip-hexagon flex items-center justify-center text-sm font-bold font-serif ${grade ? getGradeColor(grade) : 'bg-muted text-muted-foreground'}`}>
          {grade ?? '–'}
        </div>
      )}
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
export function FilmCommunity({ filmId, richGrade, filmTitle }: { filmId: number; richGrade: string | null; filmTitle?: string }) {
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
  // The admin's grade is Rich's grade, kept locally so it updates the moment it's saved
  const [richLocal, setRichLocal] = useState(richGrade);
  const [invite, setInvite] = useState(false);
  const inviteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gradeRef = useRef<HTMLDivElement>(null);

  const status = member.statuses[filmId];
  const signIn = (reason?: 'want' | 'seen' | 'take') =>
    router.push(`/signin?${new URLSearchParams({ next: window.location.pathname, ...(reason ? { reason, film: filmTitle ?? '' } : {}) })}`);

  const loadTakes = useCallback(async () => {
    const { data } = await createClient().rpc('film_takes', { p_film_id: filmId });
    setTakes((data as Take[]) ?? []);
  }, [filmId]);

  useEffect(() => { loadTakes(); }, [loadTakes, member.userId]);
  useEffect(() => {
    if (!member.userId) { setMyGrade(null); return; }
    createClient().from('user_ratings').select('grade').eq('film_id', filmId).maybeSingle().then(({ data }) => setMyGrade(data?.grade ?? null));
  }, [filmId, member.userId]);

  // The picker updates instantly; saving waits until the grade has stopped changing for a moment,
  // so stepping along the rail doesn't save every intermediate grade
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function rate(g: string | null) {
    if (!member.userId) return signIn('seen');
    if (isAdmin) { if (g) setRichLocal(g) } else setMyGrade(g);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void commit(g); }, 700);
  }
  async function commit(next: string | null) {
    if (!member.userId) return;
    if (isAdmin) {
      if (!next) return;
      setError('');
      const err = await saveRichGrade(filmId, next);
      if (err) { setError(err); return; }
      if (status !== 'seen') await member.setStatus(filmId, 'seen');
      return;
    }
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
    if (!member.userId) return signIn(target);
    const marking = status !== target;
    await member.setStatus(filmId, marking ? target : null);
    setStatsKey(k => k + 1);
    // Just seen it: invite a grade and a take right here — a soft gold glow that fades
    if (target === 'seen' && marking) {
      gradeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setInvite(true);
      if (inviteTimer.current) clearTimeout(inviteTimer.current);
      inviteTimer.current = setTimeout(() => setInvite(false), 1600);
    }
  }

  // One take per member per film: the composer holds your take, and posting again updates it
  const myTake = takes.find(t => t.is_mine) ?? null;
  useEffect(() => { setDraft(myTake?.body ?? ''); }, [myTake?.comment_id, myTake?.body]);
  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!member.userId) return signIn('take');
    const body = draft.trim();
    if (!body) return;
    setPosting(true); setError('');
    const supabase = createClient();
    const { error: err } = myTake
      ? await supabase.from('film_comments').update({ body }).eq('comment_id', myTake.comment_id)
      : await supabase.from('film_comments').insert({ user_id: member.userId, film_id: filmId, body });
    setPosting(false);
    if (err) { setError(err.message.includes('Too many') ? 'You’ve posted a lot in the last hour. Please try again later.' : err.message); return; }
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
          <Hex grade={richLocal || null} label={richLocal ? 'Rich’s grade' : 'Rich: not yet'} />
          {/* Rich isn't part of the community median, so his grade stands apart */}
          <div className="self-stretch w-px bg-border/70 my-1" aria-hidden="true" />
          <Hex grade={liveStats?.rating_median ?? null} label="Members’ median" />
          {!isAdmin && <Hex grade={myGrade} label={member.userId ? 'Your grade' : 'You (sign in)'} />}
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

        <p className="-mt-2 text-[11px] text-muted-foreground">The members’ median is the middle grade of everyone who has graded this film on the site. Rich’s grade isn’t included.</p>

        <div ref={gradeRef} className={`rounded-lg transition-shadow duration-[1400ms] ${invite ? 'ring-2 ring-primary/80 shadow-[0_0_18px_rgba(212,175,55,0.35)]' : 'ring-0 ring-transparent'}`}>
          <p className="text-xs text-muted-foreground mb-2">{isAdmin ? 'Your grade, saved as Rich’s grade' : member.userId ? 'Your grade, on Rich’s scale' : 'Sign in to grade this film on Rich’s A+–F scale'}</p>
          <GradePicker value={isAdmin ? richLocal : myGrade} onChange={rate} onClear={isAdmin ? undefined : () => rate(null)} />
        </div>

        <div className="border-t border-border/60 pt-4">
          <h3 className="font-serif text-base font-semibold mb-3">Takes</h3>
          {member.userId ? (
            <form onSubmit={post} className={`mb-4 rounded-lg transition-shadow duration-[1400ms] ${invite ? 'ring-2 ring-primary/80 shadow-[0_0_18px_rgba(212,175,55,0.35)]' : 'ring-0 ring-transparent'}`}>
              <div className="flex gap-2 items-start">
                <textarea value={draft} onChange={e => setDraft(e.target.value.slice(0, COMMENT_MAX))} rows={2} maxLength={COMMENT_MAX}
                  placeholder={`Your take as @${member.handle ?? 'you'} (280 characters)…`} aria-label={myTake ? 'Edit your take' : 'Your take'}
                  className="flex-1 min-w-0 rounded-md bg-background border border-border px-2.5 py-2 text-base sm:text-sm focus:outline-none focus:border-accent/60 placeholder:text-muted-foreground/60" />
                <button disabled={posting || !draft.trim()} className="h-10 px-4 rounded-md bg-accent text-accent-foreground text-xs font-semibold disabled:opacity-40 inline-flex items-center gap-1.5">
                  {posting && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {myTake ? 'Update' : 'Post'}
                </button>
              </div>
              <p className={`mt-1 text-[11px] ${COMMENT_MAX - draft.length < 20 ? 'text-orange-400' : 'text-muted-foreground'}`}>
                {COMMENT_MAX - draft.length} characters left{myTake ? ' · this is your take on this film; editing it updates it' : ''}
              </p>
            </form>
          ) : (
            <p className="mb-4 text-sm text-muted-foreground"><Link href={`/signin?next=/film/${filmId}`} className="text-accent hover:underline">Sign in</Link> to add your take.</p>
          )}
          {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

          <ul className="divide-y divide-border/60">
            {takes.map(t => (
              <li key={t.comment_id} className="text-sm leading-snug py-3 first:pt-0 last:pb-0">
                <div className="flex items-baseline gap-2">
                  <Link href={`/list/${t.handle}`} className="font-medium text-foreground/90 hover:text-accent">@{t.handle}</Link>
                  <span className="text-[11px] text-muted-foreground">{ago(t.created_at)}{t.edited_at ? ' · edited' : ''}</span>
                  <span className="ml-auto flex items-center gap-1">
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
                <p className="text-foreground/80 mt-0.5 whitespace-pre-line break-words">{t.body}</p>
              </li>
            ))}
            {takes.length === 0 && <li className="text-xs text-muted-foreground italic">No takes yet.</li>}
          </ul>
        </div>
      </div>
    </section>
  );
}
