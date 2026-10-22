"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, Film, Award, Calendar, LockOpen, LogOut, HelpCircle, MessageSquare, LogIn, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStatus } from "@/lib/use-auth-status";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/", label: "Years", icon: Calendar },
  { href: "/categories", label: "Categories", icon: Award },
  { href: "/search", label: "Search", icon: Search },
  { href: "/faq", label: "FAQ", icon: HelpCircle },
  { href: "/feedback", label: "Feedback", icon: MessageSquare },
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { signedIn, isAdmin, handle } = useAuthStatus();

  async function handleSignOut() {
    await createClient().auth.signOut();
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between px-4 max-sm:px-3">
        {/* Logo */}
        <Link 
          href="/" 
          className="flex items-center gap-2 transition-colors hover:opacity-80"
        >
          <Film className="h-6 w-6 text-primary" />
          <span className="font-serif text-xl font-bold tracking-tight">
            Rich Picks
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1 max-sm:gap-0">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = href === "/" 
              ? pathname === "/" 
              : pathname.startsWith(href);
            
            return (
              <Link key={href} href={href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "gap-2 transition-all max-sm:h-11 max-sm:min-w-11",
                    isActive && "text-primary"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </Button>
              </Link>
            );
          })}
        </nav>

          {/* Account: "Sign in" for visitors; @handle (+ Admin for the admin) when signed in */}
          <div className="ml-2 pl-2 max-sm:ml-1 max-sm:pl-1 border-l border-border/40 flex items-center gap-1 max-sm:gap-0">
            {isAdmin && (
              <Link href="/admin/add-review">
                <Button variant={pathname.startsWith('/admin') ? 'secondary' : 'ghost'} size="sm"
                  className="gap-2 transition-all max-sm:h-11 max-sm:min-w-11 text-accent hover:text-accent" title="Admin tools">
                  <LockOpen className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline text-xs">Admin</span>
                </Button>
              </Link>
            )}
            {signedIn ? (
              <Link href="/account">
                <Button variant={pathname === '/account' ? 'secondary' : 'ghost'} size="sm"
                  className="gap-2 transition-all max-sm:h-11 max-sm:min-w-11 text-muted-foreground hover:text-foreground" title="Your account">
                  <UserRound className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline text-xs max-w-[10rem] truncate">{handle ? `@${handle}` : 'Account'}</span>
                </Button>
              </Link>
            ) : (
              <Link href={`/signin?next=${encodeURIComponent(pathname)}`}>
                <Button variant={pathname === '/signin' ? 'secondary' : 'ghost'} size="sm"
                  className="gap-2 transition-all max-sm:h-11 max-sm:min-w-11 text-muted-foreground hover:text-foreground" title="Sign in">
                  <LogIn className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline text-xs">Sign in</span>
                </Button>
              </Link>
            )}
            {signedIn && (
              <Button variant="ghost" size="sm" onClick={handleSignOut}
                className="hidden sm:inline-flex gap-1.5 text-muted-foreground/70 hover:text-foreground" title="Log out">
                <LogOut className="h-3.5 w-3.5" />
                <span className="text-xs">Log out</span>
              </Button>
            )}
          </div>
      </div>
    </header>
  );
}
