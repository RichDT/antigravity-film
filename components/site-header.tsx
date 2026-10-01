"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, Film, Award, Calendar, Lock, LockOpen, LogOut, HelpCircle, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
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
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setIsAdmin(!!data.session?.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setIsAdmin(!!session?.user));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    await createClient().auth.signOut();
    setIsAdmin(false);
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

          {/* Admin */}
          <div className="ml-2 pl-2 max-sm:ml-1 max-sm:pl-1 border-l border-border/40 flex items-center gap-1 max-sm:gap-0">
            <Link href={isAdmin ? "/admin/add-review" : "/admin/login"}>
              <Button
                variant={pathname.startsWith('/admin') ? 'secondary' : 'ghost'}
                size="sm"
                className={cn(
                  "gap-2 transition-all max-sm:h-11 max-sm:min-w-11",
                  isAdmin ? "text-accent hover:text-accent" : "text-muted-foreground/60 hover:text-foreground",
                  pathname.startsWith('/admin') && "text-primary"
                )}
                title={isAdmin ? "Signed in as admin — open admin tools" : "Admin log-in"}
              >
                {isAdmin ? <LockOpen className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline text-xs">{isAdmin ? "Admin" : "Admin. Log-in"}</span>
              </Button>
            </Link>
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="gap-1.5 text-muted-foreground/70 hover:text-foreground max-sm:h-11 max-sm:min-w-11"
                title="Log out of admin"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline text-xs">Log out</span>
              </Button>
            )}
          </div>
      </div>
    </header>
  );
}
