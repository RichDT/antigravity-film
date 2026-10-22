import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Terms of Use · Rich Picks' };

const UPDATED = 'October 22, 2026';

export default function TermsPage() {
  return (
    <article className="max-w-2xl mx-auto px-4 pt-12 pb-16 text-sm leading-relaxed text-foreground/90 space-y-5">
      <header>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground">Terms of Use</h1>
        <p className="mt-1 text-xs text-muted-foreground">Last updated {UPDATED}</p>
      </header>

      <p>Rich Picks is a personal film-criticism site. By creating an account or posting on it, you agree to these terms.</p>

      <section className="space-y-2">
        <h2 className="font-serif text-lg font-semibold text-foreground">Your account</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>You must be at least 13 years old.</li>
          <li>Keep access to your email or Google account secure; you’re responsible for activity on your account.</li>
          <li>Pick a handle that isn’t offensive and doesn’t impersonate someone else.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-serif text-lg font-semibold text-foreground">What you post</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>You own your takes. By posting, you let Rich Picks display them on the site, alongside your handle.</li>
          <li>Keep it about the films. No harassment, hate, threats, spam, unmarked spoilers, personal information about others, or anything illegal.</li>
          <li>Takes are limited to 280 characters, and to a reasonable number per hour.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-serif text-lg font-semibold text-foreground">Moderation</h2>
        <p>We may hide or remove any post, change an inappropriate handle, or suspend or delete accounts that break these terms, at our discretion. You can report a take you think breaks the rules.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-serif text-lg font-semibold text-foreground">Community features</h2>
        <p>Community grades, counts and award picks reflect what members choose. They’re separate from Rich’s own grades, nominations and winners, which remain his alone.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-serif text-lg font-semibold text-foreground">The site</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Release dates, screenings, trailers and streaming links come from public sources and may change; check with the theater or service before you go.</li>
          <li>The site is provided as is, without warranties. We may change or discontinue features at any time.</li>
          <li>To the extent the law allows, Rich Picks isn’t liable for indirect or incidental damages arising from your use of the site.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-serif text-lg font-semibold text-foreground">Ending your account</h2>
        <p>You can delete your account any time from <Link href="/account" className="underline">your account page</Link>. See the <Link href="/privacy" className="underline">Privacy Policy</Link> for what happens to your data.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-serif text-lg font-semibold text-foreground">Changes and contact</h2>
        <p>If these terms change, we’ll update the date above; continuing to use your account means you accept the changes. Questions: use the <Link href="/feedback" className="underline">Feedback page</Link>.</p>
      </section>
    </article>
  );
}
