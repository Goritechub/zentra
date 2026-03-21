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
import { supabase } from "@/integrations/supabase/client";
import {
  cancelClientJob,
  createClientJobDispute,
  getClientJobCancelState,
  getClientJobs,
} from "@/api/jobs.api";
import { formatNaira } from "@/lib/nigerian-data";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Briefcase, PlusCircle, Loader2, ArrowRight, ArrowLeft, XCircle, Trash2, Eye } from "lucide-react";

interface JobWithCounts {
  [key: string]: any;
  _proposalCount?: number;
  _invitedCount?: number;
  _interviewingCount?: number;
}

export default function ClientJobsPage() {
  const { user, profile, authError } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; job: any | null; hasAssignment: boolean }>({
    open: false, job: null, hasAssignment: false,
  });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; job: any | null }>({
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

  const handleCancelClick = async (job: any) => {
    try {
      const data = await getClientJobCancelState(job.id);
      setCancelDialog({ open: true, job, hasAssignment: !!data.hasAssignment });
      setDisputeReason("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to check job state");
    }
  };

  const handleDeleteClick = (job: any) => {
    setDeleteDialog({ open: true, job });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.job) return;
    setDeleting(true);

    const { data, error } = await supabase.functions.invoke("cancel-delete-job", {
      body: { job_id: deleteDialog.job.id },
    });

    if (error || !data?.success) {
      toast.error(data?.error || "Failed to delete job. Please try again.");
    } else {
      toast.success(`Job deleted. ${data.notified} applicant(s) notified.`);
      queryClient.invalidateQueries({ queryKey: ["client-jobs", user?.id] });
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

  const canDeleteJob = (job: any) => {
    return job.status === "open" || job.status === "cancelled";
  };

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-wide">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>
          {authError && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              {authError}
            </div>
          )}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-foreground">My Jobs</h1>
            <Button asChild><Link to="/post-job"><PlusCircle className="h-4 w-4 mr-2" />Post New Job</Link></Button>
          </div>
          {jobsQuery.isFetching && (
            <p className="text-sm text-muted-foreground mb-4">Refreshing jobs...</p>
          )}

          <Tabs defaultValue="all">
            <TabsList className="mb-6">
              <TabsTrigger value="all">All ({jobs.length})</TabsTrigger>
              <TabsTrigger value="open">Open ({filterByStatus("open").length})</TabsTrigger>
              <TabsTrigger value="in_progress">Ongoing ({filterByStatus("in_progress").length})</TabsTrigger>
              <TabsTrigger value="completed">Completed ({filterByStatus("completed").length})</TabsTrigger>
              <TabsTrigger value="cancelled">Closed ({filterByStatus("cancelled").length})</TabsTrigger>
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
                  <div className="text-center py-16 text-muted-foreground">
                    <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No {status === "all" ? "" : status} jobs found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filterByStatus(status).map(job => (
                      <div key={job.id} className={`bg-card rounded-xl border border-border p-6 card-hover ${job.status === "completed" ? "opacity-60" : ""}`}>
                        <div className="flex items-start justify-between">
                          <Link to={`/job/${job.id}`} className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant={job.status === "open" ? "default" : "secondary"}>{job.status}</Badge>
                            </div>
                            <h3 className="text-lg font-semibold text-foreground">{job.title}</h3>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{job.description}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              Posted {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                            </p>
                          </Link>
                          <div className="flex flex-col items-end gap-2 ml-4">
                            {(job.budget_min || job.budget_max) && (
                              <p className="font-bold text-primary">{formatNaira(job.budget_max || job.budget_min || 0)}</p>
                            )}
                            {job.status !== "cancelled" && job.status !== "completed" && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleCancelClick(job);
                                }}
                              >
                                <XCircle className="h-4 w-4 mr-1" /> Cancel
                              </Button>
                            )}
                            {canDeleteJob(job) && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleDeleteClick(job);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-1" /> Delete
                              </Button>
                            )}
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-border">
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Eye className="h-3.5 w-3.5" /> {job._viewCount || 0} view{(job._viewCount || 0) !== 1 ? "s" : ""}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); navigate("/dashboard/proposals"); }}
                            className="text-sm text-muted-foreground hover:text-primary transition-colors underline-offset-2 hover:underline"
                          >
                            {job._proposalCount || 0} proposal{(job._proposalCount || 0) !== 1 ? "s" : ""} received
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); navigate("/dashboard/sent-offers"); }}
                            className="text-sm text-muted-foreground hover:text-primary transition-colors underline-offset-2 hover:underline"
                          >
                            {job._invitedCount || 0} invited
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); navigate("/dashboard/proposals?tab=interviewing"); }}
                            className="text-sm text-muted-foreground hover:text-primary transition-colors underline-offset-2 hover:underline"
                          >
                            {job._interviewingCount || 0} interviewing
                          </button>
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
