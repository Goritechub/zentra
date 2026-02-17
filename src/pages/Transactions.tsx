import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/nigerian-data";
import { FundWalletModal } from "@/components/wallet/FundWalletModal";
import { WithdrawModal } from "@/components/wallet/WithdrawModal";
import {
  Wallet, ArrowUpRight, ArrowDownLeft, Clock, CreditCard, Loader2, Plus, ArrowLeft, Download
} from "lucide-react";

export default function TransactionsPage() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFund, setShowFund] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
    if (user) fetchData();
  }, [user, authLoading]);

  const fetchData = async () => {
    const [walletRes, txRes] = await Promise.all([
      supabase.from("wallets").select("*").eq("user_id", user!.id).maybeSingle(),
      supabase.from("wallet_transactions" as any).select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(50),
    ]);
    setWallet(walletRes.data);
    setTransactions((txRes.data as any[]) || []);
    setLoading(false);
  };

  const isFreelancer = profile?.role === "freelancer";

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        <Footer />
      </div>
    );
  }

  const creditTypes = ["credit", "escrow_release", "refund"];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-wide">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-foreground mb-8">
            {isFreelancer ? "Wallet & Earnings" : "Wallet & Transactions"}
          </h1>

          {/* Wallet Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-hero-gradient text-white rounded-xl p-6">
              <div className="flex items-center gap-2 mb-2"><Wallet className="h-5 w-5" /><span className="text-sm text-white/70">Available Balance</span></div>
              <p className="text-3xl font-bold">{formatNaira(wallet?.balance || 0)}</p>
              <div className="flex gap-2 mt-4">
                <Button size="sm" variant="secondary" onClick={() => setShowFund(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Fund Wallet
                </Button>
                {isFreelancer && (
                  <Button size="sm" variant="secondary" onClick={() => setShowWithdraw(true)}>
                    <Download className="h-4 w-4 mr-1" /> Withdraw
                  </Button>
                )}
              </div>
            </div>
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center gap-2 mb-2"><Clock className="h-5 w-5 text-accent" /><span className="text-sm text-muted-foreground">In Escrow</span></div>
              <p className="text-3xl font-bold text-foreground">{formatNaira(wallet?.escrow_balance || 0)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <span className="text-sm text-muted-foreground">{isFreelancer ? "Total Earned" : "Total Spent"}</span>
              </div>
              <p className="text-3xl font-bold text-foreground">
                {formatNaira(isFreelancer ? (wallet?.total_earned || 0) : (wallet?.total_spent || 0))}
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
                {transactions.map((tx: any) => {
                  const isCredit = creditTypes.includes(tx.type);
                  return (
                    <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-muted/30">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isCredit ? "bg-primary/10" : "bg-destructive/10"}`}>
                          {isCredit
                            ? <ArrowDownLeft className="h-5 w-5 text-primary" />
                            : <ArrowUpRight className="h-5 w-5 text-destructive" />}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{tx.description || tx.type}</p>
                          <p className="text-sm text-muted-foreground">{new Date(tx.created_at).toLocaleDateString("en-NG")}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${isCredit ? "text-primary" : "text-destructive"}`}>
                          {isCredit ? "+" : "-"}{formatNaira(tx.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">Bal: {formatNaira(tx.balance_after)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />

      <FundWalletModal
        open={showFund}
        onOpenChange={setShowFund}
        onSuccess={fetchData}
        userEmail={profile?.email}
      />

      {user && (
        <WithdrawModal
          open={showWithdraw}
          onOpenChange={setShowWithdraw}
          onSuccess={fetchData}
          walletBalance={wallet?.balance || 0}
          userId={user.id}
        />
      )}
    </div>
  );
}
