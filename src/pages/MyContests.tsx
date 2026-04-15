import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { getMyContestsList, cancelContest } from "@/api/client-read.api";
import { formatNaira } from "@/lib/nigerian-data";
import { isPast, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Loader2, Trophy, ArrowLeft, PlusCircle, Users, Calendar, XCircle } from "lucide-react";

const CANCELLATION_REASONS = [
  { value: "insufficient_entries", label: "Not enough entries received" },
  { value: "low_quality_entries", label: "Entry quality did not meet expectations" },
  { value: "project_cancelled", label: "The underlying project was cancelled" },
  { value: "budget_constraints", label: "Budget constraints" },
  { value: "timeline_change", label: "Project timeline changed" },
  { value: "other", label: "Other (please specify)" },
];

// Canonical status derivation — mirrors ContestDetail.tsx
function deriveContestStatus(contest: any, winnersCount: number): "active" | "selecting_winners" | "completed" {
  if (winnersCount > 0 || contest.status === "ended" || contest.status === "completed") return "completed";
  if (contest.status === "selecting_winners" || isPast(new Date(contest.deadline))) return "selecting_winners";
  return "active";
}

function statusLabel(s: ReturnType<typeof deriveContestStatus>) {
  if (s === "completed") return "Completed";
  if (s === "selecting_winners") return "Selecting Winners";
  return "Active";
}

function statusVariant(s: ReturnType<typeof deriveContestStatus>): "default" | "secondary" | "outline" {
  if (s === "completed") return "secondary";
  if (s === "selecting_winners") return "outline";
  return "default";
}

export default function MyContestsPage() {
  const { user, bootstrapStatus, authError } = useAuth();
  const navigate = useNavigate();
  const [contests, setContests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelNote, setCancelNote] = useState("");

  useEffect(() => {
    if (bootstrapStatus === "ready" && user) {
      void fetchContests();
    }
  }, [bootstrapStatus, user]);

  const fetchContests = async () => {
    setLoading(true);
    try {
      const response = await getMyContestsList();
      setContests(response.data.contests || []);
    } catch {
      setContests([]);
    } finally {
      setLoading(false);
    }
  };

  const hasEntries = (cancelTarget?._entryCount || 0) > 0;
  const requiresReason = hasEntries;
  const canSubmitCancel = !requiresReason || (cancelReason && (cancelReason !== "other" || cancelNote.trim().length > 0));

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const body = requiresReason
        ? { reason: cancelReason, note: cancelReason === "other" ? cancelNote.trim() : undefined }
        : undefined;
      await cancelContest(cancelTarget.id, body);
      toast.success("Contest cancelled. Prize pool has been refunded to your wallet.");
      setCancelTarget(null);
      setCancelReason("");
      setCancelNote("");
      void fetchContests();
    } catch (err: any) {
      toast.error(err?.message || "Failed to cancel contest");
    } finally {
      setCancelling(false);
    }
  };

  // All five prize tiers
  const totalPrize = (c: any) =>
    (c.prize_first || 0) + (c.prize_second || 0) + (c.prize_third || 0) + (c.prize_fourth || 0) + (c.prize_fifth || 0);

  if (!user || bootstrapStatus !== "ready") {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-wide">
          {authError && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              {authError}
            </div>
          )}
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Trophy className="h-8 w-8 text-primary" /> My Contests
            </h1>
            <Button asChild>
              <Link to="/launch-contest">
                <PlusCircle className="h-4 w-4 mr-2" /> Launch Contest
              </Link>
            </Button>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((item) => (
                <div key={item} className="bg-card rounded-xl border border-border p-6">
                  <div className="h-5 w-1/2 rounded bg-muted animate-pulse mb-2" />
                  <div className="h-4 w-2/3 rounded bg-muted/70 animate-pulse mb-3" />
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
              ))}
            </div>
          ) : contests.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>You haven't launched any contests yet</p>
              <Button className="mt-4" asChild>
                <Link to="/launch-contest">Launch Your First Contest</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {contests.map((contest: any) => {
                const derived = deriveContestStatus(contest, contest._winnersCount || 0);
                const label = statusLabel(derived);
                const variant = statusVariant(derived);

                return (
                  <div key={contest.id} className="bg-card rounded-xl border border-border p-6">
                    <div className="flex items-start justify-between">
                      <Link to={`/contest/${contest.id}`} className="flex-1 min-w-0 group">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors">{contest.title}</h3>
                          <Badge variant={variant}>{label}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{contest.description}</p>
                        <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" /> {contest._entryCount || 0} entries
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {derived === "active" ? `${formatDistanceToNow(new Date(contest.deadline))} left` : label}
                          </span>
                        </div>
                      </Link>
                      <div className="flex flex-col items-end gap-2 ml-4 shrink-0">
                        <p className="text-xl font-bold text-primary">{formatNaira(totalPrize(contest))}</p>
                        {derived === "active" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
                            onClick={() => setCancelTarget(contest)}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" /> Cancel Contest
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />

      <Dialog open={!!cancelTarget} onOpenChange={(open) => { if (!open) { setCancelTarget(null); setCancelReason(""); setCancelNote(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Contest</DialogTitle>
            <DialogDescription asChild>
              <div>
                <p>
                  Are you sure you want to cancel{" "}
                  <span className="font-medium text-foreground">"{cancelTarget?.title}"</span>?
                  The full prize pool of{" "}
                  <span className="font-medium text-foreground">{formatNaira(cancelTarget ? totalPrize(cancelTarget) : 0)}</span>{" "}
                  will be refunded to your wallet.
                </p>
                {hasEntries && (
                  <p className="mt-2 text-amber-600 dark:text-amber-400 text-sm">
                    {cancelTarget._entryCount} entrant{cancelTarget._entryCount !== 1 ? "s" : ""} will be notified of the cancellation.
                  </p>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>

          {requiresReason && (
            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="cancel-reason">Reason for cancellation <span className="text-destructive">*</span></Label>
                <Select value={cancelReason} onValueChange={setCancelReason}>
                  <SelectTrigger id="cancel-reason">
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {CANCELLATION_REASONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {cancelReason === "other" && (
                <div className="space-y-1.5">
                  <Label htmlFor="cancel-note">Please explain <span className="text-destructive">*</span></Label>
                  <Textarea
                    id="cancel-note"
                    placeholder="Describe your reason for cancelling..."
                    value={cancelNote}
                    onChange={(e) => setCancelNote(e.target.value.slice(0, 300))}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground text-right">{cancelNote.length}/300</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setCancelTarget(null); setCancelReason(""); setCancelNote(""); }} disabled={cancelling}>
              Keep Contest
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling || !canSubmitCancel}>
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
              Cancel Contest
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
