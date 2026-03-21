import { useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { getDashboardOverview } from "@/api/dashboard.api";
import { formatNaira } from "@/lib/nigerian-data";
import { formatDistanceToNow } from "date-fns";
import {
  Briefcase, MessageSquare, FileText, Settings, Users, PlusCircle,
  Eye, Loader2, ArrowRight, Trophy, Send, Heart,
  Wallet, BarChart3, ShieldAlert, ImageIcon, Award, Inbox,
} from "lucide-react";
import { ExpertStatsBanner } from "@/components/layout/ExpertStatsBanner";
import { PlatformReviewPrompt } from "@/components/PlatformReviewPrompt";

interface DashboardData {
  stats: {
    jobs: number;
    proposals: number;
    messages: number;
    contracts: number;
  };
  recentJobs: any[];
  freelancerProfile: any;
}

const emptyDashboardData: DashboardData = {
  stats: { jobs: 0, proposals: 0, messages: 0, contracts: 0 },
  recentJobs: [],
  freelancerProfile: null,
};

export default function DashboardPage() {
  const { user, profile, loading, bootstrapStatus, onboardingComplete, isAdmin, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
    if (isAdmin) navigate("/admin", { replace: true });
  }, [user, loading, navigate, isAdmin]);

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", user?.id, role],
    enabled: !!user && bootstrapStatus === "ready" && !!profile && onboardingComplete && !isAdmin,
    staleTime: 2 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    queryFn: async (): Promise<DashboardData> => getDashboardOverview(),
  });

  if (!user || bootstrapStatus !== "ready") {
    return null;
  }

  if (!onboardingComplete || !profile) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center bg-muted/30 px-4">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-2xl font-bold text-foreground">Complete your setup</h1>
            <p className="text-muted-foreground">
              We need a little more account information before your dashboard is ready.
            </p>
            <Button onClick={() => navigate("/onboarding")}>Continue Setup</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const isFreelancer = profile.role === "freelancer";
  const isClient = profile.role === "client";
  const stats = dashboardQuery.data?.stats || emptyDashboardData.stats;
  const recentJobs = dashboardQuery.data?.recentJobs || [];
  const freelancerProfile = dashboardQuery.data?.freelancerProfile || null;

  const statCards = isClient
    ? [
        { label: "Posted Jobs", value: stats.jobs, icon: Briefcase, to: "/dashboard/jobs" },
        { label: "Proposals Received", value: stats.proposals, icon: FileText, to: "/dashboard/proposals" },
        { label: "Messages", value: stats.messages, icon: MessageSquare, to: "/messages" },
        { label: "Contracts", value: stats.contracts, icon: BarChart3, to: "/dashboard/contracts" },
      ]
    : [
        { label: "Active Projects", value: stats.jobs, icon: Briefcase, to: "/dashboard/contracts" },
        { label: "Proposals Sent", value: stats.proposals, icon: FileText, to: "/dashboard/expert-proposals" },
        { label: "Messages", value: stats.messages, icon: MessageSquare, to: "/messages" },
        { label: "Contracts", value: stats.contracts, icon: BarChart3, to: "/dashboard/contracts" },
      ];

  const clientMenuItems = [
    { icon: PlusCircle, label: "Post a Job", to: "/post-job", desc: "Create a new job listing" },
    { icon: Trophy, label: "Launch a Contest", to: "/launch-contest", desc: "Get multiple submissions" },
    { icon: Trophy, label: "My Contests", to: "/dashboard/my-contests", desc: "Manage your contests" },
    { icon: Briefcase, label: "Posted Jobs", to: "/dashboard/jobs", desc: "Manage your posted jobs" },
    { icon: FileText, label: "Proposals Received", to: "/dashboard/proposals", desc: "Review expert proposals" },
    { icon: Send, label: "Sent Offers", to: "/dashboard/offers", desc: "Offers sent to experts" },
    { icon: MessageSquare, label: "Messages", to: "/messages", desc: "Chat with experts" },
    { icon: BarChart3, label: "Contracts", to: "/dashboard/contracts", desc: "Manage active contracts" },
    { icon: Users, label: "Search Experts", to: "/freelancers", desc: "Find CAD professionals" },
    { icon: Heart, label: "Saved Experts", to: "/freelancers", desc: "Your bookmarked experts" },
    { icon: Eye, label: "Browse Services", to: "/browse-services", desc: "Find expert services" },
    { icon: Wallet, label: "Wallet & Transactions", to: "/transactions", desc: "Payments and balance" },
  ];

  const hasSkills = freelancerProfile?.skills?.length > 0;

  return (
    <div className="min-h-screen flex flex-col">
      <PlatformReviewPrompt />
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-wide">
          <div className="bg-hero-gradient text-white rounded-2xl p-8 mb-8">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              Welcome back, {profile.full_name?.split(" ")[0] || "User"}!
            </h1>
            <p className="text-white/80">
              {isFreelancer ? "Manage your profile, view proposals, and track your projects." : "Find talent, manage projects, and track progress."}
            </p>
            {dashboardQuery.isFetching && (
              <p className="mt-2 text-sm text-white/70">Refreshing dashboard...</p>
            )}
          </div>

          {isFreelancer && <ExpertStatsBanner />}

          <Alert className="mb-6 border-primary/30 bg-primary/5">
            <ShieldAlert className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm text-muted-foreground">
              All communication must stay on the platform. Sharing emails, phone numbers, WhatsApp, or financial details is strictly prohibited and will be blocked.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {statCards.map((card) => (
              <Link
                key={card.label}
                to={card.to}
                className="bg-card rounded-xl border border-border p-6 hover:border-primary hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <card.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    {dashboardQuery.isPending && !dashboardQuery.data ? (
                      <div className="h-8 w-16 animate-pulse rounded bg-muted/70" />
                    ) : (
                      <p className="text-2xl font-bold text-foreground">{card.value}</p>
                    )}
                    <p className="text-sm text-muted-foreground">{card.label}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { icon: Eye, label: "Browse Available Jobs", to: "/jobs", desc: "Find new opportunities" },
                      { icon: Trophy, label: "Browse Contests", to: "/contests", desc: "Compete for prizes" },
                      { icon: Settings, label: "Edit My Profile", to: "/my-profile", desc: "Update your information" },
                      { icon: ImageIcon, label: "Manage Portfolio", to: "/manage-portfolio", desc: "Showcase your work" },
                      { icon: Briefcase, label: "My Services", to: "/dashboard/my-services", desc: "Post & manage services" },
                      { icon: Inbox, label: "Received Offers", to: "/dashboard/received-offers", desc: "Private job & direct offers" },
                      { icon: MessageSquare, label: "View Messages", to: "/messages", desc: "Chat with clients" },
                      { icon: BarChart3, label: "View Contracts", to: "/dashboard/contracts", desc: "Track active projects" },
                      { icon: FileText, label: "My Proposals & Offers", to: "/dashboard/expert-proposals", desc: "Track submissions" },
                      { icon: Award, label: "Contest Entries", to: "/dashboard/contest-entries", desc: "View your entries" },
                      { icon: Wallet, label: "Wallet & Earnings", to: "/transactions", desc: "Track payments" },
                    ].map((item) => {
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

              {isClient && (
                <div className="bg-card rounded-xl border border-border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Recent Jobs</h2>
                    <Link to="/dashboard/jobs" className="text-sm text-primary hover:underline">View All</Link>
                  </div>
                  {dashboardQuery.isPending && !dashboardQuery.data ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((item) => (
                        <div key={item} className="rounded-lg border border-border p-4">
                          <div className="h-4 w-40 animate-pulse rounded bg-muted/70 mb-2" />
                          <div className="h-3 w-28 animate-pulse rounded bg-muted/60" />
                        </div>
                      ))}
                    </div>
                  ) : recentJobs.length > 0 ? (
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
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                      No recent jobs yet.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <div className="bg-card rounded-xl border border-border p-6">
                <h2 className="text-lg font-semibold mb-4">Profile Status</h2>
                <div className="space-y-4">
                  <ProfileItem emoji="📍" title="Location" done={!!profile.state} label={profile.state ? `${profile.city || ""} ${profile.state}` : "Add location"} />
                  {isFreelancer && (
                    <>
                      <Link to="/my-profile">
                        <ProfileItem emoji="💼" title="Skills" done={hasSkills} label={hasSkills ? `${freelancerProfile.skills.length} skills` : "Add skills"} />
                      </Link>
                      <Link to="/manage-portfolio">
                        <ProfileItem emoji="🖼️" title="Portfolio" done={false} label="Add portfolio items" />
                      </Link>
                    </>
                  )}
                </div>
                <Link to="/my-profile">
                  <Button variant="outline" className="w-full mt-4" size="sm">
                    <Settings className="h-4 w-4 mr-2" />Edit Profile
                  </Button>
                </Link>
                {isFreelancer && (
                  <Button variant="ghost" className="w-full mt-2" size="sm" onClick={() => navigate(`/expert/${user.id}/profile`)}>
                    <Eye className="h-4 w-4 mr-2" />View Profile
                  </Button>
                )}
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
