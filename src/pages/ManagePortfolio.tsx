import { useState, useEffect, useCallback } from "react";
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
import { toast } from "sonner";
import { cadSoftwareList } from "@/lib/nigerian-data";
import { ArrowLeft, Loader2, Plus, Trash2, ImageIcon, X } from "lucide-react";

export default function ManagePortfolioPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New item form
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectType, setProjectType] = useState("");
  const [softwareUsed, setSoftwareUsed] = useState<string[]>([]);
  const [swSearch, setSwSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
    if (!authLoading && profile?.role !== "freelancer") navigate("/dashboard");
  }, [user, authLoading, profile]);

  const fetchPortfolio = useCallback(async () => {
    if (!user) return;
    const { data: fp } = await supabase
      .from("freelancer_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (fp) {
      setProfileId(fp.id);
      const { data } = await supabase
        .from("portfolio_items")
        .select("*")
        .eq("freelancer_profile_id", fp.id)
        .order("created_at", { ascending: false });
      setItems(data || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) fetchPortfolio();
  }, [user, fetchPortfolio]);

  const handleAdd = async () => {
    if (!profileId || !title.trim()) {
      toast.error("Please enter a title");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("portfolio_items").insert({
      freelancer_profile_id: profileId,
      title: title.trim(),
      description: description.trim() || null,
      project_type: projectType.trim() || null,
      software_used: softwareUsed,
    });
    if (error) {
      toast.error("Failed to add portfolio item");
    } else {
      toast.success("Portfolio item added!");
      setTitle(""); setDescription(""); setProjectType(""); setSoftwareUsed([]); setShowForm(false);
      fetchPortfolio();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("portfolio_items").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else {
      toast.success("Item deleted");
      setItems(items.filter(i => i.id !== id));
    }
  };

  const swSuggestions = cadSoftwareList.filter(s => s.toLowerCase().includes(swSearch.toLowerCase()) && !softwareUsed.includes(s)).slice(0, 6);

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
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
                  <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Residential Building Design" maxLength={100} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the project..." rows={4} maxLength={500} />
                </div>
                <div className="space-y-2">
                  <Label>Project Type</Label>
                  <Input value={projectType} onChange={e => setProjectType(e.target.value)} placeholder="e.g. Architectural, Mechanical, Structural" maxLength={50} />
                </div>
                <div className="space-y-2">
                  <Label>Software Used</Label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {softwareUsed.map(sw => (
                      <Badge key={sw} variant="secondary" className="gap-1 pr-1">
                        {sw}
                        <button onClick={() => setSoftwareUsed(softwareUsed.filter(s => s !== sw))} className="ml-1 rounded-full hover:bg-muted p-0.5"><X className="h-3 w-3" /></button>
                      </Badge>
                    ))}
                  </div>
                  <div className="relative">
                    <Input value={swSearch} onChange={e => setSwSearch(e.target.value)} placeholder="Search software..." />
                    {swSearch && swSuggestions.length > 0 && (
                      <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {swSuggestions.map(s => (
                          <button key={s} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted" onClick={() => { setSoftwareUsed([...softwareUsed, s]); setSwSearch(""); }}>{s}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                  <Button onClick={handleAdd} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                    Add Item
                  </Button>
                </div>
              </div>
            </div>
          )}

          {items.length === 0 && !showForm ? (
            <div className="text-center py-16 bg-card rounded-xl border border-border">
              <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No portfolio items yet.</p>
              <Button className="mt-4" onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" /> Add Your First Project
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map(item => (
                <div key={item.id} className="bg-card rounded-xl border border-border p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">{item.title}</h3>
                      {item.project_type && <p className="text-sm text-primary mt-1">{item.project_type}</p>}
                      {item.description && <p className="text-sm text-muted-foreground mt-2">{item.description}</p>}
                      {item.software_used?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {item.software_used.map((sw: string) => <Badge key={sw} variant="outline" className="text-xs">{sw}</Badge>)}
                        </div>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(item.id)}>
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
