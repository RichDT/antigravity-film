export default function Loading() {
  return (
    <div className="min-h-screen bg-background animate-pulse">
      {/* Header area */}
      <div className="pt-24 pb-6 px-6 md:px-10 border-b border-border bg-card/30">
        <div className="max-w-7xl mx-auto space-y-3">
          <div className="h-10 w-32 bg-muted rounded" />
          <div className="h-6 w-64 bg-muted/60 rounded" />
          <div className="h-4 w-48 bg-muted/40 rounded" />
        </div>
      </div>
      {/* Content */}
      <div className="px-6 md:px-10 py-8 max-w-7xl mx-auto space-y-6">
        <div className="h-6 w-40 bg-muted rounded" />
        <div className="grid gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 bg-card border border-border rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
