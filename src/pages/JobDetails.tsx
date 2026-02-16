import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatNaira } from "@/lib/nigerian-data";
import { formatDistanceToNow } from "date-fns";
import { vetContent } from "@/lib/content-vetting";
import {
  MapPin, Clock, Briefcase, Calendar, ArrowLeft, Send, Loader2, Globe,
  UserCheck, Users, FileText, Download, Info, DollarSign, Tag, Layers, Wrench, ShieldAlert, Paperclip, X
} from "lucide-react";

export default function JobDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [job, setJob] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [proposalCount, setProposalCount] = useState(0);
  const [interviewingCount, setInterviewingCount] = useState(0);
  const [similarJobs, setSimilarJobs] = useState<any[]>([]);
  const [hasApplied, setHasApplied] = useState(false);

  // Proposal form
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [bidAmount, setBidAmount] = useState("");
  const [deliveryDays, setDeliveryDays] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [proposalFiles, setProposalFiles] = useState<File[]>([]);
  const proposalFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id) fetchJob();
  }, [id]);

  const fetchJob = async () => {
    const { data: jobData, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !jobData) {
      setLoading(false);
      return;
    }
    setJob(jobData);

    const [clientRes, proposalRes, interviewRes, walletRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", jobData.client_id).single(),
      supabase.from("proposals").select("id", { count: "exact" }).eq("job_id", id!),
      supabase.from("proposals").select("id", { count: "exact" }).eq("job_id", id!).eq("status", "interviewing"),
      supabase.from("wallets").select("*").eq("user_id", jobData.client_id).maybeSingle(),
    ]);

    setClient(clientRes.data);
    setProposalCount(proposalRes.count || 0);
    setInterviewingCount(interviewRes.count || 0);
    setWallet(walletRes.data);

    // Check if current user already applied
    if (user) {
      const { data: existing } = await supabase
        .from("proposals")
        .select("id")
        .eq("job_id", id!)
        .eq("freelancer_id", user.id)
        .maybeSingle();
      setHasApplied(!!existing);
    }

    // Fetch similar jobs
    const { data: similar } = await supabase
      .from("jobs")
      .select("id, title, budget_min, budget_max, is_hourly, created_at, state, city, is_remote, delivery_days, status")
      .eq("status", "open")
      .neq("id", id!)
      .limit(4);
    setSimilarJobs(similar || []);

    setLoading(false);
  };

  const handleProposalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const allowed = files.filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'dwg', 'dxf', 'zip'].includes(ext || '');
    });
    if (allowed.length < files.length) {
      toast.error("Some files were skipped. Allowed: PDF, DOC, DOCX, PNG, JPG, DWG, DXF, ZIP");
    }
    setProposalFiles(prev => [...prev, ...allowed].slice(0, 5));
    if (proposalFileRef.current) proposalFileRef.current.value = '';
  };

  const uploadProposalAttachments = async (): Promise<string[]> => {
    if (!proposalFiles.length || !user) return [];
    const urls: string[] = [];
    for (const file of proposalFiles) {
      const path = `${user.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from('proposal-attachments').upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from('proposal-attachments').getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    return urls;
  };

  const handleSubmitProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;

    const amount = parseInt(bidAmount);
    const days = parseInt(deliveryDays);
    if (!amount || !days || !coverLetter.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    if (days < 1) {
      toast.error("Delivery days must be at least 1");
      return;
    }

    // Client-side vetting first
    const vetResult = vetContent(coverLetter.trim());
    if (vetResult.blocked) {
      toast.error(vetResult.reason || "Your cover letter contains prohibited content.");
      return;
    }

    setSubmitting(true);

    // Upload attachments first
    const attachmentUrls = await uploadProposalAttachments();

    // Submit via edge function for server-side moderation
    const response = await supabase.functions.invoke("moderate-proposal", {
      body: {
        job_id: id,
        bid_amount: amount,
        delivery_days: days,
        cover_letter: coverLetter.trim(),
        attachments: attachmentUrls.length > 0 ? attachmentUrls : undefined,
      },
    });

    if (response.error) {
      const msg = typeof response.error === "object" && response.error.message
        ? response.error.message
        : "Your proposal was blocked due to policy violations.";
      toast.error(msg);
      setSubmitting(false);
      return;
    }

    if (response.data?.error) {
      toast.error(response.data.error);
      setSubmitting(false);
      return;
    }

    toast.success("Proposal submitted!");
    setShowProposalForm(false);
    setHasApplied(true);
    setProposalCount((c) => c + 1);
    setSubmitting(false);
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

  const isAssigned = job.status === "in_progress" || job.status === "completed" || job.status === "cancelled";
  const canApply = profile?.role === "freelancer" && job.status === "open" && !showProposalForm && !hasApplied;
  const paymentReady = wallet && wallet.balance >= (job.budget_max || job.budget_min || 0);

  const deliveryLabel = () => {
    const d = job.delivery_days || 0;
    if (d <= 7) return "Up to 1 week";
    if (d <= 30) return `${Math.ceil(d / 7)} weeks (~${d} days)`;
    if (d <= 90) return `${Math.ceil(d / 30)} months (~${d} days)`;
    return `${Math.ceil(d / 30)} months (~${d} days)`;
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-wide">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Job Header */}
              <div className="bg-card rounded-xl border border-border p-8">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <Badge variant={job.status === "open" ? "default" : "secondary"}>{job.status}</Badge>
                  {job.is_remote && <Badge variant="outline"><Globe className="h-3 w-3 mr-1" />Remote</Badge>}
                  <Badge variant="outline">{job.is_hourly ? "Hourly" : "Fixed Price"}</Badge>
                  {isAssigned && (
                    <Badge variant="secondary" className="bg-accent/10 text-accent-foreground border-accent/30">
                      Assigned — No longer accepting proposals
                    </Badge>
                  )}
                  {!isAssigned && (
                    <Badge variant={paymentReady ? "default" : "destructive"} className="gap-1">
                      <DollarSign className="h-3 w-3" />
                      {paymentReady ? "Payment Ready" : "Payment Unverified"}
                    </Badge>
                  )}
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-4">{job.title}</h1>

                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
                  {job.state && (
                    <div className="flex items-center gap-1"><MapPin className="h-4 w-4" />{job.city ? `${job.city}, ` : ""}{job.state}</div>
                  )}
                  {job.delivery_days && (
                    <div className="flex items-center gap-1"><Clock className="h-4 w-4" />{deliveryLabel()}</div>
                  )}
                  <div className="flex items-center gap-1"><Briefcase className="h-4 w-4" />{proposalCount} proposals</div>
                  {interviewingCount > 0 && (
                    <div className="flex items-center gap-1 text-primary"><UserCheck className="h-4 w-4" />{interviewingCount} interviewing</div>
                  )}
                  <div className="flex items-center gap-1"><Calendar className="h-4 w-4" />Posted {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}</div>
                </div>

                <div className="prose prose-sm max-w-none text-foreground">
                  <h3 className="text-lg font-semibold mb-2">Description</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{job.description}</p>
                </div>
              </div>

              {/* Attachments */}
              {job.attachments && job.attachments.length > 0 && (
                <div className="bg-card rounded-xl border border-border p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Attachments</h3>
                  <div className="space-y-2">
                    {job.attachments.map((url: string, idx: number) => {
                      const name = url.split("/").pop() || `Attachment ${idx + 1}`;
                      return (
                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                          <Download className="h-4 w-4 text-primary shrink-0" />
                          <span className="text-sm text-foreground truncate">{name}</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Things to Know */}
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Info className="h-5 w-5 text-primary" />Things to Know</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <InfoTile icon={MapPin} label="Work Location" value={job.is_remote ? "Remote" : `${job.city || ""} ${job.state || "On-site"}`} />
                  <InfoTile icon={Wrench} label="Skill Level" value="Intermediate" />
                  <InfoTile icon={DollarSign} label="Payment Type" value={job.is_hourly ? "Hourly Rate" : "Fixed Price"} />
                  <InfoTile icon={Tag} label="Price Tag" value={
                    job.budget_min && job.budget_max
                      ? `${formatNaira(job.budget_min)} - ${formatNaira(job.budget_max)}`
                      : job.budget_min ? formatNaira(job.budget_min) : "Negotiable"
                  } />
                  <InfoTile icon={Briefcase} label="Job Type" value={job.is_hourly ? "Contract / Hourly" : "Project-based"} />
                  <InfoTile icon={Clock} label="Duration" value={deliveryLabel()} />
                </div>
              </div>

              {/* Areas of Expertise */}
              {(job.required_skills?.length > 0 || job.required_software?.length > 0) && (
                <div className="bg-card rounded-xl border border-border p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Layers className="h-5 w-5 text-primary" />Areas of Expertise</h3>
                  <div className="flex flex-wrap gap-2">
                    {[...(job.required_skills || []), ...(job.required_software || [])].map((s: string) => (
                      <Badge key={s} variant="secondary" className="text-sm">{s}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Proposal Stats */}
              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex flex-wrap gap-6">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{proposalCount}</p>
                      <p className="text-xs text-muted-foreground">Total Proposals</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{interviewingCount}</p>
                      <p className="text-xs text-muted-foreground">Interviewing</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Already Applied Notice */}
              {hasApplied && (
                <Alert className="border-primary/30 bg-primary/5">
                  <ShieldAlert className="h-4 w-4 text-primary" />
                  <AlertDescription>You have already applied to this job.</AlertDescription>
                </Alert>
              )}

              {/* Proposal Form */}
              {showProposalForm && profile?.role === "freelancer" && job.status === "open" && (
                <div className="bg-card rounded-xl border border-border p-8">
                  <h2 className="text-xl font-bold mb-6">Submit Your Proposal</h2>
                  <form onSubmit={handleSubmitProposal} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Bid Amount (₦)</Label>
                        <Input type="number" placeholder="e.g. 250000" min="1" value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Delivery (days)</Label>
                        <Input type="number" placeholder="e.g. 14" min="1" value={deliveryDays} onChange={(e) => {
                          const val = e.target.value;
                          if (val === "" || parseInt(val) >= 1) setDeliveryDays(val);
                        }} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Cover Letter</Label>
                      <Textarea placeholder="Explain why you're the best fit... (No contact details allowed)" rows={6} value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} />
                      <p className="text-xs text-muted-foreground">
                        ⚠️ Sharing private contact information is prohibited and will be blocked.
                      </p>
                    </div>
                    {/* Proposal Attachments */}
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
                      <Button type="button" variant="outline" size="sm" onClick={() => proposalFileRef.current?.click()} disabled={proposalFiles.length >= 5}>
                        <Paperclip className="h-4 w-4 mr-2" /> Add Files
                      </Button>
                      {proposalFiles.length > 0 && (
                        <div className="space-y-1 mt-2">
                          {proposalFiles.map((file, idx) => (
                            <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border text-sm">
                              <FileText className="h-4 w-4 text-primary shrink-0" />
                              <span className="flex-1 truncate">{file.name}</span>
                              <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</span>
                              <X className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => setProposalFiles(proposalFiles.filter((_, i) => i !== idx))} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <Button type="submit" disabled={submitting}>
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                        Submit Proposal
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setShowProposalForm(false)}>Cancel</Button>
                    </div>
                  </form>
                </div>
              )}

              {/* Similar Jobs */}
              {similarJobs.length > 0 && (
                <div className="bg-card rounded-xl border border-border p-6">
                  <h3 className="text-lg font-semibold mb-4">Similar Jobs</h3>
                  <div className="space-y-3">
                    {similarJobs.map((sj) => (
                      <Link key={sj.id} to={`/job/${sj.id}`} className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                        <div>
                          <p className="font-medium text-foreground hover:text-primary transition-colors">{sj.title}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>{sj.is_remote ? "Remote" : sj.state || "Nigeria"}</span>
                            <span>{sj.is_hourly ? "Hourly" : "Fixed"}</span>
                            {sj.delivery_days && <span>{sj.delivery_days} days</span>}
                          </div>
                        </div>
                        <p className="text-sm font-semibold text-primary">
                          {sj.budget_max ? formatNaira(sj.budget_max) : sj.budget_min ? formatNaira(sj.budget_min) : "Negotiable"}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Budget */}
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="font-semibold mb-4">Budget</h3>
                <p className="text-2xl font-bold text-primary">
                  {job.budget_min && job.budget_max
                    ? `${formatNaira(job.budget_min)} - ${formatNaira(job.budget_max)}`
                    : job.budget_min ? formatNaira(job.budget_min) : "Negotiable"}
                </p>
                {job.is_hourly && <p className="text-sm text-muted-foreground mt-1">Hourly rate</p>}

                <div className={`mt-3 p-2 rounded-lg text-sm font-medium flex items-center gap-2 ${paymentReady ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                  <DollarSign className="h-4 w-4" />
                  {paymentReady ? "Payment Ready" : "Payment Unverified"}
                </div>

                {canApply && (
                  <Button className="w-full mt-4" onClick={() => setShowProposalForm(true)}>
                    <Send className="h-4 w-4 mr-2" /> Apply Now
                  </Button>
                )}
                {hasApplied && !isAssigned && (
                  <p className="text-sm text-muted-foreground mt-4 text-center">You have already applied to this job.</p>
                )}
                {isAssigned && (
                  <p className="text-sm text-muted-foreground mt-4 text-center">This job is no longer accepting proposals.</p>
                )}
              </div>

              {/* Client Info */}
              {client && (
                <div className="bg-card rounded-xl border border-border p-6">
                  <h3 className="font-semibold mb-4">About the Client</h3>
                  <div className="flex items-center gap-3 mb-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={client.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {(client.full_name || "C").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground">{client.full_name}</p>
                      {client.state && (
                        <p className="text-sm text-muted-foreground">
                          {client.city ? `${client.city}, ` : ""}{client.state}
                        </p>
                      )}
                    </div>
                  </div>
                  {client.is_verified && (
                    <Badge variant="default" className="gap-1 text-xs mb-2">✓ Verified Client</Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function InfoTile({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="p-4 rounded-lg bg-muted/50 border border-border">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
