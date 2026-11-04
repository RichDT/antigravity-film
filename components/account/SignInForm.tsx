'use client';

import { useState } from 'react';
import { Mail, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Turnstile, TURNSTILE_SITE_KEY } from '@/components/account/Turnstile';

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden>
      <path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8.1z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9l3.7-2.8z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
    </svg>
  );
}

/** Google or an emailed one-time link — no passwords for members. */
export function SignInForm({ next }: { next: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);

  const callback = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function google() {
    setMessage('');
    const { error } = await createClient().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callback() } });
    if (error) { setState('error'); setMessage(error.message); }
  }

  async function emailLink(e: React.FormEvent) {
    e.preventDefault();
    setState('sending'); setMessage('');
    const { error } = await createClient().auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: callback(), captchaToken: captcha ?? undefined } });
    setCaptchaReset(k => k + 1); // tokens are single-use
    if (error) { setState('error'); setMessage(error.message); return; }
    setState('sent');
  }

  if (state === 'sent') {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm">
        <p className="font-medium flex items-center gap-2"><Mail className="w-4 h-4 text-accent" /> Check your email</p>
        <p className="mt-1 text-muted-foreground">We sent a sign-in link to <span className="text-foreground">{email}</span>. Open it on this device to finish signing in.</p>
        <button onClick={() => setState('idle')} className="mt-3 text-xs text-accent hover:underline">Use a different email</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button onClick={google}
        className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background hover:bg-secondary/60 text-sm font-medium transition-colors">
        <GoogleMark /> Continue with Google
      </button>
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
      <form onSubmit={emailLink} className="space-y-2">
        <label htmlFor="signin-email" className="block text-xs text-muted-foreground">Email me a sign-in link</label>
        <input id="signin-email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full h-11 rounded-md border border-border bg-background px-3 text-base focus:outline-none focus:border-accent/60" />
        <Turnstile onToken={setCaptcha} resetKey={captchaReset} />
        <button type="submit" disabled={state === 'sending' || (!!TURNSTILE_SITE_KEY && !captcha)}
          className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-md bg-accent text-accent-foreground text-sm font-semibold disabled:opacity-60">
          {state === 'sending' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Send link
        </button>
      </form>
      {message && <p className="text-sm text-destructive">{message}</p>}
    </div>
  );
}
