import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AccountPanel } from '@/components/account/AccountPanel';

export const metadata: Metadata = { title: 'Your account · Rich Picks', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/signin?next=/account');
  const [{ data: profile }, { data: role }] = await Promise.all([
    supabase.from('profiles').select('handle, created_at').eq('user_id', user.id).maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle(),
  ]);
  return (
    <div className="max-w-xl mx-auto px-4 pt-12 pb-16">
      <h1 className="font-serif text-3xl font-bold tracking-tight">Your account</h1>
      <AccountPanel email={user.email ?? ''} handle={profile?.handle ?? ''} isAdmin={role?.role === 'admin'} />
    </div>
  );
}
