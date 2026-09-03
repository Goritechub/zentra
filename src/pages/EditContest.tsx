import { useState, useRef, useEffect, useCallback } from "react";
import ReactCrop, {
  type Crop,
  type PixelCrop,
  centerCrop,
  makeAspectCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { useNavigate, useParams } from "react-router-dom";
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
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cadSkills } from "@/lib/nigerian-data";
import { categoryNames } from "@/lib/categories";
import { useCurrency } from "@/hooks/useCurrency";
import {
  Loader2,
  X,
  Trophy,
  Upload,
  AlertTriangle,
  ArrowLeft,
  Save,
} from "lucide-react";

export default function EditContestPage() {
  const { format } = useCurrency();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contestStatus, setContestStatus] = useState<string>("");
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
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
  const [existingBannerUrl, setExistingBannerUrl] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  const categories = categoryNames;

  const loadContest = useCallback(async () => {
    setPageLoading(true);
    try {
      const res = await api.get(`/contests/${id}/edit-data`);
      const c = res.data.data.contest;
      setContestStatus(c.status);
      setReviewMessage(c.review_message || null);
      setTitle(c.title || "");
      setDescription(c.description || "");
      setCategory(c.category || "");
      setPrizeFirst(String(c.prize_first || ""));
      setPrizeSecond(String(c.prize_second || ""));
      setPrizeThird(String(c.prize_third || ""));
      setPrizeFourth(String(c.prize_fourth || ""));
      setPrizeFifth(String(c.prize_fifth || ""));
      // Format deadline to datetime-local format
      if (c.deadline) {
        const d = new Date(c.deadline);
        const pad = (n: number) => String(n).padStart(2, "0");
        setDeadline(
          `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
        );
      }
      setVisibility(c.visibility || "open");
      setRules(c.rules || "");
      setSelectedSkills(c.required_skills || []);
      if (c.banner_image) {
        setExistingBannerUrl(c.banner_image);
        setBannerPreview(c.banner_image);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load contest");
      navigate("/dashboard/my-contests");
    } finally {
      setPageLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    if (!id || !user) return;
    void loadContest();
  }, [id, user, loadContest]);

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
    if (!imgRef.current || !completedCrop) return;
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
        const preview = URL.createObjectURL(blob);
        if (bannerPreview && bannerPreview !== existingBannerUrl) {
          URL.revokeObjectURL(bannerPreview);
        }
        setBannerPreview(preview);
        setShowCropModal(false);
        if (cropSrc) URL.revokeObjectURL(cropSrc);
        setCropSrc(null);
      },
      "image/jpeg",
      0.92,
    );
  }, [completedCrop, cropSrc, bannerPreview, existingBannerUrl]);

  const cancelCrop = useCallback(() => {
    setShowCropModal(false);
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }, [cropSrc]);

  const clearBanner = useCallback(() => {
    setBannerFile(null);
    setExistingBannerUrl(null);
    if (bannerPreview && bannerPreview !== existingBannerUrl) {
      URL.revokeObjectURL(bannerPreview);
    }
    setBannerPreview(null);
  }, [bannerPreview, existingBannerUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !deadline) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("description", description.trim());
      if (category) formData.append("category", category);
      formData.append("deadline", deadline);
      if (rules.trim()) formData.append("rules", rules.trim());
      else formData.append("rules", "");
      formData.append("required_skills", JSON.stringify(selectedSkills));
      formData.append("visibility", visibility);
      if (bannerFile) formData.append("banner", bannerFile);

      await api.patch(`/contests/${id}/resubmit`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success(
        contestStatus === "rejected"
          ? "Contest updated and resubmitted for review."
          : "Contest updated. Admin has been notified of your changes.",
      );
      navigate("/dashboard/my-contests");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
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

  if (pageLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <Footer />
      </div>
    );
  }

  const isRejected = contestStatus === "rejected";

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-tight">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard/my-contests")}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to My Contests
          </Button>

          <h1 className="text-3xl font-bold text-foreground mb-2">
            {isRejected ? "Edit & Resubmit Contest" : "Edit Contest"}
          </h1>
          <p className="text-muted-foreground mb-2">
            {isRejected
              ? "Address the rejection reason below and resubmit for review."
              : "Make changes while your contest is pending review. Admin will be notified."}
          </p>

          {/* Rejection message banner */}
          {isRejected && reviewMessage && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 mb-6 text-sm text-destructive">
              <span className="font-semibold">Rejection reason: </span>
              {reviewMessage}
            </div>
          )}

          {/* Pending review notice */}
          {!isRejected && (
            <div className="rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 mb-6 text-sm text-amber-800 dark:text-amber-200">
              <span className="font-semibold">Under review — </span>
              your contest is currently being reviewed. Saving changes will notify the admin to re-review.
            </div>
          )}

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
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

            {/* Prize structure — read-only display (prizes can't change after escrow deducted) */}
            <div className="bg-card rounded-xl border border-border p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-accent" />
                <h2 className="text-lg font-semibold">Prize Structure</h2>
                <Badge variant="outline" className="text-xs ml-auto">Locked</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Prize amounts are locked once a contest is submitted. They cannot be changed during review.
              </p>
              <div className="flex flex-wrap gap-2">
                {parseInt(prizeFirst) > 0 && (
                  <Badge variant="outline" className="gap-1">
                    <Trophy className="h-3 w-3 text-amber-500" /> 1st: {format(parseInt(prizeFirst))}
                  </Badge>
                )}
                {parseInt(prizeSecond) > 0 && (
                  <Badge variant="outline">2nd: {format(parseInt(prizeSecond))}</Badge>
                )}
                {parseInt(prizeThird) > 0 && (
                  <Badge variant="outline">3rd: {format(parseInt(prizeThird))}</Badge>
                )}
                {parseInt(prizeFourth) > 0 && (
                  <Badge variant="outline">4th: {format(parseInt(prizeFourth))}</Badge>
                )}
                {parseInt(prizeFifth) > 0 && (
                  <Badge variant="outline">5th: {format(parseInt(prizeFifth))}</Badge>
                )}
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 space-y-6">
              <h2 className="text-lg font-semibold">Requirements</h2>
              <div className="space-y-2">
                <Label>Required Skills</Label>
                <Select
                  onValueChange={(s) => {
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
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedSkills.map((s) => (
                    <Badge key={s} variant="secondary" className="gap-1">
                      {s}{" "}
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() =>
                          setSelectedSkills(selectedSkills.filter((x) => x !== s))
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
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {isRejected ? "Save & Resubmit for Review" : "Save Changes"}
                </>
              )}
            </Button>
          </form>
        </div>
      </main>
      <Footer />

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
              Drag to adjust. The crop is locked to 16:9 for consistent banner display.
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
    </div>
  );
}
