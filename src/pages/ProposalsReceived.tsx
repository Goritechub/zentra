import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import {
  acceptAndAssignClientProposal,
  getClientReceivedProposalsOverview,
  rejectClientProposal,
  startClientProposalInterview,
  updateClientProposalStatus,
} from "@/api/client-proposals.api";
import { formatNaira } from "@/lib/nigerian-data";
import { useKycVerification } from "@/hooks/useKycVerification";
import { KycRequiredModal } from "@/components/KycRequiredModal";
import { VerificationBadges } from "@/components/VerificationBadges";

import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  FileText, Loader2, ArrowLeft, Clock, CheckCircle2, X, UserCheck, MessageSquare, Wallet, ShieldCheck, Eye, DollarSign, Milestone as MilestoneIcon, Download, Briefcase
} from "lucide-react";

function formatDurationDisplay(days: number, unit?: string): string {
  const u = unit || "days";
  if (u === "weeks") {
    const weeks = Math.round(days / 7);
    return `${weeks} week${weeks !== 1 ? "s" : ""}`;
  }
  if (u === "months") {
    const months = Math.round(days / 30);
    return `${months} month${months !== 1 ? "s" : ""}`;
  }
  return `${days} day${days !== 1 ? "s" : ""}`;
}

export default function ProposalsReceivedPage() {
  const { user, bootstrapStatus, authError } = useAuth();
  const navigate = useNavigate();
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState<any>(null);
  const [assignDialog, setAssignDialog] = useState<{ open: boolean; proposal: any | null }>({ open: false, proposal: null });
  const [detailDialog, setDetailDialog] = useState<{ open: boolean; proposal: any | null }>({ open: false, proposal: null });
  const [interviewConfirm, setInterviewConfirm] = useState<{ open: boolean; proposal: any | null }>({ open: false, proposal: null });
  const [assigning, setAssigning] = useState(false);
  const [fundingChoice, setFundingChoice] = useState<"now" | "later">("now");
  const [interviewingId, setInterviewingId] = useState<string | null>(null);
  const { isVerified: kycVerified } = useKycVerification();
  const [showKycModal, setShowKycModal] = useState(false);

  const [jobContracts, setJobContracts] = useState<Map<string, any>>(new Map());
  const [jobsData, setJobsData] = useState<any[]>([]);

  const proposalsOverviewQuery = useQuery({
    queryKey: ["client-received-proposals", user?.id],
    enabled: bootstrapStatus === "ready" && !!user,
    staleTime: 60 * 1000,
    placeholderData: (previousData) => previousData,
    queryFn: getClientReceivedProposalsOverview,
  });

  useEffect(() => {
    if (!user) navigate("/auth");
  }, [user, navigate]);

  useEffect(() => {
    const data = proposalsOverviewQuery.data;
    if (!data) return;

    setWallet(data.wallet || null);
    setJobsData(data.jobs || []);
    setProposals(data.proposals || []);

    const contractMap = new Map<string, any>();
    (data.jobContracts || []).forEach((contract: any) => {
      if (!contractMap.has(contract.job_id) || contract.status === "active") {
        contractMap.set(contract.job_id, contract);
      }
    });
    setJobContracts(contractMap);
    setLoading(false);
  }, [proposalsOverviewQuery.data]);

  useEffect(() => {
    if (proposalsOverviewQuery.isPending && !proposalsOverviewQuery.data) {
      setLoading(true);
    }
  }, [proposalsOverviewQuery.isPending, proposalsOverviewQuery.data]);

  const updateProposalStatus = async (proposalId: string, status: string) => {
    const proposal = proposals.find(p => p.id === proposalId);

    // If interviewing, create a draft contract with chat thread
    if (status === "interviewing" && proposal) {
      await handleStartInterview(proposal);
      return;
    }

    // If rejecting from interviewing, close the associated contract
    if (status === "rejected" && proposal) {
      await handleRejectProposal(proposal);
      return;
    }
    try {
      await updateClientProposalStatus(proposalId, status);
      toast.success(`Proposal ${status}`);
      setProposals((prev) =>
        prev.map((p) => (p.id === proposalId ? { ...p, status } : p)),
      );
    } catch {
      toast.error("Failed to update proposal");
    }
  };

  const handleStartInterview = async (proposal: any) => {
    setInterviewingId(proposal.id);
    try {
      const data = await startClientProposalInterview(proposal.id);
      toast.success("Interview started! A chat thread has been created.");
      setProposals((prev) => prev.map((p) => (p.id === proposal.id ? { ...p, status: "interviewing" } : p)));
      navigate(`/contract/${data.contractId}?tab=chat`);
    } catch {
      toast.error("Failed to start interview");
    } finally {
      setInterviewingId(null);
    }
  };

  const handleRejectProposal = async (proposal: any) => {
    try {
      await rejectClientProposal(proposal.id);
      toast.success("Proposal rejected");
      setProposals((prev) => prev.map((p) => (p.id === proposal.id ? { ...p, status: "rejected" } : p)));
    } catch {
      toast.error("Failed to reject proposal");
    }
  };

  const getRequiredAmount = (proposal: any) => {
    if (proposal.payment_type === "milestone" && proposal.milestones?.length > 0) {
      return proposal.milestones[0].amount; // First milestone only
    }
    return proposal.bid_amount; // Full project amount
  };

  const handleAcceptAndAssign = async () => {
    const proposal = assignDialog.proposal;
    if (!proposal || !user) return;


    const requiredAmount = getRequiredAmount(proposal);
    const fundNow = fundingChoice === "now";

    if (fundNow) {
      const isPaymentReady = wallet && wallet.balance >= requiredAmount;
      if (!isPaymentReady) {
        toast.error(`Insufficient wallet balance. You need at least ${formatNaira(requiredAmount)} to assign.`);
        setAssignDialog({ open: false, proposal: null });
        return;
      }
    }

    setAssigning(true);
    try {
      const result = await acceptAndAssignClientProposal(proposal.id, fundNow);
      toast.success("Expert assigned and contract created!");
      setAssignDialog({ open: false, proposal: null });
      navigate(`/contract/${result.contractId}`);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to assign expert");
    } finally {
      setAssigning(false);
    }
  };

  const openAssignDialog = (proposal: any) => {
    setFundingChoice("now");
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

  const contractStatusLabel = (status: string) => {
    const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      active: { variant: "default", label: "Contract Active" },
      completed: { variant: "secondary", label: "Contract Completed" },
      pending_funding: { variant: "outline", label: "Pending Funding" },
      disputed: { variant: "destructive", label: "Disputed" },
    };
    const cfg = map[status] || { variant: "outline" as const, label: status };
    return <Badge variant={cfg.variant} className="gap-1 text-xs">{cfg.label}</Badge>;
  };

  const groupByJob = (proposalsList: any[]) => {
    const jobMap = new Map<string, any[]>();
    proposalsList.forEach((p) => {
      if (!jobMap.has(p.job_id)) jobMap.set(p.job_id, []);
      jobMap.get(p.job_id)!.push(p);
    });
    const jobIds = Array.from(jobMap.keys());
    jobIds.sort((a, b) => {
      const aAssigned = jobContracts.has(a);
      const bAssigned = jobContracts.has(b);
      if (aAssigned && !bAssigned) return 1;
      if (!aAssigned && bAssigned) return -1;
      return 0;
    });
    return jobIds.map((jobId) => ({
      jobId,
      jobTitle: jobMap.get(jobId)![0]?.job_title || "Unknown Job",
      contract: jobContracts.get(jobId) || null,
      proposals: jobMap.get(jobId)!,
    }));
  };

  const paymentReady = wallet && wallet.balance > 0;

  const showInitialPageLoader = !user && (authLoading || bootstrapStatus === "loading");

  if (showInitialPageLoader) {
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

          {authError && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              {authError}
            </div>
          )}

          {loading && (
            <p className="mb-4 text-sm text-muted-foreground">Refreshing proposals...</p>
          )}

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
                  <div className="space-y-6">
                    {groupByJob(filterByStatus(status)).map((group) => {
                      const isAssigned = !!group.contract;
                      return (
                        <div key={group.jobId} className={`rounded-xl border ${isAssigned ? "border-border/50 bg-muted/30" : "border-border bg-card"}`}>
                          {/* Job Group Header */}
                          <div className={`flex items-center justify-between px-6 py-4 border-b ${isAssigned ? "border-border/50" : "border-border"}`}>
                            <div className="flex items-center gap-3">
                              <Briefcase className={`h-4 w-4 ${isAssigned ? "text-muted-foreground" : "text-primary"}`} />
                              <Link to={`/job/${group.jobId}`} className={`font-semibold hover:underline ${isAssigned ? "text-muted-foreground" : "text-foreground hover:text-primary"}`}>
                                {group.jobTitle}
                              </Link>
                              <Badge variant="outline" className="text-xs">{group.proposals.length} proposal{group.proposals.length !== 1 ? "s" : ""}</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              {isAssigned && contractStatusLabel(group.contract.status)}
                              {isAssigned && (
                                <Button size="sm" variant="outline" className="text-xs" onClick={() => navigate(`/contract/${group.contract.id}`)}>
                                  View Contract
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Proposals within group */}
                          <div className={`divide-y ${isAssigned ? "divide-border/50 opacity-60" : "divide-border"}`}>
                            {group.proposals.map((proposal: any) => (
                              <div key={proposal.id} className="px-6 py-5">
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
                                        <div className="flex items-center gap-2">
                                          <Link to={`/expert/${proposal.freelancer_id}/profile`} className="font-semibold text-foreground hover:text-primary hover:underline transition-colors">
                                            {proposal.freelancer?.full_name || "Expert"}
                                          </Link>
                                          {(proposal.kyc?.kyc_status === "verified" || proposal.freelancer?.is_verified) && (
                                            <VerificationBadges
                                              isVerified={true}
                                              isZentraVerified={proposal.kyc?.zentra_verified || false}
                                              role="freelancer"
                                              size="sm"
                                            />
                                          )}
                                        </div>
                                        {proposal.freelancer?.state && (
                                          <p className="text-xs text-muted-foreground">
                                            {proposal.freelancer.city ? `${proposal.freelancer.city}, ` : ""}
                                            {proposal.freelancer.state}
                                          </p>
                                        )}
                                      </div>
                                    </div>

                                    <p className="text-muted-foreground text-sm mt-2 whitespace-pre-wrap">
                                      {proposal.cover_letter}
                                    </p>

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
                                      <span>Delivery: <strong className="text-foreground">{formatDurationDisplay(proposal.delivery_days, proposal.delivery_unit)}</strong></span>
                                      <span>{formatDistanceToNow(new Date(proposal.created_at), { addSuffix: true })}</span>
                                    </div>
                                  </div>

                                  <div className="flex flex-col items-end gap-3">
                                    {statusBadge(proposal.status)}

                                    {!isAssigned && proposal.status === "pending" && (
                                      <div className="flex gap-2">
                                        <Button size="sm" variant="outline" onClick={() => setInterviewConfirm({ open: true, proposal })} disabled={interviewingId === proposal.id}>
                                          {interviewingId === proposal.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <UserCheck className="h-4 w-4 mr-1" />} Interview
                                        </Button>
                                        <Button size="sm" onClick={() => openAssignDialog(proposal)}>
                                          <CheckCircle2 className="h-4 w-4 mr-1" /> Accept & Assign
                                        </Button>
                                        <Button size="sm" variant="destructive" onClick={() => updateProposalStatus(proposal.id, "rejected")}>
                                          <X className="h-4 w-4 mr-1" /> Reject
                                        </Button>
                                      </div>
                                    )}

                                    {!isAssigned && proposal.status === "interviewing" && (
                                      <div className="flex gap-2">
                                        <Button size="sm" onClick={() => openAssignDialog(proposal)}>
                                          <CheckCircle2 className="h-4 w-4 mr-1" /> Accept & Assign
                                        </Button>
                                        <Button size="sm" variant="destructive" onClick={() => updateProposalStatus(proposal.id, "rejected")}>
                                          <X className="h-4 w-4 mr-1" /> Reject
                                        </Button>
                                      </div>
                                    )}

                                    <div className="flex gap-2">
                                      <Button size="sm" variant="outline" onClick={() => setDetailDialog({ open: true, proposal })}>
                                        <Eye className="h-4 w-4 mr-1" /> View Details
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
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
            <div className="space-y-4 py-4">
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
                <span>{formatDurationDisplay(assignDialog.proposal.delivery_days, assignDialog.proposal.delivery_unit)}</span>
              </div>

              {/* Fund Now or Later */}
              <div className="space-y-2 pt-2 border-t border-border">
                <p className="text-sm font-semibold text-foreground">When would you like to fund?</p>
                <RadioGroup value={fundingChoice} onValueChange={(v) => setFundingChoice(v as "now" | "later")} className="space-y-2">
                  <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/30 cursor-pointer">
                    <RadioGroupItem value="now" id="fund-now" className="mt-0.5" />
                    <Label htmlFor="fund-now" className="cursor-pointer flex-1">
                      <span className="font-medium text-foreground">Fund Now</span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Deposit {formatNaira(getRequiredAmount(assignDialog.proposal))} into escrow immediately. Expert can start working right away.
                      </p>
                    </Label>
                  </div>
                  <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/30 cursor-pointer">
                    <RadioGroupItem value="later" id="fund-later" className="mt-0.5" />
                    <Label htmlFor="fund-later" className="cursor-pointer flex-1">
                      <span className="font-medium text-foreground">Fund Later</span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Create the contract now but fund the milestone later. Expert cannot begin until funded.
                      </p>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {fundingChoice === "now" && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Wallet Balance</span>
                    <span className={wallet && wallet.balance >= getRequiredAmount(assignDialog.proposal) ? "text-primary" : "text-destructive"}>
                      {formatNaira(wallet?.balance || 0)}
                    </span>
                  </div>
                  {assignDialog.proposal.payment_type === "milestone" && assignDialog.proposal.milestones?.length > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Required Now (1st Milestone)</span>
                      <span className="font-bold text-primary">{formatNaira(assignDialog.proposal.milestones[0].amount)}</span>
                    </div>
                  )}
                  {wallet && wallet.balance < getRequiredAmount(assignDialog.proposal) && (
                    <Alert className="border-destructive/30 bg-destructive/5">
                      <Wallet className="h-4 w-4 text-destructive" />
                      <AlertDescription className="text-sm">
                        Insufficient balance. You need at least {formatNaira(getRequiredAmount(assignDialog.proposal))} to fund now.{" "}
                        <a href="/transactions" className="text-primary hover:underline font-medium">Fund Wallet →</a>
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}

              {fundingChoice === "later" && (
                <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm text-muted-foreground">
                  💡 The contract will be created with <strong className="text-foreground">Pending Funding</strong> status. You can fund milestones from the contract page.
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog({ open: false, proposal: null })}>Cancel</Button>
            <Button
              onClick={handleAcceptAndAssign}
              disabled={assigning || (fundingChoice === "now" && wallet && assignDialog.proposal && wallet.balance < getRequiredAmount(assignDialog.proposal))}
            >
              {assigning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              {fundingChoice === "now" ? "Confirm & Fund" : "Confirm & Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Proposal Detail Dialog */}
      <Dialog open={detailDialog.open} onOpenChange={(open) => setDetailDialog({ open, proposal: open ? detailDialog.proposal : null })}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Proposal Details</DialogTitle>
            <DialogDescription>
              Full proposal from {detailDialog.proposal?.freelancer?.full_name || "Expert"}
            </DialogDescription>
          </DialogHeader>
          {detailDialog.proposal && (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-6">
                {/* Expert Info */}
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={detailDialog.proposal.freelancer?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-lg">
                      {(detailDialog.proposal.freelancer?.full_name || "U")[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <Link to={`/expert/${detailDialog.proposal.freelancer_id}/profile`} className="font-semibold text-foreground text-lg hover:text-primary hover:underline transition-colors">{detailDialog.proposal.freelancer?.full_name || "Expert"}</Link>
                    {detailDialog.proposal.freelancer?.state && (
                      <p className="text-sm text-muted-foreground">
                        {detailDialog.proposal.freelancer.city ? `${detailDialog.proposal.freelancer.city}, ` : ""}{detailDialog.proposal.freelancer.state}
                      </p>
                    )}
                  </div>
                </div>

                {/* Job */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">For Job</p>
                  <Link to={`/job/${detailDialog.proposal.job_id}`} className="text-primary hover:underline font-medium">{detailDialog.proposal.job_title}</Link>
                </div>

                {/* Cover Letter */}
                <div>
                  <p className="text-sm font-semibold text-foreground mb-2">Cover Letter</p>
                  <div className="p-4 rounded-lg bg-muted/50 border border-border text-sm whitespace-pre-wrap text-foreground">{detailDialog.proposal.cover_letter}</div>
                </div>

                {/* Payment Section */}
                <div>
                  <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    Payment Structure
                  </p>
                  <Badge variant="outline" className="mb-3">
                    {detailDialog.proposal.payment_type === "milestone" ? "Pay by Milestone" : "Pay by Project"}
                  </Badge>

                  {detailDialog.proposal.payment_type === "milestone" && detailDialog.proposal.milestones?.length > 0 ? (
                    <div className="space-y-3">
                      {detailDialog.proposal.milestones.map((ms: any, idx: number) => (
                        <div key={idx} className="p-3 rounded-lg border border-border bg-muted/30 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">{ms.title}</p>
                            <p className="text-xs text-muted-foreground">
                              Duration: {ms.duration ? `${ms.duration} ${ms.duration_unit || ms.durationUnit || "days"}` : (ms.date ? new Date(ms.date).toLocaleDateString() : "—")}
                            </p>
                          </div>
                          <p className="font-semibold text-foreground">{formatNaira(ms.amount)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm p-3 rounded-lg border border-border bg-muted/30">
                        <span className="text-muted-foreground">Bid Amount</span>
                        <span className="font-semibold text-foreground">{formatNaira(detailDialog.proposal.bid_amount)}</span>
                      </div>
                      <div className="flex justify-between text-sm p-3 rounded-lg border border-border bg-muted/30">
                        <span className="text-muted-foreground">Delivery</span>
                        <span className="font-medium text-foreground">{formatDurationDisplay(detailDialog.proposal.delivery_days, detailDialog.proposal.delivery_unit)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Attachments */}
                {detailDialog.proposal.attachments && detailDialog.proposal.attachments.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-2">Attachments</p>
                    <div className="space-y-1">
                      {detailDialog.proposal.attachments.map((url: string, idx: number) => {
                        const name = url.split("/").pop() || `Attachment ${idx + 1}`;
                        return (
                          <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors text-sm">
                            <Download className="h-4 w-4 text-primary shrink-0" />
                            <span className="truncate text-foreground">{decodeURIComponent(name.replace(/^\d+_/, ''))}</span>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Status: {statusBadge(detailDialog.proposal.status)}</span>
                  <span>Submitted: {formatDistanceToNow(new Date(detailDialog.proposal.created_at), { addSuffix: true })}</span>
                </div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialog({ open: false, proposal: null })}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Interview Confirmation Dialog */}
      <Dialog open={interviewConfirm.open} onOpenChange={(open) => !open && setInterviewConfirm({ open: false, proposal: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Interview</DialogTitle>
            <DialogDescription>
              Do you want to proceed to interview <strong>{interviewConfirm.proposal?.freelancer?.full_name || "this expert"}</strong>? This will create a chat thread for discussion.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInterviewConfirm({ open: false, proposal: null })}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!interviewConfirm.proposal) return;
                setInterviewConfirm({ open: false, proposal: null });
                await updateProposalStatus(interviewConfirm.proposal.id, "interviewing");
              }}
              disabled={interviewingId === interviewConfirm.proposal?.id}
            >
              {interviewingId === interviewConfirm.proposal?.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserCheck className="h-4 w-4 mr-2" />}
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <KycRequiredModal open={showKycModal} onClose={() => setShowKycModal(false)} action="hire an expert and start a contract" />
    </div>
  );
}

