import { Skeleton } from "@/components/ui/skeleton";

export function BlogCardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card rounded-xl border border-border overflow-hidden">
          {/* Cover */}
          <Skeleton className="h-40 w-full rounded-none" />

          {/* Content */}
          <div className="p-4 space-y-3">
            {/* Tags */}
            <div className="flex gap-1">
              <Skeleton className="h-4 w-12 rounded-full" />
              <Skeleton className="h-4 w-16 rounded-full" />
            </div>

            {/* Title */}
            <Skeleton className="h-4 w-3/4" />

            {/* Description */}
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />

            {/* Author row */}
            <div className="flex items-center gap-2 pt-1">
              <Skeleton className="h-6 w-6 rounded-full shrink-0" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-12 ml-auto" />
            </div>

            {/* Actions row */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <Skeleton className="h-4 w-10" />
              <div className="flex gap-1">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-6 w-6 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
