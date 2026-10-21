'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/** Client-side sign-in state. `isAdmin` is true only for the admin role; regular members are signed in but not admins. */
export function useAuthStatus(): { signedIn: boolean; isAdmin: boolean } {
  const [status, setStatus] = useState({ signedIn: false, isAdmin: false });

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function resolve(userId: string | undefined) {
      if (!userId) { if (!cancelled) setStatus({ signedIn: false, isAdmin: false }); return; }
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle();
      if (!cancelled) setStatus({ signedIn: true, isAdmin: data?.role === 'admin' });
    }

    supabase.auth.getSession().then(({ data }) => resolve(data.session?.user?.id));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => { resolve(session?.user?.id); });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  return status;
}
