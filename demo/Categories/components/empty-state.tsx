import Link from "next/link";
import { Film } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-secondary p-4 mb-4">
        <Film className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="font-serif text-xl font-semibold text-foreground">
        {title}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">
        {description}
      </p>
      {actionLabel && actionHref && (
        <Link href={actionHref} className="mt-4">
          <Button variant="outline" className="gap-2">
            {actionLabel}
          </Button>
        </Link>
      )}
    </div>
  );
}
