import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/nigerian-data";
import {
  Wallet, ArrowUpRight, ArrowDownLeft, Clock, CreditCard, Loader2, Plus, ArrowLeft
} from "lucide-react";

export default function TransactionsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
    if (user) fetchData();
  }, [user, authLoading]);

  const fetchData = async () => {
    const [walletRes, txRes] = await Promise.all([
      supabase.from("wallets" as any).select("*").eq("user_id", user!.id).maybeSingle(),
      supabase.from("transactions" as any).select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(50),
    ]);
    setWallet(walletRes.data);
    setTransactions((txRes.data as any[]) || []);
    setLoading(false);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-wide">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-foreground mb-8">Wallet & Transactions</h1>

          {/* Wallet Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-hero-gradient text-white rounded-xl p-6">
              <div className="flex items-center gap-2 mb-2"><Wallet className="h-5 w-5" /><span className="text-sm text-white/70">Available Balance</span></div>
              <p className="text-3xl font-bold">{formatNaira(wallet?.balance || 0)}</p>
              <Button size="sm" variant="secondary" className="mt-4"><Plus className="h-4 w-4 mr-1" />Fund Wallet</Button>
            </div>
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center gap-2 mb-2"><Clock className="h-5 w-5 text-accent" /><span className="text-sm text-muted-foreground">In Escrow</span></div>
              <p className="text-3xl font-bold text-foreground">{formatNaira(wallet?.escrow_balance || 0)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center gap-2 mb-2"><CreditCard className="h-5 w-5 text-primary" /><span className="text-sm text-muted-foreground">Total Spent</span></div>
              <p className="text-3xl font-bold text-foreground">
                {formatNaira(transactions.filter((t: any) => t.type === "debit").reduce((sum: number, t: any) => sum + t.amount, 0))}
              </p>
            </div>
          </div>

          {/* Transaction History */}
          <div className="bg-card rounded-xl border border-border">
            <div className="p-6 border-b border-border">
              <h2 className="text-lg font-semibold">Transaction History</h2>
            </div>
            {transactions.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No transactions yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {transactions.map((tx: any) => (
                  <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        tx.type === "credit" || tx.type === "escrow_release" || tx.type === "refund"
                          ? "bg-primary/10" : "bg-destructive/10"
                      }`}>
                        {tx.type === "credit" || tx.type === "escrow_release" || tx.type === "refund"
                          ? <ArrowDownLeft className="h-5 w-5 text-primary" />
                          : <ArrowUpRight className="h-5 w-5 text-destructive" />}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{tx.description || tx.type}</p>
                        <p className="text-sm text-muted-foreground">{new Date(tx.created_at).toLocaleDateString("en-NG")}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${
                        tx.type === "credit" || tx.type === "escrow_release" || tx.type === "refund"
                          ? "text-primary" : "text-destructive"
                      }`}>
                        {tx.type === "credit" || tx.type === "escrow_release" || tx.type === "refund" ? "+" : "-"}{formatNaira(tx.amount)}
                      </p>
                      <Badge variant={tx.status === "completed" ? "default" : "secondary"} className="text-xs">{tx.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
