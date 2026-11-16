import type { Metadata } from 'next';
import { SignInForm } from '@/components/account/SignInForm';

export const metadata: Metadata = {
  title: 'Sign in · Rich Picks',
  robots: { index: false, follow: false },
};

// Why a visitor was sent here (set by Want to see / I've seen it and similar member actions)
const REASONS: Record<string, (film: string) => string> = {
  want: f => `To add ${f || 'a film'} to a Want to see list, you’ll need a Rich Picks account. Signing in below creates one in seconds, and we’ll add ${f ? 'it' : 'the film'} as soon as you’re in.`,
  seen: f => `To mark ${f || 'a film'} as seen and grade it on Rich’s scale, you’ll need a Rich Picks account. Signing in below creates one in seconds; then we’ll mark ${f ? 'it' : 'the film'} as seen and ask for your grade.`,
  take: f => `To post your take${f ? ` on ${f}` : ''}, you’ll need a Rich Picks account. Signing in below creates one in seconds.`,
};

export default async function SignInPage(props: { searchParams: Promise<{ next?: string; error?: string; reason?: string; film?: string }> }) {
  const { next = '/', error, reason, film = '' } = await props.searchParams;
  const why = reason && REASONS[reason] ? REASONS[reason](film.slice(0, 120)) : null;
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  return (
    <div className="min-h-[70vh] flex items-start justify-center px-4 pt-16 pb-16">
      <div className="w-full max-w-sm">
        <h1 className="font-serif text-3xl font-bold tracking-tight">{why ? 'Sign in or join' : 'Sign in'}</h1>
        {why && (
          <p className="mt-3 rounded-md border border-accent/40 bg-accent/10 px-3 py-2.5 text-sm text-foreground/90 leading-relaxed">{why}</p>
        )}
        <p className="mt-3 text-sm text-muted-foreground">
          {why ? 'New here? There’s no separate sign-up: continue with Google or your email and your account is ready. ' : ''}Keep a list of films you want to see, grade what you’ve seen on Rich’s A+–F scale, and share your take.
        </p>
        {error === 'link' && (
          <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            That sign-in link didn’t work or has expired. Try again below.
          </p>
        )}
        <div className="mt-6">
          <SignInForm next={safeNext} />
        </div>
        <p className="mt-6 text-[11px] text-muted-foreground leading-relaxed">
          By signing in you agree to the <a href="/terms" className="underline hover:text-foreground">Terms of Use</a> and{' '}
          <a href="/privacy" className="underline hover:text-foreground">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
