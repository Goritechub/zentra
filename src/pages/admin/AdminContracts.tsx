import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, differenceInBusinessDays } from "date-fns";
import { formatNaira } from "@/lib/nigerian-data";
import { createNotification } from "@/lib/notifications";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, Eye, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const DELETABLE_STATUSES = ["interviewing", "draft", "pending_funding"];

export default function AdminContracts() {
  const { user } = useAuth();
  const [contracts, setContracts] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [escrow, setEscrow] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; contract: any | null }>({ open: false, contract: null });
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchContracts(); }, []);

  const fetchContracts = async () => {
    const { data } = await supabase
      .from("contracts")
      .select("*, client:profiles!contracts_client_id_fkey(full_name), freelancer:profiles!contracts_freelancer_id_fkey(full_name)")
      .order("created_at", { ascending: false })
      .limit(500);
    setContracts(data || []);
    setLoading(false);
  };

  const viewContract = async (c: any) => {
    setSelectedContract(c);
    const [msRes, escrowRes] = await Promise.all([
      supabase.from("milestones").select("*").eq("contract_id", c.id).order("created_at", { ascending: true }),
      supabase.from("escrow_ledger").select("*").eq("contract_id", c.id),
    ]);
    setMilestones(msRes.data || []);
    setEscrow(escrowRes.data || []);
  };

  const deleteContract = async (contract: any) => {
    if (!user) return;
    setDeleting(true);
    try {
      // Delete all FK-dependent records (order matters)
      // First: delete children of milestones/disputes
      const { data: milestoneIds } = await supabase.from("milestones").select("id").eq("contract_id", contract.id);
      const { data: disputeIds } = await supabase.from("disputes").select("id").eq("contract_id", contract.id);
      
      if (milestoneIds?.length) {
        const msIds = milestoneIds.map(m => m.id);
        await supabase.from("milestone_submissions").delete().in("milestone_id", msIds);
      }
      if (disputeIds?.length) {
        const dIds = disputeIds.map(d => d.id);
        await supabase.from("dispute_messages").delete().in("dispute_id", dIds);
      }

      // Then: delete direct FK references to contracts
      await Promise.all([
        supabase.from("contract_attachments").delete().eq("contract_id", contract.id),
        supabase.from("contract_messages").delete().eq("contract_id", contract.id),
        supabase.from("escrow_ledger").delete().eq("contract_id", contract.id),
        supabase.from("escrow_transactions").delete().eq("contract_id", contract.id),
        supabase.from("hidden_conversations").delete().eq("contract_id", contract.id),
        supabase.from("disputes").delete().eq("contract_id", contract.id),
        supabase.from("payout_transfers").delete().eq("contract_id", contract.id),
        supabase.from("reviews").delete().eq("contract_id", contract.id),
        supabase.from("notifications").delete().eq("contract_id", contract.id),
        supabase.from("milestones").delete().eq("contract_id", contract.id),
      ]);

      // Delete the contract
      const { error } = await supabase.from("contracts").delete().eq("id", contract.id);
      if (error) throw error;

      // Notify both parties
      const isInterviewing = contract.status === "interviewing";
      const message = isInterviewing
        ? `Your interview contract for "${contract.job_title || "a project"}" has been closed by ZentraGig. If you have questions, please contact support.`
        : `Your contract for "${contract.job_title || "a project"}" has been removed by ZentraGig.`;

      const notificationPromises = [
        createNotification({
          userId: contract.client_id,
          type: "contract_closed",
          title: "Contract Closed by Platform",
          message,
          linkUrl: "/contracts",
        }),
        createNotification({
          userId: contract.freelancer_id,
          type: "contract_closed",
          title: "Contract Closed by Platform",
          message,
          linkUrl: "/contracts",
        }),
      ];

      // Log admin activity
      notificationPromises.push(
        supabase.from("admin_activity_log").insert({
          admin_id: user.id,
          action: "delete_contract",
          target_type: "contract",
          target_id: contract.id,
          details: {
            job_title: contract.job_title,
            status: contract.status,
            client_id: contract.client_id,
            freelancer_id: contract.freelancer_id,
          },
        }) as any
      );

      await Promise.all(notificationPromises);

      setContracts(prev => prev.filter(c => c.id !== contract.id));
      setDeleteDialog({ open: false, contract: null });
      toast.success("Contract deleted and parties notified.");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete contract.");
    } finally {
      setDeleting(false);
    }
  };

  const isDeletable = (status: string) => DELETABLE_STATUSES.includes(status);

  const getStaleLabel = (c: any) => {
    if (c.status !== "interviewing") return null;
    const days = differenceInBusinessDays(new Date(), new Date(c.created_at));
    if (days >= 20) return `${days} business days old`;
    return null;
  };

  const statusColor = (s: string) => {
    const map: Record<string, string> = { active: "default", completed: "secondary", disputed: "destructive", cancelled: "outline", draft: "outline", pending_funding: "secondary", interviewing: "default" };
    return (map[s] || "outline") as any;
  };

  const filtered = contracts.filter(c => {
    const matchSearch = !search || c.job_title?.toLowerCase().includes(search.toLowerCase()) || c.client?.full_name?.toLowerCase().includes(search.toLowerCase()) || c.freelancer?.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Contracts Management</h1>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search contracts..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="interviewing">Interviewing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="disputed">Disputed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="pending_funding">Pending Funding</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary">{filtered.length} contracts</Badge>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Expert</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(c => {
              const staleLabel = getStaleLabel(c);
              return (
                <TableRow key={c.id} className={staleLabel ? "bg-amber-500/5" : ""}>
                  <TableCell className="font-medium max-w-[180px] truncate">{c.job_title || "—"}</TableCell>
                  <TableCell className="text-sm">{c.client?.full_name || "—"}</TableCell>
                  <TableCell className="text-sm">{c.freelancer?.full_name || "—"}</TableCell>
                  <TableCell className="text-sm font-medium">{formatNaira(c.amount)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={statusColor(c.status)} className="capitalize">{c.status}</Badge>
                      {staleLabel && (
                        <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                          <AlertTriangle className="h-3 w-3 mr-0.5" />{staleLabel}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => viewContract(c)}><Eye className="h-4 w-4" /></Button>
                      {isDeletable(c.status) && (
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteDialog({ open: true, contract: c })}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* View Contract Dialog */}
      <Dialog open={!!selectedContract} onOpenChange={() => setSelectedContract(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Contract: {selectedContract?.job_title}</DialogTitle>
          </DialogHeader>
          {selectedContract && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>Client: <span className="font-medium">{selectedContract.client?.full_name}</span></div>
                <div>Expert: <span className="font-medium">{selectedContract.freelancer?.full_name}</span></div>
                <div>Amount: <span className="font-bold text-primary">{formatNaira(selectedContract.amount)}</span></div>
                <div>Status: <Badge variant={statusColor(selectedContract.status)} className="capitalize">{selectedContract.status}</Badge></div>
              </div>

              {milestones.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Milestones ({milestones.length})</h4>
                  <div className="space-y-2">
                    {milestones.map(ms => (
                      <div key={ms.id} className="flex items-center justify-between border border-border rounded-lg p-3 text-sm">
                        <div>
                          <p className="font-medium">{ms.title}</p>
                          <Badge variant="outline" className="text-xs capitalize mt-1">{ms.status}</Badge>
                        </div>
                        <span className="font-semibold text-primary">{formatNaira(ms.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {escrow.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Escrow Ledger</h4>
                  <div className="space-y-1 text-sm">
                    {escrow.map(e => (
                      <div key={e.id} className="flex justify-between py-1 border-b border-border last:border-0">
                        <span className="capitalize">{e.status}</span>
                        <span className="font-medium">Held: {formatNaira(e.held_amount)} | Released: {formatNaira(e.released_amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isDeletable(selectedContract.status) && (
                <div className="pt-2 border-t border-border">
                  <Button variant="destructive" size="sm" onClick={() => { setSelectedContract(null); setDeleteDialog({ open: true, contract: selectedContract }); }}>
                    <Trash2 className="h-4 w-4 mr-2" /> Delete Contract
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, contract: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Delete Contract
            </DialogTitle>
            <DialogDescription>
              This will permanently delete the contract "{deleteDialog.contract?.job_title || "Untitled"}" 
              ({deleteDialog.contract?.status}) and all associated messages, milestones, and escrow records.
              {deleteDialog.contract?.status === "interviewing" && (
                <span className="block mt-2 font-medium text-foreground">
                  Both the client and expert will be notified that this contract was closed by ZentraGig.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, contract: null })} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteDialog.contract && deleteContract(deleteDialog.contract)} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete & Notify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
