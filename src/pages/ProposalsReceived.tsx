import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { useCurrency } from "@/hooks/useCurrency";
import { useKycVerification } from "@/hooks/useKycVerification";
import { KycRequiredModal } from "@/components/KycRequiredModal";
import { VerificationBadges } from "@/components/VerificationBadges";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  FileText, Loader2, ArrowLeft, Clock, CheckCircle2, X, UserCheck, MessageSquare,
  Wallet, ShieldCheck, Eye, DollarSign, Download, Briefcase, TrendingUp, ChevronLeft,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  ClientReceivedProposal,
  ClientReceivedWallet,
  ClientReceivedJob,
  ClientReceivedContract,
  ProposalMilestone,
} from "@/types/proposals";

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
  const { format } = useCurrency();
  const { user, bootstrapStatus } = useAuth();
  const navigate = useNavigate();
  const [proposals, setProposals] = useState<ClientReceivedProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState<ClientReceivedWallet | null>(null);
  const [assignDialog, setAssignDialog] = useState<{ open: boolean; proposal: ClientReceivedProposal | null }>({ open: false, proposal: null });
  const [detailDialog, setDetailDialog] = useState<{ open: boolean; proposal: ClientReceivedProposal | null }>({ open: false, proposal: null });
  const [interviewConfirm, setInterviewConfirm] = useState<{ open: boolean; proposal: ClientReceivedProposal | null }>({ open: false, proposal: null });
  const [assigning, setAssigning] = useState(false);
  const [fundingChoice, setFundingChoice] = useState<"now" | "later">("now");
  const [interviewingId, setInterviewingId] = useState<string | null>(null);
  const { isVerified: kycVerified } = useKycVerification();
  const [showKycModal, setShowKycModal] = useState(false);
  const [jobContracts, setJobContracts] = useState<Map<string, ClientReceivedContract>>(new Map());
  const [jobsData, setJobsData] = useState<ClientReceivedJob[]>([]);

  // Split-panel state
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  // On mobile: "jobs" shows the list, "proposals" shows the right panel
  const [mobileView, setMobileView] = useState<"jobs" | "proposals">("jobs");

  const proposalsOverviewQuery = useQuery({
    queryKey: ["client-received-proposals", user?.id],
    enabled: bootstrapStatus === "ready" && !!user,
    staleTime: 0,
    refetchOnWindowFocus: true,
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
    const contractMap = new Map<string, ClientReceivedContract>();
    (data.jobContracts || []).forEach((contract) => {
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
    if (status === "interviewing" && proposal) {
      await handleStartInterview(proposal);
      return;
    }
    if (status === "rejected" && proposal) {
      await handleRejectProposal(proposal);
      return;
    }
    try {
      await updateClientProposalStatus(proposalId, status);
      toast.success(`Proposal ${status}`);
      setProposals((prev) => prev.map((p) => (p.id === proposalId ? { ...p, status } : p)));
    } catch {
      toast.error("Failed to update proposal");
    }
  };

  const handleStartInterview = async (proposal: ClientReceivedProposal) => {
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

  const handleRejectProposal = async (proposal: ClientReceivedProposal) => {
    try {
      await rejectClientProposal(proposal.id);
      toast.success("Proposal rejected");
      setProposals((prev) => prev.map((p) => (p.id === proposal.id ? { ...p, status: "rejected" } : p)));
    } catch {
      toast.error("Failed to reject proposal");
    }
  };

  const getRequiredAmount = (proposal: ClientReceivedProposal) => {
    if (proposal.payment_type === "milestone" && proposal.milestones?.length > 0) {
      return proposal.milestones[0].amount;
    }
    return proposal.bid_amount;
  };

  const handleAcceptAndAssign = async () => {
    const proposal = assignDialog.proposal;
    if (!proposal || !user) return;
    const requiredAmount = getRequiredAmount(proposal);
    const fundNow = fundingChoice === "now";
    if (fundNow && wallet && wallet.balance < requiredAmount) {
      toast.error(`Insufficient wallet balance. You need at least ${format(requiredAmount)} to assign.`);
      setAssignDialog({ open: false, proposal: null });
      return;
    }
    setAssigning(true);
    try {
      const result = await acceptAndAssignClientProposal(proposal.id, fundNow);
      toast.success("Expert assigned and contract created!");
      setAssignDialog({ open: false, proposal: null });
      navigate(`/contract/${result.contractId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign expert");
    } finally {
      setAssigning(false);
    }
  };

  const openAssignDialog = (proposal: ClientReceivedProposal) => {
    setFundingChoice("now");
    setAssignDialog({ open: true, proposal });
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: LucideIcon }> = {
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
        <Icon className="h-3 w-3" /> {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const contractStatusLabel = (status: string) => {
    const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      active: { variant: "default", label: "Active" },
      completed: { variant: "secondary", label: "Completed" },
      pending_funding: { variant: "outline", label: "Pending Funding" },
      disputed: { variant: "destructive", label: "Disputed" },
    };
    const cfg = map[status] || { variant: "outline" as const, label: status };
    return <Badge variant={cfg.variant} className="text-xs">{cfg.label}</Badge>;
  };

  const allGroups = useMemo(() => {
    const jobMap = new Map<string, ClientReceivedProposal[]>();
    proposals.forEach((p) => {
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
      job: jobsData.find((j) => j.id === jobId) || null,
      contract: jobContracts.get(jobId) || null,
      proposals: jobMap.get(jobId)!,
    }));
  }, [proposals, jobContracts, jobsData]);

  // Auto-select first job once data loads
  useEffect(() => {
    if (allGroups.length > 0 && !selectedJobId) {
      setSelectedJobId(allGroups[0].jobId);
    }
  }, [allGroups, selectedJobId]);

  const selectedGroup = allGroups.find(g => g.jobId === selectedJobId) || null;
  const filteredProposals = selectedGroup
    ? statusFilter === "all"
      ? selectedGroup.proposals
      : selectedGroup.proposals.filter(p => p.status === statusFilter)
    : [];

  const actionableProposals = proposals.filter((p) => p.status === "pending" || p.status === "interviewing");
  const minRequired = actionableProposals.length > 0
    ? Math.min(...actionableProposals.map((p) => getRequiredAmount(p)))
    : 0;
  const paymentReady = wallet !== null &&
    (actionableProposals.length === 0 || wallet.balance >= minRequired);

  if (!user && bootstrapStatus === "loading") {
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

  const statusFilters = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "interviewing", label: "Interviewing" },
    { value: "accepted", label: "Accepted" },
    { value: "rejected", label: "Rejected" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-4 sm:py-8">
        <div className="container-wide">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Proposals Received</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={paymentReady ? "default" : "destructive"} className="gap-1">
                {paymentReady ? <ShieldCheck className="h-3 w-3" /> : <Wallet className="h-3 w-3" />}
                {paymentReady ? "Payment Ready" : "Payment Not Verified"}
              </Badge>
              {wallet && (
                <span className="text-sm text-muted-foreground">Balance: {format(wallet.balance)}</span>
              )}
            </div>
          </div>

          {!paymentReady && actionableProposals.length > 0 && (
            <Alert className="mb-4 border-destructive/30 bg-destructive/5">
              <Wallet className="h-4 w-4 text-destructive" />
              <AlertDescription className="text-sm">
                Your wallet balance ({format(wallet?.balance || 0)}) is insufficient to assign any expert. You need at least {format(minRequired)}.{" "}
                <Link to="/transactions" className="text-primary hover:underline font-medium">Fund Wallet →</Link>
              </AlertDescription>
            </Alert>
          )}

          {loading && proposals.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : allGroups.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No proposals yet</p>
              <p className="text-sm mt-1">Proposals from experts will appear here once they apply to your jobs.</p>
            </div>
          ) : (
            <>
              {/* ── Desktop split panel ── */}
              <div className="hidden md:flex rounded-xl border border-border overflow-hidden bg-card" style={{ minHeight: "600px" }}>
                {/* Left: Job List (1/3) */}
                <div className="w-1/3 border-r border-border flex flex-col">
                  <div className="px-4 py-3 border-b border-border bg-muted/30">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {allGroups.length} Job{allGroups.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <ScrollArea className="flex-1">
                    {allGroups.map((group) => {
                      const pendingCount = group.proposals.filter((p) => p.status === "pending").length;
                      const isSelected = selectedJobId === group.jobId;
                      const isAssigned = !!group.contract;
                      return (
                        <button
                          key={group.jobId}
                          onClick={() => { setSelectedJobId(group.jobId); setStatusFilter("all"); }}
                          className={`w-full text-left px-4 py-3.5 border-b border-border/50 transition-colors hover:bg-muted/40 ${
                            isSelected ? "bg-primary/10 border-l-[3px] border-l-primary" : "border-l-[3px] border-l-transparent"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm font-medium leading-snug line-clamp-2 ${isAssigned ? "text-muted-foreground" : "text-foreground"}`}>
                              {group.jobTitle}
                            </p>
                            {pendingCount > 0 && !isAssigned && (
                              <span className="shrink-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1">
                                {pendingCount}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <span className="text-xs text-muted-foreground">{group.proposals.length} proposal{group.proposals.length !== 1 ? "s" : ""}</span>
                            {group.contract && (
                              <>{contractStatusLabel(group.contract.status)}</>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </ScrollArea>
                </div>

                {/* Right: Proposals (2/3) */}
                <div className="flex-1 flex flex-col min-w-0">
                  {selectedGroup ? (
                    <>
                      {/* Right header */}
                      <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <Link to={`/job/${selectedGroup.jobId}`} className="font-semibold text-foreground hover:text-primary hover:underline truncate block">
                            {selectedGroup.jobTitle}
                          </Link>
                          <p className="text-xs text-muted-foreground">{selectedGroup.proposals.length} proposal{selectedGroup.proposals.length !== 1 ? "s" : ""}</p>
                        </div>
                        {selectedGroup.contract && (
                          <Button size="sm" variant="outline" className="text-xs shrink-0" onClick={() => navigate(`/contract/${selectedGroup.contract.id}`)}>
                            View Contract
                          </Button>
                        )}
                      </div>

                      {/* Status filter chips */}
                      <div className="px-5 py-2.5 border-b border-border/50 flex gap-1.5 flex-wrap">
                        {statusFilters.map((f) => {
                          const count = f.value === "all"
                            ? selectedGroup.proposals.length
                            : selectedGroup.proposals.filter((p) => p.status === f.value).length;
                          if (f.value !== "all" && count === 0) return null;
                          return (
                            <button
                              key={f.value}
                              onClick={() => setStatusFilter(f.value)}
                              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                statusFilter === f.value
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground hover:bg-muted/80"
                              }`}
                            >
                              {f.label} {count > 0 && `(${count})`}
                            </button>
                          );
                        })}
                      </div>

                      <ScrollArea className="flex-1">
                        {filteredProposals.length === 0 ? (
                          <div className="text-center py-16 text-muted-foreground">
                            <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
                            <p className="text-sm">No {statusFilter !== "all" ? statusFilter : ""} proposals for this job</p>
                          </div>
                        ) : (
                          <div className={`p-3 space-y-2 ${selectedGroup.contract ? "opacity-60" : ""}`}>
                            {filteredProposals.map((proposal) => (
                              <ProposalCard
                                key={proposal.id}
                                proposal={proposal}
                                job={selectedGroup.job}
                                isAssigned={!!selectedGroup.contract}
                                format={format}
                                interviewingId={interviewingId}
                                statusBadge={statusBadge}
                                onInterview={(p) => setInterviewConfirm({ open: true, proposal: p })}
                                onAssign={openAssignDialog}
                                onReject={(p) => updateProposalStatus(p.id, "rejected")}
                                onDetail={(p) => setDetailDialog({ open: true, proposal: p })}
                              />
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <Briefcase className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">Select a job to view its proposals</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Mobile stacked view ── */}
              <div className="md:hidden">
                {mobileView === "jobs" ? (
                  <div className="rounded-xl border border-border overflow-hidden bg-card">
                    <div className="px-4 py-3 border-b border-border bg-muted/30">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {allGroups.length} Job{allGroups.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    {allGroups.map((group) => {
                      const pendingCount = group.proposals.filter((p) => p.status === "pending").length;
                      const isAssigned = !!group.contract;
                      return (
                        <button
                          key={group.jobId}
                          onClick={() => { setSelectedJobId(group.jobId); setStatusFilter("all"); setMobileView("proposals"); }}
                          className="w-full text-left px-4 py-4 border-b border-border/50 hover:bg-muted/30 transition-colors flex items-center justify-between gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium leading-snug ${isAssigned ? "text-muted-foreground" : "text-foreground"}`}>
                              {group.jobTitle}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className="text-xs text-muted-foreground">{group.proposals.length} proposal{group.proposals.length !== 1 ? "s" : ""}</span>
                              {group.contract && contractStatusLabel(group.contract.status)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {pendingCount > 0 && !isAssigned && (
                              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1">
                                {pendingCount}
                              </span>
                            )}
                            <ChevronLeft className="h-4 w-4 text-muted-foreground rotate-180" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : selectedGroup ? (
                  <div className="rounded-xl border border-border overflow-hidden bg-card">
                    <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-3">
                      <button onClick={() => setMobileView("jobs")} className="text-muted-foreground hover:text-foreground transition-colors">
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate">{selectedGroup.jobTitle}</p>
                        <p className="text-xs text-muted-foreground">{selectedGroup.proposals.length} proposals</p>
                      </div>
                      {selectedGroup.contract && (
                        <Button size="sm" variant="outline" className="text-xs shrink-0" onClick={() => navigate(`/contract/${selectedGroup.contract.id}`)}>
                          Contract
                        </Button>
                      )}
                    </div>
                    <div className="px-4 py-2.5 border-b border-border/50 flex gap-1.5 overflow-x-auto">
                      {statusFilters.map((f) => {
                        const count = f.value === "all"
                          ? selectedGroup.proposals.length
                          : selectedGroup.proposals.filter((p) => p.status === f.value).length;
                        if (f.value !== "all" && count === 0) return null;
                        return (
                          <button
                            key={f.value}
                            onClick={() => setStatusFilter(f.value)}
                            className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                              statusFilter === f.value
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {f.label} {count > 0 && `(${count})`}
                          </button>
                        );
                      })}
                    </div>
                    <div className={`p-3 space-y-2 ${selectedGroup.contract ? "opacity-60" : ""}`}>
                      {filteredProposals.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
                          <p className="text-sm">No {statusFilter !== "all" ? statusFilter : ""} proposals</p>
                        </div>
                      ) : filteredProposals.map((proposal) => (
                        <ProposalCard
                          key={proposal.id}
                          proposal={proposal}
                          job={selectedGroup.job}
                          isAssigned={!!selectedGroup.contract}
                          format={format}
                          interviewingId={interviewingId}
                          statusBadge={statusBadge}
                          onInterview={(p) => setInterviewConfirm({ open: true, proposal: p })}
                          onAssign={openAssignDialog}
                          onReject={(p) => updateProposalStatus(p.id, "rejected")}
                          onDetail={(p) => setDetailDialog({ open: true, proposal: p })}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />

      {/* Assignment Confirmation Dialog */}
      <Dialog open={assignDialog.open} onOpenChange={(open) => setAssignDialog({ open, proposal: open ? assignDialog.proposal : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Expert & Create Contract</DialogTitle>
            <DialogDescription>
              You're about to assign this expert and create a contract.
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
                <span className="font-bold text-primary">{format(assignDialog.proposal.bid_amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Delivery</span>
                <span>{formatDurationDisplay(assignDialog.proposal.delivery_days, assignDialog.proposal.delivery_unit)}</span>
              </div>
              <div className="space-y-2 pt-2 border-t border-border">
                <p className="text-sm font-semibold text-foreground">When would you like to fund?</p>
                <RadioGroup value={fundingChoice} onValueChange={(v) => setFundingChoice(v as "now" | "later")} className="space-y-2">
                  <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/30 cursor-pointer">
                    <RadioGroupItem value="now" id="fund-now" className="mt-0.5" />
                    <Label htmlFor="fund-now" className="cursor-pointer flex-1">
                      <span className="font-medium text-foreground">Fund Now</span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Pay {format(getRequiredAmount(assignDialog.proposal))} now. Expert can start right away.
                      </p>
                    </Label>
                  </div>
                  <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/30 cursor-pointer">
                    <RadioGroupItem value="later" id="fund-later" className="mt-0.5" />
                    <Label htmlFor="fund-later" className="cursor-pointer flex-1">
                      <span className="font-medium text-foreground">Fund Later</span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Create the contract now, fund milestones later. Expert cannot begin until funded.
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
                      {format(wallet?.balance || 0)}
                    </span>
                  </div>
                  {assignDialog.proposal.payment_type === "milestone" && assignDialog.proposal.milestones?.length > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Required Now (1st Milestone)</span>
                      <span className="font-bold text-primary">{format(assignDialog.proposal.milestones[0].amount)}</span>
                    </div>
                  )}
                  {wallet && wallet.balance < getRequiredAmount(assignDialog.proposal) && (
                    <Alert className="border-destructive/30 bg-destructive/5">
                      <Wallet className="h-4 w-4 text-destructive" />
                      <AlertDescription className="text-sm">
                        Insufficient balance. You need at least {format(getRequiredAmount(assignDialog.proposal))}.{" "}
                        <a href="/transactions" className="text-primary hover:underline font-medium">Fund Wallet →</a>
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}
              {fundingChoice === "later" && (
                <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm text-muted-foreground">
                  💡 Contract created with <strong className="text-foreground">Pending Funding</strong> status. Fund milestones from the contract page.
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
            <DialogDescription>Full proposal from {detailDialog.proposal?.freelancer?.full_name || "Expert"}</DialogDescription>
          </DialogHeader>
          {detailDialog.proposal && (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={detailDialog.proposal.freelancer?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-lg">
                      {(detailDialog.proposal.freelancer?.full_name || "U")[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <Link to={`/expert/${detailDialog.proposal.freelancer_id}/profile`} className="font-semibold text-foreground text-lg hover:text-primary hover:underline">
                      {detailDialog.proposal.freelancer?.full_name || "Expert"}
                    </Link>
                    {detailDialog.proposal.freelancer?.state && (
                      <p className="text-sm text-muted-foreground">
                        {detailDialog.proposal.freelancer.city ? `${detailDialog.proposal.freelancer.city}, ` : ""}{detailDialog.proposal.freelancer.state}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">For Job</p>
                  <Link to={`/job/${detailDialog.proposal.job_id}`} className="text-primary hover:underline font-medium">{detailDialog.proposal.job_title}</Link>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground mb-2">Cover Letter</p>
                  <div className="p-4 rounded-lg bg-muted/50 border border-border text-sm whitespace-pre-wrap text-foreground">{detailDialog.proposal.cover_letter}</div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />Payment Structure
                  </p>
                  <Badge variant="outline" className="mb-3">
                    {detailDialog.proposal.payment_type === "milestone" ? "Pay by Milestone" : "Pay by Project"}
                  </Badge>
                  {detailDialog.proposal.payment_type === "milestone" && detailDialog.proposal.milestones?.length > 0 ? (
                    <div className="space-y-3">
                      {detailDialog.proposal.milestones.map((ms: ProposalMilestone, idx: number) => (
                        <div key={idx} className="p-3 rounded-lg border border-border bg-muted/30 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">{ms.title}</p>
                            <p className="text-xs text-muted-foreground">
                              Duration: {ms.duration ? `${ms.duration} ${ms.duration_unit || ms.durationUnit || "days"}` : (ms.date ? new Date(ms.date).toLocaleDateString() : "—")}
                            </p>
                          </div>
                          <p className="font-semibold text-foreground">{format(ms.amount)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm p-3 rounded-lg border border-border bg-muted/30">
                        <span className="text-muted-foreground">Bid Amount</span>
                        <span className="font-semibold text-foreground">{format(detailDialog.proposal.bid_amount)}</span>
                      </div>
                      <div className="flex justify-between text-sm p-3 rounded-lg border border-border bg-muted/30">
                        <span className="text-muted-foreground">Delivery</span>
                        <span className="font-medium text-foreground">{formatDurationDisplay(detailDialog.proposal.delivery_days, detailDialog.proposal.delivery_unit)}</span>
                      </div>
                    </div>
                  )}
                </div>
                {detailDialog.proposal.attachments?.length > 0 && (
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
              Do you want to interview <strong>{interviewConfirm.proposal?.freelancer?.full_name || "this expert"}</strong>? This will create a chat thread.
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

/* ── Proposal Card (extracted for reuse in both desktop/mobile) ── */
function ProposalCard({
  proposal, job, isAssigned, format, interviewingId, statusBadge,
  onInterview, onAssign, onReject, onDetail,
}: {
  proposal: ClientReceivedProposal;
  job: ClientReceivedJob | null;
  isAssigned: boolean;
  format: (n: number) => string;
  interviewingId: string | null;
  statusBadge: (s: string) => React.ReactNode;
  onInterview: (p: ClientReceivedProposal) => void;
  onAssign: (p: ClientReceivedProposal) => void;
  onReject: (p: ClientReceivedProposal) => void;
  onDetail: (p: ClientReceivedProposal) => void;
}) {
  const coverLetter = proposal.cover_letter || "";
  const isLong = coverLetter.length > 280;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      {/* Header: avatar + name/location + status */}
      <div className="flex items-start gap-3 mb-3">
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarImage src={proposal.freelancer?.avatar_url || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-sm">
            {(proposal.freelancer?.full_name || "U")[0]}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link to={`/expert/${proposal.freelancer_id}/profile`} className="font-semibold text-sm text-foreground hover:text-primary hover:underline transition-colors">
              {proposal.freelancer?.full_name || "Expert"}
            </Link>
            {(proposal.kyc?.kyc_status === "verified" || proposal.freelancer?.is_verified) && (
              <VerificationBadges isVerified={true} isZentraVerified={proposal.kyc?.zentra_verified || false} role="freelancer" size="sm" />
            )}
          </div>
          {proposal.freelancer?.state && (
            <p className="text-xs text-muted-foreground">
              {proposal.freelancer.city ? `${proposal.freelancer.city}, ` : ""}{proposal.freelancer.state}
            </p>
          )}
        </div>
        <div className="shrink-0">{statusBadge(proposal.status)}</div>
      </div>

      {/* Cover letter */}
      <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap leading-relaxed">
        {coverLetter}
      </p>
      {isLong && (
        <button onClick={() => onDetail(proposal)} className="text-xs text-primary hover:underline mt-1 block">
          Read more →
        </button>
      )}

      {/* Attachments */}
      {proposal.attachments?.length > 0 && (
        <div className="mt-3 space-y-1">
          {proposal.attachments.map((url: string, idx: number) => {
            const name = url.split("/").pop() || `Attachment ${idx + 1}`;
            return (
              <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-1.5 rounded-lg border border-border hover:bg-muted/50 transition-colors text-xs">
                <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate text-foreground">{decodeURIComponent(name.replace(/^\d+_/, ''))}</span>
              </a>
            );
          })}
        </div>
      )}

      {/* Stat chips */}
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-xs font-medium text-foreground">
          <DollarSign className="h-3 w-3 text-muted-foreground" />{format(proposal.bid_amount)}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-xs font-medium text-foreground">
          <Clock className="h-3 w-3 text-muted-foreground" />{formatDurationDisplay(proposal.delivery_days, proposal.delivery_unit)}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(proposal.created_at), { addSuffix: true })}
        </span>
      </div>

      <ProposalAnalyticsStrip proposal={proposal} job={job} />

      {/* Actions */}
      {!isAssigned && (proposal.status === "pending" || proposal.status === "interviewing") && (
        <div className="flex items-center gap-2 mt-4">
          <Button size="sm" onClick={() => onAssign(proposal)} className="h-8">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Accept
          </Button>
          {proposal.status === "pending" && (
            <Button size="sm" variant="outline" onClick={() => onInterview(proposal)} disabled={interviewingId === proposal.id} className="h-8">
              {interviewingId === proposal.id
                ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                : <UserCheck className="h-3.5 w-3.5 mr-1.5" />}
              Interview
            </Button>
          )}
          <button
            onClick={() => onReject(proposal)}
            className="ml-auto text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
          >
            <X className="h-3.5 w-3.5" /> Decline
          </button>
        </div>
      )}
    </div>
  );
}

function ProposalAnalyticsStrip({ proposal, job }: { proposal: ClientReceivedProposal; job: ClientReceivedJob | null }) {
  if (!job) return null;
  const chips: { label: string; className: string }[] = [];

  if (job.budget_max && proposal.bid_amount) {
    const diff = proposal.bid_amount - job.budget_max;
    const pct = Math.round(Math.abs(diff / job.budget_max) * 100);
    if (diff > 0) chips.push({ label: `${pct}% over budget`, className: "border-destructive/60 text-destructive bg-destructive/5" });
    else if (diff < 0) chips.push({ label: `${pct}% under budget`, className: "border-emerald-400/60 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30" });
    else chips.push({ label: "Exact budget match", className: "border-primary/40 text-primary bg-primary/5" });
  }

  if (
    job.payment_type_preference === "milestone" &&
    Array.isArray(job.suggested_milestones) && job.suggested_milestones.length > 0 &&
    proposal.payment_type === "milestone" && Array.isArray(proposal.milestones)
  ) {
    const suggested = job.suggested_milestones.length;
    const actual = proposal.milestones.length;
    const diff = actual - suggested;
    if (diff === 0) chips.push({ label: `${actual} milestone${actual !== 1 ? "s" : ""} (as suggested)`, className: "border-primary/40 text-primary bg-primary/5" });
    else if (diff > 0) chips.push({ label: `+${diff} milestone${diff !== 1 ? "s" : ""} added`, className: "border-border text-muted-foreground" });
    else chips.push({ label: `${Math.abs(diff)} milestone${Math.abs(diff) !== 1 ? "s" : ""} fewer`, className: "border-amber-400/60 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30" });
  }

  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {chips.map((chip, i) => (
        <span key={i} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${chip.className}`}>
          <TrendingUp className="h-3 w-3 shrink-0" />{chip.label}
        </span>
      ))}
    </div>
  );
}
