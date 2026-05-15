"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Film, Award, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/", label: "Years", icon: Calendar },
  { href: "/categories", label: "Categories", icon: Award },
  { href: "/search", label: "Search", icon: Search },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between px-4">
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
        <nav className="flex items-center gap-1">
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
                    "gap-2 transition-all",
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
      </div>
    </header>
  );
}
