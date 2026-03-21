import { useState, useEffect } from "react";
import {
  cancelAdminWithdrawal,
  getAdminPaymentsOverview,
  setAdminWithdrawalsFreeze,
} from "@/api/admin.api";
import { formatNaira } from "@/lib/nigerian-data";
import { formatDistanceToNow } from "date-fns";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Search, Wallet, ArrowDownLeft, ArrowUpRight, TrendingUp, Timer, ShieldAlert, XCircle } from "lucide-react";
import { RevenueWithdrawCard } from "@/components/admin/RevenueWithdrawCard";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function AdminPayments() {
  useAuth();
  const [wallets, setWallets] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [revenue, setRevenue] = useState<any[]>([]);
  const [pendingClearance, setPendingClearance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [withdrawalsFrozen, setWithdrawalsFrozen] = useState(false);
  const [togglingFreeze, setTogglingFreeze] = useState(false);

  useEffect(() => { void fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const data = await getAdminPaymentsOverview();
      setWallets(data.wallets || []);
      setTransactions(data.transactions || []);
      setWithdrawals(data.withdrawals || []);
      setRevenue(data.revenue || []);
      setWithdrawalsFrozen(!!data.withdrawalsFrozen);
      setPendingClearance(data.pendingClearance || []);
    } finally {
      setLoading(false);
    }
  };

  const toggleWithdrawalFreeze = async () => {
    setTogglingFreeze(true);
    const newValue = !withdrawalsFrozen;
    try {
      await setAdminWithdrawalsFreeze(newValue);
      setWithdrawalsFrozen(newValue);
      toast.success(newValue ? "Withdrawals frozen" : "Withdrawals unfrozen");
    } catch {
      toast.error("Failed to update withdrawal freeze");
    } finally {
      setTogglingFreeze(false);
    }
  };

  const cancelWithdrawal = async (withdrawal: any) => {
    if (!confirm(`Cancel withdrawal of ${formatNaira(withdrawal.amount)} for ${withdrawal.profile?.full_name}? This will refund the amount to their wallet.`)) return;

    try {
      await cancelAdminWithdrawal(withdrawal.id);
      toast.success("Withdrawal cancelled and funds refunded");
      void fetchAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel withdrawal");
    }
  };

  const totalBalance = wallets.reduce((s, w) => s + (w.balance || 0), 0);
  const totalEscrow = wallets.reduce((s, w) => s + (w.escrow_balance || 0), 0);
  const totalPending = wallets.reduce((s, w) => s + (w.pending_clearance || 0), 0);
  const totalRev = revenue.reduce((s, r) => s + (r.commission_amount || 0), 0);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Payments & Escrow</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="pt-6 flex items-center justify-between">
          <div><p className="text-sm text-muted-foreground">Total Wallet Balances</p><p className="text-xl font-bold text-primary">{formatNaira(totalBalance)}</p></div>
          <Wallet className="h-8 w-8 text-primary" />
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center justify-between">
          <div><p className="text-sm text-muted-foreground">Total Escrow Held</p><p className="text-xl font-bold text-amber-500">{formatNaira(totalEscrow)}</p></div>
          <ArrowDownLeft className="h-8 w-8 text-amber-500" />
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center justify-between">
          <div><p className="text-sm text-muted-foreground">Pending Clearance</p><p className="text-xl font-bold text-orange-500">{formatNaira(totalPending)}</p></div>
          <Timer className="h-8 w-8 text-orange-500" />
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center justify-between">
          <div><p className="text-sm text-muted-foreground">Platform Revenue</p><p className="text-xl font-bold text-emerald-500">{formatNaira(totalRev)}</p></div>
          <TrendingUp className="h-8 w-8 text-emerald-500" />
        </CardContent></Card>
      </div>

      {/* Withdrawal Freeze Toggle */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldAlert className={`h-5 w-5 ${withdrawalsFrozen ? "text-destructive" : "text-muted-foreground"}`} />
              <div>
                <p className="font-medium text-foreground">Freeze All Withdrawals</p>
                <p className="text-xs text-muted-foreground">
                  {withdrawalsFrozen ? "Withdrawals are currently FROZEN. No user can withdraw." : "Withdrawals are enabled for all users."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="freeze-toggle" className="text-sm">{withdrawalsFrozen ? "Frozen" : "Active"}</Label>
              <Switch id="freeze-toggle" checked={withdrawalsFrozen} onCheckedChange={toggleWithdrawalFreeze} disabled={togglingFreeze} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Withdrawal - Super Admin only */}
      <div className="mb-6">
        <RevenueWithdrawCard />
      </div>

      <Tabs defaultValue="wallets">
        <TabsList>
          <TabsTrigger value="wallets">Wallets</TabsTrigger>
          <TabsTrigger value="pending">Pending Clearance</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
        </TabsList>

        <TabsContent value="wallets">
          <div className="bg-card rounded-xl border border-border overflow-hidden mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>Pending</TableHead>
                  <TableHead>Escrow</TableHead>
                  <TableHead>Earned</TableHead>
                  <TableHead>Spent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wallets.map(w => (
                  <TableRow key={w.id}>
                    <TableCell>
                      <div><p className="font-medium text-sm">{w.profile?.full_name || "—"}</p><p className="text-xs text-muted-foreground">{w.profile?.email}</p></div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{w.profile?.role === "freelancer" ? "Expert" : w.profile?.role}</Badge></TableCell>
                    <TableCell className="font-medium text-primary">{formatNaira(w.balance)}</TableCell>
                    <TableCell className={`font-medium ${(w.pending_clearance || 0) > 0 ? "text-orange-500" : "text-muted-foreground"}`}>{formatNaira(w.pending_clearance || 0)}</TableCell>
                    <TableCell className="text-amber-500">{formatNaira(w.escrow_balance)}</TableCell>
                    <TableCell>{formatNaira(w.total_earned)}</TableCell>
                    <TableCell>{formatNaira(w.total_spent)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="pending">
          <div className="bg-card rounded-xl border border-border overflow-hidden mt-4">
            {pendingClearance.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <Timer className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No pending clearance payments</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Pending Amount</TableHead>
                    <TableHead>Available Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingClearance.map(w => (
                    <TableRow key={w.id}>
                      <TableCell>
                        <div><p className="font-medium text-sm">{w.profile?.full_name || "—"}</p><p className="text-xs text-muted-foreground">{w.profile?.email}</p></div>
                      </TableCell>
                      <TableCell className="font-medium text-orange-500">{formatNaira(w.pending_clearance)}</TableCell>
                      <TableCell className="font-medium text-primary">{formatNaira(w.balance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="transactions">
          <div className="bg-card rounded-xl border border-border overflow-hidden mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Balance After</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm">{t.profile?.full_name || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize text-xs">{t.type}</Badge></TableCell>
                    <TableCell className={`font-medium ${t.amount > 0 ? "text-emerald-500" : "text-destructive"}`}>{formatNaira(Math.abs(t.amount))}</TableCell>
                    <TableCell className="text-sm">{formatNaira(t.balance_after)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{t.description || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="withdrawals">
          <div className="bg-card rounded-xl border border-border overflow-hidden mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawals.map(w => (
                  <TableRow key={w.id}>
                    <TableCell className="text-sm font-medium">{w.profile?.full_name || "—"}</TableCell>
                    <TableCell className="font-medium">{formatNaira(w.amount)}</TableCell>
                    <TableCell className="text-sm">{w.bank?.bank_name} - {w.bank?.account_number}</TableCell>
                    <TableCell><Badge variant={w.status === "completed" ? "default" : w.status === "pending" || w.status === "processing" ? "secondary" : "destructive"} className="capitalize">{w.status}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDistanceToNow(new Date(w.created_at), { addSuffix: true })}</TableCell>
                    <TableCell>
                      {(w.status === "pending" || w.status === "processing") && (
                        <Button variant="destructive" size="sm" onClick={() => cancelWithdrawal(w)}>
                          <XCircle className="h-3 w-3 mr-1" /> Cancel
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="revenue">
          <div className="bg-card rounded-xl border border-border overflow-hidden mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gross</TableHead>
                  <TableHead>Commission Rate</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Net to Expert</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revenue.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{formatNaira(r.gross_amount)}</TableCell>
                    <TableCell>{(r.commission_rate * 100).toFixed(0)}%</TableCell>
                    <TableCell className="text-emerald-500 font-medium">{formatNaira(r.commission_amount)}</TableCell>
                    <TableCell>{formatNaira(r.net_to_freelancer)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
