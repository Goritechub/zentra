import { useState, useEffect } from "react";
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
  ShieldCheck, AlertTriangle, Milestone as MilestoneIcon
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
  const [newMilestone, setNewMilestone] = useState({ title: "", description: "", amount: "", due_date: "" });
  const [disputeReason, setDisputeReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const fetchData = async () => {
    const { data: contractData } = await supabase
      .from("contracts")
      .select("*, job:jobs!contracts_job_id_fkey(title), client:profiles!contracts_client_id_fkey(full_name, avatar_url), freelancer:profiles!contracts_freelancer_id_fkey(full_name, avatar_url)")
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

  const handleMilestoneAction = async (action: string, milestoneId: string) => {
    setActionLoading(true);
    const response = await supabase.functions.invoke("escrow-release", {
      body: { action, milestone_id: milestoneId, contract_id: id },
    });

    if (response.error || response.data?.error) {
      toast.error(response.data?.error || "Action failed");
    } else {
      toast.success(action === "fund_milestone" ? "Milestone funded!" : action === "submit_delivery" ? "Delivery submitted!" : "Payment released!");
      fetchData();
    }
    setActionLoading(false);
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
                      </div>
                      <div className="flex flex-col gap-1">
                        {isClient && ms.status === "pending" && (
                          <Button size="sm" onClick={() => handleMilestoneAction("fund_milestone", ms.id)} disabled={actionLoading}>
                            <DollarSign className="h-3 w-3 mr-1" /> Fund
                          </Button>
                        )}
                        {isFreelancer && (ms.status === "funded" || ms.status === "in_progress") && (
                          <Button size="sm" onClick={() => handleMilestoneAction("submit_delivery", ms.id)} disabled={actionLoading}>
                            <Send className="h-3 w-3 mr-1" /> Submit
                          </Button>
                        )}
                        {isClient && ms.status === "submitted" && (
                          <Button size="sm" onClick={() => handleMilestoneAction("approve_release", ms.id)} disabled={actionLoading}>
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Approve & Release
                          </Button>
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
