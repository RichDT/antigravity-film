'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export const GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'] as const;
export const COMMENT_MAX = 280;
export type FilmStatus = 'want' | 'seen';
export interface CommunityStats { want_count: number; seen_count: number; rating_count: number; rating_median: string | null }

/** The signed-in member's id, profile handle, and their want/seen statuses — kept in sync with auth changes. */
export function useMember() {
  const [userId, setUserId] = useState<string | null>(null);
  const [handle, setHandle] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<number, FilmStatus>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    async function load(uid: string | undefined) {
      if (!uid) { if (!cancelled) { setUserId(null); setHandle(null); setStatuses({}); setReady(true); } return; }
      const [{ data: prof }, { data: rows }] = await Promise.all([
        supabase.from('profiles').select('handle').eq('user_id', uid).maybeSingle(),
        supabase.from('user_film_status').select('film_id, status'),
      ]);
      if (cancelled) return;
      setUserId(uid);
      setHandle(prof?.handle ?? null);
      setStatuses(Object.fromEntries((rows ?? []).map(r => [r.film_id, r.status as FilmStatus])));
      setReady(true);
    }
    supabase.auth.getSession().then(({ data }) => load(data.session?.user?.id));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => { load(session?.user?.id); });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  /** Set (or clear, with null) this member's status for a film. Optimistic, reverts on failure. */
  const setStatus = useCallback(async (filmId: number, status: FilmStatus | null) => {
    if (!userId) return false;
    const prev = statuses[filmId];
    setStatuses(s => { const n = { ...s }; if (status) n[filmId] = status; else delete n[filmId]; return n; });
    const supabase = createClient();
    const { error } = status
      ? await supabase.from('user_film_status').upsert({ user_id: userId, film_id: filmId, status, updated_at: new Date().toISOString() })
      : await supabase.from('user_film_status').delete().eq('user_id', userId).eq('film_id', filmId);
    if (error) {
      setStatuses(s => { const n = { ...s }; if (prev) n[filmId] = prev; else delete n[filmId]; return n; });
      return false;
    }
    return true;
  }, [userId, statuses]);

  return { userId, handle, statuses, setStatus, ready };
}

/** Public, anonymous totals for a set of films (want / seen counts, rating median). */
export function useCommunityStats(filmIds: number[]) {
  const [stats, setStats] = useState<Record<number, CommunityStats>>({});
  const key = filmIds.join(',');
  useEffect(() => {
    if (!filmIds.length) return;
    createClient().rpc('film_community_stats', { film_ids: filmIds }).then(({ data }) => {
      if (data) setStats(Object.fromEntries((data as (CommunityStats & { film_id: number })[]).map(r => [r.film_id, r])));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return stats;
}

/** Save a quick review: a grade (optional) and a short take (optional). */
export async function saveQuickReview(userId: string, filmId: number, grade: string | undefined, take: string): Promise<string | null> {
  const supabase = createClient();
  if (grade) {
    const { error } = await supabase.from('user_ratings').upsert({ user_id: userId, film_id: filmId, grade, updated_at: new Date().toISOString() });
    if (error) return error.message;
  }
  const body = take.trim();
  if (body) {
    const { error } = await supabase.from('film_comments').insert({ user_id: userId, film_id: filmId, body });
    if (error) return error.message.includes('Too many') ? 'You’ve posted a lot in the last hour — please try again later.' : error.message;
  }
  return null;
}
