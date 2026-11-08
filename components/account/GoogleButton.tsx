'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (opts: Record<string, unknown>) => void;
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const SCRIPT = 'https://accounts.google.com/gsi/client';

let scriptPromise: Promise<void> | null = null;
function loadScript() {
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT; s.async = true; s.defer = true;
    s.onload = () => resolve(); s.onerror = () => { scriptPromise = null; reject(); };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

async function makeNonce() {
  const raw = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  return { raw, hashed };
}

/**
 * Google's own sign-in button (Google Identity Services). Google talks to this site directly,
 * so its sign-in screen names richpicks.app — never the Supabase project address.
 */
export function GoogleButton({ next, onError }: { next: string; onError: (message: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (ref.current) setWidth(Math.min(400, Math.round(ref.current.getBoundingClientRect().width)));
  }, []);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !width || !ref.current) return;
    let cancelled = false;
    (async () => {
      try {
        const [{ raw, hashed }] = await Promise.all([makeNonce(), loadScript()]);
        if (cancelled || !ref.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: hashed,
          use_fedcm_for_button: true,
          callback: async ({ credential }: { credential: string }) => {
            const supabase = createClient();
            const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: credential, nonce: raw });
            if (error || !data.session) { onError(error?.message ?? 'Google sign-in didn’t finish. Please try again.'); return; }
            // Make sure the new session is stored before leaving, so the next page loads signed in
            await supabase.auth.getSession();
            const dest = next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/signin') ? next : '/';
            window.location.replace(dest);
          },
        });
        window.google.accounts.id.renderButton(ref.current, {
          type: 'standard', theme: 'filled_black', size: 'large', shape: 'rectangular',
          text: 'continue_with', logo_alignment: 'center', width,
        });
      } catch {
        onError('Google sign-in couldn’t load. Check your connection or try the email link.');
      }
    })();
    return () => { cancelled = true; };
  }, [width, next, onError]);

  return <div ref={ref} className="w-full min-h-11 flex justify-center" />;
}
