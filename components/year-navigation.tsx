import Link from "next/link";
import { ChevronLeft, ChevronRight, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface YearNavigationProps {
  currentYear: number;
  prevYear: number | null;
  nextYear: number | null;
}

export function YearNavigation({ currentYear, prevYear, nextYear }: YearNavigationProps) {
  return (
    <div className="flex items-center justify-center gap-4 mb-4">
      {prevYear ? (
        <Link href={`/year/${prevYear}`}>
          <Button variant="ghost" size="sm" className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{prevYear}</span>
          </Button>
        </Link>
      ) : (
        <Button variant="ghost" size="sm" disabled className="gap-1 opacity-30">
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}

      <Link href="/">
        <Button variant="outline" size="sm" className="gap-2">
          <Home className="h-4 w-4" />
          <span className="hidden sm:inline">All Years</span>
        </Button>
      </Link>

      {nextYear ? (
        <Link href={`/year/${nextYear}`}>
          <Button variant="ghost" size="sm" className="gap-1">
            <span className="hidden sm:inline">{nextYear}</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      ) : (
        <Button variant="ghost" size="sm" disabled className="gap-1 opacity-30">
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
