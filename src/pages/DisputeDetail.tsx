import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { getLocalStorageToken } from "@/api/axios";
import { getDisputeDetail, submitDisputeResponse } from "@/api/contracts.api";
import { useCurrency } from "@/hooks/useCurrency";
import { DisputeChat } from "@/components/dispute/DisputeChat";
import { formatDistanceToNow, format as fnsFormat, isPast } from "date-fns";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Clock,
  Download,
  Paperclip,
  X,
  Send,
  CheckCircle2,
  Gavel,
  MessageSquare,
  AlertCircle,
  RotateCcw,
} from "lucide-react";

type UploadStatus = "uploading" | "done" | "error";
type UploadItem = { id: string; file: File; progress: number; status: UploadStatus; url: string | null; errorMsg: string | null };

const DISPUTE_STATUS_CONFIG: Record<
  string,
  { variant: "default" | "secondary" | "destructive" | "outline"; label: string }
> = {
  awaiting_response: { variant: "destructive", label: "Awaiting Response" },
  under_review: { variant: "secondary", label: "Under Review" },
  resolved: { variant: "default", label: "Resolved" },
};

export default function DisputeDetail() {
  const { format } = useCurrency();
  const { disputeId } = useParams<{ disputeId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [dispute, setDispute] = useState<any>(null);
  const [contract, setContract] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showRespond, setShowRespond] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [responseUploads, setResponseUploads] = useState<UploadItem[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (disputeId) {
      void fetchData();
    }
  }, [disputeId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getDisputeDetail(disputeId!);
      setDispute(data.dispute || null);
      setContract(data.contract || null);
    } catch (error) {
      setDispute(null);
      setContract(null);
    } finally {
      setLoading(false);
    }
  };

  const isRespondent = dispute?.respondent_id === user?.id;
  const isParticipant =
    contract && (contract.client_id === user?.id || contract.freelancer_id === user?.id);
  const isAdjudicator = dispute?.adjudicator_id === user?.id;
  const hasAccess = isParticipant || isAdjudicator;

  const raiserProfile =
    contract?.client?.id === dispute?.raised_by ? contract?.client : contract?.freelancer;
  const respondentProfile =
    contract?.client?.id === dispute?.respondent_id ? contract?.client : contract?.freelancer;

  const deadlineExpired =
    dispute?.response_deadline && isPast(new Date(dispute.response_deadline));

  const uploadOneFile = (item: UploadItem) => {
    const token = getLocalStorageToken();
    const formData = new FormData();
    formData.append("files", item.file);
    const xhr = new XMLHttpRequest();
    const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
    xhr.open("POST", `${baseUrl}/contracts/attachments`, true);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        setResponseUploads((prev) => prev.map((u) => u.id === item.id ? { ...u, progress: pct } : u));
      }
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const res = JSON.parse(xhr.responseText);
        const url = res?.data?.urls?.[0] ?? null;
        setResponseUploads((prev) => prev.map((u) => u.id === item.id ? { ...u, status: "done", progress: 100, url } : u));
      } else {
        let msg = "Upload failed";
        try { msg = JSON.parse(xhr.responseText)?.message || msg; } catch {}
        setResponseUploads((prev) => prev.map((u) => u.id === item.id ? { ...u, status: "error", errorMsg: msg } : u));
      }
    });
    xhr.addEventListener("error", () => {
      setResponseUploads((prev) => prev.map((u) => u.id === item.id ? { ...u, status: "error", errorMsg: "Network error" } : u));
    });
    xhr.send(formData);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => /\.(pdf|png|jpg|jpeg|zip|doc|docx)$/i.test(f.name));
    const newItems: UploadItem[] = files.map(f => ({ id: `${Date.now()}_${Math.random()}`, file: f, progress: 0, status: "uploading", url: null, errorMsg: null }));
    setResponseUploads((prev) => {
      const merged = [...prev, ...newItems].slice(0, 5);
      newItems.forEach(item => uploadOneFile(item));
      return merged;
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  const retryUpload = (item: UploadItem) => {
    const retry = { ...item, status: "uploading" as UploadStatus, progress: 0, errorMsg: null };
    setResponseUploads((prev) => prev.map((u) => u.id === item.id ? retry : u));
    uploadOneFile(retry);
  };

  const handleSubmitResponse = async () => {
    if (!responseText.trim()) { toast.error("Please provide your explanation"); return; }
    if (responseUploads.some(u => u.status === "uploading")) { toast.error("Please wait for evidence uploads to finish"); return; }
    if (responseUploads.some(u => u.status === "error")) { toast.error("Some evidence files failed to upload. Remove or retry before submitting."); return; }

    setActionLoading(true);
    const evidenceUrls = responseUploads.filter(u => u.status === "done" && u.url).map(u => u.url!);

    try {
      await submitDisputeResponse(disputeId!, responseText.trim(), evidenceUrls);
      toast.success("Response submitted. Case is now under review.");
      setShowRespond(false);
      setResponseText("");
      setResponseUploads([]);
      void fetchData();
    } catch (error) {
      toast.error("Failed to submit response");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 bg-muted/30 py-8">
          <div className="container-wide max-w-3xl">
            <Skeleton className="h-9 w-44 mb-4" />
            {/* Dispute header */}
            <div className="bg-card rounded-xl border border-border p-6 mb-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Skeleton className="h-6 w-48 mb-2" />
                  <Skeleton className="h-3 w-40 mb-1.5" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
            </div>
            {/* Timeline / evidence */}
            <div className="bg-card rounded-xl border border-border p-6 mb-6">
              <Skeleton className="h-5 w-32 mb-5" />
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-4">
                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-full mb-1" />
                      <Skeleton className="h-3 w-4/5" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Response box */}
            <div className="bg-card rounded-xl border border-border p-6">
              <Skeleton className="h-24 w-full mb-3" />
              <Skeleton className="h-10 w-28" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!dispute || !contract || !hasAccess) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Dispute not found or access denied.</p>
        </div>
        <Footer />
      </div>
    );
  }

  const statusCfg =
    DISPUTE_STATUS_CONFIG[dispute.dispute_status] || DISPUTE_STATUS_CONFIG.awaiting_response;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-wide max-w-3xl">
          <Button
            variant="ghost"
            onClick={() =>
              navigate(isAdjudicator ? "/admin/disputes" : `/contract/${contract.id}?tab=disputes`)
            }
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {isAdjudicator ? "Back to Disputes" : "Back to Contract"}
          </Button>

          <div className="bg-card rounded-xl border border-border p-6 mb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                  <h1 className="text-xl font-bold text-foreground">Dispute Resolution</h1>
                </div>
                <p className="text-sm text-muted-foreground">Contract: {contract.job_title}</p>
                <p className="text-sm text-muted-foreground">
                  Disputed Amount:{" "}
                  <span className="text-primary font-semibold">{format(contract.amount)}</span>
                </p>
              </div>
              <Badge variant={statusCfg.variant} className="text-sm">
                {statusCfg.label}
              </Badge>
            </div>
          </div>

          <div className="bg-card rounded-xl border-2 border-destructive/20 p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Avatar className="h-8 w-8">
                <AvatarImage src={raiserProfile?.avatar_url || undefined} />
                <AvatarFallback className="bg-destructive/10 text-destructive">
                  {(raiserProfile?.full_name || "U")[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  <Link to={`/expert/${raiserProfile?.id}/profile`} className="hover:text-primary hover:underline">
                    {raiserProfile?.full_name}
                  </Link>{" "}
                  <Badge variant="outline" className="ml-1 text-xs">
                    Complainant
                  </Badge>
                </p>
                <p className="text-xs text-muted-foreground">
                  Filed {formatDistanceToNow(new Date(dispute.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <p className="text-sm text-foreground whitespace-pre-wrap">{dispute.reason}</p>
            </div>
            {dispute.evidence_urls?.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Evidence ({dispute.evidence_urls.length} files)
                </p>
                {dispute.evidence_urls.map((url: string, i: number) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-muted/50 text-sm text-primary"
                  >
                    <Download className="h-4 w-4" /> Evidence {i + 1}
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className={`bg-card rounded-xl border-2 p-6 mb-6 ${dispute.respondent_explanation ? "border-primary/20" : "border-dashed border-border"}`}>
            <div className="flex items-center gap-3 mb-4">
              <Avatar className="h-8 w-8">
                <AvatarImage src={respondentProfile?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {(respondentProfile?.full_name || "U")[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">
                  <Link to={`/expert/${respondentProfile?.id}/profile`} className="hover:text-primary hover:underline">
                    {respondentProfile?.full_name}
                  </Link>{" "}
                  <Badge variant="outline" className="ml-1 text-xs">
                    Respondent
                  </Badge>
                </p>
                {dispute.response_deadline && !dispute.respondent_explanation && (
                  <p className={`text-xs ${deadlineExpired ? "text-destructive font-medium" : "text-amber-500"}`}>
                    {deadlineExpired
                      ? "Response deadline expired"
                      : `Deadline: ${fnsFormat(new Date(dispute.response_deadline), "PPp")}`}
                  </p>
                )}
              </div>
            </div>

            {dispute.respondent_explanation ? (
              <>
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <p className="text-sm text-foreground whitespace-pre-wrap">{dispute.respondent_explanation}</p>
                </div>
                {dispute.respondent_evidence_urls?.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Evidence ({dispute.respondent_evidence_urls.length} files)
                    </p>
                    {dispute.respondent_evidence_urls.map((url: string, i: number) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-muted/50 text-sm text-primary"
                      >
                        <Download className="h-4 w-4" /> Evidence {i + 1}
                      </a>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-6">
                <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground">Awaiting response from respondent</p>
                {isRespondent && dispute.dispute_status === "awaiting_response" && (
                  <Button className="mt-3" onClick={() => setShowRespond(true)}>
                    <Send className="h-4 w-4 mr-2" /> Submit Your Response
                  </Button>
                )}
              </div>
            )}
          </div>

          {dispute.dispute_status === "resolved" && dispute.resolution_explanation && (
            <div className="bg-card rounded-xl border-2 border-primary p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Gavel className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Adjudicator Decision</p>
                  <p className="text-xs text-muted-foreground">
                    Resolved{" "}
                    {dispute.resolved_at
                      ? formatDistanceToNow(new Date(dispute.resolved_at), { addSuffix: true })
                      : ""}
                  </p>
                </div>
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap">{dispute.resolution_explanation}</p>
            </div>
          )}

          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Dispute Chat</h2>
            </div>
            <DisputeChat disputeId={dispute.id} currentUserId={user?.id || ""} />
          </div>
        </div>
      </main>
      <Footer />

      <Dialog open={showRespond} onOpenChange={(open) => { if (!open) { setResponseUploads([]); setResponseText(""); } setShowRespond(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Dispute Response</DialogTitle>
            <DialogDescription>
              Provide your side of the issue and upload any supporting evidence.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Explanation *</Label>
              <Textarea
                rows={6}
                placeholder="Describe what happened and why you disagree..."
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Evidence Files <span className="text-muted-foreground text-xs">(optional, up to 5)</span></Label>
              <input ref={fileRef} type="file" className="hidden" multiple accept=".pdf,.png,.jpg,.jpeg,.zip,.doc,.docx" onChange={handleFileChange} />
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={responseUploads.length >= 5}>
                <Paperclip className="h-4 w-4 mr-2" /> Add Files
              </Button>
              {responseUploads.length > 0 && (
                <div className="space-y-2 mt-1">
                  {responseUploads.map((item) => (
                    <div key={item.id} className="rounded-lg border border-border bg-muted/50 p-2 space-y-1">
                      <div className="flex items-center gap-2">
                        {item.status === "uploading" && <Loader2 className="h-4 w-4 text-primary shrink-0 animate-spin" />}
                        {item.status === "done" && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
                        {item.status === "error" && <AlertCircle className="h-4 w-4 text-destructive shrink-0" />}
                        <span className="text-sm flex-1 truncate">{item.file.name}</span>
                        {item.status === "error" && (
                          <button type="button" onClick={() => retryUpload(item)} className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0">
                            <RotateCcw className="h-3 w-3" /> Retry
                          </button>
                        )}
                        <X className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground shrink-0" onClick={() => setResponseUploads(p => p.filter(u => u.id !== item.id))} />
                      </div>
                      {item.status === "uploading" && (
                        <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-primary transition-all duration-200 rounded-full" style={{ width: `${item.progress}%` }} />
                        </div>
                      )}
                      {item.status === "error" && <p className="text-xs text-destructive">{item.errorMsg}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowRespond(false); setResponseUploads([]); setResponseText(""); }}>
              Cancel
            </Button>
            <Button onClick={handleSubmitResponse} disabled={actionLoading || !responseText.trim() || responseUploads.some(u => u.status === "uploading")}>
              {(actionLoading || responseUploads.some(u => u.status === "uploading")) ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              {responseUploads.some(u => u.status === "uploading") ? "Uploading evidence..." : "Submit Response"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
