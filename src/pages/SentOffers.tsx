import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { cancelSentOfferJob, getSentOffers } from "@/api/offers.api";
import { useCurrency } from "@/hooks/useCurrency";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Send, Loader2, Clock, CheckCircle2, X, ArrowLeft, Lock, Briefcase, UserPlus, Globe, XCircle } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import type { SentOffer, PrivateJob } from "@/types/offers";

export default function SentOffersPage() {
  const { format } = useCurrency();
  const { user, bootstrapStatus } = useAuth();
  const navigate = useNavigate();
  const [offers, setOffers] = useState<SentOffer[]>([]);
  const [privateJobs, setPrivateJobs] = useState<PrivateJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [selectedJob, setSelectedJob] = useState<PrivateJob | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchOffers = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await getSentOffers();
      setOffers(response.offers || []);
      setPrivateJobs(response.privateJobs || []);
    } catch {
      setOffers([]);
      setPrivateJobs([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (bootstrapStatus === "ready" && user) {
      void fetchOffers();
    }
  }, [bootstrapStatus, user, fetchOffers]);

  const statusIcon = (status: string) => {
    switch (status) {
      case "pending": return <Clock className="h-4 w-4 text-accent" />;
      case "accepted": return <CheckCircle2 className="h-4 w-4 text-primary" />;
      case "rejected": return <X className="h-4 w-4 text-destructive" />;
      default: return null;
    }
  };

  // Check if all invited experts have rejected (no more invited_expert_ids or all bowed out)
  const isAllRejected = (job: PrivateJob) => {
    return job.status === "open" && (!job.invited_expert_ids || job.invited_expert_ids.length === 0);
  };

  const handleInviteAnother = (job: PrivateJob) => {
    // Navigate to post-job with job details prepopulated, private selected, search open
    const params = new URLSearchParams({
      prefill: job.id,
      visibility: "private",
    });
    navigate(`/post-job?${params.toString()}`);
  };

  const handleMakePublic = (job: PrivateJob) => {
    const params = new URLSearchParams({
      prefill: job.id,
      visibility: "public",
    });
    navigate(`/post-job?${params.toString()}`);
  };

  const handleCloseJob = async () => {
    if (!selectedJob) return;
    setActionLoading(true);
    try {
      await cancelSentOfferJob(selectedJob.id);
      toast.success("Job closed");
      void fetchOffers();
    } catch {
      toast.error("Failed to close job");
    }
    setActionLoading(false);
    setShowCloseDialog(false);
    setSelectedJob(null);
  };

  if (!user || bootstrapStatus !== "ready") {
    return null;
  }

  const totalItems = offers.length + privateJobs.length;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-4 sm:py-8">
        <div className="container-wide">

          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-4 sm:mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 sm:mb-8">Sent Offers</h1>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="bg-card rounded-xl border border-border p-4 sm:p-5">
                  <div className="h-5 w-1/2 rounded bg-muted animate-pulse mb-2" />
                  <div className="h-4 w-2/3 rounded bg-muted/70 animate-pulse mb-3" />
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
              ))}
            </div>
          ) : totalItems === 0 ? (
            <EmptyState
              variant="documents"
              title="No offers sent yet"
              description="Send direct offers to experts from their profiles, or post a private job"
            />
          ) : (
            <div className="space-y-8">
              {/* Private Job Offers */}
              {privateJobs.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Lock className="h-4 w-4" /> Private Jobs ({privateJobs.length})
                  </h2>
                  <div className="space-y-4">
                    {privateJobs.map((job) => {
                      const allRejected = isAllRejected(job);
                      return (
                        <div key={job.id} className="bg-card rounded-xl border border-border p-4 sm:p-5">
                          <div className="flex items-start gap-2 flex-wrap mb-1">
                            <h3 className="font-semibold text-foreground flex-1 min-w-0">{job.title}</h3>
                            <Badge variant="outline" className="gap-1 text-xs shrink-0">
                              <Lock className="h-3 w-3" /> Private
                            </Badge>
                            {allRejected && (
                              <Badge variant="destructive" className="text-xs shrink-0">All Declined</Badge>
                            )}
                          </div>
                          {job.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{job.description}</p>}
                          <p className="text-xs text-muted-foreground mt-1.5">
                            Posted {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                            {" · "}{(job.invited_expert_ids || []).length} expert(s) invited
                          </p>

                          <div className="flex items-center justify-between pt-3 mt-2 border-t border-border gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              {(job.budget_min || job.budget_max) && (
                                <p className="font-bold text-primary text-sm">
                                  {job.budget_min && job.budget_max
                                    ? `${format(job.budget_min)} – ${format(job.budget_max)}`
                                    : format(job.budget_max || job.budget_min)}
                                </p>
                              )}
                              <Badge variant={job.status === "open" ? "secondary" : "outline"} className="text-xs">{job.status.split("_").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}</Badge>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" asChild>
                                <Link to={`/job/${job.id}`}>
                                  <Briefcase className="h-3.5 w-3.5 sm:mr-1.5" /><span className="hidden sm:inline">View Job</span>
                                </Link>
                              </Button>
                              {allRejected && job.status === "open" && (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => handleInviteAnother(job)}>
                                    <UserPlus className="h-3.5 w-3.5 sm:mr-1.5" /><span className="hidden sm:inline">Invite Another</span>
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => handleMakePublic(job)}>
                                    <Globe className="h-3.5 w-3.5 sm:mr-1.5" /><span className="hidden sm:inline">Make Public</span>
                                  </Button>
                                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { setSelectedJob(job); setShowCloseDialog(true); }}>
                                    <XCircle className="h-3.5 w-3.5 sm:mr-1.5" /><span className="hidden sm:inline">Close Job</span>
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Direct Offers */}
              {offers.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Send className="h-4 w-4" /> Direct Offers ({offers.length})
                  </h2>
                  <div className="space-y-4">
                    {offers.map((offer) => (
                      <div key={offer.id} className="bg-card rounded-xl border border-border p-4 sm:p-5">
                        <h3 className="font-semibold text-foreground">{offer.title}</h3>
                        {offer.freelancer?.full_name && (
                          <p className="text-sm text-muted-foreground mt-0.5">To: {offer.freelancer.full_name}</p>
                        )}
                        {offer.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{offer.description}</p>}
                        <p className="text-xs text-muted-foreground mt-1.5">
                          Sent {formatDistanceToNow(new Date(offer.created_at), { addSuffix: true })}
                        </p>
                        <div className="flex items-center justify-between pt-3 mt-2 border-t border-border">
                          {offer.budget
                            ? <p className="font-bold text-primary text-sm">{format(offer.budget)}</p>
                            : <span />}
                          <Badge variant={offer.status === "accepted" ? "default" : "secondary"} className="gap-1">
                            {statusIcon(offer.status)} {offer.status.charAt(0).toUpperCase() + offer.status.slice(1)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />

      {/* Close Job Confirm Dialog */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close Job</DialogTitle>
            <DialogDescription>
              Are you sure you want to close "{selectedJob?.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleCloseJob} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
              Close Job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
