import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatNaira } from "@/lib/nigerian-data";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AuthCodeVerifyModal } from "@/components/AuthCodeVerifyModal";
import { Loader2, Banknote, AlertTriangle, Plus } from "lucide-react";

export function RevenueWithdrawCard() {
  const { user } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [availableRevenue, setAvailableRevenue] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalWithdrawn, setTotalWithdrawn] = useState(0);
  const [bankDetails, setBankDetails] = useState<any[]>([]);
  const [selectedBank, setSelectedBank] = useState("");
  const [amount, setAmount] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [needsBankSetup, setNeedsBankSetup] = useState(false);

  // Bank setup state
  const [banks, setBanks] = useState<any[]>([]);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [resolvedName, setResolvedName] = useState("");
  const [resolving, setResolving] = useState(false);
  const [savingBank, setSavingBank] = useState(false);

  useEffect(() => {
    if (user) checkAccess();
  }, [user]);

  const checkAccess = async () => {
    if (!user) return;
    const { data } = await supabase.rpc("is_super_admin", { _user_id: user.id });
    setIsSuperAdmin(!!data);
    if (data) {
      await fetchData();
    }
    setLoading(false);
  };

  const fetchData = async () => {
    if (!user) return;
    const [revRes, settingsRes, bankRes] = await Promise.all([
      supabase.from("platform_revenue").select("commission_amount"),
      supabase.from("platform_settings").select("value").eq("key", "total_revenue_withdrawn").maybeSingle(),
      supabase.from("bank_details").select("*").eq("user_id", user.id),
    ]);

    const totalRev = (revRes.data || []).reduce((s, r) => s + (r.commission_amount || 0), 0);
    const withdrawn = settingsRes.data?.value ? Number(settingsRes.data.value) : 0;
    setTotalRevenue(totalRev);
    setTotalWithdrawn(withdrawn);
    setAvailableRevenue(totalRev - withdrawn);
    setBankDetails(bankRes.data || []);
    if (bankRes.data?.length) {
      setSelectedBank(bankRes.data[0].id);
    }
  };

  const handleWithdrawClick = () => {
    const amt = parseInt(amount);
    if (!amt || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (amt > availableRevenue) {
      toast.error(`Amount exceeds available revenue (${formatNaira(availableRevenue)})`);
      return;
    }
    if (!selectedBank) {
      toast.error("Please select a bank account");
      return;
    }
    setShowAuthModal(true);
  };

  const handleVerified = async () => {
    const amt = parseInt(amount);
    setWithdrawing(true);
    const { data, error } = await supabase.functions.invoke("paystack-transfer", {
      body: { action: "admin_withdraw_revenue", amount: amt, bank_detail_id: selectedBank },
    });
    setWithdrawing(false);

    if (error || !data?.success) {
      toast.error(data?.error || "Withdrawal failed");
      return;
    }

    toast.success(`${formatNaira(amt)} withdrawal initiated!`);
    setAmount("");
    await fetchData();
  };

  const loadBanks = async () => {
    const { data } = await supabase.functions.invoke("paystack-transfer", {
      body: { action: "list_banks" },
    });
    if (data?.banks) setBanks(data.banks);
  };

  const resolveAccount = async () => {
    if (accountNumber.length !== 10 || !bankCode) return;
    setResolving(true);
    const { data } = await supabase.functions.invoke("paystack-transfer", {
      body: { action: "resolve_account", account_number: accountNumber, bank_code: bankCode },
    });
    setResolving(false);
    if (data?.success && data?.data?.account_name) {
      setResolvedName(data.data.account_name);
    } else {
      toast.error("Could not resolve account");
      setResolvedName("");
    }
  };

  const saveBank = async () => {
    if (!resolvedName || !bankCode || accountNumber.length !== 10) return;
    const selectedBankObj = banks.find((b) => b.code === bankCode);
    setSavingBank(true);
    const { data, error } = await supabase.functions.invoke("paystack-transfer", {
      body: {
        action: "save_bank",
        account_number: accountNumber,
        bank_code: bankCode,
        bank_name: selectedBankObj?.name || "",
        account_name: resolvedName,
      },
    });
    setSavingBank(false);
    if (error || !data?.success) {
      toast.error("Failed to save bank");
      return;
    }
    toast.success("Bank account saved!");
    setNeedsBankSetup(false);
    setBankCode("");
    setAccountNumber("");
    setResolvedName("");
    await fetchData();
  };

  if (loading) return null;
  if (!isSuperAdmin) return null;

  return (
    <>
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-emerald-500" /> Revenue Withdrawal
          </CardTitle>
          <CardDescription>Withdraw platform commission revenue (Super Admin only)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="bg-card rounded-lg p-3 border border-border">
              <p className="text-muted-foreground">Total Revenue</p>
              <p className="text-lg font-bold text-emerald-500">{formatNaira(totalRevenue)}</p>
            </div>
            <div className="bg-card rounded-lg p-3 border border-border">
              <p className="text-muted-foreground">Withdrawn</p>
              <p className="text-lg font-bold text-amber-500">{formatNaira(totalWithdrawn)}</p>
            </div>
            <div className="bg-card rounded-lg p-3 border border-border">
              <p className="text-muted-foreground">Available</p>
              <p className="text-lg font-bold text-primary">{formatNaira(availableRevenue)}</p>
            </div>
          </div>

          {bankDetails.length === 0 && !needsBankSetup && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-amber-700 dark:text-amber-300">No bank account linked.</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setNeedsBankSetup(true);
                  loadBanks();
                }}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Bank
              </Button>
            </div>
          )}

          {needsBankSetup && (
            <div className="space-y-3 p-4 rounded-lg border border-border bg-card">
              <p className="font-medium text-sm">Add Bank Account</p>
              <Select value={bankCode} onValueChange={setBankCode}>
                <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                <SelectContent>
                  {banks.map((b) => (
                    <SelectItem key={b.code} value={b.code}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Account number (10 digits)"
                value={accountNumber}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setAccountNumber(val);
                  setResolvedName("");
                }}
                maxLength={10}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={resolveAccount}
                  disabled={accountNumber.length !== 10 || !bankCode || resolving}
                >
                  {resolving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  Verify Account
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setNeedsBankSetup(false)}
                >
                  Cancel
                </Button>
              </div>
              {resolvedName && (
                <div className="flex items-center justify-between p-2 rounded bg-emerald-500/10 border border-emerald-500/30">
                  <span className="text-sm font-medium">{resolvedName}</span>
                  <Button size="sm" onClick={saveBank} disabled={savingBank}>
                    {savingBank ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                    Save
                  </Button>
                </div>
              )}
            </div>
          )}

          {bankDetails.length > 0 && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Bank Account</label>
                <Select value={selectedBank} onValueChange={setSelectedBank}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select bank account" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankDetails.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.bank_name} - {b.account_number} ({b.account_name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Amount (₦)</label>
                <Input
                  type="number"
                  placeholder="Enter amount in Naira"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min={1}
                  max={availableRevenue}
                />
              </div>

              <Button
                className="w-full"
                onClick={handleWithdrawClick}
                disabled={withdrawing || !amount || !selectedBank || availableRevenue <= 0}
              >
                {withdrawing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Banknote className="h-4 w-4 mr-2" />}
                Withdraw Revenue
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <AuthCodeVerifyModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        onVerified={handleVerified}
        title="Confirm Revenue Withdrawal"
        description={`Enter your authentication code to withdraw ${formatNaira(parseInt(amount) || 0)}.`}
      />
    </>
  );
}
