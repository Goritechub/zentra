import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
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
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { createJobPost, updateJobPost, searchInviteExperts } from "@/api/jobs.api";
import { getLocalStorageToken } from "@/api/axios";
import { getJobDetailsOverview } from "@/api/job-details.api";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { getAllStates, getCitiesByState, cadSkills, cadSoftwareList } from "@/lib/nigerian-data";
import { Loader2, X, Plus, Paperclip, FileText, Search, UserPlus, Lock, Info, Check, AlertCircle, RefreshCw, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type SkillLevel = "Beginner" | "Intermediate" | "Advanced";
type DurationUnit = "days" | "weeks" | "months";
type JobVisibility = "public" | "private";
type PaymentTypePreference = "negotiable" | "project" | "milestone";
type UploadStatus = "uploading" | "done" | "error";
type UploadItem = {
  id: string;
  file: File;
  progress: number;
  status: UploadStatus;
  url: string | null;
  errorMsg: string | null;
};
interface InviteExpert {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  username: string | null;
}

export default function PostJobPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { jobId } = useParams<{ jobId?: string }>();
  const isEditMode = !!jobId;
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingJob, setLoadingJob] = useState(isEditMode);
  const [jobLocked, setJobLocked] = useState(false);
  const [existingAttachmentUrls, setExistingAttachmentUrls] = useState<string[]>([]);
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
  const [customSkill, setCustomSkill] = useState("");
  const [customSoftware, setCustomSoftware] = useState("");
  const [overallSkillLevel, setOverallSkillLevel] = useState<SkillLevel>("Intermediate");
  const [attachmentUploads, setAttachmentUploads] = useState<UploadItem[]>([]);
  // Visibility & invitations
  const [visibility, setVisibility] = useState<JobVisibility>("public");
  const [invitedExperts, setInvitedExperts] = useState<{id: string;full_name: string;}[]>([]);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [expertSearch, setExpertSearch] = useState("");
  const [expertResults, setExpertResults] = useState<InviteExpert[]>([]);
  const [searchingExperts, setSearchingExperts] = useState(false);

  const [isNda, setIsNda] = useState(false);
  const [ndaUpload, setNdaUpload] = useState<UploadItem | null>(null);
  const [existingNdaUrl, setExistingNdaUrl] = useState<string | null>(null);
  const ndaFileRef = useRef<HTMLInputElement>(null);

  const [isIpPolicy, setIsIpPolicy] = useState(false);
  const [ipPolicyType, setIpPolicyType] = useState<"standard" | "custom">("standard");
  const [ipPolicyUpload, setIpPolicyUpload] = useState<UploadItem | null>(null);
  const [existingIpPolicyUrl, setExistingIpPolicyUrl] = useState<string | null>(null);
  const ipPolicyFileRef = useRef<HTMLInputElement>(null);

  // Payment type preference
  const [paymentTypePreference, setPaymentTypePreference] = useState<PaymentTypePreference>("negotiable");
  const [suggestedMilestones, setSuggestedMilestones] = useState<string[]>([""]);

  // Negotiable budget confirmation
  const [showNegotiableConfirm, setShowNegotiableConfirm] = useState(false);
  const [attempted, setAttempted] = useState(false);

  // Computed upload state
  const anyUploading =
    attachmentUploads.some((u) => u.status === "uploading") ||
    ndaUpload?.status === "uploading" ||
    ipPolicyUpload?.status === "uploading";
  const anyError =
    attachmentUploads.some((u) => u.status === "error") ||
    ndaUpload?.status === "error" ||
    ipPolicyUpload?.status === "error";

  // Pre-select invited expert from URL params
  useEffect(() => {
    const inviteId = searchParams.get("invite");
    const inviteName = searchParams.get("name");
    if (inviteId && inviteName) {
      setVisibility("private");
      setInvitedExperts([{ id: inviteId, full_name: decodeURIComponent(inviteName) }]);
    }
  }, [searchParams]);

  // Edit mode: fetch existing job and prefill form
  useEffect(() => {
    if (!isEditMode || !jobId) return;
    const fromDays = (days: number, unit: string): number => {
      if (unit === "weeks") return Math.round(days / 7);
      if (unit === "months") return Math.round(days / 30);
      return days;
    };
    setLoadingJob(true);
    getJobDetailsOverview(jobId)
      .then((overview) => {
        const j = overview.job;
        if (!j) { navigate("/dashboard"); return; }
        if (["in_progress", "completed", "cancelled"].includes(j.status)) {
          setJobLocked(true);
          setLoadingJob(false);
          return;
        }
        setTitle(j.title || "");
        setDescription(j.description || "");
        setBudgetMin(j.budget_min?.toString() ?? "");
        setBudgetMax(j.budget_max?.toString() ?? "");
        const unit: DurationUnit = (j.delivery_unit as DurationUnit) || "days";
        setDeliveryUnit(unit);
        setDeliveryValue(j.delivery_days ? fromDays(j.delivery_days, unit).toString() : "");
        setLocationType(j.is_remote ? "remote" : "physical");
        setIsHourly(j.is_hourly || false);
        setState(j.state || "");
        setCity(j.city || "");
        setSelectedSkills(j.required_skills || []);
        setSelectedSoftware(j.required_software || []);
        setOverallSkillLevel((j.skill_level as SkillLevel) || "Intermediate");
        setVisibility((j.visibility as JobVisibility) || "public");
        setIsNda(j.is_nda || false);
        setExistingNdaUrl(j.nda_url || null);
        setIsIpPolicy(j.is_ip_policy || false);
        setIpPolicyType((j.ip_policy_type as "standard" | "custom") || "standard");
        setExistingIpPolicyUrl(j.ip_policy_url || null);
        setPaymentTypePreference((j.payment_type_preference as PaymentTypePreference) || "negotiable");
        setSuggestedMilestones(
          Array.isArray(j.suggested_milestones) && j.suggested_milestones.length > 0
            ? j.suggested_milestones
            : [""]
        );
        setExistingAttachmentUrls(j.attachments || []);
        if (j.invited_expert_ids?.length) {
          supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", j.invited_expert_ids)
            .then(({ data }) => {
              setInvitedExperts((data || []).map((p: { id: string; full_name: string | null }) => ({ id: p.id, full_name: p.full_name || "" })));
            });
        }
        setLoadingJob(false);
      })
      .catch(() => { setLoadingJob(false); navigate("/dashboard"); });
  }, [isEditMode, jobId, navigate]);

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
    const data = (await searchInviteExperts(query)) as InviteExpert[];
    setExpertResults((data || []).filter((e) => !invitedExperts.find((ie) => ie.id === e.id)));
    setSearchingExperts(false);
  };

  const uploadOneFile = (file: File, onProgress: (pct: number) => void): Promise<string> => {
    const token = getLocalStorageToken();

    return new Promise((resolve, reject) => {
      const form = new FormData();
      form.append("files", file);

      const xhr = new XMLHttpRequest();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
      xhr.open("POST", `${baseUrl}/jobs/attachments`, true);
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.timeout = 90000;

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable && e.total > 0) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const json = JSON.parse(xhr.responseText);
            const urls: string[] = json.data?.urls ?? [];
            if (urls.length) resolve(urls[0]);
            else reject(new Error("No URL returned from server"));
          } catch {
            reject(new Error("Invalid server response"));
          }
        } else {
          try {
            const json = JSON.parse(xhr.responseText);
            reject(new Error(json?.message || `Upload failed (${xhr.status})`));
          } catch {
            reject(new Error(`Upload failed (${xhr.status})`));
          }
        }
      };

      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.ontimeout = () => reject(new Error("Upload timed out"));

      xhr.send(form);
    });
  };

  const startAttachmentUpload = (item: UploadItem) => {
    uploadOneFile(item.file, (pct) => {
      setAttachmentUploads((prev) =>
        prev.map((u) => (u.id === item.id ? { ...u, progress: pct } : u))
      );
    })
      .then((url) => {
        setAttachmentUploads((prev) =>
          prev.map((u) => (u.id === item.id ? { ...u, status: "done", progress: 100, url } : u))
        );
      })
      .catch((err) => {
        setAttachmentUploads((prev) =>
          prev.map((u) => (u.id === item.id ? { ...u, status: "error", errorMsg: err?.message ?? "Upload failed" } : u))
        );
      });
  };

  const startNdaUpload = (item: UploadItem) => {
    uploadOneFile(item.file, (pct) => {
      setNdaUpload((prev) => (prev ? { ...prev, progress: pct } : prev));
    })
      .then((url) => {
        setNdaUpload((prev) => (prev ? { ...prev, status: "done", progress: 100, url } : prev));
      })
      .catch((err) => {
        setNdaUpload((prev) => (prev ? { ...prev, status: "error", errorMsg: err?.message ?? "Upload failed" } : prev));
      });
  };

  const startIpPolicyUpload = (item: UploadItem) => {
    uploadOneFile(item.file, (pct) => {
      setIpPolicyUpload((prev) => (prev ? { ...prev, progress: pct } : prev));
    })
      .then((url) => {
        setIpPolicyUpload((prev) => (prev ? { ...prev, status: "done", progress: 100, url } : prev));
      })
      .catch((err) => {
        setIpPolicyUpload((prev) => (prev ? { ...prev, status: "error", errorMsg: err?.message ?? "Upload failed" } : prev));
      });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (fileInputRef.current) fileInputRef.current.value = "";

    const allowed = files.filter((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase();
      return ["pdf", "doc", "docx", "png", "jpg", "jpeg", "dwg", "dxf", "zip"].includes(ext || "");
    });
    if (allowed.length < files.length) {
      toast.error("Some files were skipped. Allowed: PDF, DOC, DOCX, PNG, JPG, DWG, DXF, ZIP");
    }

    const currentCount = existingAttachmentUrls.length + attachmentUploads.length;
    const toAdd = allowed.slice(0, 5 - currentCount);

    const newItems: UploadItem[] = toAdd.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      progress: 0,
      status: "uploading",
      url: null,
      errorMsg: null,
    }));

    setAttachmentUploads((prev) => [...prev, ...newItems]);
    newItems.forEach(startAttachmentUpload);
  };

  const retryAttachmentUpload = (id: string) => {
    const item = attachmentUploads.find((u) => u.id === id);
    if (!item) return;
    const reset = { ...item, status: "uploading" as UploadStatus, progress: 0, errorMsg: null };
    setAttachmentUploads((prev) => prev.map((u) => (u.id === id ? reset : u)));
    startAttachmentUpload(reset);
  };

  const retryNdaUpload = () => {
    if (!ndaUpload) return;
    const reset: UploadItem = { ...ndaUpload, status: "uploading", progress: 0, errorMsg: null };
    setNdaUpload(reset);
    startNdaUpload(reset);
  };

  const retryIpPolicyUpload = () => {
    if (!ipPolicyUpload) return;
    const reset: UploadItem = { ...ipPolicyUpload, status: "uploading", progress: 0, errorMsg: null };
    setIpPolicyUpload(reset);
    startIpPolicyUpload(reset);
  };

  const toDays = (value: number, unit: DurationUnit): number => {
    if (unit === "weeks") return value * 7;
    if (unit === "months") return value * 30;
    return value;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {navigate("/auth");return;}
    setAttempted(true);
    if (!title.trim() || !description.trim()) {
      toast.error("Title and description are required");
      return;
    }

    if (!budgetMin && !budgetMax && !showNegotiableConfirm) {
      setShowNegotiableConfirm(true);
      return;
    }

    if (budgetMin && parseInt(budgetMin) < 30000) {
      toast.error("Minimum budget must be at least ₦30,000");
      return;
    }
    if (budgetMax && parseInt(budgetMax) < 30000) {
      toast.error("Maximum budget must be at least ₦30,000");
      return;
    }
    if (budgetMin && budgetMax && parseInt(budgetMin) > parseInt(budgetMax)) {
      toast.error("Minimum budget cannot be greater than maximum budget");
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

    const uploadedAttachmentUrls = attachmentUploads
      .filter((u) => u.status === "done" && u.url)
      .map((u) => u.url!);
    const allAttachments = [...existingAttachmentUrls, ...uploadedAttachmentUrls];

    const ndaUrl = ndaUpload?.status === "done" && ndaUpload.url
      ? ndaUpload.url
      : existingNdaUrl;

    const ipPolicyUrl = ipPolicyUpload?.status === "done" && ipPolicyUpload.url
      ? ipPolicyUpload.url
      : existingIpPolicyUrl;

    const deliveryDays = deliveryValue ? toDays(parseInt(deliveryValue), deliveryUnit) : null;

    const payload = {
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
      attachments: allAttachments.length > 0 ? allAttachments : null,
      visibility,
      invited_expert_ids: invitedExperts.map((invited) => invited.id),
      is_nda: isNda,
      nda_url: isNda ? ndaUrl : null,
      is_ip_policy: isIpPolicy,
      ip_policy_type: isIpPolicy ? ipPolicyType : null,
      ip_policy_url: isIpPolicy && ipPolicyType === "custom" ? ipPolicyUrl : null,
      payment_type_preference: paymentTypePreference === "negotiable" ? null : paymentTypePreference,
      suggested_milestones:
        paymentTypePreference === "milestone"
          ? suggestedMilestones.filter((s) => s.trim().length > 0)
          : null,
    };

    setLoading(true);
    try {
      if (isEditMode && jobId) {
        await updateJobPost(jobId, payload);
        toast.success("Job updated successfully!");
        navigate(`/job/${jobId}`);
      } else {
        await createJobPost(payload);
        toast.success("Job posted successfully!");
        navigate("/dashboard");
      }
    } catch (error) {
      const isTimeout = error instanceof Error && (
        error.message.toLowerCase().includes("timeout") ||
        (error as Error & { code?: string }).code === "ECONNABORTED"
      );
      toast.error(isTimeout
        ? "Request timed out — please check your connection and try again"
        : isEditMode ? "Failed to update job" : "Failed to post job"
      );
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

  if (loadingJob) {
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

  if (jobLocked) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <Lock className="h-10 w-10 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-bold">Job cannot be edited</h2>
            <p className="text-muted-foreground">This job has an active contract or has been closed.</p>
            <Button onClick={() => navigate(`/job/${jobId}`)}>View Job</Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const levels: SkillLevel[] = ["Beginner", "Intermediate", "Advanced"];
  const totalAttachmentCount = existingAttachmentUrls.length + attachmentUploads.length;

  // Field-level errors (only shown after first submit attempt)
  const titleError       = attempted && !title.trim();
  const descriptionError = attempted && !description.trim();
  const budgetMinError   = attempted && !!budgetMin && parseInt(budgetMin) < 30000;
  const budgetMaxError   = attempted && !!budgetMax && parseInt(budgetMax) < 30000;
  const budgetRangeError = attempted && !!budgetMin && !!budgetMax && parseInt(budgetMin) > parseInt(budgetMax);
  const inviteError      = attempted && visibility === "private" && invitedExperts.length === 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-4 sm:py-8">
        <div className="container-tight">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">{isEditMode ? "Edit Job" : "Post a New Job"}</h1>
          <p className="text-muted-foreground mb-4 sm:mb-8">{isEditMode ? "Update your job details below." : "Describe your engineering project and find the right expert."}</p>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-8">
            <div className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-4 sm:space-y-6">
              <h2 className="text-lg font-semibold">Project Details</h2>
              <div className="space-y-2">
                <Label>Job Title *</Label>
                <Input
                  placeholder="e.g. Architectural Drawings for 5-Bedroom Duplex"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={titleError ? "border-destructive focus-visible:ring-destructive" : undefined}
                />
              </div>
              <div className="space-y-2">
                <Label>Description *</Label>
                <Textarea
                  placeholder="Describe your project requirements in detail..."
                  rows={6}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={descriptionError ? "border-destructive focus-visible:ring-destructive" : undefined}
                />
              </div>
            </div>

            {/* Visibility & Invitations */}
            <div className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-4 sm:space-y-6">
              <h2 className="text-lg font-semibold">Job Visibility</h2>
              <RadioGroup value={visibility} onValueChange={(v) => setVisibility(v as JobVisibility)} className="flex flex-wrap gap-4">
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
                {inviteError && (
                  <p className="text-xs text-destructive mt-1">Private jobs require at least one invited expert.</p>
                )}
              </div>
            </div>

            {/* Skills & Software */}
            <div className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-4 sm:space-y-6">
              <h2 className="text-lg font-semibold">Skills & Software</h2>
              <div className="space-y-2">
                <Label>Required Skills</Label>
                <Select onValueChange={(s) => { if (s !== "__others__") addSkill(s); }}>
                  <SelectTrigger><SelectValue placeholder="Add a skill" /></SelectTrigger>
                  <SelectContent>
                    {cadSkills.filter((s) => !selectedSkills.includes(s)).map((s) =>
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                    )}
                    <SelectItem value="__others__">Others</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Type a custom skill and press Enter"
                    maxLength={25}
                    value={customSkill}
                    onChange={(e) => setCustomSkill(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const trimmed = customSkill.trim();
                        if (trimmed && !selectedSkills.includes(trimmed)) {
                          addSkill(trimmed);
                          setCustomSkill("");
                        }
                      }
                    }}
                  />
                </div>
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
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Don't see it? Type it and press Enter"
                    maxLength={25}
                    value={customSoftware}
                    onChange={(e) => setCustomSoftware(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const trimmed = customSoftware.trim();
                        if (trimmed && !selectedSoftware.includes(trimmed)) {
                          addSoftware(trimmed);
                          setCustomSoftware("");
                        }
                      }
                    }}
                  />
                </div>
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
            <div className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-4 sm:space-y-6">
              <h2 className="text-lg font-semibold">Budget & Timeline</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Budget Min (₦)</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 100000"
                    value={budgetMin}
                    onChange={(e) => setBudgetMin(e.target.value)}
                    className={budgetMinError || budgetRangeError ? "border-destructive focus-visible:ring-destructive" : undefined}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Budget Max (₦)</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 500000"
                    value={budgetMax}
                    onChange={(e) => setBudgetMax(e.target.value)}
                    className={budgetMaxError || budgetRangeError ? "border-destructive focus-visible:ring-destructive" : undefined}
                  />
                </div>
              </div>
              {!budgetMin && !budgetMax &&
              <p className="text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg flex items-center gap-2 -mt-2">
                  <Info className="h-4 w-4 shrink-0" />
                  No budget set — this job will be listed as <span className="font-semibold text-foreground">Negotiable</span>.
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

            {/* Payment Structure */}
            <div className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-4 sm:space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Payment Structure</h2>
                <p className="text-xs text-muted-foreground mt-1">Set how you want the expert to be paid, or leave it open for them to decide.</p>
              </div>
              <RadioGroup
                value={paymentTypePreference}
                onValueChange={(v) => setPaymentTypePreference(v as PaymentTypePreference)}
                className="grid grid-cols-1 sm:grid-cols-3 gap-3"
              >
                {(["negotiable", "project", "milestone"] as PaymentTypePreference[]).map((opt) => (
                  <label
                    key={opt}
                    htmlFor={`pref-${opt}`}
                    className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${paymentTypePreference === opt ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}
                  >
                    <RadioGroupItem value={opt} id={`pref-${opt}`} className="mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">
                        {opt === "negotiable" ? "Negotiable" : opt === "project" ? "Lump Sum" : "Milestones"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {opt === "negotiable"
                          ? "Expert chooses payment structure."
                          : opt === "project"
                          ? "Expert is paid in full upon completion."
                          : "Expert is paid in stages as work progresses."}
                      </p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
              {paymentTypePreference === "milestone" && (
                <div className="space-y-3">
                  <div>
                    <Label>Suggested Milestone Names <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Give the expert a starting point. They'll fill in amounts and durations.</p>
                  </div>
                  <div className="space-y-2">
                    {suggestedMilestones.map((ms, idx) => (
                      <div key={idx} className="flex gap-2">
                        <Input
                          placeholder={`e.g. Milestone ${idx + 1}: Foundation drawings`}
                          value={ms}
                          maxLength={80}
                          onChange={(e) => {
                            const updated = [...suggestedMilestones];
                            updated[idx] = e.target.value;
                            setSuggestedMilestones(updated);
                          }}
                          className="flex-1"
                        />
                        {suggestedMilestones.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => setSuggestedMilestones(suggestedMilestones.filter((_, i) => i !== idx))}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  {suggestedMilestones.length < 10 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSuggestedMilestones([...suggestedMilestones, ""])}
                    >
                      <Plus className="h-4 w-4 mr-2" /> Add Milestone Name
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Location */}
            <div className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-4 sm:space-y-6">
              <h2 className="text-lg font-semibold">Location</h2>
              <RadioGroup value={locationType} onValueChange={(v) => setLocationType(v as "remote" | "physical")} className="flex flex-wrap gap-4">
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
            <div className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-4">
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

              {existingAttachmentUrls.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Existing attachments:</p>
                  {existingAttachmentUrls.map((url, idx) => {
                    const name = url.split("/").pop()?.split("?")[0] || `file-${idx + 1}`;
                    return (
                      <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 border border-border">
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm flex-1 truncate">{decodeURIComponent(name)}</span>
                        <button
                          type="button"
                          onClick={() => setExistingAttachmentUrls(existingAttachmentUrls.filter((_, i) => i !== idx))}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {attachmentUploads.length > 0 && (
                <div className="space-y-2">
                  {attachmentUploads.map((item) => (
                    <div key={item.id} className="p-2 rounded-lg bg-muted/50 border border-border space-y-1.5">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm flex-1 truncate">{item.file.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {(item.file.size / 1024).toFixed(0)} KB
                        </span>
                        {item.status === "uploading" && (
                          <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                        )}
                        {item.status === "done" && (
                          <Check className="h-4 w-4 text-success shrink-0" />
                        )}
                        {item.status === "error" && (
                          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                        )}
                        {item.status !== "uploading" && (
                          <button
                            type="button"
                            onClick={() => setAttachmentUploads((prev) => prev.filter((u) => u.id !== item.id))}
                            className="text-muted-foreground hover:text-destructive shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      {item.status === "uploading" && (
                        <div className="h-1 bg-muted rounded-full overflow-hidden ml-7">
                          {item.progress > 0 ? (
                            <div
                              className="h-full bg-primary transition-all duration-150"
                              style={{ width: `${item.progress}%` }}
                            />
                          ) : (
                            <div className="h-full w-full bg-primary/50 animate-pulse" />
                          )}
                        </div>
                      )}
                      {item.status === "error" && (
                        <div className="flex items-center gap-2 ml-7">
                          <p className="text-xs text-destructive flex-1">{item.errorMsg}</p>
                          <button
                            type="button"
                            onClick={() => retryAttachmentUpload(item.id)}
                            className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
                          >
                            <RefreshCw className="h-3 w-3" /> Retry
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={totalAttachmentCount >= 5}
              >
                <Paperclip className="h-4 w-4 mr-2" /> Add Files
              </Button>
            </div>

            {/* Job Options */}
            <div className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-4">
              <h2 className="text-lg font-semibold">Job Options</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="is-nda"
                    checked={isNda}
                    onCheckedChange={(checked) => {
                      const val = checked === true;
                      setIsNda(val);
                      if (!val) { setNdaUpload(null); setExistingNdaUrl(null); }
                    }}
                    className="mt-0.5"
                  />
                  <div className="flex-1 space-y-3">
                    <div>
                      <Label htmlFor="is-nda" className="cursor-pointer font-medium">NDA Required</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Expert must agree to a Non-Disclosure Agreement before starting work.
                      </p>
                    </div>
                    {isNda && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          Upload your NDA document (optional). Experts will download and acknowledge it before submitting a proposal.
                        </p>

                        {/* Existing NDA (edit mode, not replaced yet) */}
                        {existingNdaUrl && !ndaUpload && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
                            <FileText className="h-4 w-4 shrink-0 text-primary" />
                            <a href={existingNdaUrl} target="_blank" rel="noopener noreferrer" className="underline truncate flex-1">
                              Current NDA document
                            </a>
                            <button
                              type="button"
                              onClick={() => setExistingNdaUrl(null)}
                              className="hover:text-destructive ml-1"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}

                        {/* New NDA upload item */}
                        {ndaUpload && (
                          <div className="p-2 rounded-lg bg-muted/50 border border-border space-y-1.5">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <FileText className="h-4 w-4 shrink-0 text-primary" />
                              <span className="truncate flex-1">{ndaUpload.file.name}</span>
                              {ndaUpload.status === "uploading" && (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                              )}
                              {ndaUpload.status === "done" && (
                                <Check className="h-3.5 w-3.5 text-success shrink-0" />
                              )}
                              {ndaUpload.status === "error" && (
                                <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                              )}
                              {ndaUpload.status !== "uploading" && (
                                <button
                                  type="button"
                                  onClick={() => { setNdaUpload(null); if (ndaFileRef.current) ndaFileRef.current.value = ""; }}
                                  className="hover:text-destructive ml-1"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                            {ndaUpload.status === "uploading" && (
                              <div className="h-1 bg-muted rounded-full overflow-hidden ml-5">
                                {ndaUpload.progress > 0 ? (
                                  <div
                                    className="h-full bg-primary transition-all duration-150"
                                    style={{ width: `${ndaUpload.progress}%` }}
                                  />
                                ) : (
                                  <div className="h-full w-full bg-primary/50 animate-pulse" />
                                )}
                              </div>
                            )}
                            {ndaUpload.status === "error" && (
                              <div className="flex items-center gap-2 ml-5">
                                <p className="text-xs text-destructive flex-1">{ndaUpload.errorMsg}</p>
                                <button
                                  type="button"
                                  onClick={retryNdaUpload}
                                  className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
                                >
                                  <RefreshCw className="h-3 w-3" /> Retry
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {!ndaUpload && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => ndaFileRef.current?.click()}
                          >
                            <Paperclip className="h-4 w-4 mr-2" />
                            {existingNdaUrl ? "Replace NDA Document" : "Upload NDA Document"}
                          </Button>
                        )}
                        <input
                          ref={ndaFileRef}
                          type="file"
                          accept=".pdf,.doc,.docx"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (ndaFileRef.current) ndaFileRef.current.value = "";
                            if (!file) return;
                            setExistingNdaUrl(null);
                            const item: UploadItem = {
                              id: `nda-${Date.now()}`,
                              file,
                              progress: 0,
                              status: "uploading",
                              url: null,
                              errorMsg: null,
                            };
                            setNdaUpload(item);
                            startNdaUpload(item);
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="is-ip-policy"
                    checked={isIpPolicy}
                    onCheckedChange={(checked) => {
                      const val = checked === true;
                      setIsIpPolicy(val);
                      if (!val) {
                        setIpPolicyType("standard");
                        setIpPolicyUpload(null);
                        setExistingIpPolicyUrl(null);
                      }
                    }}
                    className="mt-0.5"
                  />
                  <div className="flex-1 space-y-3">
                    <div>
                      <Label htmlFor="is-ip-policy" className="cursor-pointer font-medium">IP Policy Required</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Expert must agree to an Intellectual Property policy before viewing full job details.
                      </p>
                    </div>
                    {isIpPolicy && (
                      <div className="space-y-3">
                        <RadioGroup
                          value={ipPolicyType}
                          onValueChange={(v) => {
                            setIpPolicyType(v as "standard" | "custom");
                            if (v === "standard") {
                              setIpPolicyUpload(null);
                              setExistingIpPolicyUrl(null);
                            }
                          }}
                          className="space-y-2"
                        >
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="standard" id="ip-policy-standard" />
                            <Label htmlFor="ip-policy-standard" className="cursor-pointer text-sm font-normal">
                              Use ZentraGig's{" "}
                              <a
                                href="/terms?doc=ip-policy"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline text-primary"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Standard IP Policy
                              </a>
                            </Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="custom" id="ip-policy-custom" />
                            <Label htmlFor="ip-policy-custom" className="cursor-pointer text-sm font-normal">
                              Upload my own IP Policy document
                            </Label>
                          </div>
                        </RadioGroup>

                        {ipPolicyType === "custom" && (
                          <div className="space-y-2">
                            {/* Existing IP Policy doc (edit mode, not replaced yet) */}
                            {existingIpPolicyUrl && !ipPolicyUpload && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
                                <FileText className="h-4 w-4 shrink-0 text-primary" />
                                <a href={existingIpPolicyUrl} target="_blank" rel="noopener noreferrer" className="underline truncate flex-1">
                                  Current IP Policy document
                                </a>
                                <button
                                  type="button"
                                  onClick={() => setExistingIpPolicyUrl(null)}
                                  className="hover:text-destructive ml-1"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}

                            {/* New IP Policy upload item */}
                            {ipPolicyUpload && (
                              <div className="p-2 rounded-lg bg-muted/50 border border-border space-y-1.5">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <FileText className="h-4 w-4 shrink-0 text-primary" />
                                  <span className="truncate flex-1">{ipPolicyUpload.file.name}</span>
                                  {ipPolicyUpload.status === "uploading" && (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                                  )}
                                  {ipPolicyUpload.status === "done" && (
                                    <Check className="h-3.5 w-3.5 text-success shrink-0" />
                                  )}
                                  {ipPolicyUpload.status === "error" && (
                                    <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                                  )}
                                  {ipPolicyUpload.status !== "uploading" && (
                                    <button
                                      type="button"
                                      onClick={() => { setIpPolicyUpload(null); if (ipPolicyFileRef.current) ipPolicyFileRef.current.value = ""; }}
                                      className="hover:text-destructive ml-1"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                                {ipPolicyUpload.status === "uploading" && (
                                  <div className="h-1 bg-muted rounded-full overflow-hidden ml-5">
                                    {ipPolicyUpload.progress > 0 ? (
                                      <div
                                        className="h-full bg-primary transition-all duration-150"
                                        style={{ width: `${ipPolicyUpload.progress}%` }}
                                      />
                                    ) : (
                                      <div className="h-full w-full bg-primary/50 animate-pulse" />
                                    )}
                                  </div>
                                )}
                                {ipPolicyUpload.status === "error" && (
                                  <div className="flex items-center gap-2 ml-5">
                                    <p className="text-xs text-destructive flex-1">{ipPolicyUpload.errorMsg}</p>
                                    <button
                                      type="button"
                                      onClick={retryIpPolicyUpload}
                                      className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
                                    >
                                      <RefreshCw className="h-3 w-3" /> Retry
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {!ipPolicyUpload && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => ipPolicyFileRef.current?.click()}
                              >
                                <Paperclip className="h-4 w-4 mr-2" />
                                {existingIpPolicyUrl ? "Replace IP Policy Document" : "Upload IP Policy Document"}
                              </Button>
                            )}
                            <input
                              ref={ipPolicyFileRef}
                              type="file"
                              accept=".pdf,.doc,.docx"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (ipPolicyFileRef.current) ipPolicyFileRef.current.value = "";
                                if (!file) return;
                                setExistingIpPolicyUrl(null);
                                const item: UploadItem = {
                                  id: `ip-policy-${Date.now()}`,
                                  file,
                                  progress: 0,
                                  status: "uploading",
                                  url: null,
                                  errorMsg: null,
                                };
                                setIpPolicyUpload(item);
                                startIpPolicyUpload(item);
                              }}
                            />
                          </div>
                        )}

                        <Alert className="bg-warning/10 border-warning/30">
                          <ShieldAlert className="h-4 w-4 text-warning" />
                          <AlertDescription className="text-xs text-warning">
                            An IP Policy is a legal agreement, not encryption — avoid pasting highly sensitive proprietary
                            details directly into the description. Consider sharing specifics after hiring.
                          </AlertDescription>
                        </Alert>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={loading || anyUploading || anyError}
            >
              {loading
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />{isEditMode ? "Saving..." : "Posting..."}</>
                : anyUploading
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Uploading files...</>
                : anyError
                ? <><AlertCircle className="h-4 w-4 mr-2" />Fix upload errors to continue</>
                : <><Plus className="h-4 w-4 mr-2" />{isEditMode ? "Save Changes" : "Post Job"}</>
              }
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
            <Button size="sm" variant="outline" onClick={() => setShowNegotiableConfirm(false)}>Go Back & Set Budget</Button>
            <Button size="sm" onClick={() => {setShowNegotiableConfirm(false);document.querySelector<HTMLFormElement>("form")?.requestSubmit();}}>
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
            <Button size="sm" onClick={() => setShowInviteDialog(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);

}
