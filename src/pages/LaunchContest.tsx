import { useState, useRef, useEffect, useCallback } from "react";
import ReactCrop, {
  type Crop,
  type PixelCrop,
  centerCrop,
  makeAspectCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { api } from "@/api/axios";
import { getWalletBalance } from "@/api/wallet.api";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cadSkills } from "@/lib/nigerian-data";
import { categoryNames } from "@/lib/categories";
import { formatNaira } from "@/lib/nigerian-data";
import {
  Loader2,
  X,
  Trophy,
  Upload,
  Wallet,
  AlertTriangle,
} from "lucide-react";
import { FundWalletModal } from "@/components/wallet/FundWalletModal";
import { KycRequiredModal } from "@/components/KycRequiredModal";

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
  const [extraPrizes, setExtraPrizes] = useState<string[]>([]);
  const [extraPrizeCountInput, setExtraPrizeCountInput] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [customSkill, setCustomSkill] = useState("");
  const [deadline, setDeadline] = useState("");
  const [visibility, setVisibility] = useState("open");
  const [rules, setRules] = useState("");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [showKycModal, setShowKycModal] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  // Wallet / insufficient funds state
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [showInsufficientModal, setShowInsufficientModal] = useState(false);
  const [insufficientData, setInsufficientData] = useState({
    total: 0,
    balance: 0,
    shortfall: 0,
  });
  const [showFundWallet, setShowFundWallet] = useState(false);

  const categories = categoryNames;

  // Fetch wallet balance
  useEffect(() => {
    if (!user) return;
    const fetchWallet = async () => {
      try {
        const data = await getWalletBalance();
        setWalletBalance(data.balance || 0);
      } catch {
        setWalletBalance(0);
      }
    };
    void fetchWallet();
  }, [user]);

  const handleBannerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Banner image must be less than 10MB");
      return;
    }
    const url = URL.createObjectURL(file);
    setCropSrc(url);
    setCrop(undefined);
    setCompletedCrop(null);
    setShowCropModal(true);
  };

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
      const initial = centerCrop(
        makeAspectCrop({ unit: "%", width: 90 }, 16 / 9, w, h),
        w,
        h,
      );
      setCrop(initial);
    },
    [],
  );

  const applyCrop = useCallback(async () => {
    if (!imgRef.current || !completedCrop || !user) return;
    const img = imgRef.current;
    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(completedCrop.width * scaleX);
    canvas.height = Math.round(completedCrop.height * scaleY);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(
      img,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    canvas.toBlob(
      async (blob) => {
        if (!blob) return;
        const croppedFile = new File([blob], `banner_${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        setBannerFile(croppedFile);

        // Show preview immediately, then start uploading
        const preview = URL.createObjectURL(blob);
        if (bannerPreview) URL.revokeObjectURL(bannerPreview);
        setBannerPreview(preview);
        setShowCropModal(false);
        if (cropSrc) URL.revokeObjectURL(cropSrc);
        setCropSrc(null);

        // Banner is ready — it will be uploaded together with the launch request
      },
      "image/jpeg",
      0.92,
    );
  }, [completedCrop, cropSrc, bannerPreview, user]);

  const cancelCrop = useCallback(() => {
    setShowCropModal(false);
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }, [cropSrc]);

  const clearBanner = useCallback(() => {
    setBannerFile(null);
    if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    setBannerPreview(null);
  }, [bannerPreview]);

  const calcTotalPrize = () => {
    return (
      (parseInt(prizeFirst) || 0) +
      (parseInt(prizeSecond) || 0) +
      (parseInt(prizeThird) || 0) +
      (parseInt(prizeFourth) || 0) +
      (parseInt(prizeFifth) || 0) +
      extraPrizes.reduce((sum, p) => sum + (parseInt(p) || 0), 0)
    );
  };

  const ordinal = (n: number) => {
    if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
    if (n % 10 === 1) return `${n}st`;
    if (n % 10 === 2) return `${n}nd`;
    if (n % 10 === 3) return `${n}rd`;
    return `${n}th`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate("/auth");
      return;
    }
    if (!profile?.is_verified) {
      setShowKycModal(true);
      return;
    }
    if (!title.trim() || !description.trim() || !prizeFirst || !deadline) {
      toast.error("Please fill in all required fields");
      return;
    }
    const totalPrize = calcTotalPrize();
    if (totalPrize <= 0) {
      toast.error("Prize pool must be greater than zero");
      return;
    }
    if ((parseInt(prizeFirst) || 0) < 50000) {
      toast.error("1st prize must be at least ₦50,000");
      return;
    }
    if (prizeThird && !prizeSecond) {
      toast.error("Cannot set 3rd prize without 2nd prize");
      return;
    }
    if (prizeFourth && !prizeThird) {
      toast.error("Cannot set 4th prize without 3rd prize");
      return;
    }
    if (prizeFifth && !prizeFourth) {
      toast.error("Cannot set 5th prize without 4th prize");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("description", description.trim());
      const finalCategory = category === "Others" ? customCategory.trim() : category;
      if (finalCategory) formData.append("category", finalCategory);
      formData.append("prize_first", String(parseInt(prizeFirst) || 0));
      formData.append("prize_second", String(prizeSecond ? parseInt(prizeSecond) : 0));
      formData.append("prize_third", String(prizeThird ? parseInt(prizeThird) : 0));
      formData.append("prize_fourth", String(prizeFourth ? parseInt(prizeFourth) : 0));
      formData.append("prize_fifth", String(prizeFifth ? parseInt(prizeFifth) : 0));
      if (extraPrizes.length > 0) {
        formData.append("extra_prizes", JSON.stringify(extraPrizes.map((p) => parseInt(p) || 0)));
      }
      formData.append("deadline", deadline);
      formData.append("required_skills", JSON.stringify(selectedSkills));
      formData.append("visibility", visibility);
      if (rules.trim()) formData.append("rules", rules.trim());
      formData.append("winner_selection_method", "client_selects");
      if (bannerFile) formData.append("banner", bannerFile);

      const res = await api.post("/contests/launch", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setLoading(false);
      const data = res.data;
      if (data?.success) {
        toast.success("Contest submitted for review. You'll be notified once it's approved and goes live.");
        navigate("/dashboard/my-contests");
      }
    } catch (err: any) {
      setLoading(false);
      console.error("[LaunchContest] launch error:", err);
      console.error("[LaunchContest] error message:", err?.message);
      try {
        const parsed = JSON.parse(err?.message || "{}");
        console.log("[LaunchContest] parsed error:", parsed);
        if (parsed.error === "insufficient_funds") {
          setInsufficientData({
            total: parsed.total_prize_pool,
            balance: parsed.wallet_balance,
            shortfall: parsed.shortfall,
          });
          setWalletBalance(parsed.wallet_balance);
          setShowInsufficientModal(true);
          return;
        }
      } catch {
        /* not JSON */
      }
      toast.error(err?.message || "Failed to launch contest");
    }
  };

  const handleFundSuccess = async () => {
    // Refresh wallet balance
    if (!user) return;
    let newBal = 0;
    try {
      const data = await getWalletBalance();
      newBal = data.balance || 0;
    } catch {
      newBal = 0;
    }
    setWalletBalance(newBal);
    setShowFundWallet(false);
    // Update insufficient modal data
    const total = calcTotalPrize();
    if (newBal >= total) {
      setShowInsufficientModal(false);
      toast.success("Wallet funded! You can now launch the contest.");
    } else {
      setInsufficientData({
        total,
        balance: newBal,
        shortfall: total - newBal,
      });
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
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Launch a Contest
          </h1>
          <p className="text-muted-foreground mb-8">
            Invite submissions from experts and pick the best one.
          </p>

          {/* Wallet balance indicator */}
          <div className="bg-card rounded-xl border border-border p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wallet className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Wallet Balance</p>
                <p className="font-semibold text-foreground">
                  {formatNaira(walletBalance)}
                </p>
              </div>
            </div>
            {totalPrizePreview > 0 && (
              <div className="text-right">
                <p className="text-sm text-muted-foreground">
                  Prize Pool Required
                </p>
                <p
                  className={`font-semibold ${walletBalance >= totalPrizePreview ? "text-primary" : "text-destructive"}`}
                >
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
                <Input
                  placeholder="e.g. Office Building Floor Plan Design"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={(v) => { setCategory(v); if (v !== "Others") setCustomCategory(""); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                    <SelectItem value="Others">Others</SelectItem>
                  </SelectContent>
                </Select>
                {category === "Others" && (
                  <div className="space-y-1">
                    <Input
                      placeholder="Enter category name"
                      maxLength={25}
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value.replace(/\s{2,}/g, " "))}
                    />
                    <p className="text-xs text-muted-foreground">{customCategory.length}/25 characters</p>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Description *</Label>
                <Textarea
                  placeholder="Describe what you want contestants to design..."
                  rows={6}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Rules / How to Enter</Label>
                <Textarea
                  placeholder="Explain the rules and submission guidelines..."
                  rows={4}
                  value={rules}
                  onChange={(e) => setRules(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Submission Deadline *</Label>
                  <Input
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contest Visibility</Label>
                  <Select value={visibility} onValueChange={setVisibility}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">
                        Open (entries visible to all)
                      </SelectItem>
                      <SelectItem value="closed">
                        Closed (only entry count shown)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Banner Image (optional, max 10MB)</Label>
                {bannerPreview ? (
                  <div className="space-y-2">
                    <div className="relative w-full">
                      <img
                        src={bannerPreview}
                        alt="Banner preview"
                        className="w-full max-h-48 object-cover rounded-lg border border-border"
                      />
                      <button
                        type="button"
                        onClick={clearBanner}
                        className="absolute top-2 right-2 bg-background/80 hover:bg-background rounded-full p-1 text-muted-foreground hover:text-destructive transition-colors shadow"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => bannerRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 mr-1" /> Re-crop
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => bannerRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 mr-1" /> Upload Banner
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      JPG, PNG, WebP — max 10MB. You'll crop after selecting.
                    </p>
                  </div>
                )}
                <input
                  ref={bannerRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleBannerSelect}
                />
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 space-y-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Trophy className="h-5 w-5 text-accent" />
                Prize Structure
              </h2>
              <p className="text-sm text-muted-foreground">
                Set up to 5 prize positions. Only 1st prize is required. Prize
                amounts are in Naira (₦).
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>🥇 1st Prize (₦) *</Label>
                  <Input
                    type="number"
                    placeholder="Min. 50,000"
                    min="50000"
                    step="1"
                    value={prizeFirst}
                    onChange={(e) => setPrizeFirst(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum ₦50,000
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>🥈 2nd Prize (₦)</Label>
                  <Input
                    type="number"
                    placeholder="Optional"
                    min="0"
                    step="1"
                    value={prizeSecond}
                    onChange={(e) => setPrizeSecond(e.target.value)}
                    disabled={!prizeFirst}
                  />
                  {!prizeFirst && (
                    <p className="text-xs text-muted-foreground">Set 1st prize first</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>🥉 3rd Prize (₦)</Label>
                  <Input
                    type="number"
                    placeholder="Optional"
                    min="0"
                    step="1"
                    value={prizeThird}
                    onChange={(e) => setPrizeThird(e.target.value)}
                    disabled={!prizeSecond}
                  />
                  {!prizeSecond && (
                    <p className="text-xs text-muted-foreground">Set 2nd prize first</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>🏅 4th Prize (₦)</Label>
                  <Input
                    type="number"
                    placeholder="Optional"
                    min="0"
                    step="1"
                    value={prizeFourth}
                    onChange={(e) => setPrizeFourth(e.target.value)}
                    disabled={!prizeThird}
                  />
                  {!prizeThird && (
                    <p className="text-xs text-muted-foreground">
                      Set 3rd prize first
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>🏅 5th Prize (₦)</Label>
                  <Input
                    type="number"
                    placeholder="Optional"
                    min="0"
                    step="1"
                    value={prizeFifth}
                    onChange={(e) => setPrizeFifth(e.target.value)}
                    disabled={!prizeFourth}
                  />
                  {!prizeFourth && (
                    <p className="text-xs text-muted-foreground">
                      Set 4th prize first
                    </p>
                  )}
                </div>
              </div>

              {/* Extra prize positions beyond 5th */}
              {extraPrizes.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {extraPrizes.map((val, idx) => {
                    const prevFilled = idx === 0 ? !!prizeFifth : !!extraPrizes[idx - 1];
                    return (
                      <div key={idx} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>🏅 {ordinal(idx + 6)} Prize (₦)</Label>
                          <button
                            type="button"
                            onClick={() => setExtraPrizes(extraPrizes.slice(0, idx))}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <Input
                          type="number"
                          placeholder="Optional"
                          min="0"
                          step="1"
                          value={val}
                          disabled={!prevFilled}
                          onChange={(e) => {
                            const updated = [...extraPrizes];
                            updated[idx] = e.target.value;
                            setExtraPrizes(updated);
                          }}
                        />
                        {!prevFilled && (
                          <p className="text-xs text-muted-foreground">Set {ordinal(idx + 5)} prize first</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add more prize positions */}
              <div className="space-y-2 pt-2 border-t border-border">
                <Label className="text-sm text-muted-foreground">Add more prize positions</Label>
                <Input
                  type="number"
                  placeholder="How many more? (e.g. 5)"
                  min="1"
                  max="20"
                  value={extraPrizeCountInput}
                  onChange={(e) => setExtraPrizeCountInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const count = Math.min(Math.max(parseInt(extraPrizeCountInput) || 0, 1), 20);
                      if (count > 0) {
                        const start = extraPrizes.length + 6;
                        const end = start + count - 1;
                        setExtraPrizes([...extraPrizes, ...Array(count).fill("")]);
                        setExtraPrizeCountInput("");
                        toast.info(`Added ${ordinal(start)} to ${ordinal(end)} prize positions`);
                      }
                    }
                  }}
                />
                {extraPrizeCountInput && parseInt(extraPrizeCountInput) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Press Enter to add {ordinal(extraPrizes.length + 6)} to {ordinal(extraPrizes.length + (parseInt(extraPrizeCountInput) || 0) + 5)} prizes
                  </p>
                )}
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 space-y-6">
              <h2 className="text-lg font-semibold">Requirements</h2>
              <div className="space-y-2">
                <Label>Required Skills</Label>
                <Select
                  onValueChange={(s) => {
                    if (s === "__others__") return;
                    if (!selectedSkills.includes(s))
                      setSelectedSkills([...selectedSkills, s]);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Add skill" />
                  </SelectTrigger>
                  <SelectContent>
                    {cadSkills
                      .filter((s) => !selectedSkills.includes(s))
                      .map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    <SelectItem value="__others__">Others</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a custom skill and press Enter"
                    maxLength={25}
                    value={customSkill}
                    onChange={(e) => setCustomSkill(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const trimmed = customSkill.trim();
                        if (trimmed && !selectedSkills.includes(trimmed)) {
                          setSelectedSkills([...selectedSkills, trimmed]);
                          setCustomSkill("");
                        }
                      }
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedSkills.map((s) => (
                    <Badge key={s} variant="secondary" className="gap-1">
                      {s}{" "}
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() =>
                          setSelectedSkills(
                            selectedSkills.filter((x) => x !== s),
                          )
                        }
                      />
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Launching...
                </>
              ) : (
                <>
                  <Trophy className="h-4 w-4 mr-2" />
                  Launch Contest
                </>
              )}
            </Button>
          </form>
        </div>
      </main>
      <Footer />

      {/* Insufficient Funds Modal */}
      <Dialog
        open={showInsufficientModal}
        onOpenChange={setShowInsufficientModal}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Fund Your Wallet to Host This Contest
            </DialogTitle>
            <DialogDescription>
              Your wallet balance is not enough to cover the prize pool. The
              full prize amount must be available before launching.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted rounded-lg p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">
                  Total Prize Pool
                </span>
                <span className="font-semibold text-foreground">
                  {formatNaira(insufficientData.total)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">
                  Your Wallet Balance
                </span>
                <span className="font-semibold text-foreground">
                  {formatNaira(insufficientData.balance)}
                </span>
              </div>
              <hr className="border-border" />
              <div className="flex justify-between">
                <span className="text-sm font-medium text-destructive">
                  Amount Needed
                </span>
                <span className="font-bold text-destructive">
                  {formatNaira(insufficientData.shortfall)}
                </span>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => {
                setShowInsufficientModal(false);
                setShowFundWallet(true);
              }}
            >
              <Wallet className="h-4 w-4 mr-2" />
              Fund Wallet
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Banner Crop Modal */}
      <Dialog
        open={showCropModal}
        onOpenChange={(open) => {
          if (!open) cancelCrop();
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crop Banner Image</DialogTitle>
            <DialogDescription>
              Drag to adjust. The crop is locked to 16:9 for consistent banner
              display.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto max-h-[60vh] flex items-center justify-center bg-muted rounded-lg p-2">
            {cropSrc && (
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={16 / 9}
                minWidth={100}
              >
                <img
                  ref={imgRef}
                  src={cropSrc}
                  alt="Crop preview"
                  onLoad={onImageLoad}
                  style={{ maxHeight: "55vh", maxWidth: "100%" }}
                />
              </ReactCrop>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={cancelCrop}>
              Cancel
            </Button>
            <Button type="button" onClick={applyCrop} disabled={!completedCrop}>
              Apply Crop
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

      <KycRequiredModal
        open={showKycModal}
        onClose={() => setShowKycModal(false)}
        action="host a contest"
      />
    </div>
  );
}
