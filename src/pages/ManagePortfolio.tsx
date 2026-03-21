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
import { supabase } from "@/integrations/supabase/client";
import {
  createMyPortfolioItem,
  deleteMyPortfolioItem,
  getMyPortfolioOverview,
} from "@/api/marketplace.api";
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
} from "lucide-react";

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
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIdx((i) => (i + 1) % images.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
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
  const { user, role, bootstrapStatus, authError } = useAuth();
  const navigate = useNavigate();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectType, setProjectType] = useState("");
  const [softwareUsed, setSoftwareUsed] = useState<string[]>([]);
  const [swSearch, setSwSearch] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) =>
      ["jpg", "jpeg", "png", "webp"].includes(f.name.split(".").pop()?.toLowerCase() || ""),
    );
    const combined = [...imageFiles, ...files].slice(0, 5);
    setImageFiles(combined);

    const previews: string[] = [];
    combined.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        previews.push(ev.target?.result as string);
        if (previews.length === combined.length) setImagePreviews([...previews]);
      };
      reader.readAsDataURL(file);
    });

    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const removeImage = (idx: number) => {
    setImageFiles((f) => f.filter((_, i) => i !== idx));
    setImagePreviews((p) => p.filter((_, i) => i !== idx));
  };

  const handleAdd = async () => {
    if (!profileId || !title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    setSaving(true);
    const uploadedUrls: string[] = [];
    for (const file of imageFiles) {
      const path = `portfolio/${user!.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("contract-attachments").upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from("contract-attachments").getPublicUrl(path);
        uploadedUrls.push(data.publicUrl);
      }
    }

    try {
      await createMyPortfolioItem({
        title: title.trim(),
        description: description.trim() || null,
        projectType: projectType.trim() || null,
        softwareUsed,
        images: uploadedUrls,
      });
      toast.success("Portfolio item added!");
      setTitle("");
      setDescription("");
      setProjectType("");
      setSoftwareUsed([]);
      setImageFiles([]);
      setImagePreviews([]);
      setShowForm(false);
      void fetchPortfolio();
    } catch (error) {
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
            <Button onClick={() => navigate("/my-profile")}>Edit Profile</Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-wide max-w-3xl">
          {authError && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              {authError}
            </div>
          )}
          {loadError && (
            <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {loadError}
            </div>
          )}

          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>

          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <ImageIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Manage Portfolio</h1>
                <p className="text-sm text-muted-foreground">Showcase your best CAD projects.</p>
              </div>
            </div>
            {!showForm && (
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" /> Add Item
              </Button>
            )}
          </div>

          {showForm && (
            <div className="bg-card rounded-xl border border-border p-6 mb-6">
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
                      placeholder="Search software..."
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
                    disabled={imageFiles.length >= 5}
                  >
                    <Upload className="h-4 w-4 mr-2" /> Upload Images
                  </Button>
                  {imagePreviews.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {imagePreviews.map((src, i) => (
                        <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border group">
                          <img src={src} alt={`Preview ${i + 1}`} className="w-full h-full object-cover" />
                          <button
                            onClick={() => removeImage(i)}
                            className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      setImageFiles([]);
                      setImagePreviews([]);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAdd} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                    Add Item
                  </Button>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((item) => (
                <div key={item} className="bg-card rounded-xl border border-border p-6">
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
                <div key={item.id} className="bg-card rounded-xl border border-border p-6">
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
