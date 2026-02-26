import { useState, useEffect, useRef } from "react";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  contract_id: string;
  rating_skills?: number | null;
  rating_quality?: number | null;
  rating_availability?: number | null;
  rating_deadlines?: number | null;
  rating_communication?: number | null;
  rating_cooperation?: number | null;
  reviewer?: { full_name: string | null; avatar_url: string | null } | null;
  // We'll need contract info for job title + amount
  contract?: { job_title: string | null; amount: number | null } | null;
}

function getPriceThreshold(amount: number | null | undefined): string {
  if (!amount) return "";
  if (amount >= 1000000) return "1M+";
  if (amount >= 500000) return "500K+";
  if (amount >= 200000) return "200K+";
  if (amount >= 100000) return "100K+";
  if (amount >= 50000) return "50K+";
  if (amount >= 30000) return "30K+";
  if (amount >= 20000) return "20K+";
  if (amount >= 10000) return "10K+";
  return "10K+";
}

const CATEGORY_LABELS = [
  { key: "rating_skills", label: "Skills" },
  { key: "rating_quality", label: "Work Quality" },
  { key: "rating_availability", label: "Availability" },
  { key: "rating_deadlines", label: "Deadlines" },
  { key: "rating_communication", label: "Communication" },
  { key: "rating_cooperation", label: "Cooperation" },
] as const;

function RatingBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 text-muted-foreground truncate">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${(value / 5) * 100}%` }}
        />
      </div>
      <span className="w-6 text-right font-medium text-foreground">{value}/5</span>
    </div>
  );
}

export function ReviewsCarousel({ reviews }: { reviews: Review[] }) {
  const [page, setPage] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const perPage = 3;
  const totalPages = Math.ceil(reviews.length / perPage);

  const startAutoScroll = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (totalPages <= 1) return;
    timerRef.current = setInterval(() => {
      setPage((p) => (p + 1) % totalPages);
    }, 6000);
  };

  useEffect(() => {
    startAutoScroll();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [totalPages]);

  const goTo = (p: number) => {
    setPage(p);
    startAutoScroll();
  };

  const currentReviews = reviews.slice(page * perPage, page * perPage + perPage);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {currentReviews.map((review) => {
          const reviewerName = (review.reviewer as any)?.full_name || "Client";
          const jobTitle = (review as any).contract?.job_title || "Project";
          const amount = (review as any).contract?.amount;
          const threshold = getPriceThreshold(amount);

          return (
            <div key={review.id} className="bg-muted/50 rounded-lg border border-border p-4 space-y-3">
              {/* Client name */}
              <p className="font-semibold text-foreground text-sm">{reviewerName}</p>
              
              {/* Job title + price threshold */}
              <p className="text-xs text-primary">
                {jobTitle} {threshold && <span className="text-muted-foreground">₦{threshold}</span>}
              </p>

              {/* Comment */}
              {review.comment && (
                <p className="text-sm text-muted-foreground line-clamp-3">{review.comment}</p>
              )}

              {/* Category bars */}
              <div className="space-y-1.5 pt-2 border-t border-border">
                {CATEGORY_LABELS.map((cat) => {
                  const val = (review as any)[cat.key];
                  if (!val) return null;
                  return <RatingBar key={cat.key} label={cat.label} value={val} />;
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => goTo((page - 1 + totalPages) % totalPages)}
            className="p-1.5 rounded-full border border-border hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex gap-1.5">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`w-2 h-2 rounded-full transition-colors ${i === page ? "bg-primary" : "bg-muted-foreground/30"}`}
              />
            ))}
          </div>
          <button
            onClick={() => goTo((page + 1) % totalPages)}
            className="p-1.5 rounded-full border border-border hover:bg-muted transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
