import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getWalletOverview } from "@/api/wallet.api";
import { formatNaira } from "@/lib/nigerian-data";
import { FundWalletModal } from "@/components/wallet/FundWalletModal";
import { WithdrawModal } from "@/components/wallet/WithdrawModal";
import { useRequireAuthCode } from "@/hooks/useRequireAuthCode";
import { useKycVerification } from "@/hooks/useKycVerification";
import { KycRequiredModal } from "@/components/KycRequiredModal";
import {
  Wallet, ArrowUpRight, ArrowDownLeft, Clock, CreditCard, Loader2, Plus, ArrowLeft, Download, FileSpreadsheet, Image, Timer
} from "lucide-react";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";

const creditTypes = ["credit", "escrow_release", "refund", "deposit"];
const hiddenTypes = ["escrow_credit", "escrow_hold"];
type TxFilter = "all" | "credits" | "debits";

function ClearanceCountdown({ clearanceAt }: { clearanceAt: string }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const update = () => {
      const diff = new Date(clearanceAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Cleared");
        return;
      }
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(`${hours}h ${mins}m`);
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [clearanceAt]);

  return (
    <span className={`text-xs font-medium ${timeLeft === "Cleared" ? "text-primary" : "text-amber-500"}`}>
      <Timer className="h-3 w-3 inline mr-0.5" />
      {timeLeft}
    </span>
  );
}

export default function TransactionsPage() {
  const navigate = useNavigate();
  const { user, profile, role, bootstrapStatus, authError } = useAuth();
  const queryClient = useQueryClient();
  const [showFund, setShowFund] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [exporting, setExporting] = useState(false);
  const [txFilter, setTxFilter] = useState<TxFilter>("all");
  const exportRef = useRef<HTMLDivElement>(null);
  const { requireAuthCode, SetupModal: AuthSetupModal, VerifyModal: AuthVerifyModal } = useRequireAuthCode();
  const { isVerified: kycVerified } = useKycVerification();
  const [showKycModal, setShowKycModal] = useState(false);

  const transactionsQuery = useQuery({
    queryKey: ["transactions-page", user?.id],
    enabled: bootstrapStatus === "ready" && !!user,
    staleTime: 60 * 1000,
    placeholderData: (previousData) => previousData,
    queryFn: getWalletOverview,
  });

  const isFreelancer = role === "freelancer";
  const wallet = transactionsQuery.data?.wallet ?? null;
  const transactions = transactionsQuery.data?.transactions ?? [];
  const pendingClearanceTxs = transactionsQuery.data?.pendingClearanceTxs ?? [];
  const isCredit = (tx: any) => creditTypes.includes(tx.type);

  const filteredTransactions = transactions.filter(tx => {
    if (txFilter === "credits") return isCredit(tx);
    if (txFilter === "debits") return !isCredit(tx);
    return true;
  });

  const getFilteredTransactions = () => {
    let filtered = transactions;
    if (exportFrom) filtered = filtered.filter(tx => new Date(tx.created_at) >= new Date(exportFrom));
    if (exportTo) filtered = filtered.filter(tx => new Date(tx.created_at) <= new Date(exportTo + "T23:59:59"));
    return filtered;
  };

  const handleExportPNG = async () => {
    if (!exportRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(exportRef.current, { scale: 2, backgroundColor: "#ffffff" });
      const link = document.createElement("a");
      link.download = `ZentraGig_Transactions_${exportFrom || "all"}_to_${exportTo || "all"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      console.error(e);
    }
    setExporting(false);
  };

  const handleExportExcel = () => {
    setExporting(true);
    const filtered = getFilteredTransactions();
    const data = filtered.map(tx => ({
      Date: new Date(tx.created_at).toLocaleDateString("en-NG"),
      Type: tx.type,
      Description: tx.description || tx.type,
      Amount: tx.amount,
      "Balance After": tx.balance_after,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.sheet_add_aoa(ws, [["ZentraGig Transaction Report", "", "", "", ""], [`Generated: ${new Date().toLocaleDateString("en-NG")}`, "", "", "", ""]], { origin: -1 });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
    XLSX.writeFile(wb, `ZentraGig_Transactions_${exportFrom || "all"}_to_${exportTo || "all"}.xlsx`);
    setExporting(false);
  };

  const filteredForExport = getFilteredTransactions();

  const getEmptyMessage = () => {
    if (txFilter === "credits") return "No money in yet";
    if (txFilter === "debits") return "No money out yet";
    return "No transactions yet";
  };

  const pendingClearance = wallet?.pending_clearance || 0;
  const availableBalance = wallet?.balance || 0;
  const walletBalance = availableBalance + pendingClearance;

  // Find the next clearance time
  const nextClearance = pendingClearanceTxs.length > 0
    ? pendingClearanceTxs.reduce((earliest, tx) =>
        !earliest || new Date(tx.clearance_at) < new Date(earliest) ? tx.clearance_at : earliest, null as string | null)
    : null;

  if (!user || bootstrapStatus !== "ready") {
    return null;
  }

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
          {authError && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              {authError}
            </div>
          )}
          {transactionsQuery.isFetching && (
            <p className="text-sm text-muted-foreground mb-4">Refreshing wallet activity...</p>
          )}

          {/* Wallet Cards */}
          <div className={`grid grid-cols-1 ${isFreelancer ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3"} gap-6 mb-8`}>
            {/* Wallet Balance (total) */}
            <div className="bg-hero-gradient text-white rounded-xl p-6">
              <div className="flex items-center gap-2 mb-2"><Wallet className="h-5 w-5" /><span className="text-sm text-white/70">Wallet Balance</span></div>
              <p className="text-3xl font-bold">{formatNaira(walletBalance)}</p>
              <div className="flex gap-2 mt-4">
                <Button size="sm" variant="secondary" onClick={() => setShowFund(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Fund
                </Button>
                <Button size="sm" variant="secondary" onClick={() => {
                  if (isFreelancer && !kycVerified) {
                    setShowKycModal(true);
                    return;
                  }
                  requireAuthCode(() => setShowWithdraw(true));
                }} disabled={availableBalance < 5000}>
                  <Download className="h-4 w-4 mr-1" /> Withdraw
                </Button>
              </div>
              {isFreelancer && availableBalance < 5000 && availableBalance > 0 && (
                <p className="text-xs text-white/60 mt-2">Min. withdrawal: ₦5,000</p>
              )}
            </div>

            {/* Pending Clearance (freelancer only) */}
            {isFreelancer && (
              <div className="bg-card rounded-xl border border-amber-500/30 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Timer className="h-5 w-5 text-amber-500" />
                  <span className="text-sm text-muted-foreground">Pending Clearance</span>
                </div>
                <p className="text-3xl font-bold text-foreground">{formatNaira(pendingClearance)}</p>
                {nextClearance && (
                  <div className="mt-2">
                    <p className="text-xs text-muted-foreground">Next release:</p>
                    <ClearanceCountdown clearanceAt={nextClearance} />
                  </div>
                )}
                {pendingClearance === 0 && (
                  <p className="text-xs text-muted-foreground mt-2">No pending funds</p>
                )}
              </div>
            )}

            {/* Available for Withdrawal (freelancer) / In Escrow */}
            {isFreelancer ? (
              <div className="bg-card rounded-xl border border-primary/30 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Download className="h-5 w-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Available for Withdrawal</span>
                </div>
                <p className="text-3xl font-bold text-foreground">{formatNaira(availableBalance)}</p>
                {availableBalance < 5000 && (
                  <p className="text-xs text-muted-foreground mt-2">Min. ₦5,000 to withdraw</p>
                )}
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center gap-2 mb-2"><Clock className="h-5 w-5 text-accent" /><span className="text-sm text-muted-foreground">In Escrow</span></div>
                <p className="text-3xl font-bold text-foreground">{formatNaira(wallet?.escrow_balance || 0)}</p>
              </div>
            )}

            {/* Total Earned / Spent */}
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

          {/* Pending Clearance Details (freelancer) */}
          {isFreelancer && pendingClearanceTxs.length > 0 && (
            <div className="bg-card rounded-xl border border-amber-500/20 mb-8">
              <div className="p-4 border-b border-border">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Timer className="h-4 w-4 text-amber-500" />
                  Pending Clearance ({pendingClearanceTxs.length})
                </h3>
              </div>
              <div className="divide-y divide-border">
                {pendingClearanceTxs.map((tx: any) => (
                  <div key={tx.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString("en-NG")}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-amber-500">{formatNaira(tx.amount)}</p>
                      <ClearanceCountdown clearanceAt={tx.clearance_at} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transaction History */}
          <div className="bg-card rounded-xl border border-border">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold">Transaction History</h2>
              <Button variant="outline" size="sm" onClick={() => setShowExport(true)}>
                <Download className="h-4 w-4 mr-1" /> Export
              </Button>
            </div>

            <div className="px-6 pt-4">
              <Tabs value={txFilter} onValueChange={(v) => setTxFilter(v as TxFilter)}>
                <TabsList>
                  <TabsTrigger value="all">All Activity</TabsTrigger>
                  <TabsTrigger value="credits">
                    <ArrowDownLeft className="h-3.5 w-3.5 mr-1" /> Money In
                  </TabsTrigger>
                  <TabsTrigger value="debits">
                    <ArrowUpRight className="h-3.5 w-3.5 mr-1" /> Money Out
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {transactionsQuery.isPending && !transactionsQuery.data ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                      <div className="space-y-2">
                        <div className="h-4 w-40 rounded bg-muted animate-pulse" />
                        <div className="h-3 w-24 rounded bg-muted/70 animate-pulse" />
                      </div>
                    </div>
                    <div className="space-y-2 text-right">
                      <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                      <div className="h-3 w-16 rounded bg-muted/70 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{getEmptyMessage()}</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredTransactions.map((tx: any) => {
                  const credit = isCredit(tx);
                  const isPendingClearance = tx.clearance_at && new Date(tx.clearance_at) > new Date();
                  return (
                    <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-muted/30">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${credit ? "bg-primary/10" : "bg-destructive/10"}`}>
                          {credit
                            ? <ArrowDownLeft className="h-5 w-5 text-primary" />
                            : <ArrowUpRight className="h-5 w-5 text-destructive" />}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {tx.description || tx.type}
                            {isPendingClearance && (
                              <Badge variant="outline" className="ml-2 text-amber-500 border-amber-500/30 text-[10px] px-1.5 py-0">
                                Pending
                              </Badge>
                            )}
                          </p>
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-muted-foreground">{new Date(tx.created_at).toLocaleDateString("en-NG")}</p>
                            {isPendingClearance && <ClearanceCountdown clearanceAt={tx.clearance_at} />}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${isPendingClearance ? "text-amber-500" : credit ? "text-primary" : "text-destructive"}`}>
                          {credit ? "+" : "-"}{formatNaira(tx.amount)}
                        </p>
                        {tx.balance_after != null && <p className="text-xs text-muted-foreground">Bal: {formatNaira(tx.balance_after)}</p>}
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
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["transactions-page", user?.id] })}
        userEmail={profile?.email}
      />

      {user && (
        <WithdrawModal
          open={showWithdraw}
          onOpenChange={setShowWithdraw}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["transactions-page", user?.id] })}
          walletBalance={wallet?.balance || 0}
          userId={user.id}
        />
      )}

      {/* Export Dialog */}
      <Dialog open={showExport} onOpenChange={setShowExport}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Export Transactions</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From Date</Label>
                <Input type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>To Date</Label>
                <Input type="date" value={exportTo} onChange={e => setExportTo(e.target.value)} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{filteredForExport.length} transaction(s) in range</p>

            <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
              <div ref={exportRef} style={{ width: 800, padding: 32, background: "#fff", fontFamily: "sans-serif" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                  <div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a" }}>ZentraGig Transaction Report</h2>
                    <p style={{ fontSize: 12, color: "#888" }}>
                      {exportFrom && exportTo ? `${exportFrom} — ${exportTo}` : "All Transactions"}
                    </p>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#2563eb" }}>ZentraGig</div>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                      <th style={{ textAlign: "left", padding: "8px 4px", color: "#666" }}>Date</th>
                      <th style={{ textAlign: "left", padding: "8px 4px", color: "#666" }}>Description</th>
                      <th style={{ textAlign: "right", padding: "8px 4px", color: "#666" }}>Amount</th>
                      <th style={{ textAlign: "right", padding: "8px 4px", color: "#666" }}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredForExport.map((tx: any) => (
                      <tr key={tx.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "8px 4px" }}>{new Date(tx.created_at).toLocaleDateString("en-NG")}</td>
                        <td style={{ padding: "8px 4px" }}>{tx.description || tx.type}</td>
                        <td style={{ padding: "8px 4px", textAlign: "right", color: creditTypes.includes(tx.type) ? "#16a34a" : "#dc2626" }}>
                          {creditTypes.includes(tx.type) ? "+" : "-"}₦{tx.amount?.toLocaleString()}
                        </td>
                        <td style={{ padding: "8px 4px", textAlign: "right" }}>₦{tx.balance_after?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ marginTop: 24, borderTop: "1px solid #e5e7eb", paddingTop: 12, display: "flex", justifyContent: "space-between", fontSize: 11, color: "#aaa" }}>
                  <span>Generated on {new Date().toLocaleDateString("en-NG")}</span>
                  <span style={{ fontWeight: 700, color: "#2563eb" }}>© ZentraGig</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button className="flex-1" variant="outline" onClick={handleExportPNG} disabled={exporting || filteredForExport.length === 0}>
                <Image className="h-4 w-4 mr-1" /> Export as PNG
              </Button>
              <Button className="flex-1" onClick={handleExportExcel} disabled={exporting || filteredForExport.length === 0}>
                <FileSpreadsheet className="h-4 w-4 mr-1" /> Export as Excel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {AuthSetupModal}
      {AuthVerifyModal}
      <KycRequiredModal
        open={showKycModal}
        onClose={() => setShowKycModal(false)}
        action="withdraw funds"
      />
    </div>
  );
}
