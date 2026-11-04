'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMember } from '@/lib/community';

export interface PickOption { considerationId: number; filmId: number; title: string; detail: string | null }
export interface PickCategory { categoryId: number; name: string; group: string; options: PickOption[] }

/** Members choose one contender per category; everyone sees vote totals. */
export function CommunityPicks({ year, categories }: { year: number; categories: PickCategory[] }) {
  const router = useRouter();
  const member = useMember();
  const [mine, setMine] = useState<Record<number, number>>({}); // category_id → consideration_id
  const [votes, setVotes] = useState<Record<number, number>>({}); // consideration_id → votes
  const [error, setError] = useState('');

  const loadVotes = useCallback(async () => {
    const { data } = await createClient().rpc('community_pick_results', { p_year: year });
    setVotes(Object.fromEntries(((data ?? []) as { consideration_id: number; votes: number }[]).map(r => [r.consideration_id, r.votes])));
  }, [year]);

  useEffect(() => { loadVotes(); }, [loadVotes]);
  useEffect(() => {
    if (!member.userId) { setMine({}); return; }
    createClient().from('community_picks').select('category_id, consideration_id').eq('year', year)
      .then(({ data }) => setMine(Object.fromEntries((data ?? []).map(r => [r.category_id, r.consideration_id]))));
  }, [member.userId, year]);

  async function pick(cat: PickCategory, opt: PickOption) {
    if (!member.userId) { router.push('/signin?next=/picks'); return; }
    setError('');
    const supabase = createClient();
    const prev = mine[cat.categoryId];
    const clearing = prev === opt.considerationId;
    setMine(m => { const n = { ...m }; if (clearing) delete n[cat.categoryId]; else n[cat.categoryId] = opt.considerationId; return n; });
    const { error: err } = clearing
      ? await supabase.from('community_picks').delete().eq('user_id', member.userId).eq('year', year).eq('category_id', cat.categoryId)
      : await supabase.from('community_picks').upsert({ user_id: member.userId, year, category_id: cat.categoryId, consideration_id: opt.considerationId, film_id: opt.filmId });
    if (err) {
      setError(err.message);
      setMine(m => { const n = { ...m }; if (prev) n[cat.categoryId] = prev; else delete n[cat.categoryId]; return n; });
      return;
    }
    loadVotes();
  }

  const picked = Object.keys(mine).length;

  return (
    <>
      <div className="mb-6 text-sm text-muted-foreground">
        {member.userId
          ? <>You’ve picked <span className="text-foreground font-medium">{picked}</span> of {categories.length} categories. Tap a pick again to clear it.</>
          : <><Link href="/signin?next=/picks" className="text-accent hover:underline">Sign in</Link> to make your picks.</>}
      </div>
      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.map(cat => {
          const total = cat.options.reduce((s, o) => s + (votes[o.considerationId] ?? 0), 0);
          return (
            <section key={cat.categoryId} className="rounded-lg border border-border bg-card overflow-hidden">
              <h2 className="px-3 py-2.5 border-b border-border font-serif text-sm font-semibold flex items-baseline justify-between gap-2">
                {cat.name}
                <span className="text-[11px] font-sans font-normal text-muted-foreground">{total} vote{total === 1 ? '' : 's'}</span>
              </h2>
              <ul className="p-1.5">
                {cat.options.map(opt => {
                  const v = votes[opt.considerationId] ?? 0;
                  const pct = total ? Math.round((v / total) * 100) : 0;
                  const isMine = mine[cat.categoryId] === opt.considerationId;
                  const primary = cat.group === 'acting' && opt.detail ? opt.detail : opt.title;
                  const secondary = cat.group === 'acting' ? opt.title : opt.detail;
                  return (
                    <li key={opt.considerationId}>
                      <button onClick={() => pick(cat, opt)} aria-pressed={isMine}
                        className={`relative w-full min-h-11 text-left rounded-md px-2.5 py-1.5 flex items-center gap-2.5 overflow-hidden transition-colors ${isMine ? 'ring-1 ring-accent' : 'hover:bg-secondary/40'}`}>
                        <span aria-hidden className="absolute inset-y-0 left-0 bg-accent/10" style={{ width: `${pct}%` }} />
                        <span className={`relative w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${isMine ? 'bg-accent border-accent text-accent-foreground' : 'border-border'}`}>
                          {isMine && <Check className="w-3 h-3" />}
                        </span>
                        <span className="relative flex-1 min-w-0">
                          <span className="block text-sm leading-tight truncate">{primary}</span>
                          {secondary && <span className="block text-[11px] text-muted-foreground truncate">{secondary}</span>}
                        </span>
                        {total > 0 && <span className="relative text-[11px] tabular-nums text-muted-foreground">{pct}%</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
