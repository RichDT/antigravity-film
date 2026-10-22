'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/** Client-side sign-in state and public handle. `isAdmin` is true only for the admin role; regular members are signed in but not admins. */
export function useAuthStatus(): { signedIn: boolean; isAdmin: boolean; handle: string | null } {
  const [status, setStatus] = useState<{ signedIn: boolean; isAdmin: boolean; handle: string | null }>({ signedIn: false, isAdmin: false, handle: null });

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function resolve(userId: string | undefined) {
      if (!userId) { if (!cancelled) setStatus({ signedIn: false, isAdmin: false, handle: null }); return; }
      const [{ data: role }, { data: profile }] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
        supabase.from('profiles').select('handle').eq('user_id', userId).maybeSingle(),
      ]);
      if (!cancelled) setStatus({ signedIn: true, isAdmin: role?.role === 'admin', handle: profile?.handle ?? null });
    }

    supabase.auth.getSession().then(({ data }) => resolve(data.session?.user?.id));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => { resolve(session?.user?.id); });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  return status;
}
