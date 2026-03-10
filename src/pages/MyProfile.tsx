import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AuthCodeInput } from "@/components/AuthCodeInput";
import { AuthCodeVerifyModal } from "@/components/AuthCodeVerifyModal";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cadSkills, cadSoftwareList, getAllStates, getCitiesByState } from "@/lib/nigerian-data";
import { Loader2, X, Save, Plus, Trash2, Award, Building2, ShieldCheck, ArrowLeft, AlertTriangle, Camera } from "lucide-react";

interface FreelancerProfile {
  id: string;
  user_id: string;
  title: string | null;
  bio: string | null;
  skills: string[] | null;
  hourly_rate: number | null;
  min_project_rate: number | null;
  years_experience: number | null;
  availability: "full_time" | "part_time" | "weekends" | "flexible" | null;
  show_whatsapp: boolean | null;
}

interface Certification {
  id?: string;
  name: string;
  issuer: string;
  year_obtained: string;
  credential_url: string;
}

interface WorkExp {
  id?: string;
  company: string;
  role: string;
  start_year: string;
  end_year: string;
  is_current: boolean;
  description: string;
}

export default function MyProfilePage() {
  const { user, profile, loading: authLoading, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [freelancerProfile, setFreelancerProfile] = useState<FreelancerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Form fields – general profile
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [occupation, setOccupation] = useState("");
  const [occupationError, setOccupationError] = useState("");

  // Form fields – freelancer
  const [title, setTitle] = useState("");
  const [bio, setBio] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [hourlyRate, setHourlyRate] = useState("");
  const [minProjectRate, setMinProjectRate] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [availability, setAvailability] = useState("flexible");
  const [showWhatsapp, setShowWhatsapp] = useState(false);

  // Certifications & Work Experience
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [workExperience, setWorkExperience] = useState<WorkExp[]>([]);
  const [deletedCertIds, setDeletedCertIds] = useState<string[]>([]);
  const [deletedExpIds, setDeletedExpIds] = useState<string[]>([]);
  const [authCode, setAuthCode] = useState("");
  const [hasAuthCode, setHasAuthCode] = useState(false);
  const [savingAuthCode, setSavingAuthCode] = useState(false);
  const [fullNameEdited, setFullNameEdited] = useState(false);
  const [usernameEdited, setUsernameEdited] = useState(false);

  // Skill input
  const [skillSearch, setSkillSearch] = useState("");
  const [showSkillDropdown, setShowSkillDropdown] = useState(false);

  // Delete account state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteChecking, setDeleteChecking] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDeleteAuthCode, setShowDeleteAuthCode] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const filteredSkills = cadSkills.filter(
    (s) => s.toLowerCase().includes(skillSearch.toLowerCase()) && !skills.includes(s)
  );
  const filteredSoftware = cadSoftwareList.filter(
    (s) => s.toLowerCase().includes(skillSearch.toLowerCase()) && !skills.includes(s)
  );
  const allSuggestions = [...filteredSkills, ...filteredSoftware].slice(0, 10);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
    if (user) {
      supabase.functions.invoke("auth-code", { body: { action: "check" } }).then(({ data }) => {
        setHasAuthCode(data?.has_code || false);
      });
    }
  }, [user, authLoading, navigate]);

  const fetchFreelancerProfile = useCallback(async () => {
    if (!user) return;
    try {
      const [fpRes, certsRes, expRes] = await Promise.all([
        supabase.from("freelancer_profiles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("certifications").select("*").eq("user_id", user.id).order("year_obtained", { ascending: false }),
        supabase.from("work_experience").select("*").eq("user_id", user.id).order("start_year", { ascending: false }),
      ]);

      if (fpRes.error) throw fpRes.error;
      setFreelancerProfile(fpRes.data);

      if (fpRes.data) {
        setTitle(fpRes.data.title || "");
        setBio(fpRes.data.bio || "");
        setSkills(fpRes.data.skills || []);
        setHourlyRate(fpRes.data.hourly_rate?.toString() || "");
        setMinProjectRate(fpRes.data.min_project_rate?.toString() || "");
        setYearsExperience(fpRes.data.years_experience?.toString() || "");
        setAvailability(fpRes.data.availability || "flexible");
        setShowWhatsapp(fpRes.data.show_whatsapp || false);
      }

      setCertifications((certsRes.data || []).map((c: any) => ({
        id: c.id, name: c.name, issuer: c.issuer || "", year_obtained: c.year_obtained?.toString() || "", credential_url: c.credential_url || "",
      })));

      setWorkExperience((expRes.data || []).map((e: any) => ({
        id: e.id, company: e.company, role: e.role, start_year: e.start_year?.toString() || "", end_year: e.end_year?.toString() || "", is_current: e.is_current, description: e.description || "",
      })));
    } catch (err) {
      console.error("Error fetching freelancer profile:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch edit-once flags
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name_edited, username_edited").eq("id", user.id).single().then(({ data }) => {
      if (data) {
        setFullNameEdited((data as any).full_name_edited || false);
        setUsernameEdited((data as any).username_edited || false);
      }
    });
  }, [user]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
      setWhatsapp(profile.whatsapp || "");
      setState(profile.state || "");
      setCity(profile.city || "");
      setAvatarUrl(profile.avatar_url || null);
    }
    if (user && profile?.role === "freelancer") {
      fetchFreelancerProfile();
    } else if (profile) {
      setLoading(false);
    }
  }, [profile, user, fetchFreelancerProfile]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 5MB for profile pictures.", variant: "destructive" });
      return;
    }
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const newUrl = `${data.publicUrl}?t=${Date.now()}`;
      await supabase.from("profiles").update({ avatar_url: newUrl }).eq("id", user.id);
      setAvatarUrl(newUrl);
      await refreshProfile();
      toast({ title: "Avatar updated!" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const addSkill = (skill: string) => {
    if (!skills.includes(skill)) setSkills([...skills, skill]);
    setSkillSearch("");
    setShowSkillDropdown(false);
  };

  const removeSkill = (skill: string) => setSkills(skills.filter((s) => s !== skill));

  const addCertification = () => setCertifications([...certifications, { name: "", issuer: "", year_obtained: "", credential_url: "" }]);

  const updateCert = (idx: number, field: keyof Certification, value: string) => {
    const updated = [...certifications];
    (updated[idx] as any)[field] = value;
    setCertifications(updated);
  };

  const removeCert = (idx: number) => {
    const cert = certifications[idx];
    if (cert.id) setDeletedCertIds(prev => [...prev, cert.id!]);
    setCertifications(certifications.filter((_, i) => i !== idx));
  };

  const addWorkExp = () => setWorkExperience([...workExperience, { company: "", role: "", start_year: "", end_year: "", is_current: false, description: "" }]);

  const updateExp = (idx: number, field: keyof WorkExp, value: any) => {
    const updated = [...workExperience];
    (updated[idx] as any)[field] = value;
    if (field === "is_current" && value) updated[idx].end_year = "";
    setWorkExperience(updated);
  };

  const removeExp = (idx: number) => {
    const exp = workExperience[idx];
    if (exp.id) setDeletedExpIds(prev => [...prev, exp.id!]);
    setWorkExperience(workExperience.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!user || !profile) return;
    setSaving(true);

    try {
      const profileUpdate: any = {
        phone: phone.trim() || null,
        whatsapp: whatsapp.trim() || null,
        state: state || null,
        city: city || null,
      };

      // Only allow full_name update if not yet edited (or if it was empty)
      if (!fullNameEdited && fullName.trim()) {
        profileUpdate.full_name = fullName.trim();
        profileUpdate.full_name_edited = true;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update(profileUpdate)
        .eq("id", user.id);

      if (profileError) throw profileError;

      if (profile.role === "freelancer") {
        const freelancerData = {
          user_id: user.id,
          title: title.trim() || null,
          bio: bio.trim() || null,
          skills,
          hourly_rate: hourlyRate ? parseInt(hourlyRate) : null,
          min_project_rate: minProjectRate ? parseInt(minProjectRate) : null,
          years_experience: yearsExperience ? parseInt(yearsExperience) : null,
          availability: availability as FreelancerProfile["availability"],
          show_whatsapp: showWhatsapp,
        };

        if (freelancerProfile) {
          const { error } = await supabase.from("freelancer_profiles").update(freelancerData).eq("id", freelancerProfile.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("freelancer_profiles").insert(freelancerData);
          if (error) throw error;
        }

        if (deletedCertIds.length > 0) await supabase.from("certifications").delete().in("id", deletedCertIds);
        for (const cert of certifications) {
          if (!cert.name.trim()) continue;
          const certData = { user_id: user.id, name: cert.name.trim(), issuer: cert.issuer.trim() || null, year_obtained: cert.year_obtained ? parseInt(cert.year_obtained) : null, credential_url: cert.credential_url.trim() || null };
          if (cert.id) { await supabase.from("certifications").update(certData).eq("id", cert.id); }
          else { await supabase.from("certifications").insert(certData); }
        }

        if (deletedExpIds.length > 0) await supabase.from("work_experience").delete().in("id", deletedExpIds);
        for (const exp of workExperience) {
          if (!exp.company.trim() || !exp.role.trim()) continue;
          const expData = { user_id: user.id, company: exp.company.trim(), role: exp.role.trim(), start_year: parseInt(exp.start_year) || new Date().getFullYear(), end_year: exp.is_current ? null : (exp.end_year ? parseInt(exp.end_year) : null), is_current: exp.is_current, description: exp.description.trim() || null };
          if (exp.id) { await supabase.from("work_experience").update(expData).eq("id", exp.id); }
          else { await supabase.from("work_experience").insert(expData); }
        }

        setDeletedCertIds([]);
        setDeletedExpIds([]);
      }

      await refreshProfile();
      toast({ title: "Profile updated", description: "Your changes have been saved." });
      
      // Redirect to view profile
      if (profile.role === "freelancer") {
        navigate(`/expert/${user.id}/profile`);
      } else {
        navigate("/dashboard");
      }
    } catch (err: any) {
      console.error("Error saving profile:", err);
      toast({ title: "Error", description: err.message || "Failed to save profile.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Delete account flow
  const handleDeleteAccountClick = async () => {
    setShowDeleteDialog(true);
    setDeleteError(null);
    setDeleteChecking(true);

    try {
      const { data: wallet } = await supabase.from("wallets").select("balance, escrow_balance").eq("user_id", user!.id).maybeSingle();
      if (wallet && ((wallet.balance || 0) + (wallet.escrow_balance || 0)) > 0) {
        setDeleteError("You have a remaining wallet balance. Please withdraw all funds before deleting your account.");
        setDeleteChecking(false);
        return;
      }

      const { count: activeContracts } = await supabase.from("contracts").select("id", { count: "exact", head: true })
        .or(`client_id.eq.${user!.id},freelancer_id.eq.${user!.id}`)
        .in("status", ["active", "pending_funding", "in_review", "draft", "interviewing"]);
      if ((activeContracts || 0) > 0) {
        setDeleteError("You have active contracts. Please complete or cancel them first.");
        setDeleteChecking(false);
        return;
      }

      const { count: activeJobs } = await supabase.from("jobs").select("id", { count: "exact", head: true })
        .eq("client_id", user!.id)
        .in("status", ["open", "in_progress"]);
      if ((activeJobs || 0) > 0) {
        setDeleteError("You have active job postings. Please close them first.");
        setDeleteChecking(false);
        return;
      }

      if (!hasAuthCode) {
        setDeleteError("You must set an authentication code before you can delete your account. Please set one above.");
        setDeleteChecking(false);
        return;
      }

      setDeleteChecking(false);
    } catch (err) {
      setDeleteError("Failed to verify account status. Please try again.");
      setDeleteChecking(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    setShowDeleteDialog(false);
    setShowDeleteAuthCode(true);
  };

  const handleDeleteAfterAuthCode = async () => {
    setDeleting(true);
    try {
      const { data, error } = await supabase.rpc("delete_user_account", { _user_id: user!.id });
      if (error) throw error;

      const result = data as any;
      if (!result.success) {
        toast({ title: "Cannot delete account", description: result.error, variant: "destructive" });
        setDeleting(false);
        return;
      }

      await signOut();
      toast({ title: "Account deleted", description: "Your account has been permanently deleted." });
      navigate("/");
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to delete account", variant: "destructive" });
      setDeleting(false);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "U";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !profile) return null;

  const isFreelancer = profile.role === "freelancer";
  const cities = state ? getCitiesByState(state) : [];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-wide max-w-3xl">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Edit Profile</h1>
            <p className="text-muted-foreground mt-1">
              {isFreelancer
                ? "Set up your freelancer profile to attract clients."
                : "Complete your profile to get the most out of ZentraGig."}
            </p>
          </div>

          <div className="space-y-8">
            {/* Avatar Upload */}
            <section className="bg-card rounded-xl border border-border p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Profile Picture</h2>
              <div className="flex items-center gap-6">
                <div className="relative group">
                  <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                    <AvatarImage src={avatarUrl || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                      {getInitials(fullName || profile.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="h-6 w-6 text-white animate-spin" />
                    ) : (
                      <Camera className="h-6 w-6 text-white" />
                    )}
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                </div>
                <div>
                  <Button type="button" variant="outline" size="sm" onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar}>
                    {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Camera className="h-4 w-4 mr-2" />}
                    {avatarUrl ? "Change Photo" : "Upload Photo"}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">JPG, PNG or WebP. Max 5MB.</p>
                </div>
              </div>
            </section>

            {/* General Info */}
            <section className="bg-card rounded-xl border border-border p-6 space-y-5">
              <h2 className="text-lg font-semibold text-foreground">General Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input 
                    id="fullName" 
                    value={fullName} 
                    onChange={(e) => setFullName(e.target.value)} 
                    maxLength={100} 
                    placeholder="Your full name" 
                    disabled={fullNameEdited && !!profile?.full_name}
                  />
                  {fullNameEdited && !!profile?.full_name && (
                    <p className="text-xs text-muted-foreground">Full name can only be set once. Contact support to change it.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input 
                    value={profile?.username || ""} 
                    disabled 
                  />
                  <p className="text-xs text-muted-foreground">Username cannot be changed after registration.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>State</Label>
                  <Select value={state} onValueChange={(v) => { setState(v); setCity(""); }}>
                    <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                    <SelectContent>{getAllStates().map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Select value={city} onValueChange={setCity} disabled={!state}>
                    <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                    <SelectContent>{cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* Freelancer-Specific */}
            {isFreelancer && (
              <>
                <section className="bg-card rounded-xl border border-border p-6 space-y-5">
                  <h2 className="text-lg font-semibold text-foreground">Professional Details</h2>
                  <div className="space-y-2">
                    <Label htmlFor="title">Professional Title</Label>
                    <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="e.g. Senior CAD Designer & BIM Specialist" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={1000} rows={5} placeholder="Describe your experience, specializations, and what makes you stand out..." />
                    <p className="text-xs text-muted-foreground text-right">{bio.length}/1000</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Skills & Software</Label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {skills.map((skill) => (
                        <Badge key={skill} variant="secondary" className="gap-1 pr-1">
                          {skill}
                          <button type="button" onClick={() => removeSkill(skill)} className="ml-1 rounded-full hover:bg-muted p-0.5">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <div className="relative">
                      <Input
                        value={skillSearch}
                        onChange={(e) => { setSkillSearch(e.target.value); setShowSkillDropdown(true); }}
                        onFocus={() => setShowSkillDropdown(true)}
                        placeholder="Search skills or software..."
                      />
                      {showSkillDropdown && skillSearch && allSuggestions.length > 0 && (
                        <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {allSuggestions.map((s) => (
                            <button key={s} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors" onClick={() => addSkill(s)}>{s}</button>
                          ))}
                        </div>
                      )}
                    </div>
                    {skillSearch && allSuggestions.length === 0 && (
                      <Button type="button" variant="outline" size="sm" className="mt-1" onClick={() => addSkill(skillSearch.trim())}>
                        <Plus className="h-3 w-3 mr-1" /> Add &quot;{skillSearch.trim()}&quot;
                      </Button>
                    )}
                  </div>
                </section>

                {/* Certifications */}
                <section className="bg-card rounded-xl border border-border p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <Award className="h-5 w-5 text-primary" /> Certifications
                    </h2>
                    <Button type="button" variant="outline" size="sm" onClick={addCertification}><Plus className="h-3 w-3 mr-1" /> Add</Button>
                  </div>
                  {certifications.length === 0 && <p className="text-sm text-muted-foreground">No certifications added yet.</p>}
                  {certifications.map((cert, idx) => (
                    <div key={idx} className="border border-border rounded-lg p-4 space-y-3 relative">
                      <button type="button" onClick={() => removeCert(idx)} className="absolute top-3 right-3 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1"><Label className="text-xs">Certification Name *</Label><Input value={cert.name} onChange={(e) => updateCert(idx, "name", e.target.value)} placeholder="e.g. AutoCAD Professional" /></div>
                        <div className="space-y-1"><Label className="text-xs">Issuing Organization</Label><Input value={cert.issuer} onChange={(e) => updateCert(idx, "issuer", e.target.value)} placeholder="e.g. Autodesk" /></div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1"><Label className="text-xs">Year Obtained</Label><Input type="number" value={cert.year_obtained} onChange={(e) => updateCert(idx, "year_obtained", e.target.value)} placeholder="e.g. 2023" min={1990} max={2030} /></div>
                        <div className="space-y-1"><Label className="text-xs">Credential URL</Label><Input value={cert.credential_url} onChange={(e) => updateCert(idx, "credential_url", e.target.value)} placeholder="https://..." /></div>
                      </div>
                    </div>
                  ))}
                </section>

                {/* Work Experience */}
                <section className="bg-card rounded-xl border border-border p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary" /> Work Experience
                    </h2>
                    <Button type="button" variant="outline" size="sm" onClick={addWorkExp}><Plus className="h-3 w-3 mr-1" /> Add</Button>
                  </div>
                  {workExperience.length === 0 && <p className="text-sm text-muted-foreground">No work experience added yet.</p>}
                  {workExperience.map((exp, idx) => (
                    <div key={idx} className="border border-border rounded-lg p-4 space-y-3 relative">
                      <button type="button" onClick={() => removeExp(idx)} className="absolute top-3 right-3 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1"><Label className="text-xs">Role / Title *</Label><Input value={exp.role} onChange={(e) => updateExp(idx, "role", e.target.value)} placeholder="e.g. Senior CAD Engineer" /></div>
                        <div className="space-y-1"><Label className="text-xs">Company *</Label><Input value={exp.company} onChange={(e) => updateExp(idx, "company", e.target.value)} placeholder="e.g. Acme Corp" /></div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1"><Label className="text-xs">Start Year *</Label><Input type="number" value={exp.start_year} onChange={(e) => updateExp(idx, "start_year", e.target.value)} placeholder="e.g. 2018" min={1970} max={2030} /></div>
                        <div className="space-y-1"><Label className="text-xs">End Year</Label><Input type="number" value={exp.end_year} onChange={(e) => updateExp(idx, "end_year", e.target.value)} placeholder="e.g. 2023" min={1970} max={2030} disabled={exp.is_current} /></div>
                        <div className="flex items-end pb-1">
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <Switch checked={exp.is_current} onCheckedChange={(v) => updateExp(idx, "is_current", v)} />
                            Current
                          </label>
                        </div>
                      </div>
                      <div className="space-y-1"><Label className="text-xs">Description</Label><Textarea value={exp.description} onChange={(e) => updateExp(idx, "description", e.target.value)} placeholder="Brief description..." rows={2} maxLength={500} /></div>
                    </div>
                  ))}
                </section>

                <section className="bg-card rounded-xl border border-border p-6 space-y-5">
                  <h2 className="text-lg font-semibold text-foreground">Rates & Availability</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label htmlFor="hourlyRate">Hourly Rate (₦)</Label><Input id="hourlyRate" type="number" min={0} value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} placeholder="e.g. 15000" /></div>
                    <div className="space-y-2"><Label htmlFor="minProjectRate">Min Project Rate (₦)</Label><Input id="minProjectRate" type="number" min={0} value={minProjectRate} onChange={(e) => setMinProjectRate(e.target.value)} placeholder="e.g. 50000" /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label htmlFor="yearsExperience">Years of Experience</Label><Input id="yearsExperience" type="number" min={0} max={50} value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)} placeholder="e.g. 5" /></div>
                    <div className="space-y-2">
                      <Label>Availability</Label>
                      <Select value={availability} onValueChange={setAvailability}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full_time">Full Time</SelectItem>
                          <SelectItem value="part_time">Part Time</SelectItem>
                          <SelectItem value="weekends">Weekends</SelectItem>
                          <SelectItem value="flexible">Flexible</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium text-foreground text-sm">Show WhatsApp on Profile</p>
                      <p className="text-xs text-muted-foreground">Allow clients to contact you directly via WhatsApp</p>
                    </div>
                    <Switch checked={showWhatsapp} onCheckedChange={setShowWhatsapp} />
                  </div>
                </section>
              </>
            )}

            {/* Auth Code Section */}
            <section className="bg-card rounded-xl border border-border p-6 space-y-5">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" /> Authentication Code
              </h2>
              {hasAuthCode ? (
                <div>
                  <p className="text-sm text-muted-foreground">✅ Your 6-digit authentication code is set. It's required for publishing contest winners, funding milestones, and withdrawals.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={async () => {
                    const current = prompt("Enter your current 6-digit code to reset:");
                    if (!current || current.length !== 6) return;
                    const { data } = await supabase.functions.invoke("auth-code", { body: { action: "reset", code: current } });
                    if (data?.success) { setHasAuthCode(false); toast({ title: "Auth code cleared", description: "You can now set a new code." }); }
                    else { toast({ title: "Error", description: data?.error || "Invalid code", variant: "destructive" }); }
                  }}>Reset Auth Code</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Set a 6-digit code to secure critical actions like publishing winners and making withdrawals.</p>
                  <AuthCodeInput value={authCode} onChange={setAuthCode} disabled={savingAuthCode} />
                  <Button onClick={async () => {
                    if (authCode.length !== 6) { toast({ title: "Enter all 6 digits", variant: "destructive" }); return; }
                    setSavingAuthCode(true);
                    const { data } = await supabase.functions.invoke("auth-code", { body: { action: "set", code: authCode } });
                    setSavingAuthCode(false);
                    if (data?.success) { setHasAuthCode(true); setAuthCode(""); toast({ title: "Auth code set!", description: "Your authentication code has been saved securely." }); }
                    else { toast({ title: "Error", description: data?.error || "Failed to set code", variant: "destructive" }); }
                  }} disabled={savingAuthCode || authCode.length !== 6} className="w-full">
                    {savingAuthCode ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                    Save Authentication Code
                  </Button>
                </div>
              )}
            </section>

            {/* Danger Zone - Delete Account */}
            <section className="bg-card rounded-xl border border-destructive/30 p-6 space-y-4">
              <h2 className="text-lg font-semibold text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" /> Danger Zone
              </h2>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
              <Button variant="destructive" onClick={handleDeleteAccountClick} disabled={deleting}>
                {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Delete Account
              </Button>
            </section>

            {/* Save */}
            <div className="flex justify-end gap-3 pb-8">
              <Button variant="outline" onClick={() => navigate("/dashboard")}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </main>
      <Footer />

      {/* Delete Account Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Account
            </DialogTitle>
            <DialogDescription>
              This will permanently delete your account, profile, and all associated data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {deleteChecking ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking account status...
              </div>
            ) : deleteError ? (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
                <p className="text-sm text-destructive font-medium">{deleteError}</p>
              </div>
            ) : (
              <p className="text-sm text-foreground">
                All checks passed. You will need to enter your authentication code to proceed.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteConfirmed} disabled={deleteChecking || !!deleteError}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auth Code Modal for Delete */}
      <AuthCodeVerifyModal
        open={showDeleteAuthCode}
        onOpenChange={setShowDeleteAuthCode}
        onVerified={handleDeleteAfterAuthCode}
        title="Confirm Account Deletion"
        description="Enter your 6-digit authentication code to permanently delete your account."
      />
    </div>
  );
}
