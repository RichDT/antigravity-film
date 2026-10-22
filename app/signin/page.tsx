import type { Metadata } from 'next';
import { SignInForm } from '@/components/account/SignInForm';

export const metadata: Metadata = {
  title: 'Sign in · Rich Picks',
  robots: { index: false, follow: false },
};

export default async function SignInPage(props: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next = '/', error } = await props.searchParams;
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  return (
    <div className="min-h-[70vh] flex items-start justify-center px-4 pt-16 pb-16">
      <div className="w-full max-w-sm">
        <h1 className="font-serif text-3xl font-bold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Keep a list of films you want to see, grade what you’ve seen on Rich’s A+–F scale, and share your take.
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
