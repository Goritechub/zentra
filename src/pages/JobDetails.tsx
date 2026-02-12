import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatNaira } from "@/lib/nigerian-data";
import { formatDistanceToNow } from "date-fns";
import {
  MapPin, Clock, Briefcase, Calendar, ArrowLeft, MessageSquare,
  Send, Loader2, Building2, Globe
} from "lucide-react";

export default function JobDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [job, setJob] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [proposalCount, setProposalCount] = useState(0);

  // Proposal form
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [bidAmount, setBidAmount] = useState("");
  const [deliveryDays, setDeliveryDays] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

    const [clientRes, proposalRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", jobData.client_id).single(),
      supabase.from("proposals").select("id", { count: "exact" }).eq("job_id", id!),
    ]);

    setClient(clientRes.data);
    setProposalCount(proposalRes.count || 0);
    setLoading(false);
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

    setSubmitting(true);
    const { error } = await supabase.from("proposals").insert({
      job_id: id,
      freelancer_id: user.id,
      bid_amount: amount,
      delivery_days: days,
      cover_letter: coverLetter.trim(),
    });

    if (error) {
      toast.error("Failed to submit proposal");
    } else {
      toast.success("Proposal submitted!");
      setShowProposalForm(false);
      setProposalCount((c) => c + 1);
    }
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
              <div className="bg-card rounded-xl border border-border p-8">
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant={job.status === "open" ? "default" : "secondary"}>
                    {job.status}
                  </Badge>
                  {job.is_remote && <Badge variant="outline"><Globe className="h-3 w-3 mr-1" />Remote</Badge>}
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-4">{job.title}</h1>
                
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
                  {job.state && (
                    <div className="flex items-center gap-1"><MapPin className="h-4 w-4" />{job.city ? `${job.city}, ` : ""}{job.state}</div>
                  )}
                  {job.delivery_days && (
                    <div className="flex items-center gap-1"><Clock className="h-4 w-4" />{job.delivery_days} days delivery</div>
                  )}
                  <div className="flex items-center gap-1"><Briefcase className="h-4 w-4" />{proposalCount} proposals</div>
                  <div className="flex items-center gap-1"><Calendar className="h-4 w-4" />Posted {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}</div>
                </div>

                <div className="prose prose-sm max-w-none text-foreground">
                  <h3 className="text-lg font-semibold mb-2">Description</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{job.description}</p>
                </div>

                {(job.required_skills?.length > 0 || job.required_software?.length > 0) && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-3">Required Skills & Software</h3>
                    <div className="flex flex-wrap gap-2">
                      {[...(job.required_skills || []), ...(job.required_software || [])].map((s: string) => (
                        <Badge key={s} variant="secondary">{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Proposal Form */}
              {showProposalForm && profile?.role === "freelancer" && (
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
                      <Textarea placeholder="Explain why you're the best fit..." rows={6} value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} />
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
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Budget */}
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="font-semibold mb-4">Budget</h3>
                <p className="text-2xl font-bold text-primary">
                  {job.budget_min && job.budget_max
                    ? `${formatNaira(job.budget_min)} - ${formatNaira(job.budget_max)}`
                    : job.budget_min
                    ? formatNaira(job.budget_min)
                    : "Negotiable"}
                </p>
                {job.is_hourly && <p className="text-sm text-muted-foreground mt-1">Hourly rate</p>}
                
                {profile?.role === "freelancer" && job.status === "open" && !showProposalForm && (
                  <Button className="w-full mt-4" onClick={() => user ? setShowProposalForm(true) : navigate("/auth")}>
                    <Send className="h-4 w-4 mr-2" /> Apply Now
                  </Button>
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
                      <p className="font-medium">{client.full_name || "Client"}</p>
                      {client.state && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />{client.city ? `${client.city}, ` : ""}{client.state}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Member since {new Date(client.created_at).toLocaleDateString("en-NG", { month: "long", year: "numeric" })}
                  </p>
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
