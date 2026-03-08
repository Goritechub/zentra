import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { formatNaira } from "@/lib/nigerian-data";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, Eye } from "lucide-react";

export default function AdminContracts() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [escrow, setEscrow] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedContract, setSelectedContract] = useState<any>(null);

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

  const statusColor = (s: string) => {
    const map: Record<string, string> = { active: "default", completed: "secondary", disputed: "destructive", cancelled: "outline", draft: "outline", pending_funding: "secondary" };
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
            {filtered.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium max-w-[180px] truncate">{c.job_title || "—"}</TableCell>
                <TableCell className="text-sm">{c.client?.full_name || "—"}</TableCell>
                <TableCell className="text-sm">{c.freelancer?.full_name || "—"}</TableCell>
                <TableCell className="text-sm font-medium">{formatNaira(c.amount)}</TableCell>
                <TableCell><Badge variant={statusColor(c.status)} className="capitalize">{c.status}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => viewContract(c)}><Eye className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
