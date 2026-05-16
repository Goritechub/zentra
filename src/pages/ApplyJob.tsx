import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  getMyJobApplyContext,
  submitMyJobProposal,
  updateMyJobProposal,
} from "@/api/proposals.api";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/useCurrency";
import { useKycVerification } from "@/hooks/useKycVerification";
import { KycRequiredModal } from "@/components/KycRequiredModal";
import { calculateServiceCharge, getServiceChargeLabel } from "@/lib/service-charge";
import { formatDistanceToNow } from "date-fns";
import { vetContent } from "@/lib/content-vetting";
import {
  ArrowLeft, Send, Loader2, FileText, Download, Info, DollarSign,
  Clock, MapPin, Briefcase, Tag, Wrench, Layers, Paperclip, X, Globe, Eye, Plus, Trash2,
  CheckCircle2, ArrowRight, AlertCircle,
} from "lucide-react";
import { getLocalStorageToken } from "@/api/axios";

type UploadStatus = "uploading" | "done" | "error";
type UploadItem = {
  id: string;
  file: File;
  progress: number;
  status: UploadStatus;
  url: string | null;
  errorMsg: string | null;
};

// Format number with commas: 1000 -> 1,000
function formatWithCommas(value: string): string {
  const num = value.replace(/[^0-9]/g, "");
  if (!num) return "";
  return parseInt(num).toLocaleString("en-NG");
}

// Parse comma-formatted string back to number
function parseCommaNumber(value: string): number {
  return parseInt(value.replace(/,/g, "")) || 0;
}

// Convert duration to days
function toDays(value: number, unit: string): number {
  if (unit === "weeks") return value * 7;
  if (unit === "months") return value * 30;
  return value;
}

// Format duration for display
function formatDuration(days: number, unit: string): string {
  if (unit === "weeks") {
    const weeks = Math.round(days / 7);
    return `${weeks} week${weeks !== 1 ? "s" : ""}`;
  }
  if (unit === "months") {
    const months = Math.round(days / 30);
    return `${months} month${months !== 1 ? "s" : ""}`;
  }
  return `${days} day${days !== 1 ? "s" : ""}`;
}

// Reverse: days back to value in given unit
function fromDays(days: number, unit: string): number {
  if (unit === "weeks") return Math.round(days / 7);
  if (unit === "months") return Math.round(days / 30);
  return days;
}

type DurationUnit = "days" | "weeks" | "months";

function DurationInput({ value, unit, onValueChange, onUnitChange, placeholder }: {
  value: string;
  unit: DurationUnit;
  onValueChange: (v: string) => void;
  onUnitChange: (u: DurationUnit) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex gap-2">
      <Input
        type="number"
        min="1"
        placeholder={placeholder || "e.g. 14"}
        value={value}
        onChange={(e) => {
          const val = e.target.value;
          if (val === "" || parseInt(val) >= 1) onValueChange(val);
        }}
        className="flex-1"
      />
      <Select value={unit} onValueChange={(v) => onUnitChange(v as DurationUnit)}>
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
  );
}

function MoneyInput({ value, onChange, placeholder }: {
  value: string;
  onChange: (raw: string, formatted: string) => void;
  placeholder?: string;
}) {
  return (
    <Input
      type="text"
      inputMode="numeric"
      placeholder={placeholder || "e.g. 250,000"}
      value={value}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9]/g, "");
        const formatted = formatWithCommas(raw);
        onChange(raw, formatted);
      }}
    />
  );
}

export default function ApplyJobPage() {
  const { format } = useCurrency();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [existingProposal, setExistingProposal] = useState<any>(null);
  const [editingProposal, setEditingProposal] = useState(false);

  // New proposal form
  const [bidAmount, setBidAmount] = useState("");
  const [bidAmountFormatted, setBidAmountFormatted] = useState("");
  const [deliveryValue, setDeliveryValue] = useState("");
  const [deliveryUnit, setDeliveryUnit] = useState<DurationUnit>("days");
  const [coverLetter, setCoverLetter] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { isVerified: kycVerified } = useKycVerification();
  const isVerified = kycVerified || !!profile?.is_verified;
  const [showKycModal, setShowKycModal] = useState(false);
  const [proposalUploads, setProposalUploads] = useState<UploadItem[]>([]);
  const proposalFileRef = useRef<HTMLInputElement>(null);
  const [ndaAcknowledged, setNdaAcknowledged] = useState(false);
  const [paymentType, setPaymentType] = useState<"project" | "milestone">("project");
  const [milestones, setMilestones] = useState<{ title: string; duration: string; durationUnit: DurationUnit; amount: string; amountFormatted: string }[]>([
    { title: "", duration: "", durationUnit: "days", amount: "", amountFormatted: "" },
  ]);

  // Edit fields
  const [editBidAmount, setEditBidAmount] = useState("");
  const [editBidAmountFormatted, setEditBidAmountFormatted] = useState("");
  const [editDeliveryValue, setEditDeliveryValue] = useState("");
  const [editDeliveryUnit, setEditDeliveryUnit] = useState<DurationUnit>("days");
  const [editCoverLetter, setEditCoverLetter] = useState("");
  const [editPaymentType, setEditPaymentType] = useState<"project" | "milestone">("project");
  const [editMilestones, setEditMilestones] = useState<{ title: string; duration: string; durationUnit: DurationUnit; amount: string; amountFormatted: string }[]>([]);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [submittedConfirmation, setSubmittedConfirmation] = useState(false);
  const [editAttachmentUrls, setEditAttachmentUrls] = useState<string[]>([]);
  const [editProposalUploads, setEditProposalUploads] = useState<UploadItem[]>([]);
  const editProposalFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id && user) fetchData();
  }, [id, user]);

  // Auto-save draft so a reload doesn't wipe the form
  useEffect(() => {
    if (!id || existingProposal) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(`apply_draft_${id}`, JSON.stringify({
          paymentType, bidAmountFormatted, deliveryValue, deliveryUnit, coverLetter, milestones,
        }));
      } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [paymentType, bidAmountFormatted, deliveryValue, deliveryUnit, coverLetter, milestones, id, existingProposal]);

  const populateEditFields = (proposal: any) => {
    setEditBidAmount(String(proposal.bid_amount));
    setEditBidAmountFormatted(formatWithCommas(String(proposal.bid_amount)));
    const unit = proposal.delivery_unit || "days";
    setEditDeliveryUnit(unit);
    setEditDeliveryValue(String(fromDays(proposal.delivery_days, unit)));
    setEditCoverLetter(proposal.cover_letter);
    setEditPaymentType(proposal.payment_type || "project");
    setEditAttachmentUrls(proposal.attachments ?? []);
    setEditProposalUploads([]);

    if (proposal.payment_type === "milestone" && proposal.milestones?.length > 0) {
      setEditMilestones(proposal.milestones.map((ms: any) => {
        const msUnit = ms.duration_unit || ms.durationUnit || "days";
        const msDuration = ms.duration ? String(ms.duration) : (ms.date ? "" : "");
        return {
          title: ms.title || "",
          duration: msDuration,
          durationUnit: msUnit as DurationUnit,
          amount: String(ms.amount || ""),
          amountFormatted: formatWithCommas(String(ms.amount || "")),
        };
      }));
    } else {
      setEditMilestones([{ title: "", duration: "", durationUnit: "days", amount: "", amountFormatted: "" }]);
    }
  };

  const fetchData = async () => {
    if (!id) return;
    const { job: jobData, existingProposal: existing } = await getMyJobApplyContext(id);

    if (!jobData) {
      setLoading(false);
      return;
    }
    setJob(jobData);

    // Lock payment type if client set a preference
    const pref = jobData.payment_type_preference;
    if (pref === "project" || pref === "milestone") {
      setPaymentType(pref);
    }
    if (pref === "milestone" && Array.isArray(jobData.suggested_milestones) && jobData.suggested_milestones.length > 0 && !existing) {
      setMilestones(
        jobData.suggested_milestones.map((title: string) => ({
          title,
          duration: "",
          durationUnit: "days" as DurationUnit,
          amount: "",
          amountFormatted: "",
        }))
      );
    }

    if (existing) {
      setExistingProposal(existing);
      populateEditFields(existing);
    } else {
      // Restore saved draft if user reloaded before submitting
      try {
        const saved = localStorage.getItem(`apply_draft_${id}`);
        if (saved) {
          const draft = JSON.parse(saved);
          if (draft.coverLetter) setCoverLetter(draft.coverLetter);
          if (draft.bidAmountFormatted) {
            setBidAmountFormatted(draft.bidAmountFormatted);
            setBidAmount(draft.bidAmountFormatted.replace(/,/g, ""));
          }
          if (draft.deliveryValue) setDeliveryValue(draft.deliveryValue);
          if (draft.deliveryUnit) setDeliveryUnit(draft.deliveryUnit as DurationUnit);
          if (draft.milestones?.length > 0) setMilestones(draft.milestones);
          if (!pref && draft.paymentType) setPaymentType(draft.paymentType);
        }
      } catch {}
    }

    setLoading(false);
  };

  const canEditProposal = () => {
    if (!existingProposal) return false;
    if (existingProposal.edit_count >= 2) return false;
    const createdAt = new Date(existingProposal.created_at);
    const threeHoursLater = new Date(createdAt.getTime() + 3 * 60 * 60 * 1000);
    return new Date() < threeHoursLater;
  };

  const uploadOneFile = (file: File, onProgress: (pct: number) => void): Promise<string> => {
    const token = getLocalStorageToken();
    return new Promise((resolve, reject) => {
      const form = new FormData();
      form.append("files", file);
      const xhr = new XMLHttpRequest();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
      xhr.open("POST", `${baseUrl}/proposals/attachments`, true);
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.timeout = 90000;
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable && e.total > 0) onProgress(Math.round((e.loaded / e.total) * 100));
      });
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const json = JSON.parse(xhr.responseText);
            const urls: string[] = json.data?.urls ?? [];
            urls.length ? resolve(urls[0]) : reject(new Error("No URL returned from server"));
          } catch { reject(new Error("Invalid server response")); }
        } else {
          try {
            const json = JSON.parse(xhr.responseText);
            reject(new Error(json?.message || `Upload failed (${xhr.status})`));
          } catch { reject(new Error(`Upload failed (${xhr.status})`)); }
        }
      };
      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.ontimeout = () => reject(new Error("Upload timed out"));
      xhr.send(form);
    });
  };

  const startUpload = (item: UploadItem, setter: React.Dispatch<React.SetStateAction<UploadItem[]>>) => {
    uploadOneFile(item.file, (pct) => {
      setter(prev => prev.map(u => u.id === item.id ? { ...u, progress: pct } : u));
    }).then((url) => {
      setter(prev => prev.map(u => u.id === item.id ? { ...u, status: "done", progress: 100, url } : u));
    }).catch((err) => {
      setter(prev => prev.map(u => u.id === item.id ? { ...u, status: "error", errorMsg: err.message } : u));
    });
  };

  const handleProposalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const allowed = files.filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'dwg', 'dxf', 'zip'].includes(ext || '');
    });
    if (allowed.length < files.length) toast.error("Some files were skipped. Allowed: PDF, DOC, DOCX, PNG, JPG, DWG, DXF, ZIP");
    const remaining = 5 - proposalUploads.length;
    const toAdd = allowed.slice(0, remaining).map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file, progress: 0, status: "uploading" as UploadStatus, url: null, errorMsg: null,
    }));
    setProposalUploads(prev => [...prev, ...toAdd]);
    toAdd.forEach(item => startUpload(item, setProposalUploads));
    if (proposalFileRef.current) proposalFileRef.current.value = '';
  };

  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(e.target.files || []);
    const allowed = incoming.filter(f => f.size <= 10 * 1024 * 1024);
    const remaining = 5 - editAttachmentUrls.length - editProposalUploads.length;
    const toAdd = allowed.slice(0, remaining).map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file, progress: 0, status: "uploading" as UploadStatus, url: null, errorMsg: null,
    }));
    setEditProposalUploads(prev => [...prev, ...toAdd]);
    toAdd.forEach(item => startUpload(item, setEditProposalUploads));
    if (editProposalFileRef.current) editProposalFileRef.current.value = "";
  };

  const handleSubmitProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;

    // KYC gating for experts
    if (!isVerified) {
      setShowKycModal(true);
      return;
    }

    if (job?.is_nda && !ndaAcknowledged) {
      toast.error("You must acknowledge the NDA before submitting");
      return;
    }

    if (paymentType === "project") {
      const amount = parseCommaNumber(bidAmountFormatted);
      const durVal = parseInt(deliveryValue);
      if (!amount || !durVal || !coverLetter.trim()) {
        toast.error("Please fill in all fields");
        return;
      }
      if (durVal < 1) {
        toast.error("Duration must be at least 1");
        return;
      }
    } else {
      const validMilestones = milestones.filter(m => m.title.trim() && m.amount && m.duration);
      if (validMilestones.length === 0) {
        toast.error("Please add at least one milestone with name, duration, and price");
        return;
      }
      if (!coverLetter.trim()) {
        toast.error("Please fill in your cover letter");
        return;
      }
    }

    const vetResult = vetContent(coverLetter.trim());
    if (vetResult.blocked) {
      toast.error(vetResult.reason || "Your cover letter contains prohibited content.");
      return;
    }

    if (proposalUploads.some(u => u.status === "uploading")) {
      toast.error("Please wait for file uploads to complete.");
      return;
    }
    if (proposalUploads.some(u => u.status === "error")) {
      toast.error("Some files failed to upload. Remove or retry them before submitting.");
      return;
    }

    setSubmitting(true);
    const attachmentUrls = proposalUploads.filter(u => u.status === "done" && u.url).map(u => u.url!);

    const totalBid = paymentType === "milestone"
      ? milestones.reduce((sum, m) => sum + parseCommaNumber(m.amountFormatted), 0)
      : parseCommaNumber(bidAmountFormatted);

    const totalDays = paymentType === "milestone"
      ? Math.max(milestones.reduce((sum, m) => sum + toDays(parseInt(m.duration) || 0, m.durationUnit), 0), 1)
      : toDays(parseInt(deliveryValue) || 1, deliveryUnit);

    const milestonesData = paymentType === "milestone"
      ? milestones.filter(m => m.title.trim() && m.amount && m.duration).map(m => ({
          title: m.title.trim(),
          duration: parseInt(m.duration),
          duration_unit: m.durationUnit,
          amount: parseCommaNumber(m.amountFormatted),
        }))
      : [];

    try {
      const { proposal } = await submitMyJobProposal(id, {
        bid_amount: totalBid,
        delivery_days: totalDays,
        delivery_unit: paymentType === "project" ? deliveryUnit : "days",
        cover_letter: coverLetter.trim(),
        attachments: attachmentUrls.length > 0 ? attachmentUrls : undefined,
        payment_type: paymentType,
        milestones: milestonesData,
      });

      if (proposal) {
        setExistingProposal(proposal);
        populateEditFields(proposal);
      }
      try { localStorage.removeItem(`apply_draft_${id}`); } catch {}
      setSubmittedConfirmation(true);
    } catch (error: any) {
      toast.error(error?.message || "Your proposal was blocked due to policy violations.");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
  };

  const handleEditProposal = async () => {
    if (!existingProposal || !user) return;

    if (editPaymentType === "project") {
      const amount = parseCommaNumber(editBidAmountFormatted);
      const durVal = parseInt(editDeliveryValue);
      if (!amount || !durVal || !editCoverLetter.trim()) {
        toast.error("Please fill in all fields");
        return;
      }
    } else {
      const validMs = editMilestones.filter(m => m.title.trim() && m.amount && m.duration);
      if (validMs.length === 0) {
        toast.error("Please add at least one milestone with name, duration, and price");
        return;
      }
      if (!editCoverLetter.trim()) {
        toast.error("Please fill in your cover letter");
        return;
      }
    }

    const vetResult = vetContent(editCoverLetter.trim());
    if (vetResult.blocked) {
      toast.error(vetResult.reason || "Your cover letter contains prohibited content.");
      return;
    }

    if (editProposalUploads.some(u => u.status === "uploading")) {
      toast.error("Please wait for file uploads to complete.");
      return;
    }
    if (editProposalUploads.some(u => u.status === "error")) {
      toast.error("Some files failed to upload. Remove or retry them before saving.");
      return;
    }

    setEditSubmitting(true);

    const freshUrls = editProposalUploads.filter(u => u.status === "done" && u.url).map(u => u.url!);
    const allAttachments = [...editAttachmentUrls, ...freshUrls];

    const totalBid = editPaymentType === "milestone"
      ? editMilestones.reduce((sum, m) => sum + parseCommaNumber(m.amountFormatted), 0)
      : parseCommaNumber(editBidAmountFormatted);

    const totalDays = editPaymentType === "milestone"
      ? Math.max(editMilestones.reduce((sum, m) => sum + toDays(parseInt(m.duration) || 0, m.durationUnit), 0), 1)
      : toDays(parseInt(editDeliveryValue) || 1, editDeliveryUnit);

    const milestonesData = editPaymentType === "milestone"
      ? editMilestones.filter(m => m.title.trim() && m.amount && m.duration).map(m => ({
          title: m.title.trim(),
          duration: parseInt(m.duration),
          duration_unit: m.durationUnit,
          amount: parseCommaNumber(m.amountFormatted),
        }))
      : [];

    let updatedProposal: any = null;
    try {
      const response = await updateMyJobProposal(existingProposal.id, {
        bid_amount: totalBid,
        delivery_days: totalDays,
        delivery_unit: editPaymentType === "project" ? editDeliveryUnit : "days",
        cover_letter: editCoverLetter.trim(),
        attachments: allAttachments.length > 0 ? allAttachments : undefined,
        payment_type: editPaymentType,
        milestones: milestonesData,
        edit_count: existingProposal.edit_count + 1,
        last_edited_at: new Date().toISOString(),
      });
      updatedProposal = response.proposal;
    } catch {
      toast.error("Failed to update proposal");
      setEditSubmitting(false);
      return;
    }

    toast.success("Proposal updated!");
    setEditingProposal(false);
    setEditSubmitting(false);

    if (updatedProposal) {
      setExistingProposal(updatedProposal);
      populateEditFields(updatedProposal);
    }
  };

  const deliveryLabel = () => {
    if (!job) return "";
    const d = job.delivery_days || 0;
    if (d <= 7) return "Up to 1 week";
    if (d <= 30) return `${Math.ceil(d / 7)} weeks (~${d} days)`;
    return `${Math.ceil(d / 30)} months (~${d} days)`;
  };

  if (loading) {
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

  if (!job) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Job not found</h2>
            <Button asChild><Link to="/jobs">Browse Jobs</Link></Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const renderExistingProposalView = () => {
    const p = existingProposal;
    const pType = p.payment_type || "project";
    const pUnit = p.delivery_unit || "days";

    return (
      <div className="bg-card rounded-xl border border-border p-4 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
          <h2 className="text-xl font-bold">Your Proposal</h2>
          <div className="flex gap-2">
            {editingProposal ? (
              <>
                <Button size="sm" onClick={handleEditProposal} disabled={editSubmitting || editProposalUploads.some(u => u.status === "uploading")}>
                  {editSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</>
                    : editProposalUploads.some(u => u.status === "uploading") ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Uploading...</>
                    : "Save Changes"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  setEditingProposal(false);
                  populateEditFields(existingProposal);
                }}>Cancel</Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={!canEditProposal()}
                onClick={() => {
                  if (!canEditProposal()) {
                    toast.error("The 3-hour edit window has passed. You can no longer edit this proposal.");
                    return;
                  }
                  setEditingProposal(true);
                }}
              >
                Edit Proposal {p.edit_count > 0 && `(${p.edit_count}/2 edits used)`}
              </Button>
            )}
          </div>
        </div>

        {editingProposal ? (
          /* ---- EDIT MODE ---- */
          <div className="space-y-6">
            {/* Payment Type Selection */}
            <div className="space-y-3">
              {(() => {
                const pref = job?.payment_type_preference;
                const isLocked = pref === "project" || pref === "milestone";
                if (isLocked) {
                  return (
                    <div className="flex items-start gap-3 p-4 rounded-lg border-2 border-primary bg-primary/5">
                      <div>
                        <p className="font-semibold text-foreground">
                          {pref === "project" ? "Pay by Project (Required by client)" : "Pay by Milestones (Required by client)"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          The client has specified the payment structure for this job.
                        </p>
                      </div>
                    </div>
                  );
                }
                return (
                  <>
                    <Label className="text-base font-semibold">How would you like to be paid?</Label>
                    <RadioGroup value={editPaymentType} onValueChange={(v) => setEditPaymentType(v as "project" | "milestone")} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label htmlFor="edit-pay-project" className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${editPaymentType === "project" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}>
                        <RadioGroupItem value="project" id="edit-pay-project" className="mt-0.5" />
                        <div>
                          <p className="font-medium text-foreground">Pay by Project</p>
                          <p className="text-xs text-muted-foreground">Get paid in full once the entire job is completed.</p>
                        </div>
                      </label>
                      <label htmlFor="edit-pay-milestone" className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${editPaymentType === "milestone" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}>
                        <RadioGroupItem value="milestone" id="edit-pay-milestone" className="mt-0.5" />
                        <div>
                          <p className="font-medium text-foreground">Pay by Milestone</p>
                          <p className="text-xs text-muted-foreground">Get paid in stages as you complete each milestone.</p>
                        </div>
                      </label>
                    </RadioGroup>
                  </>
                );
              })()}
            </div>

            {editPaymentType === "project" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Bid Amount (₦)</Label>
                    <MoneyInput
                      value={editBidAmountFormatted}
                      onChange={(raw, formatted) => { setEditBidAmount(raw); setEditBidAmountFormatted(formatted); }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Completion Time</Label>
                    <DurationInput
                      value={editDeliveryValue}
                      unit={editDeliveryUnit}
                      onValueChange={setEditDeliveryValue}
                      onUnitChange={setEditDeliveryUnit}
                    />
                  </div>
                </div>
                {parseCommaNumber(editBidAmountFormatted) > 0 && (
                  <ServiceChargeSummary amount={parseCommaNumber(editBidAmountFormatted)} />
                )}
              </div>
            )}

            {editPaymentType === "milestone" && (
              <div className="space-y-4">
                <Label className="text-sm font-semibold">Milestones</Label>
                <div className="space-y-3">
                  {editMilestones.map((ms, idx) => (
                    <div key={idx} className="p-4 rounded-lg border border-border bg-muted/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">Milestone {idx + 1}</span>
                        {editMilestones.length > 1 && (
                          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setEditMilestones(editMilestones.filter((_, i) => i !== idx))}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Task Name</Label>
                          <Input placeholder="e.g. Foundation drawings" value={ms.title} onChange={(e) => {
                            const updated = [...editMilestones];
                            updated[idx].title = e.target.value;
                            setEditMilestones(updated);
                          }} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Duration</Label>
                          <DurationInput
                            value={ms.duration}
                            unit={ms.durationUnit}
                            onValueChange={(v) => {
                              const updated = [...editMilestones];
                              updated[idx].duration = v;
                              setEditMilestones(updated);
                            }}
                            onUnitChange={(u) => {
                              const updated = [...editMilestones];
                              updated[idx].durationUnit = u;
                              setEditMilestones(updated);
                            }}
                            placeholder="e.g. 2"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Price (₦)</Label>
                          <MoneyInput
                            value={ms.amountFormatted}
                            onChange={(raw, formatted) => {
                              const updated = [...editMilestones];
                              updated[idx].amount = raw;
                              updated[idx].amountFormatted = formatted;
                              setEditMilestones(updated);
                            }}
                            placeholder="e.g. 50,000"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setEditMilestones([...editMilestones, { title: "", duration: "", durationUnit: "days", amount: "", amountFormatted: "" }])}>
                  <Plus className="h-4 w-4 mr-2" /> Add Milestone
                </Button>
                {(() => {
                  const total = editMilestones.reduce((sum, m) => sum + parseCommaNumber(m.amountFormatted), 0);
                  return total > 0 ? <ServiceChargeSummary amount={total} /> : null;
                })()}
              </div>
            )}

            <div className="space-y-2">
              <Label>Cover Letter</Label>
              <Textarea rows={6} value={editCoverLetter} onChange={(e) => setEditCoverLetter(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Attachments</Label>
              {editAttachmentUrls.length > 0 && (
                <div className="space-y-1">
                  {editAttachmentUrls.map((url, idx) => {
                    const name = url.split("/").pop() || `Attachment ${idx + 1}`;
                    return (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <span className="truncate">{decodeURIComponent(name)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditAttachmentUrls(editAttachmentUrls.filter((_, i) => i !== idx))}
                          className="ml-2 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {editProposalUploads.map((item) => (
                <div key={item.id} className="space-y-1">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <Paperclip className="h-4 w-4 text-primary shrink-0" />
                      <span className="truncate">{item.file.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 ml-2 shrink-0">
                      {item.status === "uploading" && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                      {item.status === "error" && <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
                      {item.status !== "uploading" && (
                        <button type="button" onClick={() => setEditProposalUploads(prev => prev.filter(u => u.id !== item.id))} className="text-muted-foreground hover:text-destructive transition-colors">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  {item.status === "uploading" && (
                    <div className="h-1 bg-muted rounded-full overflow-hidden ml-7">
                      {item.progress > 0
                        ? <div className="h-full bg-primary transition-all duration-150" style={{ width: `${item.progress}%` }} />
                        : <div className="h-full bg-primary animate-pulse w-1/3" />}
                    </div>
                  )}
                  {item.status === "error" && (
                    <div className="flex items-center gap-2 ml-7">
                      <p className="text-xs text-destructive flex-1">{item.errorMsg}</p>
                      <button type="button" onClick={() => {
                        const reset = { ...item, status: "uploading" as UploadStatus, progress: 0, errorMsg: null };
                        setEditProposalUploads(prev => prev.map(u => u.id === item.id ? reset : u));
                        startUpload(reset, setEditProposalUploads);
                      }} className="text-xs text-primary hover:underline shrink-0">Retry</button>
                    </div>
                  )}
                </div>
              ))}
              {editAttachmentUrls.length + editProposalUploads.length < 5 && (
                <button
                  type="button"
                  onClick={() => editProposalFileRef.current?.click()}
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Paperclip className="h-4 w-4" /> Add attachment
                </button>
              )}
              <input
                ref={editProposalFileRef}
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.dwg,.dxf,.zip"
                multiple
                className="hidden"
                onChange={handleEditFileChange}
              />
            </div>
          </div>
        ) : (
          /* ---- VIEW MODE ---- */
          <div className="space-y-4">
            <Badge variant="outline" className="mb-2">
              {pType === "milestone" ? "Pay by Milestone" : "Pay by Project"}
            </Badge>

            {pType === "milestone" && p.milestones?.length > 0 ? (
              <div className="space-y-3">
                {p.milestones.map((ms: any, idx: number) => (
                  <div key={idx} className="p-3 rounded-lg border border-border bg-muted/30 flex items-start sm:items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">{ms.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Duration: {ms.duration ? `${ms.duration} ${ms.duration_unit || ms.durationUnit || "days"}` : (ms.date ? new Date(ms.date).toLocaleDateString() : "—")}
                      </p>
                    </div>
                    <p className="font-semibold text-foreground">{format(ms.amount)}</p>
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Total Bid</Label>
                    <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm font-medium">{format(p.bid_amount)}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Bid Amount (₦)</Label>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm font-medium">{format(p.bid_amount)}</div>
                </div>
                <div className="space-y-2">
                  <Label>Delivery</Label>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm font-medium">{formatDuration(p.delivery_days, pUnit)}</div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Cover Letter</Label>
              <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm whitespace-pre-wrap">{p.cover_letter}</div>
            </div>
            {p.attachments && p.attachments.length > 0 && (
              <div className="space-y-2">
                <Label>Attachments</Label>
                <div className="space-y-1">
                  {p.attachments.map((url: string, idx: number) => {
                    const name = url.split("/").pop() || `Attachment ${idx + 1}`;
                    return (
                      <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border text-sm hover:bg-muted transition-colors">
                        <Download className="h-4 w-4 text-primary shrink-0" />
                        <span className="truncate">{name}</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-2">
              <span>Status: <Badge variant="secondary" className="text-xs">{p.status}</Badge></span>
              <span>Submitted: {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</span>
              {!canEditProposal() && <span className="text-destructive">Edit window expired</span>}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (submittedConfirmation) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 bg-muted/30 py-4 sm:py-8 flex items-center justify-center">
          <div className="max-w-md w-full mx-auto px-4">
            <div className="bg-card rounded-xl border border-border p-6 sm:p-10 text-center space-y-6">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-primary" />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-foreground">Proposal Submitted!</h2>
                <p className="text-muted-foreground">
                  Your proposal has been sent to the client. They typically reach out within 1–3 business days.
                </p>
              </div>
              <div className="flex flex-col gap-3 pt-2">
                <Button onClick={() => navigate("/jobs")} className="w-full">
                  Keep Browsing Gigs <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setSubmittedConfirmation(false)}>
                  View My Proposal
                </Button>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-4 sm:py-8">
        <div className="container-wide">
          <Button variant="ghost" onClick={() => navigate(`/job/${id}`)} className="mb-4 sm:mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Job
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Proposal Section */}
              {existingProposal ? renderExistingProposalView() : (
                <div className="bg-card rounded-xl border border-border p-4 sm:p-8">
                  <h2 className="text-xl font-bold mb-4 sm:mb-6">Submit Your Proposal</h2>
                  <form onSubmit={handleSubmitProposal} className="space-y-6">
                    {/* Payment Type Selection */}
                    <div className="space-y-3">
                      {(() => {
                        const pref = job?.payment_type_preference;
                        const isLocked = pref === "project" || pref === "milestone";
                        if (isLocked) {
                          return (
                            <div className="flex items-start gap-3 p-4 rounded-lg border-2 border-primary bg-primary/5">
                              <div>
                                <p className="font-semibold text-foreground">
                                  {pref === "project" ? "Pay by Project (Required by client)" : "Pay by Milestones (Required by client)"}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  The client has specified the payment structure for this job. You can still adjust amounts{pref === "milestone" ? " and milestones" : ""}.
                                </p>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <>
                            <Label className="text-base font-semibold">How would you like to be paid?</Label>
                            <RadioGroup value={paymentType} onValueChange={(v) => setPaymentType(v as "project" | "milestone")} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <label htmlFor="pay-project" className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${paymentType === "project" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}>
                                <RadioGroupItem value="project" id="pay-project" className="mt-0.5" />
                                <div>
                                  <p className="font-medium text-foreground">Pay by Project</p>
                                  <p className="text-xs text-muted-foreground">Get paid in full once the entire job is completed.</p>
                                </div>
                              </label>
                              <label htmlFor="pay-milestone" className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${paymentType === "milestone" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}>
                                <RadioGroupItem value="milestone" id="pay-milestone" className="mt-0.5" />
                                <div>
                                  <p className="font-medium text-foreground">Pay by Milestone</p>
                                  <p className="text-xs text-muted-foreground">Get paid in stages as you complete each milestone.</p>
                                </div>
                              </label>
                            </RadioGroup>
                          </>
                        );
                      })()}
                    </div>

                    {/* Payment Details - By Project */}
                    {paymentType === "project" && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Bid Amount (₦)</Label>
                            <MoneyInput
                              value={bidAmountFormatted}
                              onChange={(raw, formatted) => { setBidAmount(raw); setBidAmountFormatted(formatted); }}
                              placeholder={job.budget_max ? `Up to ${format(job.budget_max)}` : "e.g. 250,000"}
                            />
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Info className="h-3 w-3 shrink-0" />
                              {parseCommaNumber(bidAmountFormatted) > 0
                                ? `Service fee: ${getServiceChargeLabel(parseCommaNumber(bidAmountFormatted))} on this bid.`
                                : "Service fee: 7–20% depending on bid amount."}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label>Completion Time</Label>
                            <DurationInput
                              value={deliveryValue}
                              unit={deliveryUnit}
                              onValueChange={setDeliveryValue}
                              onUnitChange={setDeliveryUnit}
                              placeholder={job.delivery_days ? `${job.delivery_days}` : "e.g. 14"}
                            />
                          </div>
                        </div>
                        {parseCommaNumber(bidAmountFormatted) > 0 && (
                          <ServiceChargeSummary amount={parseCommaNumber(bidAmountFormatted)} />
                        )}
                      </div>
                    )}

                    {/* Payment Details - By Milestone */}
                    {paymentType === "milestone" && (
                      <div className="space-y-4">
                        <Label className="text-sm font-semibold">Milestones</Label>
                        <div className="space-y-3">
                          {milestones.map((ms, idx) => (
                            <div key={idx} className="p-4 rounded-lg border border-border bg-muted/30 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-foreground">Milestone {idx + 1}</span>
                                {milestones.length > 1 && (
                                  <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setMilestones(milestones.filter((_, i) => i !== idx))}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs">Task Name</Label>
                                  <Input placeholder="e.g. Foundation drawings" value={ms.title} onChange={(e) => {
                                    const updated = [...milestones];
                                    updated[idx].title = e.target.value;
                                    setMilestones(updated);
                                  }} />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Duration</Label>
                                  <DurationInput
                                    value={ms.duration}
                                    unit={ms.durationUnit}
                                    onValueChange={(v) => {
                                      const updated = [...milestones];
                                      updated[idx].duration = v;
                                      setMilestones(updated);
                                    }}
                                    onUnitChange={(u) => {
                                      const updated = [...milestones];
                                      updated[idx].durationUnit = u;
                                      setMilestones(updated);
                                    }}
                                    placeholder="e.g. 2"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Price (₦)</Label>
                                  <MoneyInput
                                    value={ms.amountFormatted}
                                    onChange={(raw, formatted) => {
                                      const updated = [...milestones];
                                      updated[idx].amount = raw;
                                      updated[idx].amountFormatted = formatted;
                                      setMilestones(updated);
                                    }}
                                    placeholder="e.g. 50,000"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => setMilestones([...milestones, { title: "", duration: "", durationUnit: "days", amount: "", amountFormatted: "" }])}>
                          <Plus className="h-4 w-4 mr-2" /> Add Milestone
                        </Button>

                        {(() => {
                          const totalMilestoneAmount = milestones.reduce((sum, m) => sum + parseCommaNumber(m.amountFormatted), 0);
                          return totalMilestoneAmount > 0 ? <ServiceChargeSummary amount={totalMilestoneAmount} /> : null;
                        })()}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Cover Letter</Label>
                      <Textarea placeholder="Explain why you're the best fit... (No contact details allowed)" rows={6} value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} />
                      <p className="text-xs text-muted-foreground">
                        ⚠️ Sharing private contact information is prohibited and will be blocked.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Attachments (optional)</Label>
                      <p className="text-xs text-muted-foreground">Upload supporting files — PDF, DOC, PNG, JPG, DWG, DXF, ZIP. Max 5 files.</p>
                      <input
                        ref={proposalFileRef}
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.dwg,.dxf,.zip"
                        className="hidden"
                        onChange={handleProposalFileChange}
                      />
                      <Button type="button" variant="outline" size="sm" onClick={() => proposalFileRef.current?.click()} disabled={proposalUploads.length >= 5}>
                        <Paperclip className="h-4 w-4 mr-2" /> Add Files
                      </Button>
                      {proposalUploads.length > 0 && (
                        <div className="space-y-1.5 mt-2">
                          {proposalUploads.map((item) => (
                            <div key={item.id} className="space-y-1">
                              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border text-sm">
                                <FileText className="h-4 w-4 text-primary shrink-0" />
                                <span className="flex-1 truncate">{item.file.name}</span>
                                <span className="text-xs text-muted-foreground">{(item.file.size / 1024).toFixed(0)} KB</span>
                                {item.status === "uploading" && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
                                {item.status === "error" && <AlertCircle className="h-4 w-4 text-destructive shrink-0" />}
                                {item.status !== "uploading" && (
                                  <button type="button" onClick={() => setProposalUploads(prev => prev.filter(u => u.id !== item.id))}>
                                    <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                  </button>
                                )}
                              </div>
                              {item.status === "uploading" && (
                                <div className="h-1 bg-muted rounded-full overflow-hidden ml-7">
                                  {item.progress > 0
                                    ? <div className="h-full bg-primary transition-all duration-150" style={{ width: `${item.progress}%` }} />
                                    : <div className="h-full bg-primary animate-pulse w-1/3" />}
                                </div>
                              )}
                              {item.status === "error" && (
                                <div className="flex items-center gap-2 ml-7">
                                  <p className="text-xs text-destructive flex-1">{item.errorMsg}</p>
                                  <button type="button" onClick={() => {
                                    const reset = { ...item, status: "uploading" as UploadStatus, progress: 0, errorMsg: null };
                                    setProposalUploads(prev => prev.map(u => u.id === item.id ? reset : u));
                                    startUpload(reset, setProposalUploads);
                                  }} className="text-xs text-primary hover:underline shrink-0">Retry</button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground border border-border rounded-lg p-3 bg-muted/30">
                      <strong>NB:</strong> You may attach up to 5 files. Submissions are reviewed by the client and you will be notified of any updates to your proposal status.
                    </p>

                    {job?.is_nda && (
                      <div className={`rounded-lg border p-4 space-y-3 ${ndaAcknowledged ? "border-primary/40 bg-primary/5" : "border-amber-400/60 bg-amber-50 dark:bg-amber-950/20"}`}>
                        <div className="flex items-start gap-2">
                          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <div className="space-y-2 flex-1">
                            <p className="text-sm font-medium text-foreground">NDA Required</p>
                            {job.nda_url ? (
                              <a
                                href={job.nda_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs text-primary underline"
                              >
                                <Download className="h-3.5 w-3.5" /> Download NDA Document
                              </a>
                            ) : (
                              <p className="text-xs text-muted-foreground">The client will share the NDA document directly. Review it before proceeding with work.</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <Checkbox
                            id="nda-ack"
                            checked={ndaAcknowledged}
                            onCheckedChange={(v) => setNdaAcknowledged(v === true)}
                            className="mt-0.5"
                          />
                          <Label htmlFor="nda-ack" className="text-sm cursor-pointer leading-snug">
                            I have read and agree to the NDA terms for this job
                          </Label>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button type="submit" disabled={submitting || proposalUploads.some(u => u.status === "uploading") || (job?.is_nda && !ndaAcknowledged)} className="w-full sm:w-auto">
                        {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting...</>
                          : proposalUploads.some(u => u.status === "uploading") ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Uploading files...</>
                          : <><Send className="h-4 w-4 mr-2" />Submit Proposal</>}
                      </Button>
                      <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => navigate(`/job/${id}`)}>Cancel</Button>
                    </div>
                  </form>
                </div>
              )}

              {/* Job Details Summary */}
              <div className="bg-card rounded-xl border border-border p-4 sm:p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                  About this Gig
                </h3>
                <div className="space-y-4">
                  <div>
                    <Link to={`/job/${id}`} className="text-xl font-bold text-foreground hover:text-primary transition-colors">
                      {job.title}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Badge variant={job.status === "open" ? "default" : "secondary"}>{job.status.split("_").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}</Badge>
                      {job.is_remote && <Badge variant="outline"><Globe className="h-3 w-3 mr-1" />Remote</Badge>}
                      <Badge variant="outline">{job.is_hourly ? "Hourly" : "Fixed Price"}</Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">{job.description}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <MiniTile icon={DollarSign} label="Budget" value={
                      job.budget_min && job.budget_max
                        ? `${format(job.budget_min)} - ${format(job.budget_max)}`
                        : job.budget_min ? format(job.budget_min) : "Negotiable"
                    } />
                    <MiniTile icon={Clock} label="Duration" value={deliveryLabel()} />
                    <MiniTile icon={Wrench} label="Skill Level" value={(job as any).skill_level || "Intermediate"} />
                    {job.state && <MiniTile icon={MapPin} label="Location" value={job.is_remote ? "Remote" : `${job.city || ""} ${job.state}`} />}
                  </div>

                  {(job.required_skills?.length > 0 || job.required_software?.length > 0) && (
                    <div className="flex flex-wrap gap-2">
                      {[...(job.required_skills || []), ...(job.required_software || [])].map((s: string) => (
                        <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-card rounded-xl border border-border p-4 sm:p-6">
                <h3 className="font-semibold mb-4">Budget</h3>
                <p className="text-2xl font-bold text-primary">
                  {job.budget_min && job.budget_max
                    ? `${format(job.budget_min)} - ${format(job.budget_max)}`
                    : job.budget_min ? format(job.budget_min) : "Negotiable"}
                </p>
                {job.is_hourly && <p className="text-sm text-muted-foreground mt-1">Hourly rate</p>}
              </div>

              <div className="bg-card rounded-xl border border-border p-4 sm:p-6">
                <h3 className="font-semibold mb-2">Tips for a great proposal</h3>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• Highlight relevant experience</li>
                  <li>• Be specific about your approach</li>
                  <li>• Set a realistic timeline</li>
                  <li>• Attach samples of similar work</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <KycRequiredModal open={showKycModal} onClose={() => setShowKycModal(false)} action="submit a proposal" />
    </div>
  );
}

function ServiceChargeSummary({ amount }: { amount: number }) {
  const { format } = useCurrency();
  const { rateLabel, charge, takeHome } = calculateServiceCharge(amount);
  return (
    <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Total Project Price</span>
        <span className="font-semibold text-foreground">{format(amount)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Service Charge ({rateLabel})</span>
        <span className="text-destructive">-{format(charge)}</span>
      </div>
      <div className="border-t border-border pt-2 flex justify-between text-sm">
        <span className="font-semibold text-foreground">Your Take-Home</span>
        <span className="font-bold text-primary">{format(takeHome)}</span>
      </div>
    </div>
  );
}

function MiniTile({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg bg-muted/50 border border-border">
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-xs font-medium text-foreground">{value}</p>
    </div>
  );
}
