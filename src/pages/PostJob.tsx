import { useState, useRef } from "react";
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
import { Loader2, X, Plus, Paperclip, FileText } from "lucide-react";

type SkillLevel = "Beginner" | "Intermediate" | "Advanced";

interface SkillWithLevel {
  name: string;
  level: SkillLevel;
}

export default function PostJobPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [deliveryDays, setDeliveryDays] = useState("");
  const [isRemote, setIsRemote] = useState(true);
  const [isHourly, setIsHourly] = useState(false);
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [skillsWithLevel, setSkillsWithLevel] = useState<SkillWithLevel[]>([]);
  const [softwareWithLevel, setSoftwareWithLevel] = useState<SkillWithLevel[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const states = getAllStates();
  const cities = state ? getCitiesByState(state) : [];

  const addSkill = (skill: string) => {
    if (skill && !skillsWithLevel.find(s => s.name === skill)) {
      setSkillsWithLevel([...skillsWithLevel, { name: skill, level: "Intermediate" }]);
    }
  };
  const addSoftware = (sw: string) => {
    if (sw && !softwareWithLevel.find(s => s.name === sw)) {
      setSoftwareWithLevel([...softwareWithLevel, { name: sw, level: "Intermediate" }]);
    }
  };

  const updateSkillLevel = (name: string, level: SkillLevel) => {
    setSkillsWithLevel(prev => prev.map(s => s.name === name ? { ...s, level } : s));
  };
  const updateSoftwareLevel = (name: string, level: SkillLevel) => {
    setSoftwareWithLevel(prev => prev.map(s => s.name === name ? { ...s, level } : s));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const allowed = files.filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'dwg', 'dxf', 'zip'].includes(ext || '');
    });
    if (allowed.length < files.length) {
      toast.error("Some files were skipped. Allowed: PDF, DOC, DOCX, PNG, JPG, DWG, DXF, ZIP");
    }
    setAttachments(prev => [...prev, ...allowed].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadAttachments = async (): Promise<string[]> => {
    if (!attachments.length || !user) return [];
    setUploading(true);
    const urls: string[] = [];
    for (const file of attachments) {
      const path = `${user.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from('job-attachments').upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from('job-attachments').getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    setUploading(false);
    return urls;
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

    const uploadedUrls = await uploadAttachments();

    const skillLevels: Record<string, string> = {};
    [...skillsWithLevel, ...softwareWithLevel].forEach(s => { skillLevels[s.name] = s.level; });

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
      required_skills: skillsWithLevel.map(s => s.name),
      required_software: softwareWithLevel.map(s => s.name),
      required_skill_levels: skillLevels,
      attachments: uploadedUrls.length > 0 ? uploadedUrls : null,
    } as any);

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

  const levels: SkillLevel[] = ["Beginner", "Intermediate", "Advanced"];

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

            {/* Skills & Software with Level Selectors */}
            <div className="bg-card rounded-xl border border-border p-6 space-y-6">
              <h2 className="text-lg font-semibold">Skills & Software</h2>
              <div className="space-y-2">
                <Label>Required Skills</Label>
                <Select onValueChange={addSkill}>
                  <SelectTrigger><SelectValue placeholder="Add a skill" /></SelectTrigger>
                  <SelectContent>
                    {cadSkills.filter(s => !skillsWithLevel.find(sw => sw.name === s)).map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="space-y-2 mt-2">
                  {skillsWithLevel.map(s => (
                    <div key={s.name} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border">
                      <span className="text-sm font-medium flex-1">{s.name}</span>
                      <Select value={s.level} onValueChange={(v) => updateSkillLevel(s.name, v as SkillLevel)}>
                        <SelectTrigger className="w-[140px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {levels.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <X className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => setSkillsWithLevel(skillsWithLevel.filter(x => x.name !== s.name))} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Required Software</Label>
                <Select onValueChange={addSoftware}>
                  <SelectTrigger><SelectValue placeholder="Add software" /></SelectTrigger>
                  <SelectContent>
                    {cadSoftwareList.filter(s => !softwareWithLevel.find(sw => sw.name === s)).map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="space-y-2 mt-2">
                  {softwareWithLevel.map(s => (
                    <div key={s.name} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border">
                      <span className="text-sm font-medium flex-1">{s.name}</span>
                      <Select value={s.level} onValueChange={(v) => updateSoftwareLevel(s.name, v as SkillLevel)}>
                        <SelectTrigger className="w-[140px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {levels.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <X className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => setSoftwareWithLevel(softwareWithLevel.filter(x => x.name !== s.name))} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Budget & Timeline */}
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

            {/* Attachments */}
            <div className="bg-card rounded-xl border border-border p-6 space-y-4">
              <h2 className="text-lg font-semibold">Attachments</h2>
              <p className="text-sm text-muted-foreground">Upload reference files, drawings, or briefs (PDF, DOC, PNG, JPG, DWG, DXF, ZIP). Max 5 files.</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.dwg,.dxf,.zip"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={attachments.length >= 5}>
                <Paperclip className="h-4 w-4 mr-2" /> Add Files
              </Button>
              {attachments.length > 0 && (
                <div className="space-y-2">
                  {attachments.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 border border-border">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm flex-1 truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</span>
                      <X className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Location */}
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

            <Button type="submit" size="lg" className="w-full" disabled={loading || uploading}>
              {loading || uploading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />{uploading ? "Uploading files..." : "Posting..."}</> : <><Plus className="h-4 w-4 mr-2" />Post Job</>}
            </Button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
