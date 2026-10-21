import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

/** The signed-in user if they hold the admin role, otherwise null. Signed-in members are NOT admins. */
export async function getAdminUser(): Promise<User | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
  return data?.role === 'admin' ? user : null;
}
