export function SkeletonTable({
  rows = 5,
  columns = 4,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="overflow-hidden rounded-card border border-[#ede8e8] bg-white">
      <div className="border-b border-[#ede8e8] bg-[#f9f7f7] px-4 py-3">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <div key={i} className="h-3 flex-1 animate-pulse rounded bg-gray-200" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-zinc-100">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 px-4 py-3.5">
            {Array.from({ length: columns }).map((_, c) => (
              <div key={c} className="h-3.5 flex-1 animate-pulse rounded bg-gray-200" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-card border border-[#ede8e8] bg-white p-6${className ? ` ${className}` : ""}`}
    >
      <div className="h-4 w-1/3 rounded bg-gray-200" />
      <div className="mt-3 h-3 w-2/3 rounded bg-gray-200" />
      <div className="mt-2 h-3 w-1/2 rounded bg-gray-200" />
    </div>
  );
}

export function SkeletonKPI() {
  return (
    <div className="animate-pulse rounded-card border border-[#ede8e8] bg-white p-5">
      <div className="h-3 w-20 rounded bg-gray-200" />
      <div className="mt-3 h-7 w-16 rounded bg-gray-200" />
      <div className="mt-2 h-2.5 w-24 rounded bg-gray-200" />
    </div>
  );
}
