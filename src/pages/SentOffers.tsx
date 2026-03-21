import { useState, useEffect } from "react";
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
import { formatNaira } from "@/lib/nigerian-data";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Send, Loader2, Clock, CheckCircle2, X, ArrowLeft, Lock, Briefcase, UserPlus, Globe, XCircle } from "lucide-react";

export default function SentOffersPage() {
  const { user, bootstrapStatus, authError } = useAuth();
  const navigate = useNavigate();
  const [offers, setOffers] = useState<any[]>([]);
  const [privateJobs, setPrivateJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (bootstrapStatus === "ready" && user) {
      void fetchOffers();
    }
  }, [bootstrapStatus, user]);

  const fetchOffers = async () => {
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
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "pending": return <Clock className="h-4 w-4 text-accent" />;
      case "accepted": return <CheckCircle2 className="h-4 w-4 text-primary" />;
      case "rejected": return <X className="h-4 w-4 text-destructive" />;
      default: return null;
    }
  };

  // Check if all invited experts have rejected (no more invited_expert_ids or all bowed out)
  const isAllRejected = (job: any) => {
    return job.status === "open" && (!job.invited_expert_ids || job.invited_expert_ids.length === 0);
  };

  const handleInviteAnother = (job: any) => {
    // Navigate to post-job with job details prepopulated, private selected, search open
    const params = new URLSearchParams({
      prefill: job.id,
      visibility: "private",
    });
    navigate(`/post-job?${params.toString()}`);
  };

  const handleMakePublic = (job: any) => {
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
          <h1 className="text-3xl font-bold text-foreground mb-8">Sent Offers</h1>

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
          ) : totalItems === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Send className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No offers sent yet</p>
              <p className="text-sm mt-1">Send direct offers to experts from their profiles, or post a private job</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Private Job Offers */}
              {privateJobs.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Lock className="h-4 w-4" /> Private Jobs ({privateJobs.length})
                  </h2>
                  <div className="space-y-4">
                    {privateJobs.map((job: any) => {
                      const allRejected = isAllRejected(job);
                      return (
                        <div key={job.id} className="bg-card rounded-xl border border-border p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold text-foreground">{job.title}</h3>
                                <Badge variant="outline" className="gap-1 text-xs">
                                  <Lock className="h-3 w-3" /> Private
                                </Badge>
                                {allRejected && (
                                  <Badge variant="destructive" className="text-xs">All Declined</Badge>
                                )}
                              </div>
                              {job.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{job.description}</p>}
                              <p className="text-xs text-muted-foreground mt-2">
                                Posted {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                                {" · "}{(job.invited_expert_ids || []).length} expert(s) invited
                              </p>
                            </div>
                            <div className="text-right ml-4">
                              {(job.budget_min || job.budget_max) && (
                                <p className="font-bold text-primary">
                                  {job.budget_min && job.budget_max
                                    ? `${formatNaira(job.budget_min)} – ${formatNaira(job.budget_max)}`
                                    : formatNaira(job.budget_max || job.budget_min)}
                                </p>
                              )}
                              <Badge variant={job.status === "open" ? "secondary" : "outline"} className="mt-2 capitalize">{job.status}</Badge>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-4">
                            <Button size="sm" variant="outline" asChild>
                              <Link to={`/job/${job.id}`}>
                                <Briefcase className="h-3.5 w-3.5 mr-1.5" /> View Job
                              </Link>
                            </Button>
                            {allRejected && job.status === "open" && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => handleInviteAnother(job)}>
                                  <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Invite Another
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleMakePublic(job)}>
                                  <Globe className="h-3.5 w-3.5 mr-1.5" /> Make Public
                                </Button>
                                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { setSelectedJob(job); setShowCloseDialog(true); }}>
                                  <XCircle className="h-3.5 w-3.5 mr-1.5" /> Close Job
                                </Button>
                              </>
                            )}
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
                    {offers.map((offer: any) => (
                      <div key={offer.id} className="bg-card rounded-xl border border-border p-6">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-foreground">{offer.title}</h3>
                            {offer.freelancer?.full_name && (
                              <p className="text-sm text-muted-foreground mt-0.5">To: {offer.freelancer.full_name}</p>
                            )}
                            {offer.description && <p className="text-sm text-muted-foreground mt-1">{offer.description}</p>}
                            <p className="text-xs text-muted-foreground mt-2">
                              Sent {formatDistanceToNow(new Date(offer.created_at), { addSuffix: true })}
                            </p>
                          </div>
                          <div className="text-right">
                            {offer.budget && <p className="font-bold text-primary">{formatNaira(offer.budget)}</p>}
                            <Badge variant={offer.status === "accepted" ? "default" : "secondary"} className="mt-2 gap-1">
                              {statusIcon(offer.status)} {offer.status}
                            </Badge>
                          </div>
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
