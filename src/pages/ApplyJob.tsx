import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatNaira } from "@/lib/nigerian-data";
import { calculateServiceCharge } from "@/lib/service-charge";
import { formatDistanceToNow } from "date-fns";
import { vetContent } from "@/lib/content-vetting";
import {
  ArrowLeft, Send, Loader2, FileText, Download, Info, DollarSign,
  Clock, MapPin, Briefcase, Tag, Wrench, Layers, Paperclip, X, Globe, Eye, Plus, Trash2
} from "lucide-react";

export default function ApplyJobPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [existingProposal, setExistingProposal] = useState<any>(null);
  const [editingProposal, setEditingProposal] = useState(false);

  // New proposal form
  const [bidAmount, setBidAmount] = useState("");
  const [deliveryDays, setDeliveryDays] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [proposalFiles, setProposalFiles] = useState<File[]>([]);
  const proposalFileRef = useRef<HTMLInputElement>(null);
  const [paymentType, setPaymentType] = useState<"project" | "milestone">("project");
  const [milestones, setMilestones] = useState<{ title: string; date: string; amount: string }[]>([
    { title: "", date: "", amount: "" },
  ]);

  // Edit fields
  const [editBidAmount, setEditBidAmount] = useState("");
  const [editDeliveryDays, setEditDeliveryDays] = useState("");
  const [editCoverLetter, setEditCoverLetter] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  useEffect(() => {
    if (id && user) fetchData();
  }, [id, user]);

  const fetchData = async () => {
    const { data: jobData } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", id)
      .single();

    if (!jobData) {
      setLoading(false);
      return;
    }
    setJob(jobData);

    // Check existing proposal
    const { data: existing } = await supabase
      .from("proposals")
      .select("*")
      .eq("job_id", id!)
      .eq("freelancer_id", user!.id)
      .maybeSingle();

    if (existing) {
      setExistingProposal(existing);
      setEditBidAmount(String(existing.bid_amount));
      setEditDeliveryDays(String(existing.delivery_days));
      setEditCoverLetter(existing.cover_letter);
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

    if (paymentType === "project") {
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
    } else {
      const validMilestones = milestones.filter(m => m.title.trim() && m.amount && m.date);
      if (validMilestones.length === 0) {
        toast.error("Please add at least one milestone with name, date, and price");
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

    setSubmitting(true);
    const attachmentUrls = await uploadProposalAttachments();

    const totalBid = paymentType === "milestone"
      ? milestones.reduce((sum, m) => sum + (parseInt(m.amount) || 0), 0)
      : parseInt(bidAmount);

    const totalDays = paymentType === "milestone"
      ? Math.max(...milestones.map(m => {
          const d = new Date(m.date);
          const now = new Date();
          return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        }).filter(d => d > 0), 1)
      : parseInt(deliveryDays);

    const milestonesData = paymentType === "milestone"
      ? milestones.filter(m => m.title.trim() && m.amount && m.date).map(m => ({
          title: m.title.trim(),
          date: m.date,
          amount: parseInt(m.amount),
        }))
      : [];

    const response = await supabase.functions.invoke("moderate-proposal", {
      body: {
        job_id: id,
        bid_amount: totalBid,
        delivery_days: totalDays,
        cover_letter: coverLetter.trim(),
        attachments: attachmentUrls.length > 0 ? attachmentUrls : undefined,
        payment_type: paymentType,
        milestones: milestonesData,
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
    setSubmitting(false);

    // Refetch so we show view mode
    const { data: newProposal } = await supabase
      .from("proposals")
      .select("*")
      .eq("job_id", id!)
      .eq("freelancer_id", user!.id)
      .maybeSingle();
    if (newProposal) {
      setExistingProposal(newProposal);
      setEditBidAmount(String(newProposal.bid_amount));
      setEditDeliveryDays(String(newProposal.delivery_days));
      setEditCoverLetter(newProposal.cover_letter);
    }
  };

  const handleEditProposal = async () => {
    if (!existingProposal || !user) return;

    const amount = parseInt(editBidAmount);
    const days = parseInt(editDeliveryDays);
    if (!amount || !days || !editCoverLetter.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    const vetResult = vetContent(editCoverLetter.trim());
    if (vetResult.blocked) {
      toast.error(vetResult.reason || "Your cover letter contains prohibited content.");
      return;
    }

    setEditSubmitting(true);

    const { error } = await supabase
      .from("proposals")
      .update({
        bid_amount: amount,
        delivery_days: days,
        cover_letter: editCoverLetter.trim(),
        edit_count: existingProposal.edit_count + 1,
        last_edited_at: new Date().toISOString(),
      })
      .eq("id", existingProposal.id);

    if (error) {
      toast.error("Failed to update proposal");
      setEditSubmitting(false);
      return;
    }

    toast.success("Proposal updated!");
    setEditingProposal(false);
    setEditSubmitting(false);

    const { data: updated } = await supabase
      .from("proposals")
      .select("*")
      .eq("id", existingProposal.id)
      .single();
    if (updated) {
      setExistingProposal(updated);
      setEditBidAmount(String(updated.bid_amount));
      setEditDeliveryDays(String(updated.delivery_days));
      setEditCoverLetter(updated.cover_letter);
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

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-wide">
          <Button variant="ghost" onClick={() => navigate(`/job/${id}`)} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Job
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Proposal Section */}
              {existingProposal ? (
                <div className="bg-card rounded-xl border border-border p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold">Your Proposal</h2>
                    <div className="flex gap-2">
                      {editingProposal ? (
                        <>
                          <Button size="sm" onClick={handleEditProposal} disabled={editSubmitting}>
                            {editSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Save Changes
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => {
                            setEditingProposal(false);
                            setEditBidAmount(String(existingProposal.bid_amount));
                            setEditDeliveryDays(String(existingProposal.delivery_days));
                            setEditCoverLetter(existingProposal.cover_letter);
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
                          Edit Proposal {existingProposal.edit_count > 0 && `(${existingProposal.edit_count}/2 edits used)`}
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Bid Amount (₦)</Label>
                        {editingProposal ? (
                          <Input type="number" min="1" value={editBidAmount} onChange={(e) => setEditBidAmount(e.target.value)} />
                        ) : (
                          <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm font-medium">{formatNaira(existingProposal.bid_amount)}</div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Delivery (days)</Label>
                        {editingProposal ? (
                          <Input type="number" min="1" value={editDeliveryDays} onChange={(e) => setEditDeliveryDays(e.target.value)} />
                        ) : (
                          <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm font-medium">{existingProposal.delivery_days} days</div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Cover Letter</Label>
                      {editingProposal ? (
                        <Textarea rows={6} value={editCoverLetter} onChange={(e) => setEditCoverLetter(e.target.value)} />
                      ) : (
                        <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm whitespace-pre-wrap">{existingProposal.cover_letter}</div>
                      )}
                    </div>
                    {existingProposal.attachments && existingProposal.attachments.length > 0 && (
                      <div className="space-y-2">
                        <Label>Attachments</Label>
                        <div className="space-y-1">
                          {existingProposal.attachments.map((url: string, idx: number) => {
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
                    <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
                      <span>Status: <Badge variant="secondary" className="text-xs">{existingProposal.status}</Badge></span>
                      <span>Submitted: {formatDistanceToNow(new Date(existingProposal.created_at), { addSuffix: true })}</span>
                      {!canEditProposal() && <span className="text-destructive">Edit window expired</span>}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-card rounded-xl border border-border p-8">
                  <h2 className="text-xl font-bold mb-6">Submit Your Proposal</h2>
                  <form onSubmit={handleSubmitProposal} className="space-y-6">
                    {/* Payment Type Selection */}
                    <div className="space-y-3">
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
                    </div>

                    {/* Payment Details - By Project */}
                    {paymentType === "project" && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Bid Amount (₦)</Label>
                            <Input type="number" placeholder={job.budget_max ? `Up to ${formatNaira(job.budget_max)}` : "e.g. 250000"} min="1" value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label>Completion Date</Label>
                            <Input type="number" placeholder={job.delivery_days ? `${job.delivery_days} days` : "e.g. 14"} min="1" value={deliveryDays} onChange={(e) => {
                              const val = e.target.value;
                              if (val === "" || parseInt(val) >= 1) setDeliveryDays(val);
                            }} />
                            <p className="text-xs text-muted-foreground">Days to complete</p>
                          </div>
                        </div>
                        {bidAmount && parseInt(bidAmount) > 0 && (
                          <ServiceChargeSummary amount={parseInt(bidAmount)} />
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
                                  <Label className="text-xs">Due Date</Label>
                                  <Input type="date" value={ms.date} onChange={(e) => {
                                    const updated = [...milestones];
                                    updated[idx].date = e.target.value;
                                    setMilestones(updated);
                                  }} />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Price (₦)</Label>
                                  <Input type="number" placeholder="e.g. 50000" min="1" value={ms.amount} onChange={(e) => {
                                    const updated = [...milestones];
                                    updated[idx].amount = e.target.value;
                                    setMilestones(updated);
                                  }} />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => setMilestones([...milestones, { title: "", date: "", amount: "" }])}>
                          <Plus className="h-4 w-4 mr-2" /> Add Milestone
                        </Button>

                        {(() => {
                          const totalMilestoneAmount = milestones.reduce((sum, m) => sum + (parseInt(m.amount) || 0), 0);
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
                      <Button type="button" variant="outline" onClick={() => navigate(`/job/${id}`)}>Cancel</Button>
                    </div>
                  </form>
                </div>
              )}

              {/* Job Details Summary */}
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                  Job Details
                </h3>
                <div className="space-y-4">
                  <div>
                    <Link to={`/job/${id}`} className="text-xl font-bold text-foreground hover:text-primary transition-colors">
                      {job.title}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Badge variant={job.status === "open" ? "default" : "secondary"}>{job.status}</Badge>
                      {job.is_remote && <Badge variant="outline"><Globe className="h-3 w-3 mr-1" />Remote</Badge>}
                      <Badge variant="outline">{job.is_hourly ? "Hourly" : "Fixed Price"}</Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">{job.description}</p>

                  {/* Things to Know mini */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <MiniTile icon={DollarSign} label="Budget" value={
                      job.budget_min && job.budget_max
                        ? `${formatNaira(job.budget_min)} - ${formatNaira(job.budget_max)}`
                        : job.budget_min ? formatNaira(job.budget_min) : "Negotiable"
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

            {/* Sidebar - Budget summary */}
            <div className="space-y-6">
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="font-semibold mb-4">Budget</h3>
                <p className="text-2xl font-bold text-primary">
                  {job.budget_min && job.budget_max
                    ? `${formatNaira(job.budget_min)} - ${formatNaira(job.budget_max)}`
                    : job.budget_min ? formatNaira(job.budget_min) : "Negotiable"}
                </p>
                {job.is_hourly && <p className="text-sm text-muted-foreground mt-1">Hourly rate</p>}
              </div>

              <div className="bg-card rounded-xl border border-border p-6">
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
    </div>
  );
}

function ServiceChargeSummary({ amount }: { amount: number }) {
  const { rateLabel, charge, takeHome } = calculateServiceCharge(amount);
  return (
    <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Total Project Price</span>
        <span className="font-semibold text-foreground">{formatNaira(amount)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Service Charge ({rateLabel})</span>
        <span className="text-destructive">-{formatNaira(charge)}</span>
      </div>
      <div className="border-t border-border pt-2 flex justify-between text-sm">
        <span className="font-semibold text-foreground">Your Take-Home</span>
        <span className="font-bold text-primary">{formatNaira(takeHome)}</span>
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
