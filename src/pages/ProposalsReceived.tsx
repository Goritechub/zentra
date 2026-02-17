import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/nigerian-data";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  FileText, Loader2, ArrowLeft, Clock, CheckCircle2, X, UserCheck, MessageSquare, Wallet, ShieldCheck
} from "lucide-react";

export default function ProposalsReceivedPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState<any>(null);
  const [assignDialog, setAssignDialog] = useState<{ open: boolean; proposal: any | null }>({ open: false, proposal: null });
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
    if (user) {
      fetchProposals();
      fetchWallet();
    }
  }, [user, authLoading]);

  const fetchWallet = async () => {
    if (!user) return;
    const { data } = await supabase.from("wallets").select("*").eq("user_id", user.id).maybeSingle();
    setWallet(data);
  };

  const fetchProposals = async () => {
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

  const handleAcceptAndAssign = async () => {
    const proposal = assignDialog.proposal;
    if (!proposal || !user) return;

    const isPaymentReady = wallet && wallet.balance >= proposal.bid_amount;
    if (!isPaymentReady) {
      toast.error("Insufficient wallet balance. Please fund your wallet before assigning.");
      setAssignDialog({ open: false, proposal: null });
      return;
    }

    setAssigning(true);

    // Accept proposal
    const { error: propError } = await supabase
      .from("proposals")
      .update({ status: "accepted" } as any)
      .eq("id", proposal.id);

    if (propError) {
      toast.error("Failed to accept proposal");
      setAssigning(false);
      return;
    }

    // Create contract
    const { error: contractError } = await supabase.from("contracts").insert({
      job_id: proposal.job_id,
      client_id: user.id,
      freelancer_id: proposal.freelancer_id,
      proposal_id: proposal.id,
      amount: proposal.bid_amount,
      status: "active",
    });

    if (contractError) {
      toast.error("Failed to create contract");
      setAssigning(false);
      return;
    }

    // Update job to in_progress
    await supabase.from("jobs").update({ status: "in_progress" }).eq("id", proposal.job_id);

    // Move funds to escrow
    await supabase.from("wallets").update({
      balance: wallet.balance - proposal.bid_amount,
      escrow_balance: (wallet.escrow_balance || 0) + proposal.bid_amount,
    }).eq("user_id", user.id);

    // Send automatic message to the expert
    const jobTitle = proposal.job_title || "a job";
    const autoMessage = `🎉 Congratulations! I've accepted your proposal for "${jobTitle}" and created a contract. Let's get started!`;
    
    await supabase.functions.invoke("moderate-message", {
      body: {
        receiver_id: proposal.freelancer_id,
        content: autoMessage,
        attachments: [],
      },
    });

    toast.success("Expert assigned and contract created!");
    setAssignDialog({ open: false, proposal: null });
    setAssigning(false);
    
    // Navigate to chat with the expert
    navigate(`/messages?user=${proposal.freelancer_id}`);
  };

  const openAssignDialog = (proposal: any) => {
    setAssignDialog({ open: true, proposal });
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

  const paymentReady = wallet && wallet.balance > 0;

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

          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-foreground">Proposals Received</h1>
            <div className="flex items-center gap-2">
              <Badge variant={paymentReady ? "default" : "destructive"} className="gap-1">
                {paymentReady ? <ShieldCheck className="h-3 w-3" /> : <Wallet className="h-3 w-3" />}
                {paymentReady ? "Payment Ready" : "Payment Not Verified"}
              </Badge>
              {wallet && (
                <span className="text-sm text-muted-foreground">Balance: {formatNaira(wallet.balance)}</span>
              )}
            </div>
          </div>

          {!paymentReady && (
            <Alert className="mb-6 border-destructive/30 bg-destructive/5">
              <Wallet className="h-4 w-4 text-destructive" />
              <AlertDescription className="text-sm">
                You need to fund your wallet before you can assign experts to jobs.{" "}
                <Link to="/transactions" className="text-primary hover:underline font-medium">Go to Wallet →</Link>
              </AlertDescription>
            </Alert>
          )}

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
                      <div key={proposal.id} className="bg-card rounded-xl border border-border p-6">
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

                            <p className="text-muted-foreground text-sm mt-2 whitespace-pre-wrap">
                              {proposal.cover_letter}
                            </p>

                            {/* Expert Attachments */}
                            {proposal.attachments && proposal.attachments.length > 0 && (
                              <div className="mt-3 space-y-1">
                                <p className="text-xs font-medium text-muted-foreground">Attachments:</p>
                                {proposal.attachments.map((url: string, idx: number) => {
                                  const name = url.split("/").pop() || `Attachment ${idx + 1}`;
                                  return (
                                    <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors text-sm">
                                      <FileText className="h-4 w-4 text-primary shrink-0" />
                                      <span className="truncate text-foreground">{decodeURIComponent(name.replace(/^\d+_/, ''))}</span>
                                    </a>
                                  );
                                })}
                              </div>
                            )}

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
                                <Button size="sm" variant="outline" onClick={() => updateProposalStatus(proposal.id, "interviewing")}>
                                  <UserCheck className="h-4 w-4 mr-1" /> Interview
                                </Button>
                                <Button size="sm" onClick={() => openAssignDialog(proposal)}>
                                  <CheckCircle2 className="h-4 w-4 mr-1" /> Accept & Assign
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => updateProposalStatus(proposal.id, "rejected")}>
                                  <X className="h-4 w-4 mr-1" /> Reject
                                </Button>
                              </div>
                            )}

                            {proposal.status === "interviewing" && (
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => openAssignDialog(proposal)}>
                                  <CheckCircle2 className="h-4 w-4 mr-1" /> Accept & Assign
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => updateProposalStatus(proposal.id, "rejected")}>
                                  <X className="h-4 w-4 mr-1" /> Reject
                                </Button>
                              </div>
                            )}

                            <Button size="sm" variant="ghost" onClick={() => navigate(`/messages?user=${proposal.freelancer_id}`)}>
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

      {/* Assignment Confirmation Dialog */}
      <Dialog open={assignDialog.open} onOpenChange={(open) => setAssignDialog({ open, proposal: open ? assignDialog.proposal : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Expert & Create Contract</DialogTitle>
            <DialogDescription>
              You're about to assign this expert and create a contract. The bid amount will be moved to escrow.
            </DialogDescription>
          </DialogHeader>
          {assignDialog.proposal && (
            <div className="space-y-3 py-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Expert</span>
                <span className="font-medium">{assignDialog.proposal.freelancer?.full_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Bid Amount</span>
                <span className="font-bold text-primary">{formatNaira(assignDialog.proposal.bid_amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Delivery</span>
                <span>{assignDialog.proposal.delivery_days} days</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Payment Status</span>
                <Badge variant={paymentReady ? "default" : "destructive"} className="gap-1">
                  {paymentReady ? <ShieldCheck className="h-3 w-3" /> : <Wallet className="h-3 w-3" />}
                  {paymentReady ? "Payment Ready" : "Not Verified"}
                </Badge>
              </div>
              {wallet && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Wallet Balance</span>
                  <span className={wallet.balance >= assignDialog.proposal.bid_amount ? "text-primary" : "text-destructive"}>
                    {formatNaira(wallet.balance)}
                  </span>
                </div>
              )}
              {wallet && wallet.balance < assignDialog.proposal.bid_amount && (
                <Alert className="border-destructive/30 bg-destructive/5">
                  <Wallet className="h-4 w-4 text-destructive" />
                  <AlertDescription className="text-sm">
                    Insufficient balance. You need at least {formatNaira(assignDialog.proposal.bid_amount)} to assign this expert.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog({ open: false, proposal: null })}>Cancel</Button>
            <Button
              onClick={handleAcceptAndAssign}
              disabled={assigning || !paymentReady || (wallet && assignDialog.proposal && wallet.balance < assignDialog.proposal.bid_amount)}
            >
              {assigning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Confirm & Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
