export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-slate-200/80 dark:bg-slate-800/70" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="h-36 rounded-2xl bg-slate-200/80 dark:bg-slate-800/70" />
      ))}
    </div>
  );
}
