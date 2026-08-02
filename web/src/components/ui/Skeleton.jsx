/** Loading placeholder — skeletons over spinners for content (design rule). */
export function Skeleton({ className = 'h-4 w-full' }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-ink-200 motion-reduce:animate-none ${className}`}
    />
  );
}

/** A block of table-ish skeleton rows. */
export function SkeletonRows({ rows = 5 }) {
  return (
    <div className="space-y-3 p-4" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-3.5 w-16" />
        </div>
      ))}
    </div>
  );
}
