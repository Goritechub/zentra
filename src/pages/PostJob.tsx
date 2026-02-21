import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from
"@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from
"@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { getAllStates, getCitiesByState, cadSkills, cadSoftwareList } from "@/lib/nigerian-data";
import { Loader2, X, Plus, Paperclip, FileText, Search, UserPlus } from "lucide-react";

type SkillLevel = "Beginner" | "Intermediate" | "Advanced";
type DurationUnit = "days" | "weeks" | "months";
type JobVisibility = "public" | "private";

export default function PostJobPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [deliveryValue, setDeliveryValue] = useState("");
  const [deliveryUnit, setDeliveryUnit] = useState<DurationUnit>("days");
  const [locationType, setLocationType] = useState<"remote" | "physical">("remote");
  const [isHourly, setIsHourly] = useState(false);
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedSoftware, setSelectedSoftware] = useState<string[]>([]);
  const [overallSkillLevel, setOverallSkillLevel] = useState<SkillLevel>("Intermediate");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  // Visibility & invitations
  const [visibility, setVisibility] = useState<JobVisibility>("public");
  const [invitedExperts, setInvitedExperts] = useState<{id: string;full_name: string;}[]>([]);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [expertSearch, setExpertSearch] = useState("");
  const [expertResults, setExpertResults] = useState<any[]>([]);
  const [searchingExperts, setSearchingExperts] = useState(false);

  // Negotiable budget confirmation
  const [showNegotiableConfirm, setShowNegotiableConfirm] = useState(false);

  // Pre-select invited expert from URL params
  useEffect(() => {
    const inviteId = searchParams.get("invite");
    const inviteName = searchParams.get("name");
    if (inviteId && inviteName) {
      setVisibility("private");
      setInvitedExperts([{ id: inviteId, full_name: decodeURIComponent(inviteName) }]);
    }
  }, [searchParams]);

  const states = getAllStates();
  const cities = state ? getCitiesByState(state) : [];

  const addSkill = (skill: string) => {
    if (skill && !selectedSkills.includes(skill)) {
      setSelectedSkills([...selectedSkills, skill]);
    }
  };
  const addSoftware = (sw: string) => {
    if (sw && !selectedSoftware.includes(sw)) {
      setSelectedSoftware([...selectedSoftware, sw]);
    }
  };

  const searchExperts = async (query: string) => {
    setExpertSearch(query);
    if (query.length < 2) {setExpertResults([]);return;}
    setSearchingExperts(true);
    const { data } = await supabase.
    from("profiles").
    select("id, full_name, avatar_url").
    eq("role", "freelancer").
    ilike("full_name", `%${query}%`).
    limit(10);
    setExpertResults((data || []).filter((e) => !invitedExperts.find((ie) => ie.id === e.id)));
    setSearchingExperts(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const allowed = files.filter((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'dwg', 'dxf', 'zip'].includes(ext || '');
    });
    if (allowed.length < files.length) {
      toast.error("Some files were skipped. Allowed: PDF, DOC, DOCX, PNG, JPG, DWG, DXF, ZIP");
    }
    setAttachments((prev) => [...prev, ...allowed].slice(0, 5));
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

  const toDays = (value: number, unit: DurationUnit): number => {
    if (unit === "weeks") return value * 7;
    if (unit === "months") return value * 30;
    return value;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {navigate("/auth");return;}
    if (!title.trim() || !description.trim()) {
      toast.error("Title and description are required");
      return;
    }

    // Check if budget is empty and warn about negotiable
    if (!budgetMin && !budgetMax && !showNegotiableConfirm) {
      setShowNegotiableConfirm(true);
      return;
    }

    if (deliveryValue && parseInt(deliveryValue) < 1) {
      toast.error("Delivery value must be at least 1");
      return;
    }

    if (visibility === "private" && invitedExperts.length === 0) {
      toast.error("Please invite at least one expert for a private job");
      return;
    }

    setLoading(true);
    const uploadedUrls = await uploadAttachments();

    const deliveryDays = deliveryValue ? toDays(parseInt(deliveryValue), deliveryUnit) : null;

    const { error } = await supabase.from("jobs").insert({
      client_id: user.id,
      title: title.trim(),
      description: description.trim(),
      budget_min: budgetMin ? parseInt(budgetMin) : null,
      budget_max: budgetMax ? parseInt(budgetMax) : null,
      delivery_days: deliveryDays,
      delivery_unit: deliveryUnit,
      is_remote: locationType === "remote",
      is_hourly: isHourly,
      state: locationType === "physical" ? state || null : null,
      city: locationType === "physical" ? city || null : null,
      required_skills: selectedSkills,
      required_software: selectedSoftware,
      skill_level: overallSkillLevel,
      attachments: uploadedUrls.length > 0 ? uploadedUrls : null,
      visibility,
      invited_expert_ids: invitedExperts.map((e) => e.id)
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
      </div>);

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

            {/* Visibility & Invitations */}
            <div className="bg-card rounded-xl border border-border p-6 space-y-6">
              <h2 className="text-lg font-semibold">Job Visibility</h2>
              <RadioGroup value={visibility} onValueChange={(v) => setVisibility(v as JobVisibility)} className="flex gap-6">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="public" id="vis-public" />
                  <Label htmlFor="vis-public" className="cursor-pointer">
                    <span className="font-medium">Public</span>
                    <span className="text-xs text-muted-foreground ml-1">— visible to all experts</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="private" id="vis-private" />
                  <Label htmlFor="vis-private" className="cursor-pointer">
                    <span className="font-medium">Private</span>
                    <span className="text-xs text-muted-foreground ml-1">— invited experts only</span>
                  </Label>
                </div>
              </RadioGroup>

              {/* Invite experts (available for both public and private) */}
              <div className="space-y-2">
                <Label>Invite Experts {visibility === "private" && <span className="text-destructive">*</span>}</Label>
                <p className="text-xs text-muted-foreground">
                  {visibility === "public" ?
                  "Optionally invite experts. The job will still be visible to all, but invited experts will be highlighted." :
                  "Only invited experts can see and bid on this job."}
                </p>
                {invitedExperts.length > 0 &&
                <div className="flex flex-wrap gap-2 mb-2">
                    {invitedExperts.map((e) =>
                  <Badge key={e.id} variant="secondary" className="gap-1 pr-1">
                        {e.full_name}
                        <button type="button" onClick={() => setInvitedExperts(invitedExperts.filter((x) => x.id !== e.id))} className="ml-1 rounded-full hover:bg-primary-foreground/20 p-0.5">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                  )}
                  </div>
                }
                <Button type="button" variant="outline" size="sm" onClick={() => setShowInviteDialog(true)}>
                  <UserPlus className="h-4 w-4 mr-2" /> Invite Experts
                </Button>
              </div>
            </div>

            {/* Skills & Software */}
            <div className="bg-card rounded-xl border border-border p-6 space-y-6">
              <h2 className="text-lg font-semibold">Skills & Software</h2>
              <div className="space-y-2">
                <Label>Required Skills</Label>
                <Select onValueChange={addSkill}>
                  <SelectTrigger><SelectValue placeholder="Add a skill" /></SelectTrigger>
                  <SelectContent>
                    {cadSkills.filter((s) => !selectedSkills.includes(s)).map((s) =>
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {selectedSkills.length > 0 &&
                <div className="flex flex-wrap gap-2 mt-2">
                    {selectedSkills.map((s) =>
                  <Badge key={s} variant="secondary" className="gap-1 pr-1">
                        {s}
                        <button type="button" onClick={() => setSelectedSkills(selectedSkills.filter((x) => x !== s))} className="ml-1 rounded-full hover:bg-primary-foreground/20 p-0.5">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                  )}
                  </div>
                }
              </div>
              <div className="space-y-2">
                <Label>Required Software</Label>
                <Select onValueChange={addSoftware}>
                  <SelectTrigger><SelectValue placeholder="Add software" /></SelectTrigger>
                  <SelectContent>
                    {cadSoftwareList.filter((s) => !selectedSoftware.includes(s)).map((s) =>
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {selectedSoftware.length > 0 &&
                <div className="flex flex-wrap gap-2 mt-2">
                    {selectedSoftware.map((s) =>
                  <Badge key={s} variant="secondary" className="gap-1 pr-1">
                        {s}
                        <button type="button" onClick={() => setSelectedSoftware(selectedSoftware.filter((x) => x !== s))} className="ml-1 rounded-full hover:bg-primary-foreground/20 p-0.5">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                  )}
                  </div>
                }
              </div>
              {/* Skill Level Required */}
              <div className="space-y-2">
                <Label>Skill Level Required</Label>
                <p className="text-xs text-muted-foreground">What overall proficiency level does this project require?</p>
                <Select value={overallSkillLevel} onValueChange={(v) => setOverallSkillLevel(v as SkillLevel)}>
                  <SelectTrigger><SelectValue placeholder="Select skill level" /></SelectTrigger>
                  <SelectContent>
                    {levels.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
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
              {!budgetMin && !budgetMax &&
              <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                  💡 No budget set — this job will be listed as <span className="font-semibold text-foreground">Negotiable</span>.
                </p>
              }
              <div className="space-y-2">
                <Label>Delivery Timeline</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="e.g. 14"
                    min="1"
                    value={deliveryValue}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || parseInt(val) >= 1) setDeliveryValue(val);
                    }}
                    className="flex-1" />

                  <Select value={deliveryUnit} onValueChange={(v) => setDeliveryUnit(v as DurationUnit)}>
                    <SelectTrigger className="w-[120px]">
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
              





            </div>

            {/* Location */}
            <div className="bg-card rounded-xl border border-border p-6 space-y-6">
              <h2 className="text-lg font-semibold">Location</h2>
              <RadioGroup value={locationType} onValueChange={(v) => setLocationType(v as "remote" | "physical")} className="flex gap-6">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="remote" id="loc-remote" />
                  <Label htmlFor="loc-remote" className="cursor-pointer">Remote</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="physical" id="loc-physical" />
                  <Label htmlFor="loc-physical" className="cursor-pointer">Physical Location</Label>
                </div>
              </RadioGroup>
              {locationType === "physical" &&
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>State</Label>
                    <Select value={state} onValueChange={(v) => {setState(v);setCity("");}}>
                      <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                      <SelectContent>
                        {states.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Select value={city} onValueChange={setCity} disabled={!state}>
                      <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                      <SelectContent>
                        {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              }
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
                onChange={handleFileChange} />

              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={attachments.length >= 5}>
                <Paperclip className="h-4 w-4 mr-2" /> Add Files
              </Button>
              {attachments.length > 0 &&
              <div className="space-y-2">
                  {attachments.map((file, idx) =>
                <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 border border-border">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm flex-1 truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</span>
                      <X className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))} />
                    </div>
                )}
                </div>
              }
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={loading || uploading}>
              {loading || uploading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />{uploading ? "Uploading files..." : "Posting..."}</> : <><Plus className="h-4 w-4 mr-2" />Post Job</>}
            </Button>
          </form>
        </div>
      </main>
      <Footer />

      {/* Negotiable Budget Confirmation */}
      <Dialog open={showNegotiableConfirm} onOpenChange={setShowNegotiableConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>No Budget Set</DialogTitle>
            <DialogDescription>
              You haven't set a budget for this job. It will be listed as <span className="font-semibold">Negotiable</span> for experts to see. Are you sure you want to proceed?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNegotiableConfirm(false)}>Go Back & Set Budget</Button>
            <Button onClick={() => {setShowNegotiableConfirm(false);document.querySelector<HTMLFormElement>("form")?.requestSubmit();}}>
              Post as Negotiable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Experts Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Experts</DialogTitle>
            <DialogDescription>Search for experts to invite to this job.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name..." className="pl-9" value={expertSearch} onChange={(e) => searchExperts(e.target.value)} />
            </div>
            {searchingExperts && <div className="text-center py-4"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>}
            {expertResults.length > 0 &&
            <div className="space-y-2 max-h-60 overflow-y-auto">
                {expertResults.map((e) =>
              <button
                key={e.id}
                type="button"
                className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors flex items-center justify-between"
                onClick={() => {
                  setInvitedExperts([...invitedExperts, { id: e.id, full_name: e.full_name }]);
                  setExpertResults(expertResults.filter((x) => x.id !== e.id));
                }}>

                    <span className="text-sm font-medium">{e.full_name}</span>
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </button>
              )}
              </div>
            }
            {invitedExperts.length > 0 &&
            <div>
                <p className="text-xs text-muted-foreground mb-2">Invited ({invitedExperts.length}):</p>
                <div className="flex flex-wrap gap-2">
                  {invitedExperts.map((e) =>
                <Badge key={e.id} variant="default" className="gap-1 pr-1">
                      {e.full_name}
                      <button type="button" onClick={() => setInvitedExperts(invitedExperts.filter((x) => x.id !== e.id))} className="ml-1 rounded-full hover:bg-primary-foreground/20 p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                )}
                </div>
              </div>
            }
          </div>
          <DialogFooter>
            <Button onClick={() => setShowInviteDialog(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);

}