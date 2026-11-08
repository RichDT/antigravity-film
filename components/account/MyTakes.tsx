'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface MyTake {
  comment_id: number; film_id: number; body: string; created_at: string;
  edited_at: string | null; hidden: boolean; films: { title: string; release_year: number | null } | null;
}

/** The signed-in member's own takes, newest first, each linking to its film page. */
export function MyTakes() {
  const [takes, setTakes] = useState<MyTake[] | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setTakes([]); return; }
      const { data } = await supabase.from('film_comments')
        .select('comment_id, film_id, body, created_at, edited_at, hidden, films(title, release_year)')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(200);
      setTakes((data as unknown as MyTake[]) ?? []);
    });
  }, []);

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-medium flex items-center gap-2"><MessageSquare className="w-4 h-4" /> My takes{takes?.length ? ` · ${takes.length}` : ''}</h2>
      {takes === null ? (
        <p className="mt-2 text-xs text-muted-foreground">Loading…</p>
      ) : takes.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">You haven’t posted any takes yet. Add one from any film page.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border/60">
          {takes.map(t => (
            <li key={t.comment_id} className="py-2.5">
              <div className="flex items-baseline gap-2 flex-wrap">
                <Link href={`/film/${t.film_id}#community-heading`} className="text-sm font-medium text-accent hover:underline">
                  {t.films?.title ?? 'Film'}{t.films?.release_year ? ` (${t.films.release_year})` : ''}
                </Link>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {t.edited_at ? ' · edited' : ''}
                </span>
                {t.hidden && <span className="text-[11px] text-orange-400">Hidden by a moderator</span>}
              </div>
              <p className="mt-0.5 text-sm text-foreground/80 line-clamp-2 break-words">{t.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
