import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatNaira } from "@/lib/nigerian-data";
import { useKycVerification } from "@/hooks/useKycVerification";
import { KycRequiredModal } from "@/components/KycRequiredModal";
import { formatDistanceToNow } from "date-fns";
import {
  MapPin, Clock, Briefcase, Calendar, ArrowLeft, Send, Loader2, Globe,
  UserCheck, Users, FileText, Download, Info, DollarSign, Tag, Layers, Wrench, Eye,
  CheckCircle2, X, Wallet, ShieldCheck, MessageSquare
} from "lucide-react";
import { FundingStatusBadge } from "@/components/FundingStatusBadge";
import { createNotification } from "@/lib/notifications";
import { toast } from "sonner";

function formatDurationDisplay(days: number, unit?: string): string {
  const u = unit || "days";
  if (u === "weeks") { const w = Math.round(days / 7); return `${w} week${w !== 1 ? "s" : ""}`; }
  if (u === "months") { const m = Math.round(days / 30); return `${m} month${m !== 1 ? "s" : ""}`; }
  return `${days} day${days !== 1 ? "s" : ""}`;
}

export default function JobDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [job, setJob] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [proposalCount, setProposalCount] = useState(0);
  const [interviewingCount, setInterviewingCount] = useState(0);
  const [similarJobs, setSimilarJobs] = useState<any[]>([]);
  const [hasApplied, setHasApplied] = useState(false);

  // Client proposal management state
  const [proposals, setProposals] = useState<any[]>([]);
  const [interviewContracts, setInterviewContracts] = useState<any[]>([]);
  const [assignDialog, setAssignDialog] = useState<{ open: boolean; proposal: any | null }>({ open: false, proposal: null });
  const [detailDialog, setDetailDialog] = useState<{ open: boolean; proposal: any | null }>({ open: false, proposal: null });
  const [interviewConfirm, setInterviewConfirm] = useState<{ open: boolean; proposal: any | null }>({ open: false, proposal: null });
  const [assigning, setAssigning] = useState(false);
  const [fundingChoice, setFundingChoice] = useState<"now" | "later">("now");
  const [interviewingId, setInterviewingId] = useState<string | null>(null);
  const { isVerified: kycVerified } = useKycVerification();
  const [showKycModal, setShowKycModal] = useState(false);
  const [jobAssigned, setJobAssigned] = useState(false);

  const isClient = profile?.role === "client" && job?.client_id === user?.id;

  useEffect(() => {
    if (id) fetchJob();
  }, [id]);

  useEffect(() => {
    if (id && user && profile?.role === "freelancer") {
      supabase.from("job_views").upsert(
        { job_id: id, viewer_id: user.id } as any,
        { onConflict: "job_id,viewer_id" }
      ).then(() => {});
    }
  }, [id, user, profile]);

  const fetchJob = async () => {
    const { data: jobData, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !jobData) {
      setLoading(false);
      return;
    }
    setJob(jobData);
    setJobAssigned(jobData.status === "in_progress" || jobData.status === "completed");

    const [clientRes, proposalRes, interviewRes, walletRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", jobData.client_id).single(),
      supabase.from("proposals").select("id", { count: "exact" }).eq("job_id", id!),
      supabase.from("proposals").select("id", { count: "exact" }).eq("job_id", id!).eq("status", "interviewing"),
      user ? supabase.from("wallets").select("*").eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    ]);

    setClient(clientRes.data);
    setProposalCount(proposalRes.count || 0);
    setInterviewingCount(interviewRes.count || 0);
    setWallet(walletRes.data);

    // Check if current user already applied (freelancer)
    if (user && profile?.role === "freelancer") {
      const { data: existing } = await supabase
        .from("proposals")
        .select("id")
        .eq("job_id", id!)
        .eq("freelancer_id", user.id)
        .maybeSingle();
      setHasApplied(!!existing);
    }

    // Fetch proposals & interviews for client
    if (user && jobData.client_id === user.id) {
      await fetchProposalsForJob(id!);
      await fetchInterviewContracts(id!);
    }

    // Fetch similar jobs (freelancer) or other jobs (client)
    if (profile?.role === "freelancer") {
      const { data: similar } = await supabase
        .from("jobs")
        .select("id, title, budget_min, budget_max, is_hourly, created_at, state, city, is_remote, delivery_days, status")
        .eq("status", "open")
        .neq("id", id!)
        .limit(4);
      setSimilarJobs(similar || []);
    } else if (profile?.role === "client" && jobData.client_id === user?.id) {
      const { data: otherJobs } = await supabase
        .from("jobs")
        .select("id, title, budget_min, budget_max, is_hourly, created_at, state, city, is_remote, delivery_days, status")
        .eq("client_id", user!.id)
        .neq("id", id!)
        .order("created_at", { ascending: false })
        .limit(4);
      setSimilarJobs(otherJobs || []);
    }

    setLoading(false);
  };

  const fetchProposalsForJob = async (jobId: string) => {
    const { data } = await supabase
      .from("proposals")
      .select("*, freelancer:profiles!proposals_freelancer_id_fkey(id, full_name, avatar_url, state, city)")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false });
    setProposals(data || []);
  };

  const fetchInterviewContracts = async (jobId: string) => {
    const { data } = await supabase
      .from("contracts")
      .select("*, freelancer:profiles!contracts_freelancer_id_fkey(id, full_name, avatar_url, state, city)")
      .eq("job_id", jobId)
      .in("status", ["interviewing" as any])
      .order("created_at", { ascending: false });
    setInterviewContracts(data || []);
  };

  // ===== Proposal action handlers (from ProposalsReceived logic) =====

  const handleStartInterview = async (proposal: any) => {
    setInterviewingId(proposal.id);
    const { data: jobData } = await supabase
      .from("jobs")
      .select("title, description, budget_min, budget_max, delivery_days, delivery_unit, attachments, required_skills, required_software")
      .eq("id", proposal.job_id)
      .single();

    const { error: propError } = await supabase
      .from("proposals")
      .update({ status: "interviewing" } as any)
      .eq("id", proposal.id);

    if (propError) { toast.error("Failed to start interview"); setInterviewingId(null); return; }

    const { data: contractData, error: contractError } = await supabase.from("contracts").insert({
      job_id: proposal.job_id,
      client_id: user!.id,
      freelancer_id: proposal.freelancer_id,
      proposal_id: proposal.id,
      amount: proposal.bid_amount,
      status: "interviewing" as any,
      job_title: jobData?.title || job?.title,
      job_description: jobData?.description || null,
      job_budget_min: jobData?.budget_min || null,
      job_budget_max: jobData?.budget_max || null,
      job_delivery_days: jobData?.delivery_days || null,
      job_delivery_unit: jobData?.delivery_unit || "days",
      job_attachments: jobData?.attachments || [],
      accepted_cover_letter: proposal.cover_letter,
      accepted_bid_amount: proposal.bid_amount,
      accepted_attachments: proposal.attachments || [],
      accepted_payment_type: proposal.payment_type || "project",
    } as any).select().single();

    if (contractError || !contractData) { toast.error("Failed to create interview contract"); setInterviewingId(null); return; }

    const jobTitle = jobData?.title || job?.title || "a job";
    await supabase.from("contract_messages").insert({
      contract_id: contractData.id,
      sender_id: user!.id,
      content: `💬 Interview started for "${jobTitle}". Discuss the project details here.`,
      is_system_message: true,
    } as any);

    if (proposal.cover_letter) {
      await supabase.from("contract_messages").insert({
        contract_id: contractData.id,
        sender_id: proposal.freelancer_id,
        content: `📋 **Original Proposal:**\n\n${proposal.cover_letter}`,
        is_system_message: true,
      } as any);
    }

    await createNotification({
      userId: proposal.freelancer_id,
      type: "interview_started",
      title: "Interview Started",
      message: `${profile?.full_name || "A client"} started an interview for "${jobTitle}"`,
      contractId: contractData.id,
    });

    toast.success("Interview started! A chat thread has been created.");
    setProposals(prev => prev.map(p => p.id === proposal.id ? { ...p, status: "interviewing" } : p));
    setInterviewingId(null);
    await fetchInterviewContracts(id!);
    setInterviewingCount(prev => prev + 1);
  };

  const handleRejectProposal = async (proposal: any) => {
    const { error: propError } = await supabase
      .from("proposals")
      .update({ status: "rejected" } as any)
      .eq("id", proposal.id);

    if (propError) { toast.error("Failed to reject proposal"); return; }

    const { data: contracts } = await supabase
      .from("contracts")
      .select("id")
      .eq("proposal_id", proposal.id)
      .eq("status", "interviewing" as any);

    if (contracts?.length) {
      for (const c of contracts) {
        await supabase.from("contracts").update({ status: "rejected" as any } as any).eq("id", c.id);
        await supabase.from("contract_messages").insert({
          contract_id: c.id,
          sender_id: user!.id,
          content: `❌ This interview has been closed. The proposal was declined.`,
          is_system_message: true,
        } as any);
      }
    }

    const jobTitle = job?.title || "a job";
    await createNotification({
      userId: proposal.freelancer_id,
      type: "proposal_rejected",
      title: "Proposal Declined",
      message: `Your proposal for "${jobTitle}" was declined.`,
      contractId: contracts?.[0]?.id || null,
    });

    toast.success("Proposal rejected");
    setProposals(prev => prev.map(p => p.id === proposal.id ? { ...p, status: "rejected" } : p));
    setInterviewContracts(prev => prev.filter(c => !contracts?.some(rc => rc.id === c.id)));
  };

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
  };

  const getRequiredAmount = (proposal: any) => {
    if (proposal.payment_type === "milestone" && proposal.milestones?.length > 0) {
      return proposal.milestones[0].amount;
    }
    return proposal.bid_amount;
  };

  const handleAcceptAndAssign = async () => {
    const proposal = assignDialog.proposal;
    if (!proposal || !user) return;

    // KYC gating
    if (!kycVerified) {
      setAssignDialog({ open: false, proposal: null });
      setShowKycModal(true);
      return;
    }

    const requiredAmount = getRequiredAmount(proposal);
    const fundNow = fundingChoice === "now";

    if (fundNow) {
      if (!wallet || wallet.balance < requiredAmount) {
        toast.error(`Insufficient wallet balance. You need at least ${formatNaira(requiredAmount)} to assign.`);
        setAssignDialog({ open: false, proposal: null });
        return;
      }
    }

    setAssigning(true);

    const { data: jobData } = await supabase
      .from("jobs")
      .select("title, description, budget_min, budget_max, delivery_days, delivery_unit, attachments, required_skills, required_software")
      .eq("id", proposal.job_id)
      .single();

    const { error: propError } = await supabase
      .from("proposals")
      .update({ status: "accepted" } as any)
      .eq("id", proposal.id);

    if (propError) { toast.error("Failed to accept proposal"); setAssigning(false); return; }

    let contractData: any = null;
    const { data: existingContracts } = await supabase
      .from("contracts")
      .select("*")
      .eq("proposal_id", proposal.id)
      .eq("status", "interviewing" as any);

    if (existingContracts?.length) {
      const newStatus = fundNow ? "active" : "pending_funding";
      const { data: updated, error: updateErr } = await supabase
        .from("contracts")
        .update({ status: newStatus as any, started_at: new Date().toISOString() } as any)
        .eq("id", existingContracts[0].id)
        .select()
        .single();
      if (updateErr) { toast.error("Failed to activate contract"); setAssigning(false); return; }
      contractData = updated;
    } else {
      const newStatus = fundNow ? "active" : "pending_funding";
      const { data: newContract, error: contractError } = await supabase.from("contracts").insert({
        job_id: proposal.job_id,
        client_id: user.id,
        freelancer_id: proposal.freelancer_id,
        proposal_id: proposal.id,
        amount: proposal.bid_amount,
        status: newStatus as any,
        job_title: jobData?.title || job?.title,
        job_description: jobData?.description || null,
        job_budget_min: jobData?.budget_min || null,
        job_budget_max: jobData?.budget_max || null,
        job_delivery_days: jobData?.delivery_days || null,
        job_delivery_unit: jobData?.delivery_unit || "days",
        job_attachments: jobData?.attachments || [],
        accepted_cover_letter: proposal.cover_letter,
        accepted_bid_amount: proposal.bid_amount,
        accepted_attachments: proposal.attachments || [],
        accepted_payment_type: proposal.payment_type || "project",
      } as any).select().single();

      if (contractError) { toast.error("Failed to create contract"); setAssigning(false); return; }
      contractData = newContract;

      const jobTitle = job?.title || "a job";
      await supabase.from("contract_messages").insert({
        contract_id: contractData.id,
        sender_id: user.id,
        content: `🎉 Contract created for "${jobTitle}". Welcome aboard! Let's get started.`,
        is_system_message: true,
      } as any);

      if (proposal.cover_letter) {
        await supabase.from("contract_messages").insert({
          contract_id: contractData.id,
          sender_id: proposal.freelancer_id,
          content: `📋 **Original Proposal:**\n\n${proposal.cover_letter}`,
          is_system_message: true,
        } as any);
      }
    }

    await supabase.from("contract_messages").insert({
      contract_id: contractData.id,
      sender_id: user.id,
      content: `🎉 Congratulations! You have been hired for this project. The contract is now active.`,
      is_system_message: true,
    } as any);

    await supabase.from("jobs").update({ status: "in_progress" }).eq("id", proposal.job_id);

    // Close other interviewing contracts
    const { data: otherInterviews } = await supabase
      .from("contracts")
      .select("id")
      .eq("job_id", proposal.job_id)
      .eq("status", "interviewing" as any)
      .neq("id", contractData.id);

    if (otherInterviews?.length) {
      for (const oc of otherInterviews) {
        await supabase.from("contracts").update({ status: "cancelled" as any } as any).eq("id", oc.id);
        await supabase.from("contract_messages").insert({
          contract_id: oc.id,
          sender_id: user.id,
          content: `📋 This job has been assigned to another expert. This interview is now closed.`,
          is_system_message: true,
        } as any);
      }
    }

    // Reject other pending/interviewing proposals
    await supabase
      .from("proposals")
      .update({ status: "rejected" } as any)
      .eq("job_id", proposal.job_id)
      .neq("id", proposal.id)
      .in("status", ["pending", "interviewing"]);

    // Create milestones
    if (proposal.payment_type === "milestone" && proposal.milestones?.length > 0) {
      const milestoneInserts = proposal.milestones.map((ms: any, idx: number) => ({
        contract_id: contractData.id,
        title: ms.title,
        amount: ms.amount,
        due_date: ms.date || null,
        status: (fundNow && idx === 0) ? "funded" : "pending",
        funded_at: (fundNow && idx === 0) ? new Date().toISOString() : null,
      }));
      const { data: createdMilestones } = await supabase.from("milestones").insert(milestoneInserts).select();

      if (fundNow && createdMilestones?.[0]) {
        await supabase.from("wallets").update({
          balance: wallet.balance - requiredAmount,
          escrow_balance: (wallet.escrow_balance || 0) + requiredAmount,
          total_spent: (wallet.total_spent || 0) + requiredAmount,
        }).eq("user_id", user.id);

        await supabase.from("wallet_transactions").insert({
          user_id: user.id, type: "escrow_lock", amount: requiredAmount,
          balance_after: wallet.balance - requiredAmount,
          description: `Funded 1st milestone for "${job?.title}"`,
          contract_id: contractData.id,
        });

        await supabase.from("escrow_ledger").insert({
          contract_id: contractData.id,
          milestone_id: createdMilestones[0].id,
          held_amount: requiredAmount,
          status: "held",
        });
      }
    } else {
      const milestoneStatus = fundNow ? "funded" : "pending";
      const { data: createdMs } = await supabase.from("milestones").insert({
        contract_id: contractData.id, title: "Full Project Delivery",
        amount: proposal.bid_amount, status: milestoneStatus,
        funded_at: fundNow ? new Date().toISOString() : null,
      }).select().single();

      if (fundNow && createdMs) {
        await supabase.from("wallets").update({
          balance: wallet.balance - proposal.bid_amount,
          escrow_balance: (wallet.escrow_balance || 0) + proposal.bid_amount,
          total_spent: (wallet.total_spent || 0) + proposal.bid_amount,
        }).eq("user_id", user.id);

        await supabase.from("wallet_transactions").insert({
          user_id: user.id, type: "escrow_lock", amount: proposal.bid_amount,
          balance_after: wallet.balance - proposal.bid_amount,
          description: `Escrow for project: "${job?.title}"`,
          contract_id: contractData.id,
        });

        await supabase.from("escrow_ledger").insert({
          contract_id: contractData.id,
          milestone_id: createdMs.id,
          held_amount: proposal.bid_amount,
          status: "held",
        });
      }
    }

    // Funding message
    if (!fundNow) {
      await supabase.from("contract_messages").insert({
        contract_id: contractData.id,
        sender_id: user.id,
        content: `⏳ Contract created but funding is pending. The client will fund the milestone(s) before work begins.`,
        is_system_message: true,
      } as any);
    } else {
      await supabase.from("contract_messages").insert({
        contract_id: contractData.id,
        sender_id: user.id,
        content: `💰 Funds have been deposited into escrow. Work can begin!`,
        is_system_message: true,
      } as any);
    }

    const jobTitle = job?.title || "a job";
    await createNotification({
      userId: proposal.freelancer_id,
      type: "hired",
      title: "You've Been Hired! 🎉",
      message: `Congratulations! You have been hired for "${jobTitle}".`,
      contractId: contractData.id,
    });

    toast.success("Expert assigned and contract created!");
    setAssignDialog({ open: false, proposal: null });
    setAssigning(false);
    navigate(`/contract/${contractData.id}`);
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

  // ===== Render =====

  if (loading) {
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

  if (!job) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Job not found</h2>
            <Button asChild><Link to="/jobs">Browse Jobs</Link></Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const isAssigned = job.status === "in_progress" || job.status === "completed" || job.status === "cancelled";
  const canApply = profile?.role === "freelancer" && job.status === "open" && !hasApplied;
  const paymentReady = wallet && wallet.balance > 0;

  const deliveryLabel = () => {
    const d = job.delivery_days || 0;
    const u = job.delivery_unit || "days";
    if (u === "weeks") { const w = Math.round(d / 7); return `${w} week${w !== 1 ? "s" : ""}`; }
    if (u === "months") { const m = Math.round(d / 30); return `${m} month${m !== 1 ? "s" : ""}`; }
    return `${d} day${d !== 1 ? "s" : ""}`;
  };

  // Filter proposals for tabs: exclude rejected from visible proposals list
  const activeProposals = proposals.filter(p => p.status !== "rejected" && p.status !== "withdrawn");
  const pendingProposals = proposals.filter(p => p.status === "pending");
  const interviewingProposals = proposals.filter(p => p.status === "interviewing");

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-wide">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>

          {/* ===== Job Header Card ===== */}
          <div className="bg-card rounded-xl border border-border p-8 mb-6">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Badge variant={job.status === "open" ? "default" : "secondary"}>{job.status}</Badge>
              {job.is_remote && <Badge variant="outline"><Globe className="h-3 w-3 mr-1" />Remote</Badge>}
              <Badge variant="outline">{job.is_hourly ? "Hourly" : "Fixed Price"}</Badge>
              {isAssigned && (
                <Badge variant="secondary" className="bg-accent/10 text-accent-foreground border-accent/30">
                  Assigned — No longer accepting proposals
                </Badge>
              )}
              {!isAssigned && (
                <FundingStatusBadge
                  clientId={job.client_id}
                  budgetMin={job.budget_min}
                  budgetMax={job.budget_max}
                />
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-4">{job.title}</h1>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {job.state && (
                <div className="flex items-center gap-1"><MapPin className="h-4 w-4" />{job.city ? `${job.city}, ` : ""}{job.state}</div>
              )}
              {job.delivery_days && (
                <div className="flex items-center gap-1"><Clock className="h-4 w-4" />{deliveryLabel()}</div>
              )}
              <div className="flex items-center gap-1"><Briefcase className="h-4 w-4" />{proposalCount} proposals</div>
              {interviewingCount > 0 && (
                <div className="flex items-center gap-1 text-primary"><UserCheck className="h-4 w-4" />{interviewingCount} interviewing</div>
              )}
              <div className="flex items-center gap-1"><Calendar className="h-4 w-4" />Posted {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}</div>
              <div className="flex items-center gap-1 font-semibold text-primary">
                <DollarSign className="h-4 w-4" />
                {job.budget_min && job.budget_max
                  ? `${formatNaira(job.budget_min)} - ${formatNaira(job.budget_max)}`
                  : job.budget_min ? formatNaira(job.budget_min) : "Negotiable"}
              </div>
            </div>
          </div>

          {/* ===== Client View: Tabbed Layout ===== */}
          {isClient ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <Tabs defaultValue="overview">
                  <TabsList className="mb-6 w-full justify-start">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="proposals">Proposals ({activeProposals.length})</TabsTrigger>
                    <TabsTrigger value="interviewing">Interviewing ({interviewContracts.length})</TabsTrigger>
                  </TabsList>

                  {/* Overview Tab */}
                  <TabsContent value="overview">
                    <OverviewContent
                      job={job}
                      deliveryLabel={deliveryLabel}
                      similarJobs={similarJobs}
                      profileRole={profile?.role}
                    />
                  </TabsContent>

                  {/* Proposals Tab */}
                  <TabsContent value="proposals">
                    <div className="space-y-4">
                      {!paymentReady && (
                        <Alert className="border-destructive/30 bg-destructive/5">
                          <Wallet className="h-4 w-4 text-destructive" />
                          <AlertDescription className="text-sm">
                            Fund your wallet before assigning experts.{" "}
                            <Link to="/transactions" className="text-primary hover:underline font-medium">Go to Wallet →</Link>
                          </AlertDescription>
                        </Alert>
                      )}

                      {activeProposals.length === 0 ? (
                        <div className="text-center py-16 text-muted-foreground">
                          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No proposals received yet</p>
                        </div>
                      ) : (
                        activeProposals.map((proposal: any) => (
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
                                    <Link to={`/expert/${proposal.freelancer?.id || proposal.freelancer_id}/profile`} className="font-semibold text-foreground hover:text-primary hover:underline transition-colors">
                                      {proposal.freelancer?.full_name || "Expert"}
                                    </Link>
                                    {proposal.freelancer?.state && (
                                      <p className="text-xs text-muted-foreground">
                                        {proposal.freelancer.city ? `${proposal.freelancer.city}, ` : ""}{proposal.freelancer.state}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <p className="text-muted-foreground text-sm mt-2 line-clamp-3 whitespace-pre-wrap">{proposal.cover_letter}</p>

                                <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                                  <span>Bid: <strong className="text-foreground">{formatNaira(proposal.bid_amount)}</strong></span>
                                  <span>Delivery: <strong className="text-foreground">{formatDurationDisplay(proposal.delivery_days, proposal.delivery_unit)}</strong></span>
                                  <span>{formatDistanceToNow(new Date(proposal.created_at), { addSuffix: true })}</span>
                                </div>
                              </div>

                              <div className="flex flex-col items-end gap-3">
                                {statusBadge(proposal.status)}

                                {proposal.status === "pending" && !jobAssigned && (
                                  <div className="flex flex-wrap gap-2">
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

                                {proposal.status === "interviewing" && !jobAssigned && (
                                  <div className="flex flex-wrap gap-2">
                                    <Button size="sm" onClick={() => openAssignDialog(proposal)}>
                                      <CheckCircle2 className="h-4 w-4 mr-1" /> Accept & Assign
                                    </Button>
                                    <Button size="sm" variant="destructive" onClick={() => updateProposalStatus(proposal.id, "rejected")}>
                                      <X className="h-4 w-4 mr-1" /> Reject
                                    </Button>
                                  </div>
                                )}

                                {proposal.status === "accepted" && (
                                  <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Assigned</Badge>
                                )}

                                <Button size="sm" variant="outline" onClick={() => setDetailDialog({ open: true, proposal })}>
                                  <Eye className="h-4 w-4 mr-1" /> View Details
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </TabsContent>

                  {/* Interviewing Tab */}
                  <TabsContent value="interviewing">
                    <div className="space-y-4">
                      {interviewContracts.length === 0 ? (
                        <div className="text-center py-16 text-muted-foreground">
                          <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No experts being interviewed yet</p>
                        </div>
                      ) : (
                        interviewContracts.map((contract: any) => (
                          <div
                            key={contract.id}
                            className="bg-card rounded-xl border border-border p-6 hover:border-primary/30 transition-colors cursor-pointer"
                            onClick={() => navigate(`/contract/${contract.id}?tab=chat`)}
                          >
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-12 w-12">
                                  <AvatarImage src={contract.freelancer?.avatar_url || undefined} />
                                  <AvatarFallback className="bg-primary/10 text-primary text-lg">
                                    {(contract.freelancer?.full_name || "U")[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <Link to={`/expert/${contract.freelancer?.id || contract.freelancer_id}/profile`} className="font-semibold text-foreground hover:text-primary hover:underline transition-colors">{contract.freelancer?.full_name || "Expert"}</Link>
                                  {contract.freelancer?.state && (
                                    <p className="text-xs text-muted-foreground">
                                      {contract.freelancer.city ? `${contract.freelancer.city}, ` : ""}{contract.freelancer.state}
                                    </p>
                                  )}
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Started {formatDistanceToNow(new Date(contract.created_at), { addSuffix: true })}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <div className="text-right mr-3">
                                  <p className="text-sm font-semibold text-foreground">{formatNaira(contract.amount)}</p>
                                  <Badge variant="outline" className="gap-1 mt-1"><UserCheck className="h-3 w-3" /> Interviewing</Badge>
                                </div>
                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); navigate(`/contract/${contract.id}?tab=chat`); }}>
                                  <MessageSquare className="h-4 w-4 mr-1" /> Chat
                                </Button>
                                {!jobAssigned && (
                                  <>
                                    <Button
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const p = proposals.find(pr => pr.id === contract.proposal_id);
                                        if (p) openAssignDialog(p);
                                      }}
                                    >
                                      <CheckCircle2 className="h-4 w-4 mr-1" /> Assign
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const p = proposals.find(pr => pr.id === contract.proposal_id);
                                        if (p) updateProposalStatus(p.id, "rejected");
                                      }}
                                    >
                                      <X className="h-4 w-4 mr-1" /> Reject
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Client Sidebar */}
              <div className="space-y-6">
                <div className="bg-card rounded-xl border border-border p-6">
                  <h3 className="font-semibold mb-4">Budget</h3>
                  <p className="text-2xl font-bold text-primary">
                    {job.budget_min && job.budget_max
                      ? `${formatNaira(job.budget_min)} - ${formatNaira(job.budget_max)}`
                      : job.budget_min ? formatNaira(job.budget_min) : "Negotiable"}
                  </p>
                  {job.is_hourly && <p className="text-sm text-muted-foreground mt-1">Hourly rate</p>}
                  <div className="mt-3">
                    <FundingStatusBadge clientId={job.client_id} budgetMin={job.budget_min} budgetMax={job.budget_max} />
                  </div>
                </div>

                <div className="bg-card rounded-xl border border-border p-6">
                  <h3 className="font-semibold mb-4">Quick Stats</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4" /> Total Proposals</div>
                      <span className="font-semibold text-foreground">{proposalCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground"><UserCheck className="h-4 w-4" /> Interviewing</div>
                      <span className="font-semibold text-foreground">{interviewContracts.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground"><Wallet className="h-4 w-4" /> Wallet</div>
                      <span className={`font-semibold ${paymentReady ? "text-primary" : "text-destructive"}`}>{formatNaira(wallet?.balance || 0)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ===== Freelancer View: Original Layout ===== */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <OverviewContent
                  job={job}
                  deliveryLabel={deliveryLabel}
                  similarJobs={similarJobs}
                  profileRole={profile?.role}
                />
              </div>

              {/* Freelancer Sidebar */}
              <div className="space-y-6">
                <div className="bg-card rounded-xl border border-border p-6">
                  <h3 className="font-semibold mb-4">Budget</h3>
                  <p className="text-2xl font-bold text-primary">
                    {job.budget_min && job.budget_max
                      ? `${formatNaira(job.budget_min)} - ${formatNaira(job.budget_max)}`
                      : job.budget_min ? formatNaira(job.budget_min) : "Negotiable"}
                  </p>
                  {job.is_hourly && <p className="text-sm text-muted-foreground mt-1">Hourly rate</p>}
                  <div className="mt-3">
                    <FundingStatusBadge clientId={job.client_id} budgetMin={job.budget_min} budgetMax={job.budget_max} />
                  </div>

                  {canApply && (
                    <Button className="w-full mt-4" onClick={() => navigate(`/job/${id}/apply`)}>
                      <Send className="h-4 w-4 mr-2" /> Apply Now
                    </Button>
                  )}
                  {hasApplied && !isAssigned && (
                    <div className="mt-4 space-y-2">
                      <Button className="w-full" variant="secondary" disabled>Already Applied</Button>
                      <Button className="w-full" variant="outline" onClick={() => navigate(`/job/${id}/apply`)}>
                        <Eye className="h-4 w-4 mr-2" /> View Application
                      </Button>
                    </div>
                  )}
                  {isAssigned && (
                    <p className="text-sm text-muted-foreground mt-4 text-center">This job is no longer accepting proposals.</p>
                  )}
                </div>

                {client && (
                  <div className="bg-card rounded-xl border border-border p-6">
                    <h3 className="font-semibold mb-4">About the Client</h3>
                    <div className="flex items-center gap-3 mb-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={client.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {(client.full_name || "C").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground">{client.full_name}</p>
                        {client.state && (
                          <p className="text-sm text-muted-foreground">
                            {client.city ? `${client.city}, ` : ""}{client.state}
                          </p>
                        )}
                      </div>
                    </div>
                    {client.is_verified && (
                      <Badge variant="default" className="gap-1 text-xs mb-2">✓ Verified Client</Badge>
                    )}
                  </div>
                )}

                <div className="bg-card rounded-xl border border-border p-6">
                  <div className="flex flex-wrap gap-6">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{proposalCount}</p>
                        <p className="text-xs text-muted-foreground">Total Proposals</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{interviewingCount}</p>
                        <p className="text-xs text-muted-foreground">Interviewing</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />

      {/* ===== Dialogs ===== */}

      {/* Assignment Dialog */}
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
                <span className="font-bold text-primary">{formatNaira(assignDialog.proposal.bid_amount)}</span>
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
                        Deposit {formatNaira(getRequiredAmount(assignDialog.proposal))} into escrow immediately.
                      </p>
                    </Label>
                  </div>
                  <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/30 cursor-pointer">
                    <RadioGroupItem value="later" id="fund-later" className="mt-0.5" />
                    <Label htmlFor="fund-later" className="cursor-pointer flex-1">
                      <span className="font-medium text-foreground">Fund Later</span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Create the contract now but fund later.
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
                        Insufficient balance. You need at least {formatNaira(getRequiredAmount(assignDialog.proposal))}.{" "}
                        <Link to="/transactions" className="text-primary hover:underline font-medium">Fund Wallet →</Link>
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}

              {fundingChoice === "later" && (
                <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm text-muted-foreground">
                  💡 The contract will be created with <strong className="text-foreground">Pending Funding</strong> status.
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
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={detailDialog.proposal.freelancer?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-lg">
                      {(detailDialog.proposal.freelancer?.full_name || "U")[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-foreground text-lg">{detailDialog.proposal.freelancer?.full_name || "Expert"}</p>
                    {detailDialog.proposal.freelancer?.state && (
                      <p className="text-sm text-muted-foreground">
                        {detailDialog.proposal.freelancer.city ? `${detailDialog.proposal.freelancer.city}, ` : ""}{detailDialog.proposal.freelancer.state}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-foreground mb-2">Cover Letter</p>
                  <div className="p-4 rounded-lg bg-muted/50 border border-border text-sm whitespace-pre-wrap text-foreground">{detailDialog.proposal.cover_letter}</div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" /> Payment Structure
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

// ===== Overview Content Component =====

function OverviewContent({ job, deliveryLabel, similarJobs, profileRole }: {
  job: any;
  deliveryLabel: () => string;
  similarJobs: any[];
  profileRole?: string;
}) {
  return (
    <div className="space-y-6">
      {/* Description */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-lg font-semibold mb-2">Description</h3>
        <p className="text-muted-foreground whitespace-pre-wrap">{job.description}</p>
      </div>

      {/* Attachments */}
      {job.attachments && job.attachments.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Attachments</h3>
          <div className="space-y-2">
            {job.attachments.map((url: string, idx: number) => {
              const name = url.split("/").pop() || `Attachment ${idx + 1}`;
              return (
                <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                  <Download className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm text-foreground truncate">{name}</span>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Things to Know */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Info className="h-5 w-5 text-primary" />Things to Know</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <InfoTile icon={MapPin} label="Work Location" value={job.is_remote ? "Remote" : (job.city && job.state ? `${job.city}, ${job.state}` : job.state || "Physical Location")} />
          <InfoTile icon={Wrench} label="Skill Level" value={job.skill_level || "Intermediate"} />
          <InfoTile icon={DollarSign} label="Payment Type" value={job.is_hourly ? "Hourly Rate" : "Fixed Price"} />
          <InfoTile icon={Tag} label="Price Tag" value={
            job.budget_min && job.budget_max
              ? `${formatNaira(job.budget_min)} - ${formatNaira(job.budget_max)}`
              : job.budget_min ? formatNaira(job.budget_min) : "Negotiable"
          } />
          <InfoTile icon={Briefcase} label="Job Type" value={job.is_hourly ? "Contract / Hourly" : "Project-based"} />
          <InfoTile icon={Clock} label="Duration" value={deliveryLabel()} />
        </div>
      </div>

      {/* Areas of Expertise */}
      {(job.required_skills?.length > 0 || job.required_software?.length > 0) && (
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Layers className="h-5 w-5 text-primary" />Areas of Expertise</h3>
          <div className="flex flex-wrap gap-2">
            {[...(job.required_skills || []), ...(job.required_software || [])].map((s: string) => (
              <Badge key={s} variant="secondary" className="text-sm">{s}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Similar Jobs */}
      {similarJobs.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="text-lg font-semibold mb-4">
            {profileRole === "client" ? "Other Jobs by You" : "Similar Jobs"}
          </h3>
          <div className="space-y-3">
            {similarJobs.map((sj) => (
              <Link key={sj.id} to={`/job/${sj.id}`} className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                <div>
                  <p className="font-medium text-foreground hover:text-primary transition-colors">{sj.title}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{sj.is_remote ? "Remote" : sj.state || "Nigeria"}</span>
                    <span>{sj.is_hourly ? "Hourly" : "Fixed"}</span>
                  </div>
                </div>
                <p className="text-sm font-semibold text-primary">
                  {sj.budget_max ? formatNaira(sj.budget_max) : sj.budget_min ? formatNaira(sj.budget_min) : "Negotiable"}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoTile({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="p-4 rounded-lg bg-muted/50 border border-border">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
