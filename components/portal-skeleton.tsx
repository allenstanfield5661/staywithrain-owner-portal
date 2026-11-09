export function PortalSkeleton() {
  return (
    <div className="min-h-screen bg-background" aria-busy="true" aria-live="polite">
      <div className="h-28 bg-sea" />
      <div className="h-1 bg-brass" />
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-8 sm:px-6">
        <p className="text-sm text-muted-foreground">Loading the calendar…</p>
        <div className="h-8 w-56 animate-pulse rounded-full bg-muted" />
        <div className="h-12 w-72 max-w-full animate-pulse rounded-lg bg-muted" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-36 animate-pulse rounded-xl bg-card ring-1 ring-foreground/10" />
          <div className="h-36 animate-pulse rounded-xl bg-card ring-1 ring-foreground/10" />
        </div>
        <div className="h-80 animate-pulse rounded-xl bg-card ring-1 ring-foreground/10" />
      </div>
    </div>
  );
}
