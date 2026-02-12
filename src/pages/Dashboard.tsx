import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/nigerian-data";
import { formatDistanceToNow } from "date-fns";
import { 
  Briefcase, MessageSquare, FileText, Settings, Users, PlusCircle,
  Eye, Star, Loader2, ArrowRight, Trophy, Send, Heart, ShoppingBag,
  Wallet, BarChart3, Clock
} from "lucide-react";

export default function DashboardPage() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [stats, setStats] = useState({ jobs: 0, proposals: 0, messages: 0, contracts: 0 });
  const [recentJobs, setRecentJobs] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
    if (user) fetchStats();
  }, [user, loading, navigate]);

  const fetchStats = async () => {
    if (!user) return;
    const isClient = profile?.role === "client";

    const [jobsRes, proposalsRes, msgsRes, contractsRes] = await Promise.all([
      isClient
        ? supabase.from("jobs").select("*", { count: "exact" }).eq("client_id", user.id)
        : supabase.from("proposals").select("*", { count: "exact" }).eq("freelancer_id", user.id),
      isClient
        ? supabase.from("jobs").select("id").eq("client_id", user.id).then(async (r) => {
            if (!r.data?.length) return { count: 0 };
            const jobIds = r.data.map(j => j.id);
            const { count } = await supabase.from("proposals").select("*", { count: "exact" }).in("job_id", jobIds);
            return { count };
          })
        : supabase.from("proposals").select("*", { count: "exact" }).eq("freelancer_id", user.id),
      supabase.from("messages").select("*", { count: "exact" }).or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`),
      supabase.from("contracts").select("*", { count: "exact" }).or(`client_id.eq.${user.id},freelancer_id.eq.${user.id}`),
    ]);

    setStats({
      jobs: (isClient ? jobsRes : proposalsRes) && 'count' in jobsRes ? (jobsRes.count || 0) : 0,
      proposals: proposalsRes && 'count' in proposalsRes ? (proposalsRes.count || 0) : 0,
      messages: msgsRes.count || 0,
      contracts: contractsRes.count || 0,
    });

    // Fetch recent jobs for clients
    if (isClient) {
      const { data } = await supabase.from("jobs").select("*").eq("client_id", user.id).order("created_at", { ascending: false }).limit(5);
      setRecentJobs(data || []);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !profile) return null;

  const isFreelancer = profile.role === "freelancer";
  const isClient = profile.role === "client";

  const clientMenuItems = [
    { icon: PlusCircle, label: "Post a Job", to: "/post-job", desc: "Create a new job listing" },
    { icon: Trophy, label: "Launch a Contest", to: "/launch-contest", desc: "Get multiple submissions" },
    { icon: Briefcase, label: "Posted Jobs", to: "/dashboard/jobs", desc: "Manage your posted jobs" },
    { icon: FileText, label: "Proposals Received", to: "/dashboard/proposals", desc: "Review expert proposals" },
    { icon: Send, label: "Sent Offers", to: "/dashboard/offers", desc: "Offers sent to experts" },
    { icon: MessageSquare, label: "Messages", to: "/messages", desc: "Chat with experts" },
    { icon: BarChart3, label: "Contracts", to: "/dashboard/contracts", desc: "Manage active contracts" },
    { icon: Users, label: "Search Experts", to: "/freelancers", desc: "Find CAD professionals" },
    { icon: Heart, label: "Saved Experts", to: "/dashboard/saved", desc: "Your bookmarked experts" },
    { icon: ShoppingBag, label: "Browse Services", to: "/dashboard/services", desc: "Expert service listings" },
    { icon: Wallet, label: "Wallet & Transactions", to: "/transactions", desc: "Payments and balance" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-wide">
          {/* Welcome */}
          <div className="bg-hero-gradient text-white rounded-2xl p-8 mb-8">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              Welcome back, {profile.full_name?.split(" ")[0] || "User"}! 👋
            </h1>
            <p className="text-white/80">
              {isFreelancer ? "Manage your profile, view proposals, and track your projects." : "Find talent, manage projects, and track progress."}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Briefcase className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.jobs}</p>
                  <p className="text-sm text-muted-foreground">{isClient ? "Posted Jobs" : "Active Projects"}</p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.proposals}</p>
                  <p className="text-sm text-muted-foreground">{isClient ? "Proposals Received" : "Proposals Sent"}</p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <MessageSquare className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.messages}</p>
                  <p className="text-sm text-muted-foreground">Messages</p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.contracts}</p>
                  <p className="text-sm text-muted-foreground">Contracts</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Menu / Quick Actions */}
            <div className="lg:col-span-2">
              {isClient && (
                <div className="bg-card rounded-xl border border-border p-6 mb-8">
                  <h2 className="text-lg font-semibold mb-4">Dashboard Menu</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {clientMenuItems.map((item) => {
                      const isActive = location.pathname === item.to;
                      return (
                        <Link key={item.to} to={item.to} className={`flex items-center gap-3 p-4 rounded-xl border transition-all group ${isActive ? "border-primary bg-primary/10" : "border-border hover:border-primary hover:bg-primary/5"}`}>
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${isActive ? "bg-primary/20" : "bg-primary/10 group-hover:bg-primary/20"}`}>
                            <item.icon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-foreground">{item.label}</p>
                            <p className="text-xs text-muted-foreground">{item.desc}</p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {isFreelancer && (
                <div className="bg-card rounded-xl border border-border p-6 mb-8">
                  <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
                  <div className="space-y-3">
                    <Link to="/jobs">
                      <Button className="w-full justify-start" size="lg">
                        <Eye className="h-5 w-5 mr-3" />Browse Available Jobs<ArrowRight className="h-4 w-4 ml-auto" />
                      </Button>
                    </Link>
                    <Link to="/my-profile">
                      <Button variant="outline" className="w-full justify-start" size="lg">
                        <Settings className="h-5 w-5 mr-3" />Edit My Profile<ArrowRight className="h-4 w-4 ml-auto" />
                      </Button>
                    </Link>
                    <Link to="/messages">
                      <Button variant="outline" className="w-full justify-start" size="lg">
                        <MessageSquare className="h-5 w-5 mr-3" />View Messages<ArrowRight className="h-4 w-4 ml-auto" />
                      </Button>
                    </Link>
                    <Link to="/transactions">
                      <Button variant="outline" className="w-full justify-start" size="lg">
                        <Wallet className="h-5 w-5 mr-3" />Wallet & Earnings<ArrowRight className="h-4 w-4 ml-auto" />
                      </Button>
                    </Link>
                  </div>
                </div>
              )}

              {/* Recent Jobs (Client) */}
              {isClient && recentJobs.length > 0 && (
                <div className="bg-card rounded-xl border border-border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Recent Jobs</h2>
                    <Link to="/dashboard/jobs" className="text-sm text-primary hover:underline">View All</Link>
                  </div>
                  <div className="space-y-3">
                    {recentJobs.map((job) => (
                      <Link key={job.id} to={`/job/${job.id}`} className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                        <div>
                          <p className="font-medium text-foreground">{job.title}</p>
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                            <Badge variant={job.status === "open" ? "default" : "secondary"} className="text-xs">{job.status}</Badge>
                            <span>{formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}</span>
                          </div>
                        </div>
                        {(job.budget_min || job.budget_max) && (
                          <p className="text-sm font-semibold text-primary">{formatNaira(job.budget_max || job.budget_min)}</p>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Sidebar */}
            <div>
              <div className="bg-card rounded-xl border border-border p-6">
                <h2 className="text-lg font-semibold mb-4">Profile Status</h2>
                <div className="space-y-4">
                  <ProfileItem emoji="📍" title="Location" done={!!profile.state} label={profile.state ? `${profile.city || ""} ${profile.state}` : "Add location"} />
                  <ProfileItem emoji="📱" title="Phone/WhatsApp" done={!!profile.phone} label={profile.phone || "Add contact"} />
                  {isFreelancer && (
                    <>
                      <ProfileItem emoji="💼" title="Skills" done={false} label="Update skills" />
                      <ProfileItem emoji="🖼️" title="Portfolio" done={false} label="Add portfolio items" />
                    </>
                  )}
                </div>
                <Link to={isFreelancer ? "/my-profile" : "/my-profile"}>
                  <Button variant="outline" className="w-full mt-4" size="sm">
                    <Settings className="h-4 w-4 mr-2" />Edit Profile
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function ProfileItem({ emoji, title, done, label }: { emoji: string; title: string; done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      <span className="text-lg">{emoji}</span>
      <div className="flex-1">
        <p className="font-medium text-sm text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      {done ? (
        <Badge variant="default" className="text-xs">✓</Badge>
      ) : (
        <Badge variant="secondary" className="text-xs">Add</Badge>
      )}
    </div>
  );
}
