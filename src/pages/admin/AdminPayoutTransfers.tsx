import { useState, useEffect } from "react";
import { getAdminPayoutTransfers, retryAdminPayoutTransfer } from "@/api/admin.api";
import type { AdminPayoutTransfer } from "@/types/admin";
import { useCurrency } from "@/hooks/useCurrency";
import { formatDistanceToNow } from "date-fns";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Search, RotateCcw, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function AdminPayoutTransfers() {
  const { format } = useCurrency();
  useAuth();
  const [transfers, setTransfers] = useState<AdminPayoutTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [retrying, setRetrying] = useState<string | null>(null);

  useEffect(() => { void fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const data = await getAdminPayoutTransfers();
      setTransfers(data.transfers || []);
    } catch {
      toast.error("Failed to load payout transfers");
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (transfer: AdminPayoutTransfer) => {
    setRetrying(transfer.id);
    try {
      await retryAdminPayoutTransfer(transfer.id);
      toast.success("Retry initiated — transfer is now pending");
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setRetrying(null);
    }
  };

  const q = search.toLowerCase();
  const filtered = transfers.filter((t) =>
    !q ||
    t.expert?.full_name?.toLowerCase().includes(q) ||
    t.expert?.email?.toLowerCase().includes(q) ||
    t.milestone?.title?.toLowerCase().includes(q) ||
    t.transfer_code?.toLowerCase().includes(q)
  );

  const byStatus = (status: string | string[]) =>
    filtered.filter((t) =>
      Array.isArray(status) ? status.includes(t.status) : t.status === status
    );

  const statusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending_bank: { variant: "secondary", label: "Pending Bank" },
      failed:       { variant: "destructive", label: "Failed" },
      pending:      { variant: "outline", label: "Pending" },
      success:      { variant: "default", label: "Success" },
      completed:    { variant: "default", label: "Completed" },
    };
    const cfg = variants[status] || { variant: "outline", label: status };
    return <Badge variant={cfg.variant} className="capitalize text-xs">{cfg.label}</Badge>;
  };

  const TransferTable = ({ rows }: { rows: AdminPayoutTransfer[] }) => (
    rows.length === 0 ? (
      <EmptyState variant="wallet" title={q ? "No transfers match your search" : "No transfers in this category"} />
    ) : (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Expert</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Platform Fee</TableHead>
            <TableHead>Milestone</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Transfer Code</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((t) => (
            <TableRow key={t.id}>
              <TableCell>
                <div>
                  <p className="text-sm font-medium">{t.expert?.full_name || "—"}</p>
                  <p className="text-xs text-muted-foreground">{t.expert?.email || "—"}</p>
                </div>
              </TableCell>
              <TableCell className="font-medium">{format(t.amount)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{format(t.platform_fee)}</TableCell>
              <TableCell className="text-sm max-w-[160px] truncate">{t.milestone?.title || "—"}</TableCell>
              <TableCell>{statusBadge(t.status)}</TableCell>
              <TableCell className="text-xs text-muted-foreground font-mono">
                {t.transfer_code || "—"}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
              </TableCell>
              <TableCell>
                {(t.status === "failed" || t.status === "pending_bank") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRetry(t)}
                    disabled={retrying === t.id}
                  >
                    {retrying === t.id
                      ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      : <RotateCcw className="h-3 w-3 mr-1" />}
                    Retry
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pendingBank = byStatus("pending_bank");
  const failed = byStatus("failed");
  const pending = byStatus("pending");
  const completed = byStatus(["success", "completed"]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Payout Transfers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Automated expert payouts triggered on milestone approval. Retry failed or bank-pending transfers here.
        </p>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-3">
        {pendingBank.length > 0 && (
          <div className="flex items-center gap-2 bg-secondary/40 border border-border rounded-lg px-3 py-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{pendingBank.length} awaiting bank details</span>
          </div>
        )}
        {failed.length > 0 && (
          <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm font-medium text-destructive">{failed.length} failed — action needed</span>
          </div>
        )}
        {completed.length > 0 && (
          <div className="flex items-center gap-2 bg-success/10 border border-success/30 rounded-lg px-3 py-2">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span className="text-sm font-medium text-success">{completed.length} completed</span>
          </div>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by expert name, email, milestone or transfer code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Tabs defaultValue={pendingBank.length > 0 || failed.length > 0 ? "needs-action" : "all"}>
        <TabsList>
          <TabsTrigger value="needs-action">
            Needs Action {pendingBank.length + failed.length > 0 && `(${pendingBank.length + failed.length})`}
          </TabsTrigger>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
          <TabsTrigger value="all">All ({filtered.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="needs-action">
          <div className="bg-card rounded-xl border border-border overflow-hidden mt-4">
            <TransferTable rows={[...pendingBank, ...failed]} />
          </div>
        </TabsContent>

        <TabsContent value="pending">
          <div className="bg-card rounded-xl border border-border overflow-hidden mt-4">
            <TransferTable rows={pending} />
          </div>
        </TabsContent>

        <TabsContent value="completed">
          <div className="bg-card rounded-xl border border-border overflow-hidden mt-4">
            <TransferTable rows={completed} />
          </div>
        </TabsContent>

        <TabsContent value="all">
          <div className="bg-card rounded-xl border border-border overflow-hidden mt-4">
            <TransferTable rows={filtered} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
