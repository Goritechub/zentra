import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/nigerian-data";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  FileText, Loader2, ArrowLeft, Clock, CheckCircle2, X, UserCheck, MessageSquare
} from "lucide-react";

export default function ProposalsReceivedPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
    if (user) fetchProposals();
  }, [user, authLoading]);

  const fetchProposals = async () => {
    // Get all jobs by this client
    const { data: jobs } = await supabase
      .from("jobs")
      .select("id, title")
      .eq("client_id", user!.id);

    if (!jobs?.length) {
      setProposals([]);
      setLoading(false);
      return;
    }

    const jobIds = jobs.map((j) => j.id);
    const { data } = await supabase
      .from("proposals")
      .select("*, freelancer:profiles!proposals_freelancer_id_fkey(full_name, avatar_url, state, city)")
      .in("job_id", jobIds)
      .order("created_at", { ascending: false });

    // Attach job title
    const enriched = (data || []).map((p: any) => ({
      ...p,
      job_title: jobs.find((j) => j.id === p.job_id)?.title || "Unknown Job",
    }));

    setProposals(enriched);
    setLoading(false);
  };

  const updateProposalStatus = async (proposalId: string, status: string) => {
    const { error } = await supabase
      .from("proposals")
      .update({ status } as any)
      .eq("id", proposalId);

    if (error) {
      toast.error("Failed to update proposal");
    } else {
      toast.success(`Proposal ${status}`);
      setProposals((prev) =>
        prev.map((p) => (p.id === proposalId ? { ...p, status } : p))
      );
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
      pending: { variant: "secondary", icon: Clock },
      interviewing: { variant: "outline", icon: UserCheck },
      accepted: { variant: "default", icon: CheckCircle2 },
      rejected: { variant: "destructive", icon: X },
      withdrawn: { variant: "secondary", icon: X },
    };
    const cfg = map[status] || map.pending;
    const Icon = cfg.icon;
    return (
      <Badge variant={cfg.variant} className="gap-1">
        <Icon className="h-3 w-3" /> {status}
      </Badge>
    );
  };

  const filterByStatus = (status: string) =>
    status === "all" ? proposals : proposals.filter((p) => p.status === status);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-wide">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>

          <h1 className="text-3xl font-bold text-foreground mb-8">Proposals Received</h1>

          <Tabs defaultValue="all">
            <TabsList className="mb-6">
              <TabsTrigger value="all">All ({proposals.length})</TabsTrigger>
              <TabsTrigger value="pending">Pending ({filterByStatus("pending").length})</TabsTrigger>
              <TabsTrigger value="interviewing">Interviewing ({filterByStatus("interviewing").length})</TabsTrigger>
              <TabsTrigger value="accepted">Accepted ({filterByStatus("accepted").length})</TabsTrigger>
              <TabsTrigger value="rejected">Rejected ({filterByStatus("rejected").length})</TabsTrigger>
            </TabsList>

            {["all", "pending", "interviewing", "accepted", "rejected"].map((status) => (
              <TabsContent key={status} value={status}>
                {filterByStatus(status).length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No {status === "all" ? "" : status} proposals</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filterByStatus(status).map((proposal: any) => (
                      <div
                        key={proposal.id}
                        className="bg-card rounded-xl border border-border p-6"
                      >
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={proposal.freelancer?.avatar_url || undefined} />
                                <AvatarFallback className="bg-primary/10 text-primary">
                                  {(proposal.freelancer?.full_name || "U")[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-semibold text-foreground">
                                  {proposal.freelancer?.full_name || "Expert"}
                                </p>
                                {proposal.freelancer?.state && (
                                  <p className="text-xs text-muted-foreground">
                                    {proposal.freelancer.city ? `${proposal.freelancer.city}, ` : ""}
                                    {proposal.freelancer.state}
                                  </p>
                                )}
                              </div>
                            </div>

                            <Link to={`/job/${proposal.job_id}`} className="text-sm text-primary hover:underline font-medium">
                              {proposal.job_title}
                            </Link>

                            <p className="text-muted-foreground text-sm mt-2 line-clamp-3">
                              {proposal.cover_letter}
                            </p>

                            <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                              <span>Bid: <strong className="text-foreground">{formatNaira(proposal.bid_amount)}</strong></span>
                              <span>Delivery: <strong className="text-foreground">{proposal.delivery_days} days</strong></span>
                              <span>{formatDistanceToNow(new Date(proposal.created_at), { addSuffix: true })}</span>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-3">
                            {statusBadge(proposal.status)}

                            {proposal.status === "pending" && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateProposalStatus(proposal.id, "interviewing")}
                                >
                                  <UserCheck className="h-4 w-4 mr-1" /> Interview
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => updateProposalStatus(proposal.id, "accepted")}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-1" /> Accept
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => updateProposalStatus(proposal.id, "rejected")}
                                >
                                  <X className="h-4 w-4 mr-1" /> Reject
                                </Button>
                              </div>
                            )}

                            {proposal.status === "interviewing" && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => updateProposalStatus(proposal.id, "accepted")}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-1" /> Accept
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => updateProposalStatus(proposal.id, "rejected")}
                                >
                                  <X className="h-4 w-4 mr-1" /> Reject
                                </Button>
                              </div>
                            )}

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => navigate(`/messages?user=${proposal.freelancer_id}`)}
                            >
                              <MessageSquare className="h-4 w-4 mr-1" /> Message
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
    </div>
  );
}
