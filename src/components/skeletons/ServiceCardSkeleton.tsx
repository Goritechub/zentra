import { Skeleton } from "@/components/ui/skeleton";

export function ServiceCardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card rounded-xl border border-border p-5 flex flex-col">
          {/* Expert header */}
          <div className="flex items-center gap-2.5 mb-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <Skeleton className="h-4 w-28" />
          </div>

          {/* Title + description */}
          <Skeleton className="h-4 w-3/4 mb-1.5" />
          <Skeleton className="h-3 w-full mb-1" />
          <Skeleton className="h-3 w-5/6 mb-3" />

          {/* Rating */}
          <Skeleton className="h-3 w-20 mb-3" />

          {/* Price footer */}
          <div className="flex items-center justify-between mt-auto pt-3 border-t border-border">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}
