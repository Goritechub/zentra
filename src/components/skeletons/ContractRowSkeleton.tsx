import { Skeleton } from "@/components/ui/skeleton";

export function ContractRowSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full shrink-0" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
            <div className="space-y-2 text-right">
              <Skeleton className="h-5 w-24 ml-auto" />
              <Skeleton className="h-5 w-20 ml-auto" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
