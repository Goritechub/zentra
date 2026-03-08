import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatNaira } from "@/lib/nigerian-data";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import {
  Loader2, AlertTriangle, Download, Gavel, Scale, MessageSquare, FileText,
  ShieldCheck, User, Clock, CheckCircle2, ArrowRight
} from "lucide-react";

interface DisputeAdjudicatorProps {
  dispute: any;
  onResolved: () => void;
}

export function DisputeAdjudicator({ dispute, onResolved }: DisputeAdjudicatorProps) {
  const { user } = useAuth();
  const [contract, setContract] = useState<any>(null);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [escrowLedger, setEscrowLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolve, setShowResolve] = useState(false);
  const [resolutionType, setResolutionType] = useState<string>("");
  const [resolutionExplanation, setResolutionExplanation] = useState("");
  const [splitClient, setSplitClient] = useState("");
  const [splitFreelancer, setSplitFreelancer] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => { fetchDetails(); }, [dispute.id]);

  const fetchDetails = async () => {
    const [contractRes, chatRes, msRes, escrowRes] = await Promise.all([
      supabase.from("contracts")
        .select("*, client:profiles!contracts_client_id_fkey(full_name, avatar_url, id, email), freelancer:profiles!contracts_freelancer_id_fkey(full_name, avatar_url, id, email)")
        .eq("id", dispute.contract_id).single(),
      supabase.from("contract_messages").select("*").eq("contract_id", dispute.contract_id).order("created_at", { ascending: true }).limit(200),
      supabase.from("milestones").select("*").eq("contract_id", dispute.contract_id).order("created_at", { ascending: true }),
      supabase.from("escrow_ledger").select("*").eq("contract_id", dispute.contract_id),
    ]);
    setContract(contractRes.data);
    setChatHistory(chatRes.data || []);
    setMilestones(msRes.data || []);
    setEscrowLedger(escrowRes.data || []);
    setLoading(false);
  };

  const totalHeld = escrowLedger.filter(e => e.status === "held").reduce((s, e) => s + e.held_amount, 0);

  const handleResolve = async () => {
    if (!resolutionExplanation.trim()) {
      toast.error("Please provide an explanation"); return;
    }

    // If no escrow, just close the dispute directly in DB
    if (totalHeld <= 0) {
      setActionLoading(true);
      const { error } = await supabase.from("disputes").update({
        dispute_status: "resolved",
        status: "resolved",
        resolution_type: "no_funds",
        resolution_explanation: resolutionExplanation.trim(),
        resolved_at: new Date().toISOString(),
        resolved_by: user?.id,
      }).eq("id", dispute.id);

      if (error) {
        toast.error("Failed to close dispute");
      } else {
        toast.success("Dispute closed successfully");
        setShowResolve(false);
        onResolved();
      }
      setActionLoading(false);
      return;
    }

    if (!resolutionType) {
      toast.error("Please select an outcome"); return;
    }
    if (resolutionType === "partial_split") {
      const cAmt = parseInt(splitClient) || 0;
      const fAmt = parseInt(splitFreelancer) || 0;
      if (cAmt + fAmt !== totalHeld) {
        toast.error(`Split must equal the total escrow amount of ${formatNaira(totalHeld)}`); return;
      }
    }
    setActionLoading(true);

    const response = await supabase.functions.invoke("escrow-release", {
      body: {
        action: "resolve_dispute",
        dispute_id: dispute.id,
        contract_id: dispute.contract_id,
        resolution_type: resolutionType,
        resolution_explanation: resolutionExplanation.trim(),
        split_client: resolutionType === "partial_split" ? parseInt(splitClient) || 0 : 0,
        split_freelancer: resolutionType === "partial_split" ? parseInt(splitFreelancer) || 0 : 0,
      },
    });

    if (response.error || response.data?.error) {
      toast.error(response.data?.error || "Failed to resolve dispute");
    } else {
      toast.success("Dispute resolved successfully");
      setShowResolve(false);
      onResolved();
    }
    setActionLoading(false);
  };

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!contract) return <p className="text-muted-foreground text-center py-8">Contract data unavailable</p>;

  const raiserProfile = contract.client?.id === dispute.raised_by ? contract.client : contract.freelancer;
  const respondentProfile = contract.client?.id === dispute.respondent_id ? contract.client : contract.freelancer;

  return (
    <div className="space-y-6">
      {/* Contract Summary */}
      <div className="bg-muted/50 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Contract Summary</h3>
          <Badge variant="destructive">Disputed</Badge>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Job</p>
            <p className="font-medium text-foreground">{contract.job_title}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Contract Amount</p>
            <p className="font-medium text-primary">{formatNaira(contract.amount)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Client</p>
            <p className="font-medium">{contract.client?.full_name}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Expert</p>
            <p className="font-medium">{contract.freelancer?.full_name}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Escrow Held</p>
            <p className="font-bold text-destructive">{formatNaira(totalHeld)}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="submissions" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="submissions" className="flex-1">Submissions</TabsTrigger>
          <TabsTrigger value="chat" className="flex-1">Chat History ({chatHistory.length})</TabsTrigger>
          <TabsTrigger value="milestones" className="flex-1">Milestones</TabsTrigger>
          <TabsTrigger value="contract" className="flex-1">Contract Terms</TabsTrigger>
        </TabsList>

        {/* Submissions Tab */}
        <TabsContent value="submissions" className="space-y-4 mt-4">
          {/* Complainant */}
          <div className="border-2 border-destructive/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Avatar className="h-6 w-6"><AvatarImage src={raiserProfile?.avatar_url} /><AvatarFallback>{(raiserProfile?.full_name || "U")[0]}</AvatarFallback></Avatar>
              <span className="text-sm font-medium">{raiserProfile?.full_name}</span>
              <Badge variant="outline" className="text-xs">Complainant</Badge>
            </div>
            <p className="text-sm whitespace-pre-wrap">{dispute.reason}</p>
            {dispute.evidence_urls?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {dispute.evidence_urls.map((url: string, i: number) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline border border-border rounded px-2 py-1">
                    <Download className="h-3 w-3" /> Evidence {i + 1}
                  </a>
                ))}
              </div>
            )}
          </div>
          {/* Respondent */}
          <div className={`border-2 rounded-lg p-4 ${dispute.respondent_explanation ? "border-primary/20" : "border-dashed border-muted-foreground/20"}`}>
            <div className="flex items-center gap-2 mb-3">
              <Avatar className="h-6 w-6"><AvatarImage src={respondentProfile?.avatar_url} /><AvatarFallback>{(respondentProfile?.full_name || "U")[0]}</AvatarFallback></Avatar>
              <span className="text-sm font-medium">{respondentProfile?.full_name}</span>
              <Badge variant="outline" className="text-xs">Respondent</Badge>
            </div>
            {dispute.respondent_explanation ? (
              <>
                <p className="text-sm whitespace-pre-wrap">{dispute.respondent_explanation}</p>
                {dispute.respondent_evidence_urls?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {dispute.respondent_evidence_urls.map((url: string, i: number) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline border border-border rounded px-2 py-1">
                        <Download className="h-3 w-3" /> Evidence {i + 1}
                      </a>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground italic">No response submitted yet</p>
            )}
          </div>
        </TabsContent>

        {/* Chat History Tab */}
        <TabsContent value="chat" className="mt-4">
          <div className="max-h-96 overflow-y-auto space-y-2 border border-border rounded-lg p-3">
            {chatHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No messages</p>
            ) : chatHistory.map(msg => (
              <div key={msg.id} className={`p-2 rounded text-xs ${msg.is_system_message ? "bg-muted/50 text-muted-foreground italic" : "bg-card border border-border"}`}>
                <div className="flex justify-between mb-1">
                  <span className="font-medium">
                    {msg.is_system_message ? "System" : msg.sender_id === contract.client_id ? contract.client?.full_name : contract.freelancer?.full_name}
                  </span>
                  <span className="text-muted-foreground">{format(new Date(msg.created_at), "PP p")}</span>
                </div>
                <p>{msg.content}</p>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Milestones Tab */}
        <TabsContent value="milestones" className="mt-4">
          {milestones.length === 0 ? <p className="text-center text-muted-foreground py-4">No milestones</p> : (
            <div className="space-y-2">
              {milestones.map(ms => (
                <div key={ms.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div>
                    <p className="text-sm font-medium">{ms.title}</p>
                    <p className="text-xs text-muted-foreground">{ms.status}</p>
                  </div>
                  <span className="text-sm font-semibold text-primary">{formatNaira(ms.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Contract Terms Tab */}
        <TabsContent value="contract" className="mt-4">
          <div className="space-y-4 text-sm">
            {contract.job_description && (
              <div><p className="text-xs font-medium text-muted-foreground mb-1">Job Description</p><p className="whitespace-pre-wrap">{contract.job_description}</p></div>
            )}
            {contract.accepted_cover_letter && (
              <div><p className="text-xs font-medium text-muted-foreground mb-1">Accepted Proposal</p><p className="whitespace-pre-wrap">{contract.accepted_cover_letter}</p></div>
            )}
            {contract.terms_conditions && (
              <div><p className="text-xs font-medium text-muted-foreground mb-1">Terms & Conditions</p><p className="whitespace-pre-wrap">{contract.terms_conditions}</p></div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      {dispute.dispute_status !== "resolved" && (
        <div className="flex items-center justify-between">
          {totalHeld <= 0 && (
            <p className="text-sm text-amber-600 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              No escrow funds held — funds were already released or contract completed.
            </p>
          )}
          <Button onClick={() => setShowResolve(true)} className="ml-auto">
            <Gavel className="h-4 w-4 mr-2" /> {totalHeld > 0 ? "Render Decision" : "Close Dispute"}
          </Button>
        </div>
      )}

      {/* Resolution Dialog */}
      <Dialog open={showResolve} onOpenChange={setShowResolve}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Gavel className="h-5 w-5" /> {totalHeld > 0 ? "Render Dispute Decision" : "Close Dispute"}</DialogTitle>
            <DialogDescription>{totalHeld > 0 ? `Choose an outcome for this dispute. Escrow: ${formatNaira(totalHeld)}` : "No escrow funds to distribute. Provide a closing note."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {totalHeld > 0 && (
              <Label>Outcome *</Label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { value: "release_to_freelancer", label: "Release funds to Expert", icon: ArrowRight, desc: `Expert receives ${formatNaira(totalHeld)}` },
                  { value: "refund_client", label: "Refund Client", icon: ArrowRight, desc: `Client receives ${formatNaira(totalHeld)}` },
                  { value: "partial_split", label: "Partial Split", icon: Scale, desc: "Split escrow between both parties" },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setResolutionType(opt.value)}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                      resolutionType === opt.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <opt.icon className={`h-4 w-4 ${resolutionType === opt.value ? "text-primary" : "text-muted-foreground"}`} />
                    <div>
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {resolutionType === "partial_split" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Client Amount (₦)</Label>
                  <Input type="number" min="0" value={splitClient} onChange={e => {
                    setSplitClient(e.target.value);
                    setSplitFreelancer(String(totalHeld - (parseInt(e.target.value) || 0)));
                  }} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Expert Amount (₦)</Label>
                  <Input type="number" min="0" value={splitFreelancer} onChange={e => {
                    setSplitFreelancer(e.target.value);
                    setSplitClient(String(totalHeld - (parseInt(e.target.value) || 0)));
                  }} />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Decision Explanation *</Label>
              <Textarea placeholder="Explain your decision and reasoning..." rows={5} value={resolutionExplanation} onChange={e => setResolutionExplanation(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResolve(false)}>Cancel</Button>
            <Button onClick={handleResolve} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Gavel className="h-4 w-4 mr-2" />} Confirm Decision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
