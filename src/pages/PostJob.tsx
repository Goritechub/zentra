import { useState } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { getAllStates, getCitiesByState, cadSkills, cadSoftwareList } from "@/lib/nigerian-data";
import { Loader2, X, Plus } from "lucide-react";

export default function PostJobPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [deliveryDays, setDeliveryDays] = useState("");
  const [isRemote, setIsRemote] = useState(true);
  const [isHourly, setIsHourly] = useState(false);
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedSoftware, setSelectedSoftware] = useState<string[]>([]);

  const states = getAllStates();
  const cities = state ? getCitiesByState(state) : [];

  const addSkill = (skill: string) => {
    if (skill && !selectedSkills.includes(skill)) setSelectedSkills([...selectedSkills, skill]);
  };
  const addSoftware = (sw: string) => {
    if (sw && !selectedSoftware.includes(sw)) setSelectedSoftware([...selectedSoftware, sw]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { navigate("/auth"); return; }
    if (!title.trim() || !description.trim()) {
      toast.error("Title and description are required");
      return;
    }
    if (deliveryDays && parseInt(deliveryDays) < 1) {
      toast.error("Delivery days must be at least 1");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("jobs").insert({
      client_id: user.id,
      title: title.trim(),
      description: description.trim(),
      budget_min: budgetMin ? parseInt(budgetMin) : null,
      budget_max: budgetMax ? parseInt(budgetMax) : null,
      delivery_days: deliveryDays ? parseInt(deliveryDays) : null,
      is_remote: isRemote,
      is_hourly: isHourly,
      state: state || null,
      city: city || null,
      required_skills: selectedSkills,
      required_software: selectedSoftware,
    });

    if (error) {
      toast.error("Failed to post job");
    } else {
      toast.success("Job posted successfully!");
      navigate("/dashboard");
    }
    setLoading(false);
  };

  if (!user || profile?.role !== "client") {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Client Access Only</h2>
            <p className="text-muted-foreground mb-4">You need to be signed in as a client to post jobs.</p>
            <Button onClick={() => navigate("/auth")}>Sign In</Button>
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
        <div className="container-tight">
          <h1 className="text-3xl font-bold text-foreground mb-2">Post a New Job</h1>
          <p className="text-muted-foreground mb-8">Describe your CAD project and find the right expert.</p>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="bg-card rounded-xl border border-border p-6 space-y-6">
              <h2 className="text-lg font-semibold">Project Details</h2>
              <div className="space-y-2">
                <Label>Job Title *</Label>
                <Input placeholder="e.g. Architectural Drawings for 5-Bedroom Duplex" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Description *</Label>
                <Textarea placeholder="Describe your project requirements in detail..." rows={6} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 space-y-6">
              <h2 className="text-lg font-semibold">Skills & Software</h2>
              <div className="space-y-2">
                <Label>Required Skills</Label>
                <Select onValueChange={addSkill}>
                  <SelectTrigger><SelectValue placeholder="Add a skill" /></SelectTrigger>
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
              <div className="space-y-2">
                <Label>Required Software</Label>
                <Select onValueChange={addSoftware}>
                  <SelectTrigger><SelectValue placeholder="Add software" /></SelectTrigger>
                  <SelectContent>
                    {cadSoftwareList.filter(s => !selectedSoftware.includes(s)).map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedSoftware.map(s => (
                    <Badge key={s} variant="secondary" className="gap-1">
                      {s} <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedSoftware(selectedSoftware.filter(x => x !== s))} />
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 space-y-6">
              <h2 className="text-lg font-semibold">Budget & Timeline</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Budget Min (₦)</Label>
                  <Input type="number" placeholder="e.g. 100000" value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Budget Max (₦)</Label>
                  <Input type="number" placeholder="e.g. 500000" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Delivery Timeline (days)</Label>
                <Input type="number" placeholder="e.g. 14" min="1" value={deliveryDays} onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || parseInt(val) >= 1) setDeliveryDays(val);
                }} />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={isHourly} onCheckedChange={setIsHourly} />
                  <Label>Hourly Rate</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={isRemote} onCheckedChange={setIsRemote} />
                  <Label>Remote Work</Label>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 space-y-6">
              <h2 className="text-lg font-semibold">Location (Optional)</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>State</Label>
                  <Select value={state} onValueChange={(v) => { setState(v === "none" ? "" : v); setCity(""); }}>
                    <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Select value={city} onValueChange={setCity} disabled={!state}>
                    <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                    <SelectContent>
                      {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Posting...</> : <><Plus className="h-4 w-4 mr-2" />Post Job</>}
            </Button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
