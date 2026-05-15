export default function Loading() {
  return (
    <div className="min-h-screen bg-background animate-pulse">
      <div className="pt-24 pb-6 px-6 md:px-10 border-b border-border bg-card/30">
        <div className="max-w-7xl mx-auto flex gap-6 items-start">
          <div className="w-32 h-48 bg-muted rounded-lg shrink-0" />
          <div className="flex-1 space-y-3 pt-2">
            <div className="h-8 w-72 bg-muted rounded" />
            <div className="h-4 w-40 bg-muted/60 rounded" />
            <div className="h-4 w-56 bg-muted/40 rounded" />
          </div>
        </div>
      </div>
      <div className="px-6 md:px-10 py-8 max-w-7xl mx-auto space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 bg-card border border-border rounded-lg" />
        ))}
      </div>
    </div>
  );
}
