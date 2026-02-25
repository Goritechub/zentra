import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/nigerian-data";
import { FundWalletModal } from "@/components/wallet/FundWalletModal";
import { WithdrawModal } from "@/components/wallet/WithdrawModal";
import {
  Wallet, ArrowUpRight, ArrowDownLeft, Clock, CreditCard, Loader2, Plus, ArrowLeft, Download, FileSpreadsheet, Image
} from "lucide-react";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";

export default function TransactionsPage() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFund, setShowFund] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

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
      link.download = `CADGigs_Transactions_${exportFrom || "all"}_to_${exportTo || "all"}.png`;
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
    // Add header row for watermark
    XLSX.utils.sheet_add_aoa(ws, [["CADGigs Transaction Report", "", "", "", ""], [`Generated: ${new Date().toLocaleDateString("en-NG")}`, "", "", "", ""]], { origin: -1 });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
    XLSX.writeFile(wb, `CADGigs_Transactions_${exportFrom || "all"}_to_${exportTo || "all"}.xlsx`);
    setExporting(false);
  };

  const creditTypes = ["credit", "escrow_release", "refund"];
  const filteredForExport = getFilteredTransactions();

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
                <Button size="sm" variant="secondary" onClick={() => setShowWithdraw(true)}>
                  <Download className="h-4 w-4 mr-1" /> Withdraw
                </Button>
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
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold">Transaction History</h2>
              <Button variant="outline" size="sm" onClick={() => setShowExport(true)}>
                <Download className="h-4 w-4 mr-1" /> Export
              </Button>
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

            {/* Hidden exportable div for PNG */}
            <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
              <div ref={exportRef} style={{ width: 800, padding: 32, background: "#fff", fontFamily: "sans-serif" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                  <div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a" }}>CADGigs Transaction Report</h2>
                    <p style={{ fontSize: 12, color: "#888" }}>
                      {exportFrom && exportTo ? `${exportFrom} — ${exportTo}` : "All Transactions"}
                    </p>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#2563eb" }}>CADGigs</div>
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
                  <span style={{ fontWeight: 700, color: "#2563eb" }}>© CADGigs</span>
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
    </div>
  );
}
