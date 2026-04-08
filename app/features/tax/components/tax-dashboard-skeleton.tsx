function ShimmerBar({ className }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-md bg-muted ${className ?? ""}`}
    >
      <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/45 to-transparent dark:via-white/15" />
    </div>
  );
}

/**
 * Layout-matched placeholders to avoid CLS while tax calculation streams in.
 */
export default function TaxDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-4 pt-0">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex min-h-[220px] flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-sm">
          <ShimmerBar className="h-4 w-32" />
          <ShimmerBar className="mt-4 h-14 w-3/4 max-w-md" />
          <ShimmerBar className="mt-6 h-3 w-full max-w-sm" />
        </div>
        <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="relative size-44 rounded-full border-8 border-muted">
            <ShimmerBar className="absolute inset-2 rounded-full" />
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <ShimmerBar className="h-5 w-40" />
        <ShimmerBar className="mt-2 h-4 w-72 max-w-full" />
        <div className="mt-5 overflow-hidden rounded-lg border border-border/60 bg-background/60 p-3">
          <ShimmerBar className="h-[180px] w-full rounded-lg" />
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <ShimmerBar className="h-5 w-48" />
        <div className="mt-6 space-y-4">
          <ShimmerBar className="h-10 w-full" />
          <ShimmerBar className="h-10 w-full" />
          <ShimmerBar className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}
