'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bookmark, Download, LogOut, Trash2, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { MyTakes } from '@/components/account/MyTakes';

const HANDLE_RE = /^[a-z0-9_.]{3,24}$/;

export function AccountPanel({ email, handle: initialHandle, isAdmin }: { email: string; handle: string; isAdmin: boolean }) {
  const router = useRouter();
  const [handle, setHandle] = useState(initialHandle);
  const [draft, setDraft] = useState(initialHandle);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState('');

  async function saveHandle(e: React.FormEvent) {
    e.preventDefault();
    const next = draft.trim().toLowerCase();
    if (!HANDLE_RE.test(next)) { setMsg({ ok: false, text: 'Handles are 3–24 characters: lowercase letters, numbers, “_” and “.”.' }); return; }
    setBusy(true); setMsg(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('profiles').update({ handle: next }).eq('user_id', user!.id);
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.code === '23505' ? 'That handle is taken — try another.' : error.message }); return; }
    setHandle(next); setDraft(next); setMsg({ ok: true, text: 'Handle updated.' });
  }

  async function exportData() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [status, ratings, picks, comments] = await Promise.all([
      supabase.from('user_film_status').select('film_id, status, updated_at').eq('user_id', user.id),
      supabase.from('user_ratings').select('film_id, grade, updated_at').eq('user_id', user.id),
      supabase.from('community_picks').select('year, category_id, consideration_id, film_id, person_id, updated_at').eq('user_id', user.id),
      supabase.from('film_comments').select('film_id, body, created_at, edited_at, hidden').eq('user_id', user.id),
    ]);
    const blob = new Blob([JSON.stringify({ email, handle, exported_at: new Date().toISOString(),
      want_to_see_and_seen: status.data, ratings: ratings.data, community_picks: picks.data, comments: comments.data }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `rich-picks-${handle}.json`; a.click();
    URL.revokeObjectURL(a.href);
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.push('/'); router.refresh();
  }

  async function deleteAccount() {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc('delete_my_account');
    if (error) { setBusy(false); setMsg({ ok: false, text: error.message }); return; }
    await supabase.auth.signOut();
    router.push('/?account=deleted'); router.refresh();
  }

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground">Signed in as</p>
        <p className="text-sm">{email}</p>
        <form onSubmit={saveHandle} className="mt-4">
          <label htmlFor="handle" className="block text-xs text-muted-foreground mb-1">Public handle</label>
          <div className="flex gap-2">
            <div className="flex-1 flex items-center rounded-md border border-border bg-background focus-within:border-accent/60">
              <span className="pl-3 text-muted-foreground">@</span>
              <input id="handle" value={draft} onChange={e => setDraft(e.target.value.toLowerCase())} maxLength={24}
                className="flex-1 min-w-0 h-11 bg-transparent px-1 text-base focus:outline-none" />
            </div>
            <button disabled={busy || draft === handle} className="h-11 px-4 rounded-md bg-accent text-accent-foreground text-sm font-semibold disabled:opacity-40">Save</button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Shown next to your takes and on your shared list.</p>
        </form>
        {msg && <p className={`mt-2 text-sm ${msg.ok ? 'text-emerald-400' : 'text-destructive'}`}>{msg.text}</p>}
      </section>

      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <Link href={`/list/${handle}`} className="flex items-center gap-2 text-sm hover:text-accent"><Bookmark className="w-4 h-4" /> My want-to-see list</Link>
        {isAdmin && <Link href="/admin/add-review" className="block text-sm text-accent hover:underline">Admin tools</Link>}
        <button onClick={exportData} className="flex items-center gap-2 text-sm hover:text-accent"><Download className="w-4 h-4" /> Download my data</button>
        <button onClick={signOut} className="flex items-center gap-2 text-sm hover:text-accent"><LogOut className="w-4 h-4" /> Log out</button>
      </section>

      <MyTakes />

      {!isAdmin && (
        <section className="rounded-lg border border-destructive/40 p-4">
          <p className="text-sm font-medium flex items-center gap-2"><Trash2 className="w-4 h-4 text-destructive" /> Delete account</p>
          <p className="mt-1 text-xs text-muted-foreground">Permanently removes your account, list, grades, picks and takes. This can’t be undone.</p>
          <label className="mt-3 block text-xs text-muted-foreground" htmlFor="confirm-delete">Type <span className="text-foreground">delete</span> to confirm</label>
          <div className="mt-1 flex gap-2">
            <input id="confirm-delete" value={confirmDelete} onChange={e => setConfirmDelete(e.target.value)}
              className="flex-1 h-11 rounded-md border border-border bg-background px-3 text-base focus:outline-none" />
            <button onClick={deleteAccount} disabled={busy || confirmDelete !== 'delete'}
              className="h-11 px-4 rounded-md bg-destructive text-white text-sm font-semibold disabled:opacity-40 inline-flex items-center gap-2">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Delete
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
