import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cadSkills } from "@/lib/nigerian-data";
import { categoryNames } from "@/lib/categories";
import { formatNaira } from "@/lib/nigerian-data";
import { Loader2, X, Trophy, Upload, Wallet, AlertTriangle } from "lucide-react";
import { FundWalletModal } from "@/components/wallet/FundWalletModal";

export default function LaunchContestPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const bannerRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [prizeFirst, setPrizeFirst] = useState("");
  const [prizeSecond, setPrizeSecond] = useState("");
  const [prizeThird, setPrizeThird] = useState("");
  const [prizeFourth, setPrizeFourth] = useState("");
  const [prizeFifth, setPrizeFifth] = useState("");
  const [deadline, setDeadline] = useState("");
  const [visibility, setVisibility] = useState("open");
  const [rules, setRules] = useState("");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  // Wallet / insufficient funds state
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [showInsufficientModal, setShowInsufficientModal] = useState(false);
  const [insufficientData, setInsufficientData] = useState({ total: 0, balance: 0, shortfall: 0 });
  const [showFundWallet, setShowFundWallet] = useState(false);

  const categories = [
    "Architectural Drafting", "Mechanical CAD", "Electrical CAD", "3D Modeling",
    "BIM/Revit", "AutoCAD 2D Plans", "SolidWorks", "Fusion 360", "Civil/Structural Drawings"
  ];

  // Fetch wallet balance
  useEffect(() => {
    if (!user) return;
    const fetchWallet = async () => {
      const { data } = await supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle();
      setWalletBalance(data?.balance || 0);
    };
    fetchWallet();
  }, [user]);

  const calcTotalPrize = () => {
    return (parseInt(prizeFirst) || 0) + (parseInt(prizeSecond) || 0) + (parseInt(prizeThird) || 0) +
      (parseInt(prizeFourth) || 0) + (parseInt(prizeFifth) || 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { navigate("/auth"); return; }
    if (!title.trim() || !description.trim() || !prizeFirst || !deadline) {
      toast.error("Please fill in all required fields");
      return;
    }

    const totalPrize = calcTotalPrize();
    if (totalPrize <= 0) {
      toast.error("Prize pool must be greater than zero");
      return;
    }

    setLoading(true);

    // Upload banner first if present
    let bannerUrl: string | null = null;
    if (bannerFile) {
      const path = `banners/${user.id}/${Date.now()}_${bannerFile.name}`;
      const { error } = await supabase.storage.from("contest-banners").upload(path, bannerFile);
      if (!error) {
        const { data } = supabase.storage.from("contest-banners").getPublicUrl(path);
        bannerUrl = data.publicUrl;
      }
    }

    // Call the secure backend function
    const { data, error } = await supabase.functions.invoke("launch-contest", {
      body: {
        title: title.trim(),
        description: description.trim(),
        category: category || null,
        prize_first: parseInt(prizeFirst),
        prize_second: prizeSecond ? parseInt(prizeSecond) : 0,
        prize_third: prizeThird ? parseInt(prizeThird) : 0,
        prize_fourth: prizeFourth ? parseInt(prizeFourth) : 0,
        prize_fifth: prizeFifth ? parseInt(prizeFifth) : 0,
        deadline,
        required_skills: selectedSkills,
        visibility,
        rules: rules.trim() || null,
        banner_image: bannerUrl,
        winner_selection_method: "client_selects",
      },
    });

    setLoading(false);

    if (error) {
      toast.error("Failed to launch contest");
      return;
    }

    if (data?.error === "insufficient_funds") {
      setInsufficientData({
        total: data.total_prize_pool,
        balance: data.wallet_balance,
        shortfall: data.shortfall,
      });
      setWalletBalance(data.wallet_balance);
      setShowInsufficientModal(true);
      return;
    }

    if (data?.error) {
      toast.error(data.error);
      return;
    }

    if (data?.success) {
      toast.success("Contest launched! Prize pool moved to escrow.");
      navigate("/dashboard/my-contests");
    }
  };

  const handleFundSuccess = async () => {
    // Refresh wallet balance
    if (!user) return;
    const { data } = await supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle();
    const newBal = data?.balance || 0;
    setWalletBalance(newBal);
    setShowFundWallet(false);
    // Update insufficient modal data
    const total = calcTotalPrize();
    if (newBal >= total) {
      setShowInsufficientModal(false);
      toast.success("Wallet funded! You can now launch the contest.");
    } else {
      setInsufficientData({ total, balance: newBal, shortfall: total - newBal });
    }
  };

  if (!user || profile?.role !== "client") {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Client Access Only</h2>
            <Button onClick={() => navigate("/auth")}>Sign In</Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const totalPrizePreview = calcTotalPrize();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-tight">
          <h1 className="text-3xl font-bold text-foreground mb-2">Launch a Contest</h1>
          <p className="text-muted-foreground mb-8">Get multiple design submissions and pick the best one.</p>

          {/* Wallet balance indicator */}
          <div className="bg-card rounded-xl border border-border p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wallet className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Wallet Balance</p>
                <p className="font-semibold text-foreground">{formatNaira(walletBalance)}</p>
              </div>
            </div>
            {totalPrizePreview > 0 && (
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Prize Pool Required</p>
                <p className={`font-semibold ${walletBalance >= totalPrizePreview ? "text-primary" : "text-destructive"}`}>
                  {formatNaira(totalPrizePreview)}
                </p>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="bg-card rounded-xl border border-border p-6 space-y-6">
              <h2 className="text-lg font-semibold">Contest Details</h2>
              <div className="space-y-2">
                <Label>Contest Title *</Label>
                <Input placeholder="e.g. Office Building Floor Plan Design" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description *</Label>
                <Textarea placeholder="Describe what you want contestants to design..." rows={6} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Rules / How to Enter</Label>
                <Textarea placeholder="Explain the rules and submission guidelines..." rows={4} value={rules} onChange={(e) => setRules(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Submission Deadline *</Label>
                  <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Contest Visibility</Label>
                  <Select value={visibility} onValueChange={setVisibility}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open (entries visible to all)</SelectItem>
                      <SelectItem value="closed">Closed (only entry count shown)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Banner Image (optional)</Label>
                <div className="flex items-center gap-3">
                  <Button type="button" variant="outline" size="sm" onClick={() => bannerRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-1" /> {bannerFile ? bannerFile.name : "Upload Banner"}
                  </Button>
                  {bannerFile && <button type="button" onClick={() => setBannerFile(null)} className="text-muted-foreground"><X className="h-4 w-4" /></button>}
                </div>
                <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={e => setBannerFile(e.target.files?.[0] || null)} />
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 space-y-6">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Trophy className="h-5 w-5 text-accent" />Prize Structure</h2>
              <p className="text-sm text-muted-foreground">Set up to 5 prize positions. Only 1st prize is required. Prize amounts are in Naira (₦).</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>🥇 1st Prize (₦) *</Label>
                  <Input type="number" placeholder="e.g. 50000" value={prizeFirst} onChange={(e) => setPrizeFirst(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>🥈 2nd Prize (₦)</Label>
                  <Input type="number" placeholder="Optional" value={prizeSecond} onChange={(e) => setPrizeSecond(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>🥉 3rd Prize (₦)</Label>
                  <Input type="number" placeholder="Optional" value={prizeThird} onChange={(e) => setPrizeThird(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>🏅 4th Prize (₦)</Label>
                  <Input type="number" placeholder="Optional" value={prizeFourth} onChange={(e) => setPrizeFourth(e.target.value)} disabled={!prizeThird} />
                  {!prizeThird && <p className="text-xs text-muted-foreground">Set 3rd prize first</p>}
                </div>
                <div className="space-y-2">
                  <Label>🏅 5th Prize (₦)</Label>
                  <Input type="number" placeholder="Optional" value={prizeFifth} onChange={(e) => setPrizeFifth(e.target.value)} disabled={!prizeFourth} />
                  {!prizeFourth && <p className="text-xs text-muted-foreground">Set 4th prize first</p>}
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 space-y-6">
              <h2 className="text-lg font-semibold">Requirements</h2>
              <div className="space-y-2">
                <Label>Required Skills</Label>
                <Select onValueChange={(s) => { if (!selectedSkills.includes(s)) setSelectedSkills([...selectedSkills, s]); }}>
                  <SelectTrigger><SelectValue placeholder="Add skill" /></SelectTrigger>
                  <SelectContent>
                    {cadSkills.filter(s => !selectedSkills.includes(s)).map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedSkills.map(s => (
                    <Badge key={s} variant="secondary" className="gap-1">
                      {s} <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedSkills(selectedSkills.filter(x => x !== s))} />
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Launching...</> : <><Trophy className="h-4 w-4 mr-2" />Launch Contest</>}
            </Button>
          </form>
        </div>
      </main>
      <Footer />

      {/* Insufficient Funds Modal */}
      <Dialog open={showInsufficientModal} onOpenChange={setShowInsufficientModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Fund Your Wallet to Host This Contest
            </DialogTitle>
            <DialogDescription>
              Your wallet balance is not enough to cover the prize pool. The full prize amount must be available before launching.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted rounded-lg p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total Prize Pool</span>
                <span className="font-semibold text-foreground">{formatNaira(insufficientData.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Your Wallet Balance</span>
                <span className="font-semibold text-foreground">{formatNaira(insufficientData.balance)}</span>
              </div>
              <hr className="border-border" />
              <div className="flex justify-between">
                <span className="text-sm font-medium text-destructive">Amount Needed</span>
                <span className="font-bold text-destructive">{formatNaira(insufficientData.shortfall)}</span>
              </div>
            </div>

            <Button className="w-full" onClick={() => { setShowInsufficientModal(false); setShowFundWallet(true); }}>
              <Wallet className="h-4 w-4 mr-2" />
              Fund Wallet
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fund Wallet Modal */}
      <FundWalletModal
        open={showFundWallet}
        onOpenChange={setShowFundWallet}
        onSuccess={handleFundSuccess}
        userEmail={profile?.email}
      />
    </div>
  );
}
