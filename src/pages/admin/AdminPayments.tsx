import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/nigerian-data";
import { formatDistanceToNow } from "date-fns";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Search, Wallet, ArrowDownLeft, ArrowUpRight, TrendingUp } from "lucide-react";

export default function AdminPayments() {
  const [wallets, setWallets] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [revenue, setRevenue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const [walletsRes, txRes, wdRes, revRes] = await Promise.all([
      supabase.from("wallets").select("*, profile:profiles!wallets_user_id_fkey(full_name, email, role)").order("balance", { ascending: false }).limit(200),
      supabase.from("wallet_transactions").select("*, profile:profiles!wallet_transactions_user_id_fkey(full_name)").order("created_at", { ascending: false }).limit(200),
      supabase.from("withdrawal_requests").select("*, profile:profiles!withdrawal_requests_user_id_fkey(full_name), bank:bank_details!withdrawal_requests_bank_detail_id_fkey(bank_name, account_number)").order("created_at", { ascending: false }).limit(100),
      supabase.from("platform_revenue").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setWallets(walletsRes.data || []);
    setTransactions(txRes.data || []);
    setWithdrawals(wdRes.data || []);
    setRevenue(revRes.data || []);
    setLoading(false);
  };

  const totalBalance = wallets.reduce((s, w) => s + (w.balance || 0), 0);
  const totalEscrow = wallets.reduce((s, w) => s + (w.escrow_balance || 0), 0);
  const totalRev = revenue.reduce((s, r) => s + (r.commission_amount || 0), 0);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Payments & Escrow</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card><CardContent className="pt-6 flex items-center justify-between">
          <div><p className="text-sm text-muted-foreground">Total Wallet Balances</p><p className="text-xl font-bold text-primary">{formatNaira(totalBalance)}</p></div>
          <Wallet className="h-8 w-8 text-primary" />
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center justify-between">
          <div><p className="text-sm text-muted-foreground">Total Escrow Held</p><p className="text-xl font-bold text-amber-500">{formatNaira(totalEscrow)}</p></div>
          <ArrowDownLeft className="h-8 w-8 text-amber-500" />
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center justify-between">
          <div><p className="text-sm text-muted-foreground">Platform Revenue</p><p className="text-xl font-bold text-emerald-500">{formatNaira(totalRev)}</p></div>
          <TrendingUp className="h-8 w-8 text-emerald-500" />
        </CardContent></Card>
      </div>

      <Tabs defaultValue="wallets">
        <TabsList>
          <TabsTrigger value="wallets">Wallets</TabsTrigger>
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
                  <TableHead>Balance</TableHead>
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
                    <TableCell className="text-amber-500">{formatNaira(w.escrow_balance)}</TableCell>
                    <TableCell>{formatNaira(w.total_earned)}</TableCell>
                    <TableCell>{formatNaira(w.total_spent)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawals.map(w => (
                  <TableRow key={w.id}>
                    <TableCell className="text-sm font-medium">{w.profile?.full_name || "—"}</TableCell>
                    <TableCell className="font-medium">{formatNaira(w.amount)}</TableCell>
                    <TableCell className="text-sm">{w.bank?.bank_name} - {w.bank?.account_number}</TableCell>
                    <TableCell><Badge variant={w.status === "completed" ? "default" : w.status === "pending" ? "secondary" : "destructive"} className="capitalize">{w.status}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDistanceToNow(new Date(w.created_at), { addSuffix: true })}</TableCell>
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
