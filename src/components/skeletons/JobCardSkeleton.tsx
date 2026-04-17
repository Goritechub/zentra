import { Skeleton } from "@/components/ui/skeleton";

export function JobCardSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-start justify-between gap-4">
            {/* Left: title, description, tags, meta */}
            <div className="flex-1 min-w-0 space-y-3">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              {/* Tags */}
              <div className="flex gap-1.5">
                {[80, 64, 72, 56, 60].map((w, j) => (
                  <Skeleton key={j} className="h-5 rounded-full" style={{ width: w }} />
                ))}
              </div>
              {/* Meta row */}
              <div className="flex gap-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
            </div>

            {/* Right: save + budget + button */}
            <div className="flex flex-col items-end gap-3 shrink-0">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
