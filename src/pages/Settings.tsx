import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AuthCodeInput } from "@/components/AuthCodeInput";
import { AuthCodeVerifyModal } from "@/components/AuthCodeVerifyModal";
import { KycVerificationCard } from "@/components/KycVerificationCard";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/hooks/useCurrency";
import { supabase } from "@/integrations/supabase/client";
import { api } from "@/api/axios";
import {
  getMyProfileDeleteChecks, getMyProfileOverview,
  updateMyAvatarUrl, updateMyProfileData,
} from "@/api/profile.api";
import type { ProfileEmailPreferences, UpdateProfilePayload } from "@/types/profile";
import type { BankDetail, PaystackBank } from "@/types/wallet";
import { useToast } from "@/hooks/use-toast";
import { cadSkills, cadSoftwareList, getAllStates, getCitiesByState } from "@/lib/nigerian-data";
import {
  Loader2, X, Save, Plus, Trash2, Award, Building2, ShieldCheck,
  AlertTriangle, Camera, KeyRound, Building, CheckCircle2, Eye, EyeOff, Mail,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/* ─── email prefs ────────────────────────────────────────────────────── */

type EmailPrefs = ProfileEmailPreferences;

const DEFAULT_EMAIL_PREFS: EmailPrefs = {
  transactional: true,
  messages: true,
  proposals: true,
  job_alerts: true,
  job_alert_mode: "instant",
  contest_alerts: true,
  blog: false,
  platform_updates: true,
};

/* ─── types ─────────────────────────────────────────────────────────── */

interface FreelancerProfile {
  id: string; user_id: string; title: string | null; bio: string | null;
  skills: string[] | null; hourly_rate: number | null; min_project_rate: number | null;
  years_experience: number | null;
  availability: "full_time" | "part_time" | "weekends" | "flexible" | null;
  show_whatsapp: boolean | null;
}

interface Certification {
  id?: string; name: string; issuer: string; year_obtained: string; credential_url: string;
}

interface WorkExp {
  id?: string; company: string; role: string; start_year: string; end_year: string;
  is_current: boolean; description: string;
}

/* ─── main component ─────────────────────────────────────────────────── */

export default function SettingsPage() {
  const { user, profile, refreshProfile, signOut, bootstrapStatus } = useAuth();
  const { currency, setCurrency } = useCurrency();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "profile";

  /* ── profile state ── */
  const [freelancerProfile, setFreelancerProfile] = useState<FreelancerProfile | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [occupation, setOccupation] = useState("");
  const [occupationError, setOccupationError] = useState("");
  const [title, setTitle] = useState("");
  const [bio, setBio] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [hourlyRate, setHourlyRate] = useState("");
  const [minProjectRate, setMinProjectRate] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [availability, setAvailability] = useState("flexible");
  const [showWhatsapp, setShowWhatsapp] = useState(false);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [workExperience, setWorkExperience] = useState<WorkExp[]>([]);
  const [deletedCertIds, setDeletedCertIds] = useState<string[]>([]);
  const [deletedExpIds, setDeletedExpIds] = useState<string[]>([]);
  const [fullNameEdited, setFullNameEdited] = useState(false);
  const [skillSearch, setSkillSearch] = useState("");
  const [showSkillDropdown, setShowSkillDropdown] = useState(false);

  /* ── security state ── */
  const [authCode, setAuthCode] = useState("");
  const [hasAuthCode, setHasAuthCode] = useState(false);
  const [savingAuthCode, setSavingAuthCode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  /* ── delete account state ── */
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteChecking, setDeleteChecking] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDeleteAuthCode, setShowDeleteAuthCode] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /* ── email prefs state ── */
  const [emailPrefs, setEmailPrefs] = useState<EmailPrefs>(DEFAULT_EMAIL_PREFS);
  const [savingEmailPrefs, setSavingEmailPrefs] = useState(false);

  /* ── bank details state ── */
  const [bankDetails, setBankDetails] = useState<BankDetail[]>([]);
  const [banks, setBanks] = useState<PaystackBank[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [showAddBank, setShowAddBank] = useState(false);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [resolvedName, setResolvedName] = useState("");
  const [selectedBankName, setSelectedBankName] = useState("");
  const [resolving, setResolving] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [nameMismatch, setNameMismatch] = useState(false);
  const [deleteBankId, setDeleteBankId] = useState<string | null>(null);
  const [deletingBank, setDeletingBank] = useState(false);

  /* ── queries ── */
  const authCodeQuery = useQuery({
    queryKey: ["auth-code-status", user?.id],
    enabled: bootstrapStatus === "ready" && !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => { const res = await api.post("/auth/auth-code", { action: "check" }); return !!res.data?.has_code; },
  });

  const generalProfileQuery = useQuery({
    queryKey: ["my-profile-general", user?.id],
    enabled: bootstrapStatus === "ready" && !!user,
    staleTime: 2 * 60 * 1000,
    placeholderData: (p) => p,
    queryFn: async () => { const data = await getMyProfileOverview(); return data.generalProfile; },
  });

  const freelancerBundleQuery = useQuery({
    queryKey: ["my-profile-freelancer-bundle", user?.id],
    enabled: bootstrapStatus === "ready" && !!user && profile?.role === "freelancer",
    staleTime: 2 * 60 * 1000,
    placeholderData: (p) => p,
    queryFn: async () => {
      const data = await getMyProfileOverview();
      return {
        freelancerProfile: data.freelancerProfile ?? null,
        certifications: (data.certifications || []).map((c) => ({
          id: c.id, name: c.name, issuer: c.issuer || "", year_obtained: c.year_obtained?.toString() || "", credential_url: c.credential_url || "",
        })),
        workExperience: (data.workExperience || []).map((e) => ({
          id: e.id, company: e.company, role: e.role, start_year: e.start_year?.toString() || "", end_year: e.end_year?.toString() || "", is_current: e.is_current, description: e.description || "",
        })),
      };
    },
  });

  /* ── effects ── */
  useEffect(() => { if (typeof authCodeQuery.data === "boolean") setHasAuthCode(authCodeQuery.data); }, [authCodeQuery.data]);

  useEffect(() => {
    if (!user) return;
    getMyProfileOverview().then((data) => {
      if (data.editFlags) setFullNameEdited(data.editFlags.full_name_edited || false);
    });
  }, [user]);

  useEffect(() => {
    setLoadingError(null);
    const gp = generalProfileQuery.data;
    if (gp || profile) {
      setFullName(gp?.full_name || profile?.full_name || "");
      setPhone(gp?.phone || "");
      setWhatsapp(gp?.whatsapp || "");
      setState(gp?.state || "");
      setCity(gp?.city || "");
      setAvatarUrl(gp?.avatar_url || profile?.avatar_url || null);
      setOccupation(gp?.occupation || "");
      const ep = gp?.email_preferences;
      if (ep) setEmailPrefs({ ...DEFAULT_EMAIL_PREFS, ...ep });
    }
  }, [generalProfileQuery.data, profile]);

  useEffect(() => {
    if (profile?.role !== "freelancer") { setFreelancerProfile(null); setCertifications([]); setWorkExperience([]); return; }
    if (freelancerBundleQuery.error) { setLoadingError("Could not load freelancer details."); return; }
    if (!freelancerBundleQuery.data) return;
    setFreelancerProfile(freelancerBundleQuery.data.freelancerProfile);
    setCertifications(freelancerBundleQuery.data.certifications);
    setWorkExperience(freelancerBundleQuery.data.workExperience);
    if (freelancerBundleQuery.data.freelancerProfile) {
      const fp = freelancerBundleQuery.data.freelancerProfile;
      setTitle(fp.title || ""); setBio(fp.bio || ""); setSkills(fp.skills || []);
      setHourlyRate(fp.hourly_rate?.toString() || ""); setMinProjectRate(fp.min_project_rate?.toString() || "");
      setYearsExperience(fp.years_experience?.toString() || ""); setAvailability(fp.availability || "flexible");
      setShowWhatsapp(fp.show_whatsapp || false);
    }
  }, [freelancerBundleQuery.data, freelancerBundleQuery.error, profile?.role]);

  useEffect(() => {
    if (activeTab === "payment") fetchBankDetails();
  }, [activeTab]);

  /* ── avatar ── */
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast({ title: "File too large", description: "Max 5MB.", variant: "destructive" }); return; }
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const newUrl = `${data.publicUrl}?t=${Date.now()}`;
      await updateMyAvatarUrl(newUrl);
      setAvatarUrl(newUrl);
      toast({ title: "Photo updated!" });
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Failed to upload avatar.", variant: "destructive" });
    } finally { setUploadingAvatar(false); }
  };

  /* ── skills ── */
  const filteredSuggestions = [...cadSkills, ...cadSoftwareList]
    .filter((s) => s.toLowerCase().includes(skillSearch.toLowerCase()) && !skills.includes(s))
    .slice(0, 10);
  const addSkill = (s: string) => { if (!skills.includes(s)) setSkills([...skills, s]); setSkillSearch(""); setShowSkillDropdown(false); };
  const removeSkill = (s: string) => setSkills(skills.filter((x) => x !== s));

  /* ── certs / work exp ── */
  const addCertification = () => setCertifications([...certifications, { name: "", issuer: "", year_obtained: "", credential_url: "" }]);
  const updateCert = (idx: number, field: keyof Certification, value: string) => { const u = [...certifications]; u[idx] = { ...u[idx], [field]: value }; setCertifications(u); };
  const removeCert = (idx: number) => { const c = certifications[idx]; if (c.id) setDeletedCertIds((p) => [...p, c.id!]); setCertifications(certifications.filter((_, i) => i !== idx)); };
  const addWorkExp = () => setWorkExperience([...workExperience, { company: "", role: "", start_year: "", end_year: "", is_current: false, description: "" }]);
  const updateExp = (idx: number, field: keyof WorkExp, value: string | boolean) => { const u = [...workExperience]; u[idx] = { ...u[idx], [field]: value }; if (field === "is_current" && value) u[idx].end_year = ""; setWorkExperience(u); };
  const removeExp = (idx: number) => { const e = workExperience[idx]; if (e.id) setDeletedExpIds((p) => [...p, e.id!]); setWorkExperience(workExperience.filter((_, i) => i !== idx)); };

  /* ── save profile ── */
  const handleSave = async () => {
    if (!user || !profile) return;
    setSaving(true);
    try {
      const wordCount = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
      if (occupation.trim() && wordCount(occupation) > 5) { setOccupationError("Maximum 5 words allowed"); setSaving(false); return; }
      setOccupationError("");
      const payload: UpdateProfilePayload = {
        phone: phone.trim() || null, whatsapp: whatsapp.trim() || null,
        state: state || null, city: city || null, occupation: occupation.trim() || null,
        fullName: (!fullNameEdited && fullName.trim()) ? fullName.trim() : undefined,
        fullNameEdited, role: profile.role,
      };
      if (profile.role === "freelancer") {
        payload.freelancerProfileId = freelancerProfile?.id || null;
        payload.freelancerData = { title: title.trim() || null, bio: bio.trim() || null, skills, hourly_rate: hourlyRate ? parseInt(hourlyRate) : null, min_project_rate: minProjectRate ? parseInt(minProjectRate) : null, years_experience: yearsExperience ? parseInt(yearsExperience) : null, availability: availability as FreelancerProfile["availability"], show_whatsapp: showWhatsapp };
        payload.deletedCertIds = deletedCertIds; payload.deletedExpIds = deletedExpIds;
        payload.certifications = certifications.map((c) => ({ id: c.id, name: c.name.trim(), issuer: c.issuer.trim() || null, year_obtained: c.year_obtained ? parseInt(c.year_obtained) : null, credential_url: c.credential_url.trim() || null }));
        payload.workExperience = workExperience.map((e) => ({ id: e.id, company: e.company.trim(), role: e.role.trim(), start_year: parseInt(e.start_year) || new Date().getFullYear(), end_year: e.is_current ? null : (e.end_year ? parseInt(e.end_year) : null), is_current: e.is_current, description: e.description.trim() || null }));
      }
      await updateMyProfileData(payload);
      setDeletedCertIds([]); setDeletedExpIds([]);
      await refreshProfile();
      await queryClient.invalidateQueries({ queryKey: ["my-profile-general", user.id] });
      await queryClient.invalidateQueries({ queryKey: ["my-profile-freelancer-bundle", user.id] });
      toast({ title: "Profile saved" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to save profile.", variant: "destructive" });
    } finally { setSaving(false); }
  };

  /* ── save email prefs ── */
  const handleSaveEmailPrefs = async () => {
    setSavingEmailPrefs(true);
    try {
      await updateMyProfileData({ emailPreferences: emailPrefs });
      await queryClient.invalidateQueries({ queryKey: ["my-profile-general", user?.id] });
      toast({ title: "Email preferences saved" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to save preferences.", variant: "destructive" });
    } finally {
      setSavingEmailPrefs(false);
    }
  };

  /* ── change password ── */
  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 8) { toast({ title: "Password must be at least 8 characters", variant: "destructive" }); return; }
    if (newPassword !== confirmPassword) { toast({ title: "Passwords do not match", variant: "destructive" }); return; }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword(""); setConfirmPassword("");
      toast({ title: "Password updated successfully" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to update password", variant: "destructive" });
    } finally { setSavingPassword(false); }
  };

  /* ── delete account ── */
  const handleDeleteAccountClick = async () => {
    setShowDeleteDialog(true); setDeleteError(null); setDeleteChecking(true);
    try {
      const checks = await getMyProfileDeleteChecks();
      if ((checks.walletBalance || 0) > 0) { setDeleteError("You have a remaining wallet balance. Please withdraw all funds first."); setDeleteChecking(false); return; }
      if ((checks.activeContracts || 0) > 0) { setDeleteError("You have active contracts. Please complete or cancel them first."); setDeleteChecking(false); return; }
      if ((checks.activeJobs || 0) > 0) { setDeleteError("You have active job postings. Please close them first."); setDeleteChecking(false); return; }
      if (!checks.hasAuthCode && !hasAuthCode) { setDeleteError("You must set an authentication code before deleting your account."); setDeleteChecking(false); return; }
      setDeleteChecking(false);
    } catch { setDeleteError("Failed to verify account status. Please try again."); setDeleteChecking(false); }
  };

  const handleDeleteAfterAuthCode = async () => {
    setDeleting(true);
    try {
      const { data, error } = await supabase.rpc("delete_user_account", { _user_id: user!.id });
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result.success) { toast({ title: "Cannot delete account", description: result.error, variant: "destructive" }); setDeleting(false); return; }
      toast({ title: "Account deleted" });
      signOut();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to delete account", variant: "destructive" });
      setDeleting(false);
    }
  };

  /* ── bank details ── */
  const fetchBankDetails = async () => {
    try {
      const res = await api.post("/wallet/paystack-transfer", { action: "list_bank_details" });
      if (res.data?.success) setBankDetails(res.data.bank_details || []);
    } catch { /* silent */ }
  };

  const fetchBanks = async () => {
    if (banks.length > 0) return;
    setLoadingBanks(true);
    try {
      const res = await api.post("/wallet/paystack-transfer", { action: "list_banks" });
      if (res.data?.banks) {
        const seen = new Set<string>();
        setBanks((res.data.banks as PaystackBank[]).filter((b) => { if (seen.has(b.code)) return false; seen.add(b.code); return true; }));
      }
    } catch { /* silent */ }
    setLoadingBanks(false);
  };

  const resolveAccount = async () => {
    if (accountNumber.length !== 10 || !bankCode) return;
    setResolving(true);
    try {
      const res = await api.post("/wallet/paystack-transfer", { action: "resolve_account", account_number: accountNumber, bank_code: bankCode });
      if (res.data?.success && res.data.data?.account_name) {
        const resolved = res.data.data.account_name as string;
        setResolvedName(resolved);
        if (fullName) {
          const norm = (s: string) => s.toLowerCase().trim().split(/\s+/).filter((p) => p.length >= 2);
          const matches = norm(fullName).filter((p) => norm(resolved).includes(p)).length;
          setNameMismatch(matches < 2);
        }
      } else {
        toast({ title: "Could not resolve account", description: "Check the details and try again.", variant: "destructive" });
        setResolvedName("");
        setNameMismatch(false);
      }
    } catch {
      toast({ title: "Could not resolve account", variant: "destructive" });
      setResolvedName("");
      setNameMismatch(false);
    }
    setResolving(false);
  };

  // Auto-resolve when account number reaches 10 digits and a bank is selected
  useEffect(() => {
    if (accountNumber.length === 10 && bankCode) {
      resolveAccount();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountNumber, bankCode]);

  const saveBankDetails = async () => {
    if (!resolvedName || !bankCode || !accountNumber) { toast({ title: "Resolve your account first", variant: "destructive" }); return; }
    setSavingBank(true);
    try {
      const res = await api.post("/wallet/paystack-transfer", { action: "save_bank", account_number: accountNumber, bank_code: bankCode, bank_name: selectedBankName, account_name: resolvedName });
      if (res.data?.success) {
        toast({ title: "Bank account saved" });
        const saved = res.data.bank_detail as BankDetail;
        setBankDetails((prev) => [saved, ...prev.filter((b) => b.id !== saved.id).map((b) => ({ ...b, is_default: false }))]);
        setShowAddBank(false); setBankCode(""); setAccountNumber(""); setResolvedName(""); setSelectedBankName("");
      } else { toast({ title: "Error", description: res.data?.error || "Failed to save bank details", variant: "destructive" }); }
    } catch (err) { toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to save", variant: "destructive" }); }
    setSavingBank(false);
  };

  const deleteBankAccount = async () => {
    if (!deleteBankId) return;
    setDeletingBank(true);
    try {
      await api.post("/wallet/paystack-transfer", { action: "delete_bank", bank_detail_id: deleteBankId });
      setBankDetails((prev) => {
        const remaining = prev.filter((b) => b.id !== deleteBankId);
        // If the deleted one was default and there are others, mark the first as default
        const deletedWasDefault = prev.find((b) => b.id === deleteBankId)?.is_default;
        if (deletedWasDefault && remaining.length > 0) remaining[0].is_default = true;
        return remaining;
      });
      toast({ title: "Bank account removed" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to remove account", variant: "destructive" });
    }
    setDeletingBank(false);
    setDeleteBankId(null);
  };

  /* ── helpers ── */
  const getInitials = (name: string | null) => { if (!name) return "U"; return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2); };
  const cities = state ? getCitiesByState(state) : [];
  const isFreelancer = profile?.role === "freelancer";

  /* ── loading / error states ── */
  const showInitialLoad = bootstrapStatus === "loading" || (isFreelancer && freelancerBundleQuery.isPending && !freelancerBundleQuery.data);

  if (showInitialLoad) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 bg-muted/30 py-4 sm:py-8">
          <div className="w-full min-w-0 max-w-4xl mx-auto px-4 sm:px-6 space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!user || bootstrapStatus !== "ready" || !profile) return null;

  /* ═══════════════════════════════════════════════════════════════════ */

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-4 sm:py-8">
        <div className="w-full min-w-0 max-w-4xl mx-auto px-4 sm:px-6">

          <div className="mb-4 sm:mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Account Settings</h1>
            <p className="text-muted-foreground mt-1 text-sm">Manage your profile, security, and payment details.</p>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(v) => setSearchParams({ tab: v })}
          >
            <TabsList className="mb-4 sm:mb-6 w-full">
              <TabsTrigger value="profile" className="flex-1">Profile</TabsTrigger>
              <TabsTrigger value="security" className="flex-1">Security</TabsTrigger>
              <TabsTrigger value="payment" className="flex-1">Payment</TabsTrigger>
              <TabsTrigger value="emails" className="flex-1">Emails</TabsTrigger>
            </TabsList>

            {/* ══════════════ PROFILE TAB ══════════════ */}
            <TabsContent value="profile" className="space-y-4 sm:space-y-8 mt-0">

              {/* Avatar */}
              <section className="bg-card rounded-xl border border-border p-4 sm:p-6">
                <h2 className="text-base font-semibold text-foreground mb-4">Profile Picture</h2>
                <div className="flex items-center gap-4">
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
                      {uploadingAvatar ? <Loader2 className="h-6 w-6 text-white animate-spin" /> : <Camera className="h-6 w-6 text-white" />}
                    </button>
                    <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleAvatarUpload} />
                  </div>
                  <div>
                    <Button type="button" variant="outline" size="sm" onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar}>
                      {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Camera className="h-4 w-4 mr-2" />}
                      {avatarUrl ? "Change Photo" : "Upload Photo"}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">JPG, PNG or WebP · Max 5 MB</p>
                  </div>
                </div>
              </section>

              {/* General info */}
              <section className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-5">
                <h2 className="text-base font-semibold text-foreground">General Information</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} placeholder="Your full name" disabled={fullNameEdited && !!profile.full_name} />
                    {fullNameEdited && !!profile.full_name && <p className="text-xs text-muted-foreground">Can only be set once. Contact support to change it.</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Username</Label>
                    <Input value={profile.username || ""} disabled />
                    <p className="text-xs text-muted-foreground">Cannot be changed after registration.</p>
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
                <div className="space-y-2">
                  <Label>Occupation <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input value={occupation} onChange={(e) => { setOccupation(e.target.value); setOccupationError(""); }} maxLength={50}
                    placeholder={isFreelancer ? "e.g. Engineer, Technician, Student" : "e.g. Project Manager"}
                    className={occupationError ? "border-destructive" : ""} />
                  <p className="text-xs text-muted-foreground">Max 5 words</p>
                  {occupationError && <p className="text-sm text-destructive">{occupationError}</p>}
                </div>
              </section>

              {/* Freelancer-specific sections */}
              {isFreelancer && (
                <>
                  <section className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-5">
                    <h2 className="text-base font-semibold text-foreground">Professional Details</h2>
                    <div className="space-y-2">
                      <Label htmlFor="title">Professional Title</Label>
                      <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="e.g. Senior CAD Designer & BIM Specialist" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={1000} rows={5} placeholder="Describe your experience and specialisations..." />
                      <p className="text-xs text-muted-foreground text-right">{bio.length}/1000</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Skills & Software</Label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {skills.map((s) => (
                          <Badge key={s} variant="secondary" className="gap-1 pr-1">
                            {s}
                            <button type="button" onClick={() => removeSkill(s)} className="ml-1 rounded-full hover:bg-muted p-0.5"><X className="h-3 w-3" /></button>
                          </Badge>
                        ))}
                      </div>
                      <div className="relative">
                        <Input value={skillSearch} onChange={(e) => { setSkillSearch(e.target.value); setShowSkillDropdown(true); }} onFocus={() => setShowSkillDropdown(true)} placeholder="Search skills or software..." />
                        {showSkillDropdown && skillSearch && filteredSuggestions.length > 0 && (
                          <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {filteredSuggestions.map((s) => (
                              <button key={s} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted" onClick={() => addSkill(s)}>{s}</button>
                            ))}
                          </div>
                        )}
                      </div>
                      {skillSearch && filteredSuggestions.length === 0 && (
                        <Button type="button" variant="outline" size="sm" className="mt-1" onClick={() => addSkill(skillSearch.trim())}>
                          <Plus className="h-3 w-3 mr-1" /> Add &quot;{skillSearch.trim()}&quot;
                        </Button>
                      )}
                    </div>
                  </section>

                  <section className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-5">
                    <h2 className="text-base font-semibold text-foreground">Rates & Availability</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Hourly Rate (₦)</Label><Input type="number" min={0} value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} placeholder="e.g. 15000" /></div>
                      <div className="space-y-2"><Label>Min Project Rate (₦)</Label><Input type="number" min={0} value={minProjectRate} onChange={(e) => setMinProjectRate(e.target.value)} placeholder="e.g. 50000" /></div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Years of Experience</Label><Input type="number" min={0} max={50} value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)} placeholder="e.g. 5" /></div>
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
                        <p className="font-medium text-sm">Show WhatsApp on Profile</p>
                        <p className="text-xs text-muted-foreground">Allow clients to contact you directly via WhatsApp</p>
                      </div>
                      <Switch checked={showWhatsapp} onCheckedChange={setShowWhatsapp} />
                    </div>
                  </section>

                  {/* Certifications */}
                  <section className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-5">
                    <div className="flex items-center justify-between">
                      <h2 className="text-base font-semibold text-foreground flex items-center gap-2"><Award className="h-4 w-4 text-primary" /> Certifications</h2>
                      <Button type="button" variant="outline" size="sm" onClick={addCertification}><Plus className="h-3 w-3 mr-1" /> Add</Button>
                    </div>
                    {certifications.length === 0 && <p className="text-sm text-muted-foreground">No certifications added yet.</p>}
                    {certifications.map((cert, idx) => (
                      <div key={idx} className="border border-border rounded-lg p-4 space-y-3 relative">
                        <button type="button" onClick={() => removeCert(idx)} className="absolute top-3 right-3 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1"><Label className="text-xs">Name *</Label><Input value={cert.name} onChange={(e) => updateCert(idx, "name", e.target.value)} placeholder="e.g. AutoCAD Professional" /></div>
                          <div className="space-y-1"><Label className="text-xs">Issuer</Label><Input value={cert.issuer} onChange={(e) => updateCert(idx, "issuer", e.target.value)} placeholder="e.g. Autodesk" /></div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1"><Label className="text-xs">Year</Label><Input type="number" value={cert.year_obtained} onChange={(e) => updateCert(idx, "year_obtained", e.target.value)} placeholder="e.g. 2023" min={1990} max={2030} /></div>
                          <div className="space-y-1"><Label className="text-xs">Credential URL</Label><Input value={cert.credential_url} onChange={(e) => updateCert(idx, "credential_url", e.target.value)} placeholder="https://..." /></div>
                        </div>
                      </div>
                    ))}
                  </section>

                  {/* Work Experience */}
                  <section className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-5">
                    <div className="flex items-center justify-between">
                      <h2 className="text-base font-semibold text-foreground flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Work Experience</h2>
                      <Button type="button" variant="outline" size="sm" onClick={addWorkExp}><Plus className="h-3 w-3 mr-1" /> Add</Button>
                    </div>
                    {workExperience.length === 0 && <p className="text-sm text-muted-foreground">No work experience added yet.</p>}
                    {workExperience.map((exp, idx) => (
                      <div key={idx} className="border border-border rounded-lg p-4 space-y-3 relative">
                        <button type="button" onClick={() => removeExp(idx)} className="absolute top-3 right-3 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1"><Label className="text-xs">Role *</Label><Input value={exp.role} onChange={(e) => updateExp(idx, "role", e.target.value)} placeholder="e.g. Senior CAD Engineer" /></div>
                          <div className="space-y-1"><Label className="text-xs">Company *</Label><Input value={exp.company} onChange={(e) => updateExp(idx, "company", e.target.value)} placeholder="e.g. Acme Corp" /></div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1"><Label className="text-xs">Start Year *</Label><Input type="number" value={exp.start_year} onChange={(e) => updateExp(idx, "start_year", e.target.value)} placeholder="2018" min={1970} max={2030} /></div>
                          <div className="space-y-1"><Label className="text-xs">End Year</Label><Input type="number" value={exp.end_year} onChange={(e) => updateExp(idx, "end_year", e.target.value)} placeholder="2023" min={1970} max={2030} disabled={exp.is_current} /></div>
                          <div className="flex items-end pb-1">
                            <label className="flex items-center gap-2 text-sm cursor-pointer"><Switch checked={exp.is_current} onCheckedChange={(v) => updateExp(idx, "is_current", v)} /> Current</label>
                          </div>
                        </div>
                        <div className="space-y-1"><Label className="text-xs">Description</Label><Textarea value={exp.description} onChange={(e) => updateExp(idx, "description", e.target.value)} rows={2} maxLength={500} /></div>
                      </div>
                    ))}
                  </section>
                </>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pb-4 sm:pb-8">
                <Button variant="outline" className="w-full sm:w-auto" onClick={() => navigate(-1)}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Profile
                </Button>
              </div>
            </TabsContent>

            {/* ══════════════ SECURITY TAB ══════════════ */}
            <TabsContent value="security" className="space-y-4 sm:space-y-8 mt-0">

              {/* Change Password */}
              <section className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-5">
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-primary" /> Change Password
                </h2>
                <div className="space-y-4 max-w-sm">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Input id="newPassword" type={showNewPw ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 8 characters" className="pr-10" />
                      <button type="button" onClick={() => setShowNewPw((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <div className="relative">
                      <Input id="confirmPassword" type={showConfirmPw ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat new password" className="pr-10" />
                      <button type="button" onClick={() => setShowConfirmPw((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button onClick={handleChangePassword} disabled={savingPassword || !newPassword || !confirmPassword}>
                    {savingPassword ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
                    Update Password
                  </Button>
                </div>
              </section>

              {/* Auth Code */}
              <section className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-5">
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Authentication Code
                </h2>
                {hasAuthCode ? (
                  <div>
                    <p className="text-sm text-muted-foreground">✅ Your 6-digit authentication code is set. It's required for publishing contest winners, funding milestones, and withdrawals.</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={async () => {
                      const current = prompt("Enter your current 6-digit code to reset:");
                      if (!current || current.length !== 6) return;
                      try {
                        const res = await api.post("/auth/auth-code", { action: "reset", code: current });
                        if (res.data?.success) { setHasAuthCode(false); toast({ title: "Auth code cleared. Set a new one below." }); }
                        else toast({ title: "Error", description: res.data?.error || "Invalid code", variant: "destructive" });
                      } catch (err) { toast({ title: "Error", description: err instanceof Error ? err.message : "Invalid code", variant: "destructive" }); }
                    }}>Reset Auth Code</Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">Set a 6-digit code to secure critical actions like publishing winners and making withdrawals.</p>
                    <AuthCodeInput value={authCode} onChange={setAuthCode} disabled={savingAuthCode} />
                    <Button onClick={async () => {
                      if (authCode.length !== 6) { toast({ title: "Enter all 6 digits", variant: "destructive" }); return; }
                      setSavingAuthCode(true);
                      try {
                        const res = await api.post("/auth/auth-code", { action: "set", code: authCode });
                        if (res.data?.success) { setHasAuthCode(true); setAuthCode(""); toast({ title: "Auth code saved!" }); }
                        else toast({ title: "Error", description: res.data?.error || "Failed to set code", variant: "destructive" });
                      } catch (err) { toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to set code", variant: "destructive" }); }
                      setSavingAuthCode(false);
                    }} disabled={savingAuthCode || authCode.length !== 6}>
                      {savingAuthCode ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                      Save Authentication Code
                    </Button>
                  </div>
                )}
              </section>

              {/* Danger Zone */}
              <section className="bg-card rounded-xl border border-destructive/30 p-6 space-y-4">
                <h2 className="text-base font-semibold text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Danger Zone
                </h2>
                <p className="text-sm text-muted-foreground">Permanently delete your account and all associated data. This cannot be undone.</p>
                <Button variant="destructive" onClick={handleDeleteAccountClick} disabled={deleting}>
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                  Delete Account
                </Button>
              </section>
            </TabsContent>

            {/* ══════════════ PAYMENT TAB ══════════════ */}
            <TabsContent value="payment" className="space-y-4 sm:space-y-8 mt-0">

              {/* KYC */}
              <section className="bg-card rounded-xl border border-border overflow-hidden">
                <KycVerificationCard />
              </section>

              {/* Currency */}
              <section className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-4">
                <h2 className="text-base font-semibold text-foreground">Display Currency</h2>
                <p className="text-sm text-muted-foreground">Choose how prices and amounts are displayed. All values are stored in NGN.</p>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-medium ${currency === "NGN" ? "text-foreground" : "text-muted-foreground"}`}>₦ NGN</span>
                  <Switch checked={currency === "USD"} onCheckedChange={(checked) => void setCurrency(checked ? "USD" : "NGN")} />
                  <span className={`text-sm font-medium ${currency === "USD" ? "text-foreground" : "text-muted-foreground"}`}>$ USD</span>
                </div>
              </section>

              {/* Bank Details */}
              <section className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Building className="h-4 w-4 text-primary" /> Saved Bank Accounts
                  </h2>
                  {!showAddBank && (
                    <Button size="sm" variant="outline" onClick={() => { setShowAddBank(true); fetchBanks(); }}>
                      <Plus className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Add Account</span>
                    </Button>
                  )}
                </div>

                {bankDetails.length === 0 && !showAddBank && (
                  <p className="text-sm text-muted-foreground">No bank accounts saved yet. Add one to enable withdrawals.</p>
                )}

                {bankDetails.map((b) => (
                  <div key={b.id} className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
                    <div>
                      <p className="text-sm font-medium">{b.account_name}</p>
                      <p className="text-xs text-muted-foreground">{b.bank_name} · {b.account_number}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {b.is_default && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <CheckCircle2 className="h-3 w-3 text-primary" /> Default
                        </Badge>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteBankId(b.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {showAddBank && (
                  <div className="border border-border rounded-lg p-4 sm:p-5 space-y-4">
                    <h3 className="text-sm font-semibold">Add New Bank Account (NGN)</h3>
                    <div className="space-y-2">
                      <Label className="text-xs">Bank</Label>
                      {loadingBanks ? (
                        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading banks...</div>
                      ) : (
                        <Select value={bankCode} onValueChange={(v) => { setBankCode(v); setSelectedBankName(banks.find((b) => b.code === v)?.name || ""); setResolvedName(""); }}>
                          <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                          <SelectContent className="max-h-60">
                            {banks.map((b) => <SelectItem key={b.code} value={b.code}>{b.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Account Number</Label>
                      <div className="relative">
                        <Input
                          value={accountNumber}
                          onChange={(e) => { setAccountNumber(e.target.value); setResolvedName(""); setNameMismatch(false); }}
                          maxLength={10}
                          placeholder="10-digit account number"
                          className={resolving ? "pr-9" : ""}
                        />
                        {resolving && (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
                        )}
                      </div>
                    </div>
                    {resolvedName && (
                      <div className="flex items-center gap-2 text-sm text-primary font-medium">
                        <CheckCircle2 className="h-4 w-4" /> {resolvedName}
                      </div>
                    )}
                    {nameMismatch && resolvedName && (
                      <div className="flex gap-2 rounded-lg border border-yellow-400/50 bg-yellow-50/70 dark:bg-yellow-900/20 p-3 text-sm text-yellow-800 dark:text-yellow-300">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>
                          The account name <strong>{resolvedName}</strong> doesn't closely match your profile name <strong>{fullName}</strong>. Make sure this account belongs to you.
                        </span>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveBankDetails} disabled={savingBank || !resolvedName}>
                        {savingBank ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Save Account
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setShowAddBank(false); setBankCode(""); setAccountNumber(""); setResolvedName(""); setNameMismatch(false); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </section>

              <AlertDialog open={!!deleteBankId} onOpenChange={(open) => { if (!open) setDeleteBankId(null); }}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove bank account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This account will be removed from your saved accounts. Any pending withdrawals using it won't be affected.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deletingBank}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={deleteBankAccount}
                      disabled={deletingBank}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deletingBank ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </TabsContent>
            {/* ══════════════ EMAILS TAB ══════════════ */}
            <TabsContent value="emails" className="space-y-4 sm:space-y-6 mt-0">

              <div className="flex items-start gap-3 bg-muted/50 border border-border rounded-xl p-4">
                <Mail className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Email Notification Preferences</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Control which emails ZentraGig sends you. You can always unsubscribe from any email using the link in the footer.</p>
                </div>
              </div>

              {/* Contract & Work */}
              <section className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-1">
                <h2 className="text-sm font-semibold text-foreground mb-3">Contract & Work</h2>
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <div>
                    <p className="text-sm font-medium">Contract & milestone emails</p>
                    <p className="text-xs text-muted-foreground">Get emailed when you're hired, a milestone is funded, approved, rejected, or a dispute is filed.</p>
                  </div>
                  <Switch
                    checked={emailPrefs.transactional}
                    onCheckedChange={(v) => setEmailPrefs((p) => ({ ...p, transactional: v }))}
                  />
                </div>
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <div>
                    <p className="text-sm font-medium">Message notifications</p>
                    <p className="text-xs text-muted-foreground">Get emailed when you receive a new message from your client or expert on a contract.</p>
                  </div>
                  <Switch
                    checked={emailPrefs.messages}
                    onCheckedChange={(v) => setEmailPrefs((p) => ({ ...p, messages: v }))}
                  />
                </div>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">Proposal & application updates</p>
                    <p className="text-xs text-muted-foreground">
                      {isFreelancer
                        ? "Emails when your proposal is shortlisted, rejected, or a job you applied to is removed."
                        : "Emails when a new proposal arrives on your job posting."}
                    </p>
                  </div>
                  <Switch
                    checked={emailPrefs.proposals}
                    onCheckedChange={(v) => setEmailPrefs((p) => ({ ...p, proposals: v }))}
                  />
                </div>
              </section>

              {/* Job Alerts — expert only */}
              {isFreelancer && (
                <section className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-1">
                  <h2 className="text-sm font-semibold text-foreground mb-3">Job Alerts</h2>
                  <div className="flex items-center justify-between py-3 border-b border-border">
                    <div>
                      <p className="text-sm font-medium">New job alerts</p>
                      <p className="text-xs text-muted-foreground">Get notified when new jobs matching your expertise are posted on the platform.</p>
                    </div>
                    <Switch
                      checked={emailPrefs.job_alerts}
                      onCheckedChange={(v) => setEmailPrefs((p) => ({ ...p, job_alerts: v }))}
                    />
                  </div>
                  {emailPrefs.job_alerts && (
                    <div className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-medium">Alert frequency</p>
                        <p className="text-xs text-muted-foreground">Instant sends an email per matching job. Digest sends one daily summary.</p>
                      </div>
                      <Select
                        value={emailPrefs.job_alert_mode}
                        onValueChange={(v: "instant" | "digest") => setEmailPrefs((p) => ({ ...p, job_alert_mode: v }))}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="instant">Instant</SelectItem>
                          <SelectItem value="digest">Daily digest</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </section>
              )}

              {/* Contests */}
              <section className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-1">
                <h2 className="text-sm font-semibold text-foreground mb-3">Contests</h2>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">Contest updates</p>
                    <p className="text-xs text-muted-foreground">
                      {isFreelancer
                        ? "Emails about contest approvals, voting periods, results, and new contests in your field."
                        : "Emails when your hosted contest is approved, enters voting, or ends."}
                    </p>
                  </div>
                  <Switch
                    checked={emailPrefs.contest_alerts}
                    onCheckedChange={(v) => setEmailPrefs((p) => ({ ...p, contest_alerts: v }))}
                  />
                </div>
              </section>

              {/* Platform & Marketing */}
              <section className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-1">
                <h2 className="text-sm font-semibold text-foreground mb-3">Platform & Updates</h2>
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <div>
                    <p className="text-sm font-medium">Blog posts & newsletters</p>
                    <p className="text-xs text-muted-foreground">Occasional articles, industry insights, and platform news. Opt-in only.</p>
                  </div>
                  <Switch
                    checked={emailPrefs.blog}
                    onCheckedChange={(v) => setEmailPrefs((p) => ({ ...p, blog: v }))}
                  />
                </div>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">Feature announcements</p>
                    <p className="text-xs text-muted-foreground">Emails about new features, improvements, and important platform changes.</p>
                  </div>
                  <Switch
                    checked={emailPrefs.platform_updates}
                    onCheckedChange={(v) => setEmailPrefs((p) => ({ ...p, platform_updates: v }))}
                  />
                </div>
              </section>

              <div className="flex justify-end pb-4 sm:pb-8">
                <Button onClick={handleSaveEmailPrefs} disabled={savingEmailPrefs}>
                  {savingEmailPrefs ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Preferences
                </Button>
              </div>

            </TabsContent>

          </Tabs>
        </div>
      </main>
      <Footer />

      {/* Delete confirmation */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" /> Delete Account</DialogTitle>
            <DialogDescription>This will permanently delete your account and all associated data. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {deleteChecking ? (
              <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Checking account status...</div>
            ) : deleteError ? (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4"><p className="text-sm text-destructive font-medium">{deleteError}</p></div>
            ) : (
              <p className="text-sm text-foreground">All checks passed. You'll need to enter your authentication code to proceed.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { setShowDeleteDialog(false); setShowDeleteAuthCode(true); }} disabled={deleteChecking || !!deleteError}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
