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
import { supabase } from "@/integrations/supabase/client";
import { getDisputeDetail, submitDisputeResponse } from "@/api/contracts.api";
import { formatNaira } from "@/lib/nigerian-data";
import { DisputeChat } from "@/components/dispute/DisputeChat";
import { formatDistanceToNow, format, isPast } from "date-fns";
import { toast } from "sonner";
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
} from "lucide-react";

const DISPUTE_STATUS_CONFIG: Record<
  string,
  { variant: "default" | "secondary" | "destructive" | "outline"; label: string }
> = {
  awaiting_response: { variant: "destructive", label: "Awaiting Response" },
  under_review: { variant: "secondary", label: "Under Review" },
  resolved: { variant: "default", label: "Resolved" },
};

export default function DisputeDetail() {
  const { disputeId } = useParams<{ disputeId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [dispute, setDispute] = useState<any>(null);
  const [contract, setContract] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showRespond, setShowRespond] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [responseFiles, setResponseFiles] = useState<File[]>([]);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 5);
    setResponseFiles((prev) => [...prev, ...files].slice(0, 5));
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmitResponse = async () => {
    if (!responseText.trim()) {
      toast.error("Please provide your explanation");
      return;
    }

    setActionLoading(true);
    const evidenceUrls: string[] = [];

    for (const file of responseFiles) {
      const path = `disputes/${user!.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("contract-attachments").upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from("contract-attachments").getPublicUrl(path);
        evidenceUrls.push(data.publicUrl);
      }
    }

    try {
      await submitDisputeResponse(disputeId!, responseText.trim(), evidenceUrls);
      toast.success("Response submitted. Case is now under review.");
      setShowRespond(false);
      setResponseText("");
      setResponseFiles([]);
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
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
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
                  Amount in Escrow:{" "}
                  <span className="text-primary font-semibold">{formatNaira(contract.amount)}</span>
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
                      : `Deadline: ${format(new Date(dispute.response_deadline), "PPp")}`}
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

      <Dialog open={showRespond} onOpenChange={setShowRespond}>
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
              <Label>Evidence Files (optional, max 5)</Label>
              <input ref={fileRef} type="file" className="hidden" multiple onChange={handleFileChange} />
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                <Paperclip className="h-4 w-4 mr-2" /> Add Files
              </Button>
              {responseFiles.length > 0 && (
                <div className="space-y-2">
                  {responseFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded border border-border bg-muted/50">
                      <span className="text-sm truncate">{file.name}</span>
                      <button onClick={() => setResponseFiles((prev) => prev.filter((_, i) => i !== idx))}>
                        <X className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRespond(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitResponse} disabled={actionLoading || !responseText.trim()}>
              {actionLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Submit Response
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
