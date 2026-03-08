import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/nigerian-data";
import { formatDistanceToNow, format, addHours, isPast } from "date-fns";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2, AlertTriangle, ShieldCheck, Clock, FileText,
  Download, Paperclip, X, Send, CheckCircle2, Scale, User, Gavel
} from "lucide-react";

const DISPUTE_STATUS_CONFIG: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; color: string }> = {
  awaiting_response: { variant: "destructive", label: "Awaiting Response", color: "text-amber-500" },
  under_review: { variant: "secondary", label: "Under Review", color: "text-blue-500" },
  resolved: { variant: "default", label: "Resolved", color: "text-primary" },
};

export default function DisputeDetail() {
  const { disputeId } = useParams<{ disputeId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dispute, setDispute] = useState<any>(null);
  const [contract, setContract] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showRespond, setShowRespond] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [responseFiles, setResponseFiles] = useState<File[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (disputeId) fetchData(); }, [disputeId]);

  const fetchData = async () => {
    const { data: d } = await supabase
      .from("disputes")
      .select("*")
      .eq("id", disputeId)
      .single();
    
    if (d) {
      setDispute(d);
      const { data: c } = await supabase
        .from("contracts")
        .select("*, client:profiles!contracts_client_id_fkey(full_name, avatar_url, id), freelancer:profiles!contracts_freelancer_id_fkey(full_name, avatar_url, id)")
        .eq("id", d.contract_id)
        .single();
      setContract(c);
    }
    setLoading(false);
  };

  const isRaisedBy = dispute?.raised_by === user?.id;
  const isRespondent = dispute?.respondent_id === user?.id;
  const isParticipant = contract && (contract.client_id === user?.id || contract.freelancer_id === user?.id);
  const raiserProfile = contract?.client?.id === dispute?.raised_by ? contract?.client : contract?.freelancer;
  const respondentProfile = contract?.client?.id === dispute?.respondent_id ? contract?.client : contract?.freelancer;
  const deadlineExpired = dispute?.response_deadline && isPast(new Date(dispute.response_deadline));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 5);
    setResponseFiles(prev => [...prev, ...files].slice(0, 5));
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmitResponse = async () => {
    if (!responseText.trim()) { toast.error("Please provide your explanation"); return; }
    setActionLoading(true);
    
    const evidenceUrls: string[] = [];
    for (const file of responseFiles) {
      const path = `disputes/${user!.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from('contract-attachments').upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from('contract-attachments').getPublicUrl(path);
        evidenceUrls.push(data.publicUrl);
      }
    }

    const { error } = await supabase.from("disputes").update({
      respondent_explanation: responseText.trim(),
      respondent_evidence_urls: evidenceUrls,
      dispute_status: "under_review",
      status: "under_review",
      updated_at: new Date().toISOString(),
    }).eq("id", disputeId);

    if (error) { toast.error("Failed to submit response"); }
    else {
      // Notify the other party and system
      await supabase.from("contract_messages").insert({
        contract_id: dispute.contract_id,
        sender_id: user!.id,
        content: `📋 Response submitted to dispute. Case is now under review by a ZentraGig adjudicator.`,
        is_system_message: true,
      });
      
      toast.success("Response submitted. Case is now under review.");
      setShowRespond(false);
      setResponseText("");
      setResponseFiles([]);
      fetchData();
    }
    setActionLoading(false);
  };

  if (loading) {
    return (<div className="min-h-screen flex flex-col"><Header /><div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div><Footer /></div>);
  }

  if (!dispute || !contract || !isParticipant) {
    return (<div className="min-h-screen flex flex-col"><Header /><div className="flex-1 flex items-center justify-center"><p className="text-muted-foreground">Dispute not found or access denied.</p></div><Footer /></div>);
  }

  const statusCfg = DISPUTE_STATUS_CONFIG[dispute.dispute_status] || DISPUTE_STATUS_CONFIG.awaiting_response;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-wide max-w-3xl">
          <Button variant="ghost" onClick={() => navigate(`/contract/${contract.id}?tab=disputes`)} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Contract
          </Button>

          {/* Header */}
          <div className="bg-card rounded-xl border border-border p-6 mb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                  <h1 className="text-xl font-bold text-foreground">Dispute Resolution</h1>
                </div>
                <p className="text-sm text-muted-foreground">Contract: {contract.job_title}</p>
                <p className="text-sm text-muted-foreground">Amount in Escrow: <span className="text-primary font-semibold">{formatNaira(contract.amount)}</span></p>
              </div>
              <Badge variant={statusCfg.variant} className="text-sm">{statusCfg.label}</Badge>
            </div>
          </div>

          {/* Status Flow */}
          <div className="bg-card rounded-xl border border-border p-6 mb-6">
            <h2 className="text-sm font-semibold text-muted-foreground mb-4">DISPUTE STATUS FLOW</h2>
            <div className="flex items-center gap-2 flex-wrap">
              {["awaiting_response", "under_review", "resolved"].map((step, i) => {
                const isActive = step === dispute.dispute_status;
                const isPast = ["awaiting_response", "under_review", "resolved"].indexOf(dispute.dispute_status) > i;
                return (
                  <div key={step} className="flex items-center gap-2">
                    {i > 0 && <div className={`h-0.5 w-6 ${isPast ? "bg-primary" : "bg-border"}`} />}
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
                      isActive ? "bg-primary text-primary-foreground border-primary" : 
                      isPast ? "bg-primary/10 text-primary border-primary/30" : 
                      "bg-muted text-muted-foreground border-border"
                    }`}>
                      {isPast && <CheckCircle2 className="h-3 w-3" />}
                      {isActive && <Clock className="h-3 w-3" />}
                      {DISPUTE_STATUS_CONFIG[step]?.label || step}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Complainant Submission */}
          <div className="bg-card rounded-xl border-2 border-destructive/20 p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Avatar className="h-8 w-8">
                <AvatarImage src={raiserProfile?.avatar_url || undefined} />
                <AvatarFallback className="bg-destructive/10 text-destructive">{(raiserProfile?.full_name || "U")[0]}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold text-foreground">{raiserProfile?.full_name} <Badge variant="outline" className="ml-1 text-xs">Complainant</Badge></p>
                <p className="text-xs text-muted-foreground">Filed {formatDistanceToNow(new Date(dispute.created_at), { addSuffix: true })}</p>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <p className="text-sm text-foreground whitespace-pre-wrap">{dispute.reason}</p>
            </div>
            {dispute.evidence_urls?.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Evidence ({dispute.evidence_urls.length} files)</p>
                {dispute.evidence_urls.map((url: string, i: number) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-muted/50 text-sm text-primary">
                    <Download className="h-4 w-4" /> Evidence {i + 1}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Respondent Submission */}
          <div className={`bg-card rounded-xl border-2 p-6 mb-6 ${dispute.respondent_explanation ? "border-primary/20" : "border-dashed border-border"}`}>
            <div className="flex items-center gap-3 mb-4">
              <Avatar className="h-8 w-8">
                <AvatarImage src={respondentProfile?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary">{(respondentProfile?.full_name || "U")[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{respondentProfile?.full_name} <Badge variant="outline" className="ml-1 text-xs">Respondent</Badge></p>
                {dispute.response_deadline && !dispute.respondent_explanation && (
                  <p className={`text-xs ${deadlineExpired ? "text-destructive font-medium" : "text-amber-500"}`}>
                    {deadlineExpired ? "⚠ Response deadline expired" : `Deadline: ${format(new Date(dispute.response_deadline), "PPp")}`}
                  </p>
                )}
              </div>
            </div>

            {dispute.respondent_explanation ? (
              <>
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <p className="text-sm text-foreground whitespace-pre-wrap">{dispute.respondent_explanation}</p>
                </div>
                {dispute.respondent_evidence_urls?.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Evidence ({dispute.respondent_evidence_urls.length} files)</p>
                    {dispute.respondent_evidence_urls.map((url: string, i: number) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-muted/50 text-sm text-primary">
                        <Download className="h-4 w-4" /> Evidence {i + 1}
                      </a>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-6">
                <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground">Awaiting response from respondent</p>
                {isRespondent && dispute.dispute_status === "awaiting_response" && (
                  <Button className="mt-3" onClick={() => setShowRespond(true)}>
                    <Send className="h-4 w-4 mr-2" /> Submit Your Response
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Resolution (if resolved) */}
          {dispute.dispute_status === "resolved" && dispute.resolution_explanation && (
            <div className="bg-card rounded-xl border-2 border-primary p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Gavel className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">ZentraGig Adjudicator Decision</p>
                  <p className="text-xs text-muted-foreground">
                    Resolved {dispute.resolved_at ? formatDistanceToNow(new Date(dispute.resolved_at), { addSuffix: true }) : ""}
                  </p>
                </div>
              </div>
              
              <div className="mb-4">
                <Badge variant="default" className="mb-2">
                  {dispute.resolution_type === "release_to_freelancer" && "Funds Released to Expert"}
                  {dispute.resolution_type === "refund_client" && "Funds Refunded to Client"}
                  {dispute.resolution_type === "partial_split" && "Partial Split"}
                </Badge>
              </div>

              {dispute.resolution_type === "partial_split" && (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
                    <p className="text-xs text-muted-foreground">Client Receives</p>
                    <p className="text-lg font-bold text-foreground">{formatNaira(dispute.resolution_split_client || 0)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
                    <p className="text-xs text-muted-foreground">Expert Receives</p>
                    <p className="text-lg font-bold text-primary">{formatNaira(dispute.resolution_split_freelancer || 0)}</p>
                  </div>
                </div>
              )}

              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-sm text-foreground whitespace-pre-wrap">{dispute.resolution_explanation}</p>
              </div>
            </div>
          )}

          {/* Under Review notice */}
          {dispute.dispute_status === "under_review" && (
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-6 text-center">
              <Scale className="h-10 w-10 mx-auto mb-3 text-blue-500" />
              <h3 className="text-base font-semibold text-foreground mb-1">Under Review</h3>
              <p className="text-sm text-muted-foreground">Both parties have submitted their cases. A ZentraGig adjudicator will review the evidence and make a decision.</p>
              <p className="text-xs text-muted-foreground mt-2">Escrow funds remain locked until a decision is made.</p>
            </div>
          )}
        </div>
      </main>
      <Footer />

      {/* Response Dialog */}
      <Dialog open={showRespond} onOpenChange={setShowRespond}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Submit Your Response</DialogTitle>
            <DialogDescription>Provide your explanation and evidence. You have 48 hours from when the dispute was filed.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Your Explanation *</Label>
              <Textarea placeholder="Explain your side of the situation in detail..." rows={6} value={responseText} onChange={(e) => setResponseText(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Evidence Attachments</Label>
              <input ref={fileRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.zip,.doc,.docx" className="hidden" onChange={handleFileChange} />
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={responseFiles.length >= 5}>
                <Paperclip className="h-4 w-4 mr-2" /> Add Evidence
              </Button>
              {responseFiles.length > 0 && (
                <div className="space-y-2 mt-2">
                  {responseFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 border border-border">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm flex-1 truncate">{file.name}</span>
                      <X className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => setResponseFiles(f => f.filter((_, i) => i !== idx))} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRespond(false)}>Cancel</Button>
            <Button onClick={handleSubmitResponse} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />} Submit Response
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
