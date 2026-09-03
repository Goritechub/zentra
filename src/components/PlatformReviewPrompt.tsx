import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getPlatformReviewEligibility, submitPlatformReview } from "@/api/profile.api";

const FIRST_PROMPT_THRESHOLD = 3;
const RE_PROMPT_INTERVAL = 2;

export function PlatformReviewPrompt({ forced = false, onForcedClose }: { forced?: boolean; onForcedClose?: () => void }) {
  const { user } = useAuth();
  const [show, setShow] = useState(forced);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);

  const checkEligibility = useCallback(async () => {
    if (!user) return;

    const dismissed = sessionStorage.getItem(`platform_review_dismissed_${user.id}`);
    if (dismissed) return;

    try {
      const { hasReviewed, completedContracts } = await getPlatformReviewEligibility();
      if (hasReviewed) return;

      const total = completedContracts;
      setCompletedCount(total);

      if (total >= FIRST_PROMPT_THRESHOLD) {
        const pastThreshold = total - FIRST_PROMPT_THRESHOLD;
        if (pastThreshold === 0 || pastThreshold % RE_PROMPT_INTERVAL === 0) {
          setShow(true);
        }
      }
    } catch {
      // silently skip — non-critical
    }
  }, [user]);

  useEffect(() => {
    if (forced) { setShow(true); return; }
    if (user) checkEligibility();
  }, [user, forced, checkEligibility]);

  const handleDismiss = () => {
    if (!forced && user) sessionStorage.setItem(`platform_review_dismissed_${user.id}`, "1");
    setShow(false);
    onForcedClose?.();
  };

  const handleNeverAsk = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await submitPlatformReview(0, "__never_ask__", completedCount);
    } catch {
      // best-effort
    }
    setShow(false);
    onForcedClose?.();
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!user || rating === 0) {
      toast.error("Please select a rating");
      return;
    }
    setLoading(true);
    try {
      await submitPlatformReview(rating, comment.trim() || null, completedCount);
      toast.success("Thank you for your feedback!");
      setShow(false);
      onForcedClose?.();
    } catch {
      toast.error("Failed to submit review");
    }
    setLoading(false);
  };

  if (!show) return null;

  return (
    <Dialog open={show} onOpenChange={(open) => { if (!open) handleDismiss(); }}>
      <DialogContent className="max-w-sm max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>How's your ZentraGig experience?</DialogTitle>
          <DialogDescription>
            You've completed {completedCount} contracts! We'd love to hear your thoughts.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center gap-2 py-4">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              className="focus:outline-none transition-transform hover:scale-110"
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(star)}
            >
              <Star
                className={`h-8 w-8 ${
                  star <= (hover || rating)
                    ? "fill-accent text-accent"
                    : "text-muted-foreground/30"
                }`}
              />
            </button>
          ))}
        </div>

        <Textarea
          placeholder="Tell us what you think (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
        />

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="link" size="sm" className="text-muted-foreground text-xs" onClick={handleNeverAsk} disabled={loading}>Never ask again</Button>
          <div className="flex gap-2 ml-auto">
            <Button variant="ghost" onClick={handleDismiss}>Maybe Later</Button>
            <Button onClick={handleSubmit} disabled={loading || rating === 0}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Star className="h-4 w-4 mr-2" />}
              Submit
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
