'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bookmark, BookmarkCheck, CheckCircle2, Circle } from 'lucide-react';
import { useMember, type FilmStatus } from '@/lib/community';
import { useAuthStatus } from '@/lib/use-auth-status';
import { QuickReview } from '@/components/community/QuickReview';

type Ctx = {
  statusOf: (filmId: number) => FilmStatus | undefined;
  toggleWant: (filmId: number, title?: string) => void;
  toggleSeen: (filmId: number, title: string) => void;
};
const MemberActions = createContext<Ctx | null>(null);
const PENDING_KEY = 'rp:pending-film-action';

/**
 * One member session for a whole page: every list's Want to see / I've seen it controls share it, and
 * marking a film seen opens a single quick-review prompt (Rich's own grade and review for the admin).
 */
export function MemberActionsProvider({ children }: { children: React.ReactNode }) {
  const member = useMember();
  const { isAdmin } = useAuthStatus();
  const router = useRouter();
  const [reviewing, setReviewing] = useState<{ filmId: number; title: string } | null>(null);

  // Signed-out visitors go to sign in (which also creates an account), told why; the action they chose is
  // remembered on this device and completed as soon as they're back, signed in.
  const signIn = useCallback((action: 'want' | 'seen', filmId: number, title: string) => {
    try { localStorage.setItem(PENDING_KEY, JSON.stringify({ action, filmId, title, at: Date.now() })); } catch { /* storage blocked */ }
    const q = new URLSearchParams({ next: window.location.pathname + window.location.search, reason: action, film: title });
    router.push(`/signin?${q}`);
  }, [router]);
  const toggleWant = useCallback((filmId: number, title = '') => {
    if (!member.userId) return signIn('want', filmId, title);
    member.setStatus(filmId, member.statuses[filmId] === 'want' ? null : 'want');
  }, [member, signIn]);
  const toggleSeen = useCallback(async (filmId: number, title: string) => {
    if (!member.userId) return signIn('seen', filmId, title);
    if (member.statuses[filmId] === 'seen') { await member.setStatus(filmId, null); return; }
    // Seeing a film replaces wanting to see it, and invites a quick review
    if (await member.setStatus(filmId, 'seen')) setReviewing({ filmId, title });
  }, [member, signIn]);

  // Finish an action started before signing in
  useEffect(() => {
    if (!member.ready || !member.userId) return;
    let pending: { action: 'want' | 'seen'; filmId: number; title: string; at: number } | null = null;
    try { pending = JSON.parse(localStorage.getItem(PENDING_KEY) ?? 'null'); localStorage.removeItem(PENDING_KEY); } catch { /* storage blocked */ }
    if (!pending || Date.now() - pending.at > 60 * 60 * 1000) return;
    if (member.statuses[pending.filmId] === pending.action) return;
    member.setStatus(pending.filmId, pending.action).then(ok => { if (ok && pending!.action === 'seen') setReviewing({ filmId: pending!.filmId, title: pending!.title }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member.ready, member.userId]);
  const value = useMemo<Ctx>(() => ({ statusOf: id => member.statuses[id], toggleWant, toggleSeen }), [member.statuses, toggleWant, toggleSeen]);

  return (
    <MemberActions.Provider value={value}>
      {children}
      {reviewing && member.userId && (
        <QuickReview userId={member.userId} filmId={reviewing.filmId} title={reviewing.title} isAdmin={isAdmin} onClose={() => setReviewing(null)} />
      )}
    </MemberActions.Provider>
  );
}

/**
 * A quiet pair of icon toggles — Want to see, I've seen it — for dense lists and cards.
 * Renders nothing outside a MemberActionsProvider.
 */
export function FilmStatusIcons({ filmId, title, className = '', quiet = false }: { filmId: number; title: string; className?: string; quiet?: boolean }) {
  const ctx = useContext(MemberActions);
  if (!ctx) return null;
  const status = ctx.statusOf(filmId);
  const wants = status === 'want', seen = status === 'seen';
  const btn = 'touch-target w-9 h-9 sm:w-7 sm:h-7 inline-flex items-center justify-center rounded-full transition-colors';
  return (
    <span className={`inline-flex items-center gap-1 sm:gap-0.5 shrink-0 transition-opacity ${quiet && !status ? 'opacity-35 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100' : ''} ${className}`}>
      <button type="button" onClick={() => ctx.toggleWant(filmId, title)} disabled={seen} aria-pressed={wants}
        title={seen ? 'You’ve seen this film' : wants ? 'On your Want to see list · tap to remove' : 'Want to see'}
        aria-label={wants ? `Remove ${title} from your Want to see list` : `Want to see ${title}`}
        className={`${btn} ${wants ? 'text-accent' : 'text-muted-foreground/70 hover:text-foreground hover:bg-secondary/70'} disabled:opacity-30 disabled:pointer-events-none`}>
        {wants ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
      </button>
      <button type="button" onClick={() => ctx.toggleSeen(filmId, title)} aria-pressed={seen}
        title={seen ? 'You’ve seen it · tap to undo' : 'I’ve seen it (then grade it)'}
        aria-label={seen ? `Unmark ${title} as seen` : `I’ve seen ${title}`}
        className={`${btn} ${seen ? 'text-accent' : 'text-muted-foreground/70 hover:text-foreground hover:bg-secondary/70'}`}>
        {seen ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
      </button>
    </span>
  );
}
