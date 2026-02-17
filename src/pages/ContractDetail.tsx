import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/nigerian-data";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2, CheckCircle2, Clock, DollarSign, Plus, Send,
  ShieldCheck, AlertTriangle, Milestone as MilestoneIcon, Paperclip, FileText, X, MessageSquare, Download, Eye
} from "lucide-react";

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [contract, setContract] = useState<any>(null);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [showSubmitDelivery, setShowSubmitDelivery] = useState(false);
  const [showSubmissionDetail, setShowSubmissionDetail] = useState<any>(null);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);
  const [newMilestone, setNewMilestone] = useState({ title: "", description: "", amount: "", due_date: "" });
  const [disputeReason, setDisputeReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Submission form state
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [submissionFiles, setSubmissionFiles] = useState<File[]>([]);
  const submissionFileRef = useRef<HTMLInputElement>(null);
  const [uploadingSubmission, setUploadingSubmission] = useState(false);

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const fetchData = async () => {
    const { data: contractData } = await supabase
      .from("contracts")
      .select("*, job:jobs!contracts_job_id_fkey(title), client:profiles!contracts_client_id_fkey(full_name, avatar_url, id), freelancer:profiles!contracts_freelancer_id_fkey(full_name, avatar_url, id)")
      .eq("id", id)
      .single();

    setContract(contractData);

    const { data: ms } = await supabase
      .from("milestones")
      .select("*")
      .eq("contract_id", id!)
      .order("created_at", { ascending: true });

    setMilestones(ms || []);
    setLoading(false);
  };

  const isClient = contract?.client_id === user?.id;
  const isFreelancer = contract?.freelancer_id === user?.id;

  const addMilestone = async () => {
    if (!newMilestone.title || !newMilestone.amount) {
      toast.error("Title and amount are required");
      return;
    }
    setActionLoading(true);
    const { error } = await supabase.from("milestones").insert({
      contract_id: id,
      title: newMilestone.title,
      description: newMilestone.description || null,
      amount: parseInt(newMilestone.amount),
      due_date: newMilestone.due_date || null,
    });
    if (error) toast.error("Failed to add milestone");
    else {
      toast.success("Milestone added");
      setShowAddMilestone(false);
      setNewMilestone({ title: "", description: "", amount: "", due_date: "" });
      fetchData();
    }
    setActionLoading(false);
  };

  const handleSubmissionFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const allowed = files.filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'dwg', 'dxf', 'zip'].includes(ext || '');
    });
    if (allowed.length < files.length) toast.error("Some files skipped. Allowed: PDF, DOC, DOCX, PNG, JPG, DWG, DXF, ZIP");
    setSubmissionFiles(prev => [...prev, ...allowed].slice(0, 5));
    if (submissionFileRef.current) submissionFileRef.current.value = '';
  };

  const handleSubmitDelivery = async () => {
    if (!submissionNotes.trim()) {
      toast.error("Please add submission notes describing your work");
      return;
    }
    setActionLoading(true);
    setUploadingSubmission(true);

    // Upload submission attachments
    const urls: string[] = [];
    if (submissionFiles.length > 0 && user) {
      for (const file of submissionFiles) {
        const path = `submissions/${user.id}/${Date.now()}_${file.name}`;
        const { error } = await supabase.storage.from('job-attachments').upload(path, file);
        if (!error) {
          const { data } = supabase.storage.from('job-attachments').getPublicUrl(path);
          urls.push(data.publicUrl);
        }
      }
    }
    setUploadingSubmission(false);

    const response = await supabase.functions.invoke("escrow-release", {
      body: {
        action: "submit_delivery",
        milestone_id: selectedMilestoneId,
        contract_id: id,
        submission_notes: submissionNotes.trim(),
        submission_attachments: urls,
      },
    });

    if (response.error || response.data?.error) {
      toast.error(response.data?.error || "Submission failed");
    } else {
      toast.success("Delivery submitted for review!");
      setShowSubmitDelivery(false);
      setSubmissionNotes("");
      setSubmissionFiles([]);
      setSelectedMilestoneId(null);
      fetchData();
    }
    setActionLoading(false);
  };

  const openSubmitDelivery = (milestoneId: string) => {
    setSelectedMilestoneId(milestoneId);
    setSubmissionNotes("");
    setSubmissionFiles([]);
    setShowSubmitDelivery(true);
  };

  const handleMilestoneAction = async (action: string, milestoneId: string) => {
    setActionLoading(true);
    const response = await supabase.functions.invoke("escrow-release", {
      body: { action, milestone_id: milestoneId, contract_id: id },
    });

    if (response.error || response.data?.error) {
      toast.error(response.data?.error || "Action failed");
    } else {
      toast.success(action === "fund_milestone" ? "Milestone funded!" : "Payment released!");
      fetchData();
    }
    setActionLoading(false);
  };

  const handleSendFeedback = () => {
    // Navigate to chat with the freelancer
    const partnerId = contract?.freelancer_id;
    if (partnerId) navigate(`/messages?user=${partnerId}`);
  };

  const handleRaiseDispute = async () => {
    if (!disputeReason.trim()) { toast.error("Please provide a reason"); return; }
    setActionLoading(true);
    const response = await supabase.functions.invoke("escrow-release", {
      body: { action: "raise_dispute", contract_id: id, reason: disputeReason },
    });
    if (response.error || response.data?.error) {
      toast.error(response.data?.error || "Failed to raise dispute");
    } else {
      toast.success("Dispute raised");
      setShowDispute(false);
      setDisputeReason("");
      fetchData();
    }
    setActionLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        <Footer />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center"><p>Contract not found</p></div>
        <Footer />
      </div>
    );
  }

  const partner = isClient ? contract.freelancer : contract.client;
  const statusColors: Record<string, string> = {
    pending: "secondary",
    funded: "default",
    in_progress: "default",
    submitted: "outline",
    approved: "secondary",
    disputed: "destructive",
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-wide max-w-4xl">
          <Button variant="ghost" onClick={() => navigate("/dashboard/contracts")} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Contracts
          </Button>

          {/* Contract Header */}
          <div className="bg-card rounded-xl border border-border p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">{contract.job?.title || "Contract"}</h1>
                <p className="text-sm text-muted-foreground">with {partner?.full_name}</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-2xl font-bold text-primary">{formatNaira(contract.amount)}</p>
                <Badge variant={contract.status === "active" ? "default" : contract.status === "disputed" ? "destructive" : "secondary"}>
                  {contract.status}
                </Badge>
              </div>
            </div>

            {contract.status === "active" && (
              <div className="flex gap-2">
                {isClient && (
                  <Button size="sm" onClick={() => setShowAddMilestone(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Add Milestone
                  </Button>
                )}
                <Button size="sm" variant="destructive" onClick={() => setShowDispute(true)}>
                  <AlertTriangle className="h-4 w-4 mr-1" /> Raise Dispute
                </Button>
              </div>
            )}
          </div>

          {/* Milestones */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MilestoneIcon className="h-5 w-5 text-primary" /> Milestones
            </h2>

            {milestones.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No milestones yet.</p>
                {isClient && <p className="text-sm mt-1">Add milestones to structure payments for this contract.</p>}
              </div>
            ) : (
              <div className="space-y-4">
                {milestones.map((ms) => (
                  <div key={ms.id} className="border border-border rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-foreground">{ms.title}</h3>
                          <Badge variant={(statusColors[ms.status] || "secondary") as any}>{ms.status}</Badge>
                        </div>
                        {ms.description && <p className="text-sm text-muted-foreground">{ms.description}</p>}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="font-semibold text-primary text-sm">{formatNaira(ms.amount)}</span>
                          {ms.due_date && <span>Due: {new Date(ms.due_date).toLocaleDateString()}</span>}
                          {ms.funded_at && <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-primary" /> Funded</span>}
                          {ms.submitted_at && <span className="flex items-center gap-1"><Send className="h-3 w-3" /> Submitted</span>}
                          {ms.approved_at && <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-primary" /> Approved</span>}
                        </div>

                        {/* Show submission details if submitted */}
                        {ms.status === "submitted" && (ms.submission_notes || (ms.submission_attachments && ms.submission_attachments.length > 0)) && (
                          <Button
                            variant="link"
                            size="sm"
                            className="mt-2 p-0 h-auto text-primary"
                            onClick={() => setShowSubmissionDetail(ms)}
                          >
                            <Eye className="h-3 w-3 mr-1" /> View Submission Details
                          </Button>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        {isClient && ms.status === "pending" && (
                          <Button size="sm" onClick={() => handleMilestoneAction("fund_milestone", ms.id)} disabled={actionLoading}>
                            <DollarSign className="h-3 w-3 mr-1" /> Fund
                          </Button>
                        )}
                        {isFreelancer && (ms.status === "funded" || ms.status === "in_progress") && (
                          <Button size="sm" onClick={() => openSubmitDelivery(ms.id)} disabled={actionLoading}>
                            <Send className="h-3 w-3 mr-1" /> Submit for Review
                          </Button>
                        )}
                        {isClient && ms.status === "submitted" && (
                          <div className="flex flex-col gap-1">
                            <Button size="sm" onClick={() => handleMilestoneAction("approve_release", ms.id)} disabled={actionLoading}>
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Approve & Release
                            </Button>
                            <Button size="sm" variant="outline" onClick={handleSendFeedback}>
                              <MessageSquare className="h-3 w-3 mr-1" /> Send Feedback
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />

      {/* Submit Delivery Dialog */}
      <Dialog open={showSubmitDelivery} onOpenChange={setShowSubmitDelivery}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Submit Delivery for Review</DialogTitle>
            <DialogDescription>Describe the work completed and attach any deliverables. The client will review your submission.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Submission Notes *</Label>
              <Textarea
                placeholder="Describe what you've completed, any notes for the client..."
                rows={5}
                value={submissionNotes}
                onChange={(e) => setSubmissionNotes(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Attachments</Label>
              <input
                ref={submissionFileRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.dwg,.dxf,.zip"
                className="hidden"
                onChange={handleSubmissionFileChange}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => submissionFileRef.current?.click()} disabled={submissionFiles.length >= 5}>
                <Paperclip className="h-4 w-4 mr-2" /> Add Files
              </Button>
              {submissionFiles.length > 0 && (
                <div className="space-y-2 mt-2">
                  {submissionFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 border border-border">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm flex-1 truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</span>
                      <X className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => setSubmissionFiles(submissionFiles.filter((_, i) => i !== idx))} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDelivery(false)}>Cancel</Button>
            <Button onClick={handleSubmitDelivery} disabled={actionLoading || uploadingSubmission}>
              {actionLoading || uploadingSubmission ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              {uploadingSubmission ? "Uploading..." : "Submit for Review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Submission Detail Dialog */}
      <Dialog open={!!showSubmissionDetail} onOpenChange={() => setShowSubmissionDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Submission Details</DialogTitle>
            <DialogDescription>Review the expert's submission for "{showSubmissionDetail?.title}"</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {showSubmissionDetail?.submission_notes && (
              <div className="space-y-2">
                <Label>Notes from Expert</Label>
                <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm whitespace-pre-wrap">
                  {showSubmissionDetail.submission_notes}
                </div>
              </div>
            )}
            {showSubmissionDetail?.submission_attachments?.length > 0 && (
              <div className="space-y-2">
                <Label>Attachments</Label>
                <div className="space-y-2">
                  {showSubmissionDetail.submission_attachments.map((url: string, idx: number) => {
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
          </div>
          <DialogFooter>
            {isClient && showSubmissionDetail?.status === "submitted" && (
              <>
                <Button variant="outline" onClick={() => { setShowSubmissionDetail(null); handleSendFeedback(); }}>
                  <MessageSquare className="h-4 w-4 mr-1" /> Send Feedback
                </Button>
                <Button onClick={() => { handleMilestoneAction("approve_release", showSubmissionDetail.id); setShowSubmissionDetail(null); }} disabled={actionLoading}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Approve & Release
                </Button>
              </>
            )}
            {!isClient && <Button variant="outline" onClick={() => setShowSubmissionDetail(null)}>Close</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Milestone Dialog */}
      <Dialog open={showAddMilestone} onOpenChange={setShowAddMilestone}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Milestone</DialogTitle>
            <DialogDescription>Define a payment milestone for this contract.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input placeholder="e.g. Initial Design" value={newMilestone.title} onChange={(e) => setNewMilestone(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="What's included..." value={newMilestone.description} onChange={(e) => setNewMilestone(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount (₦)</Label>
                <Input type="number" min="1" value={newMilestone.amount} onChange={(e) => setNewMilestone(p => ({ ...p, amount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input type="date" value={newMilestone.due_date} onChange={(e) => setNewMilestone(p => ({ ...p, due_date: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMilestone(false)}>Cancel</Button>
            <Button onClick={addMilestone} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Add Milestone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispute Dialog */}
      <Dialog open={showDispute} onOpenChange={setShowDispute}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Raise a Dispute</DialogTitle>
            <DialogDescription>Funds will remain locked until the dispute is resolved by an admin.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea placeholder="Describe the issue..." rows={4} value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDispute(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRaiseDispute} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <AlertTriangle className="h-4 w-4 mr-2" />}
              Submit Dispute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
