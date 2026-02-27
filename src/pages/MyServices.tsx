import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/nigerian-data";
import { toast } from "sonner";
import {
  Loader2, ArrowLeft, ShoppingBag, PlusCircle, Edit, Pause, Play, Trash2, X, Clock
} from "lucide-react";

const CATEGORIES = [
  "Product Design", "CAD Drafting", "3D Modeling", "3D Printing",
  "Structural Design", "Architectural Design", "Mechanical Design",
  "Electrical Design", "BIM/Revit", "Civil Engineering",
];

export default function MyServicesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
    if (user) fetchServices();
  }, [user, authLoading]);

  const fetchServices = async () => {
    const { data } = await supabase
      .from("service_offers" as any)
      .select("*")
      .eq("freelancer_id", user!.id)
      .order("created_at", { ascending: false });
    setServices((data as any[]) || []);
    setLoading(false);
  };

  const resetForm = () => {
    setTitle(""); setDescription(""); setCategory(""); setPricingType("fixed");
    setPrice(""); setDeliveryDays(""); setDeliveryUnit("days"); setRevisions("");
    setSkills([]); setSkillInput(""); setEditing(null);
  };

  const openEditForm = (svc: any) => {
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
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !description.trim()) { toast.error("Title and description required"); return; }
    setSaving(true);

    const data: any = {
      freelancer_id: user!.id,
      title: title.trim(),
      description: description.trim(),
      category: category || null,
      pricing_type: pricingType,
      price: price ? parseInt(price) : null,
      delivery_days: deliveryDays ? parseInt(deliveryDays) : null,
      delivery_unit: deliveryUnit,
      revisions_allowed: revisions ? parseInt(revisions) : null,
      skills,
      is_active: true,
    };

    if (editing) {
      const { error } = await supabase.from("service_offers" as any).update(data).eq("id", editing.id);
      if (error) toast.error("Failed to update"); else toast.success("Service updated!");
    } else {
      const { error } = await supabase.from("service_offers" as any).insert(data);
      if (error) toast.error("Failed to create"); else toast.success("Service created!");
    }

    setSaving(false);
    setShowForm(false);
    resetForm();
    fetchServices();
  };

  const toggleActive = async (svc: any) => {
    await supabase.from("service_offers" as any).update({ is_active: !svc.is_active }).eq("id", svc.id);
    toast.success(svc.is_active ? "Service paused" : "Service activated");
    fetchServices();
  };

  const deleteService = async (id: string) => {
    if (!window.confirm("Delete this service?")) return;
    await supabase.from("service_offers" as any).delete().eq("id", id);
    toast.success("Service deleted");
    fetchServices();
  };

  if (authLoading || loading) {
    return <div className="min-h-screen flex flex-col"><Header /><div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div><Footer /></div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-wide">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <ShoppingBag className="h-8 w-8 text-primary" /> My Services
            </h1>
            <Button onClick={() => { resetForm(); setShowForm(true); }}>
              <PlusCircle className="h-4 w-4 mr-2" /> Post Service
            </Button>
          </div>

          {services.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>You haven't posted any services yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((svc: any) => (
                <div key={svc.id} className={`bg-card rounded-xl border border-border p-6 ${!svc.is_active ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      {svc.category && <Badge variant="secondary" className="mb-1 text-xs">{svc.category}</Badge>}
                      <h3 className="font-semibold text-foreground">{svc.title}</h3>
                    </div>
                    <Badge variant={svc.is_active ? "default" : "outline"}>
                      {svc.is_active ? "Active" : "Paused"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{svc.description}</p>
                  <div className="flex items-center justify-between text-sm mb-4">
                    {svc.price && (
                      <span className="font-bold text-primary">
                        {svc.pricing_type === "starting_from" ? "From " : ""}{formatNaira(svc.price)}
                      </span>
                    )}
                    {svc.delivery_days && (
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {svc.delivery_days} {svc.delivery_unit || "days"}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEditForm(svc)} className="flex-1">
                      <Edit className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggleActive(svc)}>
                      {svc.is_active ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => deleteService(svc.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); resetForm(); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Service" : "Post a Service"}</DialogTitle>
            <DialogDescription>Describe your service so clients can find and hire you.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input placeholder="e.g. Professional CAD Drafting" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea placeholder="Describe what's included..." rows={4} value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Pricing Type</Label>
                <Select value={pricingType} onValueChange={setPricingType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed Price</SelectItem>
                    <SelectItem value="starting_from">Starting From</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Price (₦)</Label>
                <Input type="number" placeholder="e.g. 50000" value={price} onChange={e => setPrice(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Delivery Time</Label>
                <Input type="number" placeholder="e.g. 7" value={deliveryDays} onChange={e => setDeliveryDays(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={deliveryUnit} onValueChange={setDeliveryUnit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="days">Days</SelectItem>
                    <SelectItem value="weeks">Weeks</SelectItem>
                    <SelectItem value="months">Months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Revisions Allowed (optional)</Label>
              <Input type="number" placeholder="e.g. 3" value={revisions} onChange={e => setRevisions(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tags / Skills</Label>
              <div className="flex flex-wrap gap-1 mb-2">
                {skills.map(s => (
                  <Badge key={s} variant="secondary" className="gap-1">
                    {s} <button onClick={() => setSkills(skills.filter(x => x !== s))}><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input placeholder="Add tag..." value={skillInput} onChange={e => setSkillInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && skillInput.trim()) { e.preventDefault(); setSkills([...skills, skillInput.trim()]); setSkillInput(""); }}} />
                <Button type="button" variant="outline" size="sm" disabled={!skillInput.trim()}
                  onClick={() => { setSkills([...skills, skillInput.trim()]); setSkillInput(""); }}>Add</Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editing ? "Update" : "Post Service"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
