import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Privacy Policy · Rich Picks' };

const UPDATED = 'October 22, 2026';

export default function PrivacyPage() {
  return (
    <article className="max-w-2xl mx-auto px-4 pt-12 pb-16 text-sm leading-relaxed text-foreground/90 space-y-5">
      <header>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground">Privacy Policy</h1>
        <p className="mt-1 text-xs text-muted-foreground">Last updated {UPDATED}</p>
      </header>

      <p>Rich Picks is a personal film-criticism site. You can browse everything without an account. If you sign in, this page explains what we collect, why, and what you can do about it.</p>

      <section className="space-y-2">
        <h2 className="font-serif text-lg font-semibold text-foreground">What we collect</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Account details:</strong> your email address, and your name and profile picture if you sign in with Google (we use only your email).</li>
          <li><strong>Your public handle</strong>, which you choose.</li>
          <li><strong>What you do on the site:</strong> films you mark “Want to see” or “Seen it”, grades you give, award picks, and short takes you post.</li>
          <li><strong>Basic technical data</strong> our hosting providers log automatically, such as IP address and browser type, for security and to keep the site running.</li>
        </ul>
        <p>We don’t sell your data, run third-party advertising, or use your data to profile you for marketing.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-serif text-lg font-semibold text-foreground">What’s public</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Your <strong>handle</strong> and the <strong>takes</strong> you post.</li>
          <li>Your <strong>want-to-see list</strong>, at <code>/list/your-handle</code>, so you can share it with anyone.</li>
          <li><strong>Totals only</strong> for everything else: how many people want to see a film, and the community’s median grade. Your individual grades and picks are not shown publicly.</li>
        </ul>
        <p>Your email address is never shown publicly.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-serif text-lg font-semibold text-foreground">Who processes it</h2>
        <p>Your data is stored with <strong>Supabase</strong> (database and sign-in) and the site is hosted by <strong>Vercel</strong>. If you choose Google sign-in, <strong>Google</strong> confirms who you are. When you sign in by email, <strong>Cloudflare Turnstile</strong> checks that you’re a person, not a bot. These providers handle data on our behalf under their own privacy commitments.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-serif text-lg font-semibold text-foreground">Your choices and rights</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Download your data</strong> any time from <Link href="/account" className="underline">your account page</Link>.</li>
          <li><strong>Change your handle</strong> or delete individual takes.</li>
          <li><strong>Delete your account</strong> from your account page. This permanently removes your account and everything tied to it.</li>
        </ul>
        <p>If you live in California or elsewhere with privacy laws, you have the right to know, access, correct and delete your personal information, and we won’t treat you differently for using those rights. We don’t sell or share personal information as those laws define it.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-serif text-lg font-semibold text-foreground">Cookies</h2>
        <p>We use only the cookies needed to keep you signed in. Some preferences, like which board sections are open, are remembered in your own browser.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-serif text-lg font-semibold text-foreground">Children</h2>
        <p>Accounts are for people 13 and older. If you believe a child under 13 has signed up, let us know and we’ll delete the account.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-serif text-lg font-semibold text-foreground">Changes and contact</h2>
        <p>If this policy changes, we’ll update the date above. Questions or requests: use the <Link href="/feedback" className="underline">Feedback page</Link>.</p>
      </section>
    </article>
  );
}
