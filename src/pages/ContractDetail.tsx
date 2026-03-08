import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ContractChat } from "@/components/contract/ContractChat";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/nigerian-data";
import { calculateServiceCharge } from "@/lib/service-charge";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2, CheckCircle2, Clock, DollarSign, Plus, Send,
  ShieldCheck, AlertTriangle, Milestone as MilestoneIcon, Paperclip, FileText,
  X, MessageSquare, Download, Eye, Briefcase, ScrollText, BarChart3,
  Wallet, History, XCircle, Star
} from "lucide-react";
import { FundingStatusBadge } from "@/components/FundingStatusBadge";

const STATUS_CONFIG: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  interviewing: { variant: "outline", label: "Interviewing" },
  draft: { variant: "outline", label: "Draft" },
  pending_funding: { variant: "outline", label: "Pending Funding" },
  active: { variant: "default", label: "Active" },
  submitted: { variant: "secondary", label: "Submitted" },
  in_review: { variant: "secondary", label: "In Review" },
  completed: { variant: "secondary", label: "Completed" },
  cancelled: { variant: "outline", label: "Cancelled" },
  disputed: { variant: "destructive", label: "Disputed" },
  rejected: { variant: "destructive", label: "Rejected" },
};

const MILESTONE_COLORS: Record<string, string> = {
  pending: "secondary",
  funded: "default",
  in_progress: "default",
  submitted: "outline",
  approved: "secondary",
  paid: "default",
  disputed: "destructive",
};

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [contract, setContract] = useState<any>(null);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [escrowLedger, setEscrowLedger] = useState<any[]>([]);
  const [walletTransactions, setWalletTransactions] = useState<any[]>([]);
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "overview");

  // Dialog state
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [showSubmitDelivery, setShowSubmitDelivery] = useState(false);
  const [showSubmissionDetail, setShowSubmissionDetail] = useState<any>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);
  const [newMilestone, setNewMilestone] = useState({ title: "", description: "", amount: "", due_date: "" });
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeFiles, setDisputeFiles] = useState<File[]>([]);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [submissionFiles, setSubmissionFiles] = useState<File[]>([]);
  const submissionFileRef = useRef<HTMLInputElement>(null);
  const disputeFileRef = useRef<HTMLInputElement>(null);

  // Rating state
  const [showRateDialog, setShowRateDialog] = useState(false);
  const [categoryRatings, setCategoryRatings] = useState<Record<string, number>>({});
  const [categoryHovers, setCategoryHovers] = useState<Record<string, number>>({});
  const [ratingComment, setRatingComment] = useState("");
  const [ratingLoading, setRatingLoading] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [canRate, setCanRate] = useState(false);

  const RATING_CATEGORIES = [
    { key: "rating_skills", label: "Skills" },
    { key: "rating_quality", label: "Work Quality" },
    { key: "rating_availability", label: "Availability" },
    { key: "rating_deadlines", label: "Meet Deadlines" },
    { key: "rating_communication", label: "Communication" },
    { key: "rating_cooperation", label: "Cooperation" },
  ] as const;

  useEffect(() => { if (id) fetchData(); }, [id]);

  const fetchData = async () => {
    const [{ data: contractData }, { data: ms }, { data: ds }, { data: ledger }, { data: txns }, { data: sysMessages }] = await Promise.all([
      supabase.from("contracts")
        .select("*, client:profiles!contracts_client_id_fkey(full_name, avatar_url, id), freelancer:profiles!contracts_freelancer_id_fkey(full_name, avatar_url, id)")
        .eq("id", id).single(),
      supabase.from("milestones").select("*").eq("contract_id", id!).order("created_at", { ascending: true }),
      supabase.from("disputes").select("*").eq("contract_id", id!).order("created_at", { ascending: false }),
      supabase.from("escrow_ledger").select("*").eq("contract_id", id!).order("created_at", { ascending: false }),
      supabase.from("wallet_transactions").select("*").eq("contract_id", id!).order("created_at", { ascending: false }),
      supabase.from("contract_messages").select("*").eq("contract_id", id!).eq("is_system_message", true).order("created_at", { ascending: false }),
    ]);
    setContract(contractData);
    setMilestones(ms || []);
    setDisputes(ds || []);
    setEscrowLedger(ledger || []);
    setWalletTransactions(txns || []);
    setActivityLog(sysMessages || []);
    setLoading(false);

    // Check if user can rate (completed contract, all milestones paid/approved, no existing review)
    if (contractData && contractData.status === "completed" && user) {
      const allMilestonesDone = (ms || []).length > 0 && (ms || []).every((m: any) => m.status === "approved" || m.status === "paid");
      const revieweeId = contractData.client_id === user.id ? contractData.freelancer_id : contractData.client_id;
      const { data: existingReview } = await supabase
        .from("reviews")
        .select("id")
        .eq("contract_id", id!)
        .eq("reviewer_id", user.id)
        .maybeSingle();
      setHasReviewed(!!existingReview);
      setCanRate(!existingReview && allMilestonesDone);
    }
  };

  const isClient = contract?.client_id === user?.id;
  const isFreelancer = contract?.freelancer_id === user?.id;
  const partner = isClient ? contract?.freelancer : contract?.client;

  // Escrow summary
  const totalHeld = escrowLedger.filter(e => e.status === "held").reduce((s, e) => s + e.held_amount, 0);
  const totalReleased = escrowLedger.filter(e => e.status === "released").reduce((s, e) => s + e.released_amount, 0);
  const totalFees = escrowLedger.filter(e => e.status === "released").reduce((s, e) => s + e.platform_fee, 0);

  const addMilestone = async () => {
    if (!newMilestone.title || !newMilestone.amount) { toast.error("Title and amount are required"); return; }
    setActionLoading(true);
    const { error } = await supabase.from("milestones").insert({
      contract_id: id, title: newMilestone.title, description: newMilestone.description || null,
      amount: parseInt(newMilestone.amount), due_date: newMilestone.due_date || null,
    });
    if (error) toast.error("Failed to add milestone");
    else { toast.success("Milestone added"); setShowAddMilestone(false); setNewMilestone({ title: "", description: "", amount: "", due_date: "" }); fetchData(); }
    setActionLoading(false);
  };

  const handleSubmissionFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const allowed = files.filter(f => ['pdf','doc','docx','png','jpg','jpeg','dwg','dxf','zip'].includes(f.name.split('.').pop()?.toLowerCase() || ''));
    setSubmissionFiles(prev => [...prev, ...allowed].slice(0, 5));
    if (submissionFileRef.current) submissionFileRef.current.value = '';
  };

  const handleSubmitDelivery = async () => {
    if (!submissionNotes.trim()) { toast.error("Please add submission notes"); return; }
    setActionLoading(true);
    const urls: string[] = [];
    for (const file of submissionFiles) {
      const path = `submissions/${user!.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from('contract-attachments').upload(path, file);
      if (!error) { const { data } = supabase.storage.from('contract-attachments').getPublicUrl(path); urls.push(data.publicUrl); }
    }
    const response = await supabase.functions.invoke("escrow-release", {
      body: { action: "submit_delivery", milestone_id: selectedMilestoneId, contract_id: id, submission_notes: submissionNotes.trim(), submission_attachments: urls },
    });
    if (response.error || response.data?.error) toast.error(response.data?.error || "Submission failed");
    else { toast.success("Delivery submitted!"); setShowSubmitDelivery(false); setSubmissionNotes(""); setSubmissionFiles([]); setSelectedMilestoneId(null); fetchData(); }
    setActionLoading(false);
  };

  const handleMilestoneAction = async (action: string, milestoneId: string, extra?: Record<string, string>) => {
    setActionLoading(true);
    const response = await supabase.functions.invoke("escrow-release", { body: { action, milestone_id: milestoneId, contract_id: id, ...extra } });
    if (response.error || response.data?.error) toast.error(response.data?.error || "Action failed");
    else {
      if (action === "fund_milestone") toast.success("Milestone funded! Funds held in escrow.");
      else if (action === "approve_release") toast.success("Payment released to expert!");
      else if (action === "reject_milestone") toast.success("Milestone rejected. Expert can resubmit.");
      fetchData();
    }
    setActionLoading(false);
  };

  const handleRejectMilestone = async () => {
    if (!rejectionReason.trim()) { toast.error("Please provide a rejection reason"); return; }
    await handleMilestoneAction("reject_milestone", selectedMilestoneId!, { rejection_reason: rejectionReason });
    setShowRejectDialog(false);
    setRejectionReason("");
    setSelectedMilestoneId(null);
  };

  const handleRaiseDispute = async () => {
    if (!disputeReason.trim()) { toast.error("Please provide a reason"); return; }
    setActionLoading(true);
    const evidenceUrls: string[] = [];
    for (const file of disputeFiles) {
      const path = `disputes/${user!.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from('contract-attachments').upload(path, file);
      if (!error) { const { data } = supabase.storage.from('contract-attachments').getPublicUrl(path); evidenceUrls.push(data.publicUrl); }
    }
    const response = await supabase.functions.invoke("escrow-release", {
      body: { action: "raise_dispute", contract_id: id, reason: disputeReason, evidence_urls: evidenceUrls },
    });
    if (response.error || response.data?.error) toast.error(response.data?.error || "Failed to raise dispute");
    else { toast.success("Dispute raised"); setShowDispute(false); setDisputeReason(""); setDisputeFiles([]); fetchData(); }
    setActionLoading(false);
  };

  const handleSubmitRating = async () => {
    const allCategoriesFilled = RATING_CATEGORIES.every(c => categoryRatings[c.key] && categoryRatings[c.key] > 0);
    if (!allCategoriesFilled || !contract || !user) {
      toast.error("Please rate all categories");
      return;
    }
    setRatingLoading(true);
    const overallRating = Math.round(
      RATING_CATEGORIES.reduce((sum, c) => sum + (categoryRatings[c.key] || 0), 0) / RATING_CATEGORIES.length * 10
    ) / 10;
    const revieweeId = isClient ? contract.freelancer_id : contract.client_id;

    const { error } = await supabase.from("reviews").insert({
      contract_id: id!,
      reviewer_id: user.id,
      reviewee_id: revieweeId,
      rating: Math.round(overallRating),
      comment: ratingComment.trim() || null,
      rating_skills: categoryRatings.rating_skills,
      rating_quality: categoryRatings.rating_quality,
      rating_availability: categoryRatings.rating_availability,
      rating_deadlines: categoryRatings.rating_deadlines,
      rating_communication: categoryRatings.rating_communication,
      rating_cooperation: categoryRatings.rating_cooperation,
    } as any);
    if (error) {
      toast.error("Failed to submit rating");
    } else {
      // Update freelancer average rating
      if (isClient) {
        const { data: allReviews } = await supabase.from("reviews").select("rating").eq("reviewee_id", revieweeId);
        if (allReviews && allReviews.length > 0) {
          const avg = allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length;
          await supabase.from("freelancer_profiles").update({ rating: Math.round(avg * 10) / 10 }).eq("user_id", revieweeId);
        }
      }
      toast.success("Review submitted! Thank you.");
      setShowRateDialog(false);
      setHasReviewed(true);
      setCanRate(false);
      setCategoryRatings({});
      setRatingComment("");
    }
    setRatingLoading(false);
  };


  if (loading) {
    return (<div className="min-h-screen flex flex-col"><Header /><div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div><Footer /></div>);
  }
  if (!contract) {
    return (<div className="min-h-screen flex flex-col"><Header /><div className="flex-1 flex items-center justify-center"><p>Contract not found</p></div><Footer /></div>);
  }

  const statusCfg = STATUS_CONFIG[contract.status] || STATUS_CONFIG.active;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-wide max-w-5xl">
          <Button variant="ghost" onClick={() => navigate("/dashboard/contracts")} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Contracts
          </Button>

          {/* Contract Header */}
          <div className="bg-card rounded-xl border border-border p-6 mb-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12 cursor-pointer" onClick={() => navigate(`/expert/${partner?.id}/profile`)}>
                  <AvatarImage src={partner?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary">{(partner?.full_name || "U")[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-xl font-bold text-foreground">{contract.job_title || "Contract"}</h1>
                  <p className="text-sm text-muted-foreground">with <span className="text-primary hover:underline cursor-pointer" onClick={() => navigate(`/expert/${partner?.id}/profile`)}>{partner?.full_name || "User"}</span></p>
                  {contract.started_at && <p className="text-xs text-muted-foreground">Started {formatDistanceToNow(new Date(contract.started_at), { addSuffix: true })}</p>}
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-2xl font-bold text-primary">{formatNaira(contract.amount)}</p>
                <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                <FundingStatusBadge
                  clientId={contract.client_id}
                  budgetMin={contract.job_budget_min}
                  budgetMax={contract.job_budget_max}
                  contractId={contract.id}
                />
              </div>
            </div>
          </div>

          {/* Escrow Summary Cards - clients only see held/released, experts see fees too */}
          {(totalHeld > 0 || totalReleased > 0) && (
            <div className={`grid grid-cols-1 gap-4 mb-6 ${isFreelancer ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
              <div className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-muted-foreground">Held in Escrow</span>
                </div>
                <p className="text-xl font-bold text-primary">{formatNaira(totalHeld)}</p>
              </div>
              <div className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-muted-foreground">Released</span>
                </div>
                <p className="text-xl font-bold text-foreground">{formatNaira(totalReleased)}</p>
              </div>
              {isFreelancer && (
                <div className="bg-card rounded-xl border border-border p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">Platform Fees</span>
                  </div>
                  <p className="text-xl font-bold text-muted-foreground">{formatNaira(totalFees)}</p>
                </div>
              )}
            </div>
          )}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6 flex-wrap h-auto gap-1 sticky top-0 z-20 bg-muted/95 backdrop-blur-sm">
              <TabsTrigger value="overview"><Briefcase className="h-4 w-4 mr-1.5" /> Overview</TabsTrigger>
              <TabsTrigger value="milestones" disabled={contract.status === "interviewing"}>
                <MilestoneIcon className="h-4 w-4 mr-1.5" /> {contract.status === "interviewing" ? "Still Interviewing" : "Milestones"}
              </TabsTrigger>
              <TabsTrigger value="activity"><FileText className="h-4 w-4 mr-1.5" /> Activity</TabsTrigger>
              <TabsTrigger value="chat"><MessageSquare className="h-4 w-4 mr-1.5" /> Chat</TabsTrigger>
              <TabsTrigger value="transactions" disabled={contract.status === "interviewing"}>
                <History className="h-4 w-4 mr-1.5" /> {contract.status === "interviewing" ? "Still Interviewing" : "Transactions"}
              </TabsTrigger>
              <TabsTrigger value="disputes" disabled={contract.status === "interviewing"}>
                <AlertTriangle className="h-4 w-4 mr-1.5" /> {contract.status === "interviewing" ? "Still Interviewing" : "Disputes"}
              </TabsTrigger>
            </TabsList>

            {/* OVERVIEW TAB */}
            <TabsContent value="overview">
              <div className="space-y-6">
                {/* Rate Expert Banner */}
                {contract.status === "completed" && canRate && (
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">Contract completed! Rate {partner?.full_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Share your experience to help other users on the platform.</p>
                    </div>
                    <Button size="sm" onClick={() => setShowRateDialog(true)}>
                      <Star className="h-3.5 w-3.5 mr-1.5" /> Rate Now
                    </Button>
                  </div>
                )}
                {contract.status === "completed" && hasReviewed && (
                  <div className="rounded-xl border border-border bg-muted/30 p-4 flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    <p className="text-sm text-muted-foreground">You've already reviewed this contract. Thank you!</p>
                  </div>
                )}
                {/* Submission Review Banner */}
                {(() => {
                  const submittedMilestones = milestones.filter(ms => ms.status === "submitted");
                  if (submittedMilestones.length === 0) return null;
                  return (
                    <div className="bg-primary/5 border-2 border-primary/30 rounded-xl p-5">
                      <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mb-3">
                        <Send className="h-5 w-5 text-primary" />
                        {submittedMilestones.length} Delivery Awaiting Review
                      </h3>
                      <div className="space-y-3">
                        {submittedMilestones.map(ms => (
                          <div key={ms.id} className="bg-card rounded-lg border border-border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <p className="font-medium text-foreground">{ms.title}</p>
                              <p className="text-sm text-primary font-semibold">{formatNaira(ms.amount)}</p>
                              {ms.submitted_at && <p className="text-xs text-muted-foreground">Submitted {formatDistanceToNow(new Date(ms.submitted_at), { addSuffix: true })}</p>}
                              {ms.submission_notes && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{ms.submission_notes}</p>}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" onClick={() => setShowSubmissionDetail(ms)}>
                                <Eye className="h-3 w-3 mr-1" /> View
                              </Button>
                              {isClient && (
                                <>
                                  <Button size="sm" onClick={() => handleMilestoneAction("approve_release", ms.id)} disabled={actionLoading}>
                                    <CheckCircle2 className="h-3 w-3 mr-1" /> Approve & Release
                                  </Button>
                                  <Button size="sm" variant="destructive" onClick={() => { setSelectedMilestoneId(ms.id); setShowRejectDialog(true); }} disabled={actionLoading}>
                                    <XCircle className="h-3 w-3 mr-1" /> Request Revision
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Pending Funding Banner */}
                {isClient && contract.status === "pending_funding" && milestones.some(ms => ms.status === "pending") && (
                  <div className="bg-accent/10 border-2 border-accent/30 rounded-xl p-5">
                    <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mb-2">
                      <DollarSign className="h-5 w-5 text-accent-foreground" />
                      Funding Required
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">Fund the first milestone to activate this contract and let the expert begin work.</p>
                    <Button size="sm" onClick={() => setActiveTab("milestones")}>
                      <Wallet className="h-4 w-4 mr-1" /> Go to Milestones
                    </Button>
                  </div>
                )}
                {contract.job_description && (
                  <div className="bg-card rounded-xl border border-border p-6">
                    <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary" /> Job Details</h2>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{contract.job_description}</p>
                    <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
                      {contract.job_category && <span>Category: <strong className="text-foreground">{contract.job_category}</strong></span>}
                      {(contract.job_budget_min || contract.job_budget_max) && <span>Budget: <strong className="text-foreground">{formatNaira(contract.job_budget_min || 0)} – {formatNaira(contract.job_budget_max || 0)}</strong></span>}
                      {contract.job_delivery_days && <span>Timeline: <strong className="text-foreground">{contract.job_delivery_days} {contract.job_delivery_unit || "days"}</strong></span>}
                    </div>
                    {contract.job_attachments?.length > 0 && (
                      <div className="mt-4 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Attachments</p>
                        {contract.job_attachments.map((url: string, i: number) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-muted/50 text-sm">
                            <Download className="h-4 w-4 text-primary" /><span className="truncate">{decodeURIComponent(url.split("/").pop() || `File ${i+1}`)}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {contract.accepted_cover_letter && (
                  <div className="bg-card rounded-xl border border-border p-6">
                    <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><ScrollText className="h-5 w-5 text-primary" /> Accepted Proposal</h2>
                    <div className="p-4 rounded-lg bg-muted/50 border border-border text-sm whitespace-pre-wrap">{contract.accepted_cover_letter}</div>
                    <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
                      <span>Bid: <strong className="text-primary">{formatNaira(contract.accepted_bid_amount || contract.amount)}</strong></span>
                      <span>Payment: <strong className="text-foreground">{contract.accepted_payment_type === "milestone" ? "Milestone" : "Project"}</strong></span>
                    </div>
                    {/* Fee preview - expert only */}
                    {isFreelancer && (() => {
                      const amt = contract.accepted_bid_amount || contract.amount;
                      const { rateLabel, charge, takeHome } = calculateServiceCharge(amt);
                      return (
                        <div className="mt-3 p-3 rounded-lg bg-muted/30 border border-border text-sm">
                          <p className="text-muted-foreground">Platform fee: <strong className="text-foreground">{rateLabel}</strong> ({formatNaira(charge)})</p>
                          <p className="text-muted-foreground">You receive: <strong className="text-primary">{formatNaira(takeHome)}</strong></p>
                        </div>
                      );
                    })()}
                    {contract.accepted_attachments?.length > 0 && (
                      <div className="mt-4 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Proposal Attachments</p>
                        {contract.accepted_attachments.map((url: string, i: number) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-muted/50 text-sm">
                            <Download className="h-4 w-4 text-primary" /><span className="truncate">{decodeURIComponent(url.split("/").pop() || `File ${i+1}`)}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {contract.terms_conditions && (
                  <div className="bg-card rounded-xl border border-border p-6">
                    <h2 className="text-lg font-semibold mb-3">Terms & Conditions</h2>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{contract.terms_conditions}</p>
                  </div>
                )}

                <div className="bg-card rounded-xl border border-border p-6">
                  <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" /> Contract Timeline</h2>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{contract.created_at ? format(new Date(contract.created_at), "PPP") : "—"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Started</span><span>{contract.started_at ? format(new Date(contract.started_at), "PPP") : "—"}</span></div>
                    {contract.completed_at && <div className="flex justify-between"><span className="text-muted-foreground">Completed</span><span>{format(new Date(contract.completed_at), "PPP")}</span></div>}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* MILESTONES TAB */}
            <TabsContent value="milestones">
              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2"><MilestoneIcon className="h-5 w-5 text-primary" /> Milestones</h2>
                  {isClient && contract.status === "active" && (
                    <Button size="sm" onClick={() => setShowAddMilestone(true)}><Plus className="h-4 w-4 mr-1" /> Add</Button>
                  )}
                </div>
                {milestones.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No milestones yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {milestones.map((ms) => {
                      const feeInfo = calculateServiceCharge(ms.amount);
                      return (
                        <div key={ms.id} className="border border-border rounded-lg p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-medium text-foreground">{ms.title}</h3>
                                <Badge variant={(MILESTONE_COLORS[ms.status] || "secondary") as any}>{ms.status}</Badge>
                              </div>
                              {ms.description && <p className="text-sm text-muted-foreground">{ms.description}</p>}
                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                <span className="font-semibold text-primary text-sm">{formatNaira(ms.amount)}</span>
                                {ms.due_date && <span>Due: {new Date(ms.due_date).toLocaleDateString()}</span>}
                                {ms.funded_at && <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-primary" /> Funded</span>}
                                {ms.submitted_at && <span className="flex items-center gap-1"><Send className="h-3 w-3" /> Submitted</span>}
                                {ms.approved_at && <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-primary" /> Approved</span>}
                              </div>
                              {/* Fee breakdown - expert view only */}
                              {isFreelancer && (ms.status === "pending" || ms.status === "funded") && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Fee: {feeInfo.rateLabel} → You get {formatNaira(feeInfo.takeHome)}
                                </p>
                              )}
                              {ms.status === "submitted" && ms.submission_notes && (
                                <Button variant="link" size="sm" className="mt-2 p-0 h-auto text-primary" onClick={() => setShowSubmissionDetail(ms)}>
                                  <Eye className="h-3 w-3 mr-1" /> View Submission
                                </Button>
                              )}
                            </div>
                            <div className="flex flex-col gap-1">
                              {isClient && ms.status === "pending" && (
                                <Button size="sm" onClick={() => handleMilestoneAction("fund_milestone", ms.id)} disabled={actionLoading}>
                                  <DollarSign className="h-3 w-3 mr-1" /> Fund Milestone
                                </Button>
                              )}
                              {isFreelancer && (ms.status === "funded" || ms.status === "in_progress") && (
                                <Button size="sm" onClick={() => { setSelectedMilestoneId(ms.id); setShowSubmitDelivery(true); }} disabled={actionLoading}>
                                  <Send className="h-3 w-3 mr-1" /> Submit Delivery
                                </Button>
                              )}
                              {isClient && ms.status === "submitted" && (
                                <div className="flex flex-col gap-1">
                                  <Button size="sm" onClick={() => handleMilestoneAction("approve_release", ms.id)} disabled={actionLoading}>
                                    <CheckCircle2 className="h-3 w-3 mr-1" /> Approve & Release
                                  </Button>
                                  <Button size="sm" variant="destructive" onClick={() => { setSelectedMilestoneId(ms.id); setShowRejectDialog(true); }} disabled={actionLoading}>
                                    <XCircle className="h-3 w-3 mr-1" /> Reject
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setActiveTab("chat")}>
                                    <MessageSquare className="h-3 w-3 mr-1" /> Feedback
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* CHAT TAB */}
            <TabsContent value="chat">
              <ContractChat contractId={id!} partnerName={partner?.full_name || "User"} partnerAvatar={partner?.avatar_url} contractStatus={contract?.status} />
            </TabsContent>

            {/* TRANSACTIONS TAB */}
            <TabsContent value="transactions">
              <div className="space-y-6">
                {/* Escrow Ledger */}
                <div className="bg-card rounded-xl border border-border p-6">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Escrow Ledger</h2>
                  {escrowLedger.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">No escrow entries yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {escrowLedger.map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                          <div>
                            <Badge variant={entry.status === "held" ? "default" : entry.status === "released" ? "secondary" : "destructive"}>
                              {entry.status}
                            </Badge>
                            <p className="text-sm mt-1">
                              Held: {formatNaira(entry.held_amount)}
                              {entry.released_amount > 0 && ` → Released: ${formatNaira(entry.released_amount)}`}
                            </p>
                            {isFreelancer && entry.platform_fee > 0 && (
                              <p className="text-xs text-muted-foreground">Fee: {formatNaira(entry.platform_fee)} | You receive: {formatNaira(entry.expert_amount)}</p>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">{format(new Date(entry.created_at), "PP")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Wallet Transactions */}
                <div className="bg-card rounded-xl border border-border p-6">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" /> Transaction History</h2>
                  {walletTransactions.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">No transactions for this contract.</p>
                  ) : (
                    <div className="space-y-2">
                      {walletTransactions.map((txn) => (
                        <div key={txn.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">{txn.description}</p>
                            <p className="text-xs text-muted-foreground">{txn.type} • {format(new Date(txn.created_at), "PPp")}</p>
                          </div>
                          <span className={`font-semibold text-sm ${txn.type === "escrow_lock" ? "text-destructive" : "text-primary"}`}>
                            {txn.type === "escrow_lock" ? "-" : "+"}{formatNaira(txn.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ACTIVITY TAB */}
            <TabsContent value="activity">
              <div className="bg-card rounded-xl border border-border p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Contract Activity Log</h2>
                {activityLog.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No activity recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    {activityLog.map((entry) => (
                      <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          {entry.content.includes("💰") || entry.content.includes("Funded") ? <DollarSign className="h-4 w-4 text-primary" /> :
                           entry.content.includes("📦") || entry.content.includes("Submitted") || entry.content.includes("submitted") ? <Send className="h-4 w-4 text-primary" /> :
                           entry.content.includes("✅") || entry.content.includes("Approved") || entry.content.includes("approved") ? <CheckCircle2 className="h-4 w-4 text-primary" /> :
                           entry.content.includes("❌") || entry.content.includes("Rejected") || entry.content.includes("rejected") ? <XCircle className="h-4 w-4 text-destructive" /> :
                           entry.content.includes("⚠️") || entry.content.includes("Dispute") ? <AlertTriangle className="h-4 w-4 text-destructive" /> :
                           entry.content.includes("🎉") || entry.content.includes("hired") ? <CheckCircle2 className="h-4 w-4 text-primary" /> :
                           <Clock className="h-4 w-4 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground">{entry.content}</p>
                          <p className="text-xs text-muted-foreground mt-1">{format(new Date(entry.created_at), "PPp")}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* DISPUTES TAB */}
            <TabsContent value="disputes">
              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /> Disputes</h2>
                  {(contract.status === "active" || contract.status === "submitted") && (
                    <Button size="sm" variant="destructive" onClick={() => setShowDispute(true)}><AlertTriangle className="h-4 w-4 mr-1" /> Raise Dispute</Button>
                  )}
                </div>
                {disputes.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ShieldCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No disputes. Keep it that way! 🤝</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {disputes.map((d: any) => {
                      const dStatus = d.dispute_status || (d.status === "open" ? "awaiting_response" : "resolved");
                      const statusLabel = dStatus === "awaiting_response" ? "Awaiting Response" :
                        dStatus === "under_review" ? "Under Review" : "Resolved";
                      const statusVariant = dStatus === "awaiting_response" ? "destructive" as const :
                        dStatus === "under_review" ? "secondary" as const : "default" as const;
                      return (
                        <Link key={d.id} to={`/dispute/${d.id}`} className="block border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={statusVariant}>{statusLabel}</Badge>
                            <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}</span>
                          </div>
                          <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-2">{d.reason}</p>
                          {d.evidence_urls?.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">{d.evidence_urls.length} evidence file(s)</p>
                          )}
                          {d.resolution_explanation && (
                            <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-border">
                              <p className="text-xs font-medium text-muted-foreground mb-1">Adjudicator Decision</p>
                              <p className="text-sm line-clamp-2">{d.resolution_explanation}</p>
                            </div>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />

      {/* Submit Delivery Dialog */}
      <Dialog open={showSubmitDelivery} onOpenChange={setShowSubmitDelivery}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Submit Delivery</DialogTitle><DialogDescription>Describe work completed and attach deliverables.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Notes *</Label><Textarea placeholder="Describe what you've completed..." rows={5} value={submissionNotes} onChange={(e) => setSubmissionNotes(e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Attachments</Label>
              <input ref={submissionFileRef} type="file" multiple accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.dwg,.dxf,.zip" className="hidden" onChange={handleSubmissionFileChange} />
              <Button type="button" variant="outline" size="sm" onClick={() => submissionFileRef.current?.click()} disabled={submissionFiles.length >= 5}><Paperclip className="h-4 w-4 mr-2" /> Add Files</Button>
              {submissionFiles.length > 0 && (
                <div className="space-y-2 mt-2">
                  {submissionFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 border border-border">
                      <FileText className="h-4 w-4 text-primary shrink-0" /><span className="text-sm flex-1 truncate">{file.name}</span>
                      <X className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => setSubmissionFiles(f => f.filter((_, i) => i !== idx))} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDelivery(false)}>Cancel</Button>
            <Button onClick={handleSubmitDelivery} disabled={actionLoading}>{actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />} Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submission Detail Dialog */}
      <Dialog open={!!showSubmissionDetail} onOpenChange={() => setShowSubmissionDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Submission Details</DialogTitle><DialogDescription>Review for "{showSubmissionDetail?.title}"</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            {showSubmissionDetail?.submission_notes && <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm whitespace-pre-wrap">{showSubmissionDetail.submission_notes}</div>}
            {showSubmissionDetail?.submission_attachments?.length > 0 && (
              <div className="space-y-2">
                {showSubmissionDetail.submission_attachments.map((url: string, idx: number) => (
                  <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50"><Download className="h-4 w-4 text-primary" /><span className="text-sm truncate">{url.split("/").pop()}</span></a>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            {isClient && showSubmissionDetail?.status === "submitted" && (
              <>
                <Button variant="destructive" onClick={() => { setSelectedMilestoneId(showSubmissionDetail.id); setShowSubmissionDetail(null); setShowRejectDialog(true); }}><XCircle className="h-4 w-4 mr-1" /> Reject</Button>
                <Button variant="outline" onClick={() => { setShowSubmissionDetail(null); setActiveTab("chat"); }}><MessageSquare className="h-4 w-4 mr-1" /> Feedback</Button>
                <Button onClick={() => { handleMilestoneAction("approve_release", showSubmissionDetail.id); setShowSubmissionDetail(null); }} disabled={actionLoading}><CheckCircle2 className="h-4 w-4 mr-1" /> Approve & Release</Button>
              </>
            )}
            {!isClient && <Button variant="outline" onClick={() => setShowSubmissionDetail(null)}>Close</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Milestone Dialog */}
      <Dialog open={showAddMilestone} onOpenChange={setShowAddMilestone}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Milestone</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Title</Label><Input placeholder="e.g. Initial Design" value={newMilestone.title} onChange={(e) => setNewMilestone(p => ({ ...p, title: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea placeholder="What's included..." value={newMilestone.description} onChange={(e) => setNewMilestone(p => ({ ...p, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Amount (₦)</Label><Input type="number" min="1" value={newMilestone.amount} onChange={(e) => setNewMilestone(p => ({ ...p, amount: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Due Date</Label><Input type="date" value={newMilestone.due_date} onChange={(e) => setNewMilestone(p => ({ ...p, due_date: e.target.value }))} /></div>
            </div>
            {newMilestone.amount && parseInt(newMilestone.amount) > 0 && isFreelancer && (
              <div className="p-3 rounded-lg bg-muted/30 border border-border text-sm">
                {(() => { const info = calculateServiceCharge(parseInt(newMilestone.amount)); return <p className="text-muted-foreground">Fee: {info.rateLabel} ({formatNaira(info.charge)}) → You receive <strong className="text-primary">{formatNaira(info.takeHome)}</strong></p>; })()}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMilestone(false)}>Cancel</Button>
            <Button onClick={addMilestone} disabled={actionLoading}>{actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />} Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Milestone Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Milestone</DialogTitle><DialogDescription>The expert will be able to resubmit their work.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Rejection Reason *</Label>
              <Textarea placeholder="Explain what needs to be fixed..." rows={4} value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowRejectDialog(false); setRejectionReason(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleRejectMilestone} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />} Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispute Dialog */}
      <Dialog open={showDispute} onOpenChange={setShowDispute}>
        <DialogContent>
          <DialogHeader><DialogTitle>Raise a Dispute</DialogTitle><DialogDescription>Funds remain locked until resolved.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Reason</Label><Textarea placeholder="Describe the issue..." rows={4} value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Evidence (optional)</Label>
              <input ref={disputeFileRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.zip" className="hidden" onChange={(e) => setDisputeFiles(Array.from(e.target.files || []).slice(0, 5))} />
              <Button type="button" variant="outline" size="sm" onClick={() => disputeFileRef.current?.click()}><Paperclip className="h-4 w-4 mr-2" /> Add Evidence</Button>
              {disputeFiles.length > 0 && <p className="text-xs text-muted-foreground">{disputeFiles.length} file(s) selected</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDispute(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRaiseDispute} disabled={actionLoading}>{actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <AlertTriangle className="h-4 w-4 mr-2" />} Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
