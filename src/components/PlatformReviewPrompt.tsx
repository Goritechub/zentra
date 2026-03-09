import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2 } from "lucide-react";
import { toast } from "sonner";

const FIRST_PROMPT_THRESHOLD = 3;
const RE_PROMPT_INTERVAL = 2;

export function PlatformReviewPrompt() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    if (user) checkEligibility();
  }, [user]);

  const checkEligibility = async () => {
    if (!user) return;

    // Check if user already left a platform review
    const { data: existing } = await supabase
      .from("platform_reviews")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) return; // Already reviewed, never prompt again

    // Check if user dismissed this session
    const dismissed = sessionStorage.getItem(`platform_review_dismissed_${user.id}`);
    if (dismissed) return;

    // Count completed contracts
    const { count } = await supabase
      .from("contracts")
      .select("id", { count: "exact", head: true })
      .or(`client_id.eq.${user.id},freelancer_id.eq.${user.id}`)
      .eq("status", "completed");

    const total = count || 0;
    setCompletedCount(total);

    // First prompt at 3, then every 2 more (5, 7, 9...)
    if (total >= FIRST_PROMPT_THRESHOLD) {
      const pastThreshold = total - FIRST_PROMPT_THRESHOLD;
      if (pastThreshold === 0 || pastThreshold % RE_PROMPT_INTERVAL === 0) {
        setShow(true);
      }
    }
  };

  const handleDismiss = () => {
    if (user) sessionStorage.setItem(`platform_review_dismissed_${user.id}`, "1");
    setShow(false);
  };

  const handleSubmit = async () => {
    if (!user || rating === 0) {
      toast.error("Please select a rating");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("platform_reviews").insert({
      user_id: user.id,
      rating,
      comment: comment.trim() || null,
      contracts_at_review: completedCount,
    } as any);

    if (error) {
      toast.error("Failed to submit review");
    } else {
      toast.success("Thank you for your feedback!");
      setShow(false);
    }
    setLoading(false);
  };

  if (!show) return null;

  return (
    <Dialog open={show} onOpenChange={(open) => { if (!open) handleDismiss(); }}>
      <DialogContent className="max-w-sm">
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
          <Button variant="link" size="sm" className="text-muted-foreground text-xs" onClick={handleNeverAsk}>Never ask again</Button>
          <div className="flex gap-2 ml-auto">
            <Button variant="ghost" onClick={handleDismiss}>Maybe Later</Button>
          <Button onClick={handleSubmit} disabled={loading || rating === 0}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Star className="h-4 w-4 mr-2" />}
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
