import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import {
  cancelClientJob,
  createClientJobDispute,
  deleteClientJob,
  getClientJobCancelState,
  getClientJobs,
} from "@/api/jobs.api";
import { useCurrency } from "@/hooks/useCurrency";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { PlusCircle, Loader2, ArrowRight, ArrowLeft, XCircle, Trash2, Eye } from "lucide-react";
import type { DashboardJob } from "@/types/dashboard";
import { EmptyState } from "@/components/EmptyState";

interface JobWithCounts extends DashboardJob {
  _proposalCount?: number;
  _invitedCount?: number;
  _interviewingCount?: number;
  _viewCount?: number;
}

export default function ClientJobsPage() {
  const { format } = useCurrency();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; job: JobWithCounts | null; hasAssignment: boolean }>({
    open: false, job: null, hasAssignment: false,
  });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; job: JobWithCounts | null }>({
    open: false, job: null,
  });
  const [disputeReason, setDisputeReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const jobsQuery = useQuery({
    queryKey: ["client-jobs", user?.id],
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    queryFn: async (): Promise<JobWithCounts[]> => getClientJobs(),
  });

  const jobs = jobsQuery.data || [];

  const filterByStatus = (status: string) => {
    if (status === "all") return jobs;
    return jobs.filter(j => j.status === status);
  };

  const handleCancelClick = async (job: JobWithCounts) => {
    try {
      const data = await getClientJobCancelState(job.id);
      setCancelDialog({ open: true, job, hasAssignment: !!data.hasAssignment });
      setDisputeReason("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to check job state");
    }
  };

  const handleDeleteClick = (job: JobWithCounts) => {
    setDeleteDialog({ open: true, job });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.job) return;
    setDeleting(true);

    try {
      const data = await deleteClientJob(deleteDialog.job.id);
      toast.success(`Job deleted. ${data.notified} applicant(s) notified.`);
      queryClient.invalidateQueries({ queryKey: ["client-jobs", user?.id] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete job. Please try again.");
    }

    setDeleting(false);
    setDeleteDialog({ open: false, job: null });
  };

  const handleSimpleCancel = async () => {
    if (!cancelDialog.job) return;
    setCancelling(true);
    try {
      await cancelClientJob(cancelDialog.job.id);
      toast.success("Job cancelled successfully");
      queryClient.invalidateQueries({ queryKey: ["client-jobs", user?.id] });
    } catch (error) {
      toast.error("Failed to cancel job");
    }
    setCancelling(false);
    setCancelDialog({ open: false, job: null, hasAssignment: false });
  };

  const handleDisputeSubmit = async () => {
    if (!cancelDialog.job || !disputeReason.trim()) return;
    setCancelling(true);

    try {
      await createClientJobDispute(cancelDialog.job.id, disputeReason.trim());
      toast.success("Dispute submitted. An admin will review it shortly.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to open dispute");
    }

    setCancelling(false);
    setCancelDialog({ open: false, job: null, hasAssignment: false });
  };

  const canDeleteJob = (job: JobWithCounts) => {
    return job.status === "open" || job.status === "cancelled";
  };

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-4 sm:py-8">
        <div className="container-wide">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-4 sm:mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>

          <div className="flex items-center justify-between mb-4 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">My Jobs</h1>
            <Button asChild size="sm">
              <Link to="/post-job">
                <PlusCircle className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Post New Job</span>
              </Link>
            </Button>
          </div>
          {jobsQuery.isFetching && (
            <p className="text-sm text-muted-foreground mb-4">Refreshing jobs...</p>
          )}

          <Tabs defaultValue="all">
            <TabsList className="mb-6 w-full flex-wrap h-auto gap-1">
              <TabsTrigger value="all" className="flex-1">All ({jobs.length})</TabsTrigger>
              <TabsTrigger value="open" className="flex-1">Open ({filterByStatus("open").length})</TabsTrigger>
              <TabsTrigger value="in_progress" className="flex-1">Ongoing ({filterByStatus("in_progress").length})</TabsTrigger>
              <TabsTrigger value="completed" className="flex-1">Completed ({filterByStatus("completed").length})</TabsTrigger>
              <TabsTrigger value="cancelled" className="flex-1">Closed ({filterByStatus("cancelled").length})</TabsTrigger>
            </TabsList>

            {["all", "open", "in_progress", "completed", "cancelled"].map(status => (
              <TabsContent key={status} value={status}>
                {jobsQuery.isPending && !jobsQuery.data ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((item) => (
                      <div key={item} className="rounded-xl border border-border bg-card p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="h-4 w-16 rounded bg-muted animate-pulse" />
                            <div className="h-5 w-48 rounded bg-muted/80 animate-pulse" />
                            <div className="h-3 w-64 rounded bg-muted/70 animate-pulse" />
                          </div>
                          <div className="space-y-2">
                            <div className="h-5 w-24 rounded bg-muted animate-pulse" />
                            <div className="h-8 w-20 rounded bg-muted/70 animate-pulse" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filterByStatus(status).length === 0 ? (
                  <EmptyState
                    variant="search"
                    title={status === "all" ? "No jobs found" : `No ${status.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")} jobs found`}
                  />
                ) : (
                  <div className="space-y-3">
                    {filterByStatus(status).map(job => (
                      <div key={job.id} className={`bg-card rounded-xl border border-border p-4 sm:p-5 transition-shadow hover:shadow-sm ${job.status === "completed" ? "opacity-60" : ""}`}>
                        <Link to={`/job/${job.id}`} className="block">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Badge variant={job.status === "open" ? "default" : "secondary"} className="text-xs">{job.status.split("_").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}</Badge>
                          </div>
                          <h3 className="text-base sm:text-lg font-semibold text-foreground leading-snug">{job.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{job.description}</p>
                          <p className="text-xs text-muted-foreground mt-1.5">
                            Posted {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                          </p>
                        </Link>

                        {/* Stats row */}
                        <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-border">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Eye className="h-3.5 w-3.5" /> {job._viewCount || 0} view{(job._viewCount || 0) !== 1 ? "s" : ""}
                          </span>
                          <button
                            type="button"
                            onClick={() => navigate("/dashboard/proposals")}
                            className="text-xs text-muted-foreground hover:text-primary transition-colors underline-offset-2 hover:underline"
                          >
                            {job._proposalCount || 0} proposal{(job._proposalCount || 0) !== 1 ? "s" : ""}
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate("/dashboard/sent-offers")}
                            className="text-xs text-muted-foreground hover:text-primary transition-colors underline-offset-2 hover:underline"
                          >
                            {job._invitedCount || 0} invited
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate("/dashboard/proposals?tab=interviewing")}
                            className="text-xs text-muted-foreground hover:text-primary transition-colors underline-offset-2 hover:underline"
                          >
                            {job._interviewingCount || 0} interviewing
                          </button>
                        </div>

                        {/* Bottom bar: budget + actions */}
                        <div className="flex items-center justify-between pt-3 mt-1">
                          <p className="text-base font-bold text-primary">
                            {(job.budget_min || job.budget_max)
                              ? format(job.budget_max || job.budget_min || 0)
                              : <span className="text-sm text-muted-foreground font-normal">No budget set</span>}
                          </p>
                          <div className="flex items-center gap-2">
                            {job.status !== "cancelled" && job.status !== "completed" && job.status !== "in_progress" && (
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-8 px-2.5"
                                onClick={(e) => { e.preventDefault(); handleCancelClick(job); }}
                              >
                                <XCircle className="h-3.5 w-3.5 sm:mr-1" />
                                <span className="hidden sm:inline">Cancel</span>
                              </Button>
                            )}
                            {canDeleteJob(job) && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                                onClick={(e) => { e.preventDefault(); handleDeleteClick(job); }}
                              >
                                <Trash2 className="h-3.5 w-3.5 sm:mr-1" />
                                <span className="hidden sm:inline">Delete</span>
                              </Button>
                            )}
                            <Button size="sm" variant="default" className="h-8 px-2.5" asChild>
                              <Link to={`/job/${job.id}`}>
                                <ArrowRight className="h-3.5 w-3.5 sm:mr-1" />
                                <span className="hidden sm:inline">View</span>
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </main>
      <Footer />

      {/* Cancel/Dispute Dialog */}
      <Dialog open={cancelDialog.open} onOpenChange={(open) => !open && setCancelDialog({ open: false, job: null, hasAssignment: false })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {cancelDialog.hasAssignment ? "Open a Dispute" : "Cancel Job"}
            </DialogTitle>
            <DialogDescription>
              {cancelDialog.hasAssignment
                ? "This job has an assigned expert. Cancelling requires opening a dispute for admin review."
                : "Are you sure you want to cancel this job? This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>

          {cancelDialog.hasAssignment && (
            <div className="py-4">
              <label className="text-sm font-medium text-foreground mb-2 block">
                Describe the reason for the dispute
              </label>
              <Textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="Please explain why you want to cancel this assigned job..."
                rows={4}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialog({ open: false, job: null, hasAssignment: false })}>
              No, Keep Job
            </Button>
            {cancelDialog.hasAssignment ? (
              <Button
                variant="destructive"
                onClick={handleDisputeSubmit}
                disabled={cancelling || !disputeReason.trim()}
              >
                {cancelling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                Submit Dispute
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={handleSimpleCancel}
                disabled={cancelling}
              >
                {cancelling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Yes, Cancel Job
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, job: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Job Permanently</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteDialog.job?.title}"? This will permanently remove the job and notify all applicants that the role has been closed. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, job: null })}>
              No, Keep Job
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Yes, Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
