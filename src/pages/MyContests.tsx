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
import { useCurrency } from "@/hooks/useCurrency";
import { isPast, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Loader2, Trophy, ArrowLeft, PlusCircle, Users, Calendar, XCircle,
  Clock, AlertCircle, Edit2,
} from "lucide-react";
import type { ContestSummary } from "@/types/client";
import { EmptyState } from "@/components/EmptyState";

const CANCELLATION_REASONS = [
  { value: "insufficient_entries", label: "Not enough entries received" },
  { value: "low_quality_entries", label: "Entry quality did not meet expectations" },
  { value: "project_cancelled", label: "The underlying project was cancelled" },
  { value: "budget_constraints", label: "Budget constraints" },
  { value: "timeline_change", label: "Project timeline changed" },
  { value: "other", label: "Other (please specify)" },
];

type SpecialStatus = "pending_review" | "rejected" | "cancelled" | "cancellation_requested";

function getSpecialStatus(contest: ContestSummary): SpecialStatus | null {
  if (contest.status === "pending_review") return "pending_review";
  if (contest.status === "rejected") return "rejected";
  if (contest.status === "cancelled") return "cancelled";
  if (contest.status === "cancellation_requested") return "cancellation_requested";
  return null;
}

function deriveContestStatus(contest: ContestSummary, winnersCount: number): "active" | "selecting_winners" | "completed" {
  if (winnersCount > 0 || contest.status === "ended" || contest.status === "completed") return "completed";
  if (contest.status === "selecting_winners" || isPast(new Date(contest.deadline))) return "selecting_winners";
  return "active";
}

function StatusBadge({ contest }: { contest: ContestSummary }) {
  const special = getSpecialStatus(contest);
  if (special === "pending_review") return <Badge variant="outline" className="border-warning text-warning"><Clock className="h-3 w-3 mr-1" />Under Review</Badge>;
  if (special === "rejected") return <Badge variant="destructive">Rejected</Badge>;
  if (special === "cancelled") return <Badge variant="secondary">Cancelled</Badge>;
  if (special === "cancellation_requested") return <Badge variant="outline" className="border-error text-error"><AlertCircle className="h-3 w-3 mr-1" />Cancellation Requested</Badge>;

  const derived = deriveContestStatus(contest, contest._winnersCount || 0);
  if (derived === "completed") return <Badge variant="secondary">Completed</Badge>;
  if (derived === "selecting_winners") return <Badge variant="outline">Selecting Winners</Badge>;
  return <Badge variant="default">Active</Badge>;
}

export default function MyContestsPage() {
  const { format } = useCurrency();
  const { user, bootstrapStatus } = useAuth();
  const navigate = useNavigate();
  const [contests, setContests] = useState<ContestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<ContestSummary | null>(null);
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
      const res = await cancelContest(cancelTarget.id, body);
      if (res?.data?.requested) {
        toast.success("Cancellation request submitted. An admin will review it shortly.");
      } else {
        toast.success("Contest cancelled. Prize pool has been refunded to your wallet.");
      }
      setCancelTarget(null);
      setCancelReason("");
      setCancelNote("");
      void fetchContests();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel contest");
    } finally {
      setCancelling(false);
    }
  };

  const totalPrize = (c: ContestSummary) =>
    (c.prize_first || 0) + (c.prize_second || 0) + (c.prize_third || 0) + (c.prize_fourth || 0) + (c.prize_fifth || 0);

  if (!user || bootstrapStatus !== "ready") {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-wide">

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
            <EmptyState
              variant="trophy"
              title="You haven't launched any contests yet"
              action={<Button asChild><Link to="/launch-contest">Launch Your First Contest</Link></Button>}
            />
          ) : (
            <div className="space-y-4">
              {contests.map((contest) => {
                const special = getSpecialStatus(contest);
                const isActive = !special && !isPast(new Date(contest.deadline));
                // Cancellable: active contests or pending_review contests
                const canCancel = (special === null && isActive) || special === "pending_review";
                // Editable: pending_review or rejected (not yet live)
                const canEdit = special === "pending_review" || special === "rejected";

                return (
                  <div
                    key={contest.id}
                    className={`bg-card rounded-xl border p-6 ${special === "rejected" ? "border-destructive/40" : special === "pending_review" ? "border-warning/40" : "border-border"}`}
                  >
                    <div className="flex items-start justify-between">
                      <Link to={`/contest/${contest.id}`} className="flex-1 min-w-0 group">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors">{contest.title}</h3>
                          <StatusBadge contest={contest} />
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{contest.description}</p>

                        {/* Rejection message */}
                        {special === "rejected" && contest.review_message && (
                          <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                            <span className="font-medium">Rejection reason:</span> {contest.review_message}
                          </div>
                        )}

                        {/* Pending review info */}
                        {special === "pending_review" && (
                          <p className="mt-2 text-xs text-warning">
                            Awaiting admin approval before going live.
                          </p>
                        )}

                        {/* Cancellation requested info */}
                        {special === "cancellation_requested" && (
                          <p className="mt-2 text-xs text-error">
                            Your cancellation request is being reviewed by an admin.
                          </p>
                        )}

                        <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" /> {contest._entryCount || 0} entries
                          </span>
                          {isActive && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {formatDistanceToNow(new Date(contest.deadline))} left
                            </span>
                          )}
                        </div>
                      </Link>

                      <div className="flex flex-col items-end gap-2 ml-4 shrink-0">
                        <p className="text-xl font-bold text-primary">{format(totalPrize(contest))}</p>
                        {canEdit && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={(e) => { e.preventDefault(); navigate(`/contest/${contest.id}/edit`); }}
                          >
                            <Edit2 className="h-3.5 w-3.5 mr-1" />
                            {special === "rejected" ? "Edit & Resubmit" : "Edit"}
                          </Button>
                        )}
                        {canCancel && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
                            onClick={(e) => { e.preventDefault(); setCancelTarget(contest); }}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" /> Cancel Contest
                          </Button>
                        )}
                        {special === "cancellation_requested" && (
                          <Badge variant="outline" className="text-xs text-error border-error/40 flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Pending Approval
                          </Badge>
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

      {/* Cancel dialog */}
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
                  <span className="font-medium text-foreground">{format(cancelTarget ? totalPrize(cancelTarget) : 0)}</span>{" "}
                  will be refunded to your wallet.
                </p>
                {hasEntries ? (
                  <p className="mt-2 text-warning text-sm">
                    This contest has {cancelTarget._entryCount} entr{cancelTarget._entryCount !== 1 ? "ies" : "y"}. Your cancellation request will be reviewed by an admin before taking effect.
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    This contest has no entries, so it will be cancelled immediately.
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
              {requiresReason ? "Submit Request" : "Cancel Contest"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
