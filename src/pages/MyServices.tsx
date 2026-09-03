import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { getLocalStorageToken } from "@/api/axios";
import {
  createMyService,
  deleteMyService as deleteMyServiceApi,
  getMyServicesList,
  setMyServiceActive,
  updateMyService as updateMyServiceApi,
} from "@/api/marketplace.api";
import { useCurrency } from "@/hooks/useCurrency";
import { toast } from "sonner";
import {
  Loader2, ArrowLeft, ShoppingBag, Trash2, X, Clock,
  Upload, Pause, Play, Pencil, AlertCircle, RotateCcw, CheckCircle2,
} from "lucide-react";

type UploadStatus = "uploading" | "done" | "error";
type UploadItem = { id: string; file: File; progress: number; status: UploadStatus; url: string | null; errorMsg: string | null; localPreview: string };
import { categoryNames } from "@/lib/categories";
import type { MyServiceItem, ServicePayload } from "@/types/marketplace";

const CATEGORIES = categoryNames;
const FORM_SECTIONS = ["Basics", "Media", "Pricing"] as const;

function FormSectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
        {label}
      </span>
      <div className="flex-1 h-px bg-border/60" />
    </div>
  );
}

export default function MyServicesPage() {
  const { format } = useCurrency();
  const { user, bootstrapStatus } = useAuth();
  const navigate = useNavigate();
  const [services, setServices] = useState<MyServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MyServiceItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [pricingType, setPricingType] = useState("fixed");
  const [price, setPrice] = useState("");
  const [deliveryDays, setDeliveryDays] = useState("");
  const [deliveryUnit, setDeliveryUnit] = useState("days");
  const [revisions, setRevisions] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [imageUploads, setImageUploads] = useState<UploadItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const basicsRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const pricingRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState(0);

  const fetchServices = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(null);
    try {
      const response = await getMyServicesList();
      setServices(response.data.services || []);
    } catch (error) {
      setServices([]);
      setLoadError(error instanceof Error ? error.message : "Failed to load services");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (bootstrapStatus === "ready" && user) void fetchServices();
  }, [bootstrapStatus, fetchServices, user]);

  const resetForm = () => {
    setTitle(""); setDescription(""); setCategory(""); setPricingType("fixed");
    setPrice(""); setDeliveryDays(""); setDeliveryUnit("days"); setRevisions("");
    setSkills([]); setSkillInput(""); setEditing(null); setImages([]);
    setImageUploads(prev => { prev.forEach(u => URL.revokeObjectURL(u.localPreview)); return []; });
  };

  const openEditForm = (svc: MyServiceItem) => {
    setEditing(svc);
    setTitle(svc.title);
    setDescription(svc.description);
    setCategory(svc.category || "");
    setPricingType(svc.pricing_type || "fixed");
    setPrice(svc.price?.toString() || "");
    setDeliveryDays(svc.delivery_days?.toString() || "");
    setDeliveryUnit(svc.delivery_unit || "days");
    setRevisions(svc.revisions_allowed?.toString() || "");
    setSkills(svc.skills || []);
    setImages(svc.images || []);
    setImageUploads([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const uploadOneServiceImage = (item: UploadItem) => {
    const token = getLocalStorageToken();
    const formData = new FormData();
    formData.append("files", item.file);
    const xhr = new XMLHttpRequest();
    const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
    xhr.open("POST", `${baseUrl}/services/attachments`, true);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        setImageUploads((prev) => prev.map((u) => u.id === item.id ? { ...u, progress: Math.round((e.loaded / e.total) * 100) } : u));
      }
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const url = JSON.parse(xhr.responseText)?.data?.urls?.[0] ?? null;
        setImageUploads((prev) => prev.map((u) => u.id === item.id ? { ...u, status: "done", progress: 100, url } : u));
      } else {
        let msg = "Upload failed";
        try { msg = JSON.parse(xhr.responseText)?.message || msg; } catch { /* ignore — fall back to default message */ }
        setImageUploads((prev) => prev.map((u) => u.id === item.id ? { ...u, status: "error", errorMsg: msg } : u));
      }
    });
    xhr.addEventListener("error", () => {
      setImageUploads((prev) => prev.map((u) => u.id === item.id ? { ...u, status: "error", errorMsg: "Network error" } : u));
    });
    xhr.send(formData);
  };

  const handleImageUpload = (files: FileList | null) => {
    if (!files || !user) return;
    const total = images.length + imageUploads.length;
    const newItems: UploadItem[] = Array.from(files)
      .slice(0, 5 - total)
      .map(f => ({ id: `${Date.now()}_${Math.random()}`, file: f, progress: 0, status: "uploading", url: null, errorMsg: null, localPreview: URL.createObjectURL(f) }));
    setImageUploads((prev) => {
      const merged = [...prev, ...newItems].slice(0, 5 - images.length);
      newItems.forEach(uploadOneServiceImage);
      return merged;
    });
  };

  const removeImage = (idx: number) => setImages(images.filter((_, i) => i !== idx));
  const removeUpload = (id: string) => setImageUploads(prev => { const item = prev.find(u => u.id === id); if (item) URL.revokeObjectURL(item.localPreview); return prev.filter(u => u.id !== id); });
  const retryUpload = (item: UploadItem) => { const retry = { ...item, status: "uploading" as UploadStatus, progress: 0, errorMsg: null }; setImageUploads(prev => prev.map(u => u.id === item.id ? retry : u)); uploadOneServiceImage(retry); };

  const handleSave = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error("Title and description required");
      return;
    }
    if (imageUploads.some(u => u.status === "uploading")) { toast.error("Please wait for images to finish uploading"); return; }
    if (imageUploads.some(u => u.status === "error")) { toast.error("Some images failed. Remove or retry them first."); return; }
    setSaving(true);
    const allImages = [...images, ...imageUploads.filter(u => u.status === "done" && u.url).map(u => u.url!)];
    const data: ServicePayload = {
      title: title.trim(),
      description: description.trim(),
      category: category || null,
      pricing_type: pricingType,
      price: price ? parseInt(price) : null,
      delivery_days: deliveryDays ? parseInt(deliveryDays) : null,
      delivery_unit: deliveryUnit,
      revisions_allowed: revisions ? parseInt(revisions) : null,
      skills,
      images: allImages,
      banner_image: allImages.length > 0 ? allImages[0] : null,
      is_active: true,
    };
    try {
      if (editing) {
        await updateMyServiceApi(editing.id, data);
        toast.success("Service updated!");
      } else {
        await createMyService(data);
        toast.success("Service created!");
      }
      resetForm();
      void fetchServices();
    } catch {
      toast.error(editing ? "Failed to update" : "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (svc: MyServiceItem) => {
    try {
      await setMyServiceActive(svc.id, !svc.is_active);
      toast.success(svc.is_active ? "Service paused" : "Service activated");
      void fetchServices();
    } catch {
      toast.error("Failed to update service");
    }
  };

  const deleteService = async (id: string) => {
    if (!window.confirm("Delete this service?")) return;
    try {
      await deleteMyServiceApi(id);
      toast.success("Service deleted");
      if (editing?.id === id) resetForm();
      void fetchServices();
    } catch {
      toast.error("Failed to delete service");
    }
  };

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const scrollTop = container.scrollTop;
    let closestIdx = 0;
    let closestDist = Infinity;
    [basicsRef, mediaRef, pricingRef].forEach((ref, i) => {
      if (ref.current) {
        const dist = Math.abs(ref.current.offsetTop - scrollTop);
        if (dist < closestDist) { closestDist = dist; closestIdx = i; }
      }
    });
    setActiveSection(closestIdx);
  }, []);

  if (!user || bootstrapStatus !== "ready") {
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

  const scrollToSection = (idx: number) => {
    const refs = [basicsRef, mediaRef, pricingRef];
    const container = scrollContainerRef.current;
    const section = refs[idx].current;
    if (!container || !section) return;
    container.scrollTo({ top: section.offsetTop, behavior: "smooth" });
  };

  const hasDraft = !editing && (!!title || !!description || images.length > 0);
  const parsedPrice = price ? parseInt(price) : null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-wide">
          {loadError && (
            <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {loadError}
            </div>
          )}

          {/* Page header */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </button>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">My Services</h1>
            {!loading && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {services.length} service{services.length !== 1 ? "s" : ""}
                {services.filter((s) => s.is_active).length > 0 &&
                  ` · ${services.filter((s) => s.is_active).length} live`}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

            {/* ── Form (1/3) ── */}
            <aside className="lg:col-span-1">
              <div className="lg:sticky lg:top-6">
                <Card className="rounded-2xl border-border/60 overflow-hidden">

                  {/* Form header */}
                  <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {editing ? "Editing" : "New Service"}
                      </p>
                      {editing && (
                        <p className="text-sm font-medium text-foreground truncate">
                          {editing.title}
                        </p>
                      )}
                    </div>
                    {editing && (
                      <button
                        onClick={resetForm}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-3 shrink-0"
                      >
                        Cancel
                      </button>
                    )}
                  </div>

                  {/* Scrollable form body with dot nav */}
                  <div className="relative">
                    <div
                      ref={scrollContainerRef}
                      onScroll={handleScroll}
                      className="overflow-y-auto max-h-[calc(100vh-16rem)] snap-y snap-proximity scrollbar-none"
                    >
                      <div className="p-5 pr-8">

                        {/* Basics */}
                        <div ref={basicsRef} className="snap-start space-y-4 pb-6">
                          <FormSectionLabel label="Basics" />
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Title *</Label>
                            <Input
                              placeholder="e.g. Professional CAD Drafting"
                              value={title}
                              onChange={(e) => setTitle(e.target.value)}
                              className="h-9 text-sm"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Category</Label>
                            <Select value={category} onValueChange={setCategory}>
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                {CATEGORIES.map((c) => (
                                  <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Description *</Label>
                            <Textarea
                              placeholder="Describe what's included..."
                              rows={3}
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              className="text-sm resize-none"
                            />
                          </div>
                          {skills.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {skills.map((s) => (
                                <Badge key={s} variant="secondary" className="gap-1 text-xs pr-1">
                                  {s}
                                  <button onClick={() => setSkills(skills.filter((x) => x !== s))}>
                                    <X className="h-2.5 w-2.5" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-2">
                            <Input
                              placeholder="Add tag..."
                              value={skillInput}
                              onChange={(e) => setSkillInput(e.target.value)}
                              className="h-9 text-sm"
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && skillInput.trim()) {
                                  e.preventDefault();
                                  setSkills([...skills, skillInput.trim()]);
                                  setSkillInput("");
                                }
                              }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-9 rounded-lg shrink-0"
                              disabled={!skillInput.trim()}
                              onClick={() => {
                                setSkills([...skills, skillInput.trim()]);
                                setSkillInput("");
                              }}
                            >
                              Add
                            </Button>
                          </div>
                        </div>

                        {/* Media */}
                        <div ref={mediaRef} className="snap-start space-y-4 pb-6 pt-2">
                          <FormSectionLabel label="Media" />
                          {(images.length > 0 || imageUploads.length > 0) && (
                            <div className="grid grid-cols-2 gap-2">
                              {images.map((url, i) => (
                                <div key={i} className="relative aspect-video bg-muted rounded-lg overflow-hidden group">
                                  <img src={url} alt={`Service image ${i + 1}`} className="w-full h-full object-cover" />
                                  <button type="button" onClick={() => removeImage(i)} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <X className="h-3 w-3" />
                                  </button>
                                  {i === 0 && <span className="absolute bottom-1 left-1 text-[9px] bg-background/80 text-foreground px-1.5 py-0.5 rounded">Thumbnail</span>}
                                </div>
                              ))}
                              {imageUploads.map((item) => (
                                <div key={item.id} className="relative aspect-video bg-muted rounded-lg overflow-hidden group">
                                  <img src={item.localPreview} alt="Uploading" className="w-full h-full object-cover" />
                                  {item.status === "uploading" && (
                                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-1">
                                      <Loader2 className="h-4 w-4 text-white animate-spin" />
                                      <div className="w-3/4 h-1 bg-white/30 rounded-full overflow-hidden">
                                        <div className="h-full bg-white transition-all duration-200 rounded-full" style={{ width: `${item.progress}%` }} />
                                      </div>
                                    </div>
                                  )}
                                  {item.status === "done" && <div className="absolute top-1 left-1 bg-emerald-500 rounded-full p-0.5"><CheckCircle2 className="h-3 w-3 text-white" /></div>}
                                  {item.status === "error" && (
                                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1">
                                      <AlertCircle className="h-4 w-4 text-destructive" />
                                      <button type="button" onClick={() => retryUpload(item)} className="text-[10px] text-white underline flex items-center gap-0.5"><RotateCcw className="h-2.5 w-2.5" /> Retry</button>
                                    </div>
                                  )}
                                  <button type="button" onClick={() => removeUpload(item.id)} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-3 w-3" /></button>
                                </div>
                              ))}
                            </div>
                          )}
                          {images.length + imageUploads.length < 5 && (
                            <>
                              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleImageUpload(e.target.files)} />
                              <Button type="button" variant="outline" size="sm" className="w-full rounded-lg text-xs" onClick={() => fileInputRef.current?.click()} disabled={imageUploads.some(u => u.status === "uploading")}>
                                {imageUploads.some(u => u.status === "uploading") ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Upload className="h-3 w-3 mr-1.5" />}
                                Upload Images ({images.length + imageUploads.length}/5)
                              </Button>
                            </>
                          )}
                        </div>

                        {/* Pricing & Delivery */}
                        <div ref={pricingRef} className="snap-start space-y-4 pb-6 pt-2">
                          <FormSectionLabel label="Pricing & Delivery" />
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Type</Label>
                              <Select value={pricingType} onValueChange={setPricingType}>
                                <SelectTrigger className="h-9 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="fixed">Fixed</SelectItem>
                                  <SelectItem value="starting_from">From</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Price (₦)</Label>
                              <Input
                                type="number"
                                placeholder="50000"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                className="h-9 text-sm"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Delivery</Label>
                              <Input
                                type="number"
                                placeholder="7"
                                value={deliveryDays}
                                onChange={(e) => setDeliveryDays(e.target.value)}
                                className="h-9 text-sm"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Unit</Label>
                              <Select value={deliveryUnit} onValueChange={setDeliveryUnit}>
                                <SelectTrigger className="h-9 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="days">Days</SelectItem>
                                  <SelectItem value="weeks">Weeks</SelectItem>
                                  <SelectItem value="months">Months</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Revisions Allowed</Label>
                            <Input
                              type="number"
                              placeholder="3"
                              value={revisions}
                              onChange={(e) => setRevisions(e.target.value)}
                              className="h-9 text-sm"
                            />
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Dot nav */}
                    <div className="absolute right-2 top-0 h-full flex flex-col items-center justify-center gap-2.5 pointer-events-none">
                      {FORM_SECTIONS.map((label, i) => (
                        <button
                          key={label}
                          title={label}
                          onClick={() => scrollToSection(i)}
                          aria-label={`Scroll to ${label}`}
                          className="pointer-events-auto flex items-center justify-center w-4 h-6 group"
                        >
                          <span
                            className={`rounded-full transition-all duration-300 w-1.5 ${
                              activeSection === i
                                ? "h-5 bg-primary"
                                : "h-1.5 bg-muted-foreground/25 group-hover:bg-muted-foreground/55"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Submit footer */}
                  <div className="px-5 py-4 border-t border-border/60 bg-card">
                    <Button
                      className="w-full rounded-xl"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      {editing ? "Update Service" : "Post Service"}
                    </Button>
                  </div>
                </Card>
              </div>
            </aside>

            {/* ── Services Grid (2/3) ── */}
            <div className="lg:col-span-2">
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="rounded-2xl border border-border/60 bg-card overflow-hidden"
                    >
                      <div className="h-40 bg-muted animate-pulse" />
                      <div className="p-4 space-y-2">
                        <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
                        <div className="h-3 w-full rounded bg-muted/70 animate-pulse" />
                        <div className="h-3 w-2/3 rounded bg-muted/70 animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  {/* Live draft preview card */}
                  {hasDraft && (
                    <div className="rounded-2xl border-2 border-dashed border-primary/40 overflow-hidden bg-card/50">
                      <div className="h-40 overflow-hidden bg-muted">
                        {images[0] ? (
                          <img
                            src={images[0]}
                            alt="preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                            <ShoppingBag className="h-8 w-8 text-primary/20" />
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-2">
                          Live Preview
                        </p>
                        {category && (
                          <p className="text-xs text-primary mb-0.5">{category}</p>
                        )}
                        <h3 className="font-semibold text-sm text-foreground leading-snug line-clamp-1 mb-1">
                          {title || (
                            <span className="text-muted-foreground/40">Service title...</span>
                          )}
                        </h3>
                        {description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                            {description}
                          </p>
                        )}
                        <div className="flex items-center justify-between text-xs mt-2">
                          {parsedPrice ? (
                            <span className="font-bold text-primary text-sm">
                              {pricingType === "starting_from" ? "From " : ""}
                              {format(parsedPrice)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/30 text-xs">Price...</span>
                          )}
                          {deliveryDays && (
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {deliveryDays} {deliveryUnit}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Existing service cards */}
                  {services.map((svc) => (
                    <div
                      key={svc.id}
                      className={`relative rounded-2xl border overflow-hidden bg-card transition-all hover:shadow-sm hover:-translate-y-0.5
                        ${editing?.id === svc.id
                          ? "border-primary/50 ring-2 ring-primary/20"
                          : "border-border/60"
                        }
                        ${!svc.is_active ? "opacity-60" : ""}
                      `}
                    >
                      {/* Pencil edit icon */}
                      <button
                        onClick={() => openEditForm(svc)}
                        className="absolute top-2 right-2 z-10 h-7 w-7 rounded-lg bg-background/80 backdrop-blur-sm border border-border/60 flex items-center justify-center hover:bg-background hover:border-primary/40 transition-all"
                        title="Edit service"
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>

                      {/* Thumbnail */}
                      <div className="h-40 overflow-hidden">
                        {svc.images?.[0] || svc.banner_image ? (
                          <img
                            src={svc.images?.[0] || svc.banner_image}
                            alt={svc.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                            <ShoppingBag className="h-8 w-8 text-primary/30" />
                          </div>
                        )}
                      </div>

                      {/* Card content */}
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex-1 min-w-0">
                            {svc.category && (
                              <p className="text-xs text-primary mb-0.5">{svc.category}</p>
                            )}
                            <h3 className="font-semibold text-sm text-foreground leading-snug line-clamp-1">
                              {svc.title}
                            </h3>
                          </div>
                          {svc.is_active ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 shrink-0">
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                              </span>
                              Live
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground shrink-0">Paused</span>
                          )}
                        </div>

                        {svc.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                            {svc.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between text-xs mb-3">
                          {svc.price && (
                            <span className="font-bold text-primary text-sm">
                              {svc.pricing_type === "starting_from" ? "From " : ""}
                              {format(svc.price)}
                            </span>
                          )}
                          {svc.delivery_days && (
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {svc.delivery_days} {svc.delivery_unit || "days"}
                            </span>
                          )}
                        </div>

                        <div className="flex gap-2 pt-3 border-t border-border/60">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 rounded-lg text-xs h-7"
                            onClick={() => toggleActive(svc)}
                          >
                            {svc.is_active
                              ? <><Pause className="h-3 w-3 mr-1" />Pause</>
                              : <><Play className="h-3 w-3 mr-1" />Activate</>}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-lg h-7 w-7 p-0 text-destructive hover:text-destructive hover:border-destructive/40"
                            onClick={() => deleteService(svc.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Empty state */}
                  {services.length === 0 && !hasDraft && (
                    <div className="col-span-2 flex flex-col items-center justify-center py-16 text-muted-foreground">
                      <ShoppingBag className="h-10 w-10 mb-3 opacity-20" />
                      <p className="text-sm">Fill in the form to create your first service</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
