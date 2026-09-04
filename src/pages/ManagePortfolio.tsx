import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { getLocalStorageToken } from "@/api/axios";
import {
  createMyPortfolioItem,
  deleteMyPortfolioItem,
  getMyPortfolioOverview,
} from "@/api/marketplace.api";
import type { PortfolioItem } from "@/types/marketplace";
import { toast } from "sonner";
import { cadSoftwareList } from "@/lib/nigerian-data";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  ImageIcon,
  X,
  Upload,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";

type UploadStatus = "uploading" | "done" | "error";
type UploadItem = { id: string; file: File; progress: number; status: UploadStatus; url: string | null; errorMsg: string | null; localPreview: string };

function ImageCarousel({ images }: { images: string[] }) {
  const [idx, setIdx] = useState(0);
  if (!images || images.length === 0) return null;

  return (
    <div className="relative w-full aspect-video bg-muted rounded-lg overflow-hidden mb-3 group">
      <img src={images[idx]} alt={`Portfolio ${idx + 1}`} className="w-full h-full object-cover" />
      {images.length > 1 && (
        <>
          <button
            onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIdx((i) => (i + 1) % images.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? "bg-white" : "bg-white/50"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function ManagePortfolioPage() {
  const { user, role, bootstrapStatus } = useAuth();
  const navigate = useNavigate();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectType, setProjectType] = useState("");
  const [softwareUsed, setSoftwareUsed] = useState<string[]>([]);
  const [swSearch, setSwSearch] = useState("");
  const [imageUploads, setImageUploads] = useState<UploadItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(null);
    try {
      const response = await getMyPortfolioOverview();
      setProfileId(response.data.profileId);
      setItems(response.data.items || []);
    } catch (error) {
      setProfileId(null);
      setItems([]);
      setLoadError(error instanceof Error ? error.message : "Failed to load portfolio");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (bootstrapStatus === "ready" && user) {
      void fetchPortfolio();
    }
  }, [bootstrapStatus, user, fetchPortfolio]);

  const uploadOneImage = (item: UploadItem) => {
    const token = getLocalStorageToken();
    const formData = new FormData();
    formData.append("files", item.file);
    const xhr = new XMLHttpRequest();
    const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
    xhr.open("POST", `${baseUrl}/portfolio/attachments`, true);
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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) =>
      /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name),
    );
    const newItems: UploadItem[] = files
      .slice(0, 5 - imageUploads.length)
      .map(f => ({ id: `${Date.now()}_${Math.random()}`, file: f, progress: 0, status: "uploading", url: null, errorMsg: null, localPreview: URL.createObjectURL(f) }));
    setImageUploads((prev) => {
      const merged = [...prev, ...newItems].slice(0, 5);
      newItems.forEach(uploadOneImage);
      return merged;
    });
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const removeImage = (id: string) => {
    setImageUploads((prev) => {
      const item = prev.find(u => u.id === id);
      if (item) URL.revokeObjectURL(item.localPreview);
      return prev.filter(u => u.id !== id);
    });
  };

  const retryImage = (item: UploadItem) => {
    const retry = { ...item, status: "uploading" as UploadStatus, progress: 0, errorMsg: null };
    setImageUploads((prev) => prev.map(u => u.id === item.id ? retry : u));
    uploadOneImage(retry);
  };

  const handleAdd = async () => {
    if (!profileId || !title.trim()) { toast.error("Please enter a title"); return; }
    if (imageUploads.some(u => u.status === "uploading")) { toast.error("Please wait for images to finish uploading"); return; }
    if (imageUploads.some(u => u.status === "error")) { toast.error("Some images failed to upload. Remove or retry them first."); return; }

    setSaving(true);
    try {
      await createMyPortfolioItem({
        title: title.trim(),
        description: description.trim() || null,
        projectType: projectType.trim() || null,
        softwareUsed,
        images: imageUploads.filter(u => u.status === "done" && u.url).map(u => u.url!),
      });
      toast.success("Portfolio item added!");
      setTitle(""); setDescription(""); setProjectType(""); setSoftwareUsed([]);
      imageUploads.forEach(u => URL.revokeObjectURL(u.localPreview));
      setImageUploads([]);
      setShowForm(false);
      void fetchPortfolio();
    } catch {
      toast.error("Failed to add portfolio item");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMyPortfolioItem(id);
      toast.success("Item deleted");
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      toast.error("Failed to delete");
    }
  };

  const swSuggestions = cadSoftwareList
    .filter((s) => s.toLowerCase().includes(swSearch.toLowerCase()) && !softwareUsed.includes(s))
    .slice(0, 6);

  if (bootstrapStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || bootstrapStatus !== "ready" || role !== "freelancer") {
    return null;
  }

  if (!profileId) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Please complete your profile first.</p>
            <Button onClick={() => navigate("/settings")}>Account Settings</Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-4 sm:py-8">
        <div className="container-wide max-w-3xl">

          {loadError && (
            <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {loadError}
            </div>
          )}

          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-4 sm:mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <ImageIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">Manage Portfolio</h1>
                <p className="text-sm text-muted-foreground">Showcase your best CAD projects.</p>
              </div>
            </div>
            {!showForm && (
              <Button size="sm" onClick={() => setShowForm(true)} className="self-start sm:self-auto">
                <Plus className="h-4 w-4 mr-2" /> Add Item
              </Button>
            )}
          </div>

          {showForm && (
            <div className="bg-card rounded-xl border border-border p-4 sm:p-6 mb-4 sm:mb-6">
              <h2 className="text-lg font-semibold mb-4">New Portfolio Item</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Project Title *</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Residential Building Design"
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the project..."
                    rows={4}
                    maxLength={500}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Project Type</Label>
                  <Input
                    value={projectType}
                    onChange={(e) => setProjectType(e.target.value)}
                    placeholder="e.g. Architectural, Mechanical, Structural"
                    maxLength={50}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Software Used</Label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {softwareUsed.map((sw) => (
                      <Badge key={sw} variant="secondary" className="gap-1 pr-1">
                        {sw}
                        <button
                          onClick={() => setSoftwareUsed(softwareUsed.filter((s) => s !== sw))}
                          className="ml-1 rounded-full hover:bg-muted p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="relative">
                    <Input
                      value={swSearch}
                      onChange={(e) => setSwSearch(e.target.value)}
                      placeholder="Search software, or type your own and press Enter"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && swSuggestions.length === 0) {
                          e.preventDefault();
                          const trimmed = swSearch.trim();
                          if (trimmed && !softwareUsed.includes(trimmed)) {
                            setSoftwareUsed([...softwareUsed, trimmed]);
                            setSwSearch("");
                          }
                        }
                      }}
                    />
                    {swSearch && swSuggestions.length > 0 && (
                      <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {swSuggestions.map((s) => (
                          <button
                            key={s}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                            onClick={() => {
                              setSoftwareUsed([...softwareUsed, s]);
                              setSwSearch("");
                            }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>
                    Project Images <span className="text-muted-foreground text-xs">(up to 5)</span>
                  </Label>
                  <input
                    ref={imageInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageSelect}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={imageUploads.length >= 5}
                  >
                    <Upload className="h-4 w-4 mr-2" /> Upload Images ({imageUploads.length}/5)
                  </Button>
                  {imageUploads.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {imageUploads.map((item) => (
                        <div key={item.id} className="relative aspect-square rounded-lg overflow-hidden border border-border group">
                          <img src={item.localPreview} alt="Preview" className="w-full h-full object-cover" />
                          {item.status === "uploading" && (
                            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-1">
                              <Loader2 className="h-5 w-5 text-white animate-spin" />
                              <div className="w-3/4 h-1 bg-white/30 rounded-full overflow-hidden">
                                <div className="h-full bg-white transition-all duration-200 rounded-full" style={{ width: `${item.progress}%` }} />
                              </div>
                            </div>
                          )}
                          {item.status === "done" && (
                            <div className="absolute top-1 left-1 bg-success rounded-full p-0.5">
                              <CheckCircle2 className="h-3 w-3 text-white" />
                            </div>
                          )}
                          {item.status === "error" && (
                            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1.5 p-1">
                              <AlertCircle className="h-5 w-5 text-destructive" />
                              <button type="button" onClick={() => retryImage(item)} className="text-[10px] text-white underline flex items-center gap-0.5">
                                <RotateCcw className="h-2.5 w-2.5" /> Retry
                              </button>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => removeImage(item.id)}
                            className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      setShowForm(false);
                      imageUploads.forEach(u => URL.revokeObjectURL(u.localPreview));
                      setImageUploads([]);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAdd} disabled={saving || imageUploads.some(u => u.status === "uploading")} className="w-full sm:w-auto">
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : imageUploads.some(u => u.status === "uploading") ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                    {imageUploads.some(u => u.status === "uploading") ? "Uploading..." : "Add Item"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((item) => (
                <div key={item} className="bg-card rounded-xl border border-border p-4 sm:p-6">
                  <div className="h-40 rounded-lg bg-muted animate-pulse mb-3" />
                  <div className="h-5 w-1/2 rounded bg-muted animate-pulse mb-2" />
                  <div className="h-4 w-2/3 rounded bg-muted/70 animate-pulse" />
                </div>
              ))}
            </div>
          ) : items.length === 0 && !showForm ? (
            <div className="text-center py-16 bg-card rounded-xl border border-border">
              <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No portfolio items yet.</p>
              <Button className="mt-4" onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" /> Add Your First Project
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.id} className="bg-card rounded-xl border border-border p-4 sm:p-6">
                  <ImageCarousel images={item.images || []} />
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{item.title}</h3>
                      {item.project_type && <p className="text-sm text-primary mt-1">{item.project_type}</p>}
                      {item.description && <p className="text-sm text-muted-foreground mt-2">{item.description}</p>}
                      {item.software_used?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {item.software_used.map((sw: string) => (
                            <Badge key={sw} variant="outline" className="text-xs">
                              {sw}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {item.images?.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {item.images.length} image{item.images.length !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
