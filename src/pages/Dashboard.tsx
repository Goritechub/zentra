import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { getDashboardOverview } from "@/api/dashboard.api";
import { getReferralInfo } from "@/api/auth.api";
import { getExpertPendingCounts } from "@/api/proposals.api";
import { useCurrency } from "@/hooks/useCurrency";
import { formatDistanceToNow } from "date-fns";
import {
  Briefcase, MessageSquare, FileText, Settings, Users, PlusCircle,
  Eye, ArrowRight, Trophy, Send, Heart, Wallet, BarChart3,
  ShieldAlert, ImageIcon, Award, Inbox, CheckCircle2, ChevronRight,
  CircleDot, ArrowUpRight, Gift, Copy, Check, type LucideIcon,
} from "lucide-react";
import { StatCardSkeleton } from "@/components/skeletons/StatCardSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { ExpertStatsBanner } from "@/components/layout/ExpertStatsBanner";
import { PlatformReviewPrompt } from "@/components/PlatformReviewPrompt";
import { NetworkError } from "@/components/NetworkError";
import type { DashboardOverview } from "@/types/dashboard";

type DashboardData = Omit<DashboardOverview, "isAdmin">;

const emptyDashboardData: DashboardData = {
  stats: { jobs: 0, proposals: 0, messages: 0, contracts: 0 },
  recentJobs: [],
  freelancerProfile: null,
  walletBalance: 0,
  completedContracts: 0,
  recentActivity: [],
  kyc: null,
};

export default function DashboardPage() {
  const { format } = useCurrency();
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

  const referralQuery = useQuery({
    queryKey: ["referral-info", user?.id],
    enabled: !!user && role === "freelancer" && bootstrapStatus === "ready",
    staleTime: 5 * 60 * 1000,
    queryFn: getReferralInfo,
  });

  const pendingCountsQuery = useQuery({
    queryKey: ["expert-pending-counts", user?.id],
    enabled: !!user && role === "freelancer" && bootstrapStatus === "ready",
    staleTime: 2 * 60 * 1000,
    queryFn: getExpertPendingCounts,
  });
  const totalPendingCount = (pendingCountsQuery.data?.pendingOffers ?? 0) + (pendingCountsQuery.data?.pendingInvites ?? 0);

  const [copied, setCopied] = useState(false);
  const handleCopyReferral = () => {
    const url = referralQuery.data?.share_url;
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!user || bootstrapStatus !== "ready") return null;

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
  const firstName = profile.full_name?.split(" ")[0] || "User";

  const stats = dashboardQuery.data?.stats || emptyDashboardData.stats;
  const recentJobs = dashboardQuery.data?.recentJobs || [];
  const freelancerProfile = dashboardQuery.data?.freelancerProfile || null;
  const walletBalance = dashboardQuery.data?.walletBalance ?? 0;
  const completedContracts = dashboardQuery.data?.completedContracts ?? 0;
  const recentActivity = dashboardQuery.data?.recentActivity || [];

  const hasSkills = freelancerProfile?.skills?.length > 0;
  const kyc = dashboardQuery.data?.kyc ?? null;
  const kycVerified = kyc?.kyc_status === "verified";
  const isZentraVerified = kyc?.zentra_verified === true;
  const profileItems = [
    !!profile.avatar_url,
    !!profile.state,
    ...(isFreelancer ? [hasSkills] : []),
    kycVerified,
    isZentraVerified,
  ];
  const profileComplete = profileItems.filter(Boolean).length;
  const profileTotal = profileItems.length;
  const profilePct = Math.round((profileComplete / profileTotal) * 100);

  const statCards = isClient
    ? [
        { label: "Wallet Balance", value: format(walletBalance), icon: Wallet, to: "/transactions", accent: "primary" as const },
        { label: "Posted Jobs", value: stats.jobs, icon: Briefcase, to: "/dashboard/jobs", accent: "accent" as const },
        { label: "Proposals Received", value: stats.proposals, icon: FileText, to: "/dashboard/proposals", accent: "primary" as const },
        { label: "Completed", value: completedContracts, icon: CheckCircle2, to: "/dashboard/contracts", accent: "accent" as const },
      ]
    : [
        { label: "Wallet Balance", value: format(walletBalance), icon: Wallet, to: "/transactions", accent: "primary" as const },
        { label: "Active Projects", value: stats.jobs, icon: Briefcase, to: "/dashboard/contracts", accent: "accent" as const },
        { label: "Proposals Sent", value: stats.proposals, icon: FileText, to: "/dashboard/expert-proposals", accent: "primary" as const },
        { label: "Completed", value: completedContracts, icon: CheckCircle2, to: "/dashboard/contracts", accent: "accent" as const },
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
    { icon: Users, label: "Search Experts", to: "/freelancers", desc: "Find the right professional" },
    { icon: Heart, label: "Saved Experts", to: "/saved-experts", desc: "Your bookmarked experts" },
    { icon: Eye, label: "Browse Services", to: "/browse-services", desc: "Find expert services" },
    { icon: Wallet, label: "Wallet & Transactions", to: "/transactions", desc: "Payments and balance" },
  ];

  const freelancerMenuItems: { icon: LucideIcon; label: string; to: string; desc: string; count?: number }[] = [
    { icon: Eye, label: "Browse Available Jobs", to: "/jobs", desc: "Find new opportunities" },
    { icon: Trophy, label: "Browse Contests", to: "/contests", desc: "Compete for prizes" },
    { icon: Settings, label: "Account Settings", to: "/settings", desc: "Update your information" },
    { icon: ImageIcon, label: "Manage Portfolio", to: "/manage-portfolio", desc: "Showcase your work" },
    { icon: Briefcase, label: "My Services", to: "/dashboard/my-services", desc: "Post & manage services" },
    { icon: MessageSquare, label: "View Messages", to: "/messages", desc: "Chat with clients" },
    { icon: BarChart3, label: "View Contracts", to: "/dashboard/contracts", desc: "Track active projects" },
    { icon: FileText, label: "My Proposals & Offers", to: "/dashboard/expert-proposals", desc: "Track submissions", count: totalPendingCount },
    { icon: Award, label: "Contest Entries", to: "/dashboard/contest-entries", desc: "View your entries" },
    { icon: Wallet, label: "Wallet & Earnings", to: "/transactions", desc: "Track payments" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <PlatformReviewPrompt />
      <Header />
      <main className="flex-1 py-6 md:py-8">
        <div className="container-wide">

          {/* Greeting row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                Welcome back, {firstName}
              </h1>
              <p className="text-muted-foreground mt-1">
                {dashboardQuery.isFetching && !!dashboardQuery.data
                  ? "Refreshing dashboard..."
                  : isFreelancer
                  ? "Here's what's happening with your projects"
                  : "Manage your projects and find talent"}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {isClient && (
                <>
                  <Button size="sm" onClick={() => navigate("/post-job")} className="gap-1.5">
                    <PlusCircle className="h-4 w-4" /> Post a Job
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => navigate("/launch-contest")} className="gap-1.5">
                    <Trophy className="h-4 w-4" /> Launch Contest
                  </Button>
                </>
              )}
              {isFreelancer && (
                <>
                  <Button size="sm" onClick={() => navigate("/jobs")} className="gap-1.5">
                    <Briefcase className="h-4 w-4" /> Browse Jobs
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => navigate("/contests")} className="gap-1.5">
                    <Trophy className="h-4 w-4" /> Contests
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Stat cards */}
          {dashboardQuery.isError && !dashboardQuery.data && (
            <NetworkError
              error={dashboardQuery.error as Error}
              onRetry={() => dashboardQuery.refetch()}
              compact
              className="mb-4"
            />
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {dashboardQuery.isPending && !dashboardQuery.data ? (
              <StatCardSkeleton count={4} />
            ) : (
              statCards.map((card) => (
                <StatCard
                  key={card.label}
                  label={card.label}
                  value={String(card.value)}
                  icon={card.icon}
                  to={card.to}
                  accent={card.accent}
                />
              ))
            )}
          </div>

          {/* Platform notice */}
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary/5 border border-primary/15 mb-6 text-sm text-muted-foreground">
            <ShieldAlert className="h-4 w-4 text-primary shrink-0" />
            <span>All communication must stay on the platform. Sharing personal contact details is prohibited.</span>
          </div>

          {isFreelancer && <ExpertStatsBanner />}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Main content */}
            <div className="lg:col-span-8 space-y-6">

              {/* Dashboard Menu / Quick Actions */}
              {isClient && (
                <div className="bg-card rounded-xl border border-border p-6">
                  <h2 className="text-base font-semibold text-foreground mb-4">Dashboard Menu</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {clientMenuItems.map((item) => {
                      const active = location.pathname === item.to;
                      return (
                        <Link
                          key={`${item.to}-${item.label}`}
                          to={item.to}
                          className={`flex items-center gap-3 p-4 rounded-xl border transition-all group ${
                            active ? "border-primary bg-primary/10" : "border-border hover:border-primary hover:bg-primary/5"
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                            active ? "bg-primary/20" : "bg-primary/10 group-hover:bg-primary/20"
                          }`}>
                            <item.icon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground text-sm">{item.label}</p>
                            <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {isFreelancer && (
                <div className="bg-card rounded-xl border border-border p-6">
                  <h2 className="text-base font-semibold text-foreground mb-4">Quick Actions</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {freelancerMenuItems.map((item) => {
                      const active = location.pathname === item.to;
                      const count = item.count ?? 0;
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          className={`flex items-center gap-3 p-4 rounded-xl border transition-all group ${
                            active ? "border-primary bg-primary/10" : "border-border hover:border-primary hover:bg-primary/5"
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                            active ? "bg-primary/20" : "bg-primary/10 group-hover:bg-primary/20"
                          }`}>
                            <item.icon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground text-sm">{item.label}</p>
                            <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
                          </div>
                          {count > 0 && (
                            <Badge variant="destructive" className="text-[10px] h-5 px-1.5 shrink-0">{count}</Badge>
                          )}
                          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recent Jobs (client) */}
              {isClient && (
                <div className="bg-card rounded-xl border border-border">
                  <div className="flex items-center justify-between p-5 pb-0">
                    <h2 className="text-base font-semibold text-foreground">Recent Jobs</h2>
                    <Link to="/dashboard/jobs" className="text-xs text-primary hover:underline flex items-center gap-1">
                      View All <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                  <div className="p-5">
                    {dashboardQuery.isPending && !dashboardQuery.data ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="rounded-lg border border-border p-4">
                            <Skeleton className="h-4 w-40 mb-2" />
                            <Skeleton className="h-3 w-28" />
                          </div>
                        ))}
                      </div>
                    ) : recentJobs.length > 0 ? (
                      <div className="space-y-2">
                        {recentJobs.map((job) => (
                          <Link
                            key={job.id}
                            to={`/job/${job.id}`}
                            className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-2 h-2 rounded-full shrink-0 bg-primary" />
                              <div className="min-w-0">
                                <p className="font-medium text-sm text-foreground truncate">{job.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <Badge variant={job.status === "open" ? "default" : "secondary"} className="text-xs">
                                {job.status.split("_").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                              </Badge>
                              {(job.budget_max || job.budget_min) && (
                                <span className="text-xs font-semibold text-primary">
                                  {format(job.budget_max || job.budget_min)}
                                </span>
                              )}
                              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                        No recent jobs yet.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Recent Activity */}
              {recentActivity.length > 0 && (
                <div className="bg-card rounded-xl border border-border">
                  <div className="flex items-center justify-between p-5 pb-0">
                    <h2 className="text-base font-semibold text-foreground">Recent Activity</h2>
                    <Link to="/notifications" className="text-xs text-primary hover:underline flex items-center gap-1">
                      View All <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                  <div className="p-5 space-y-1">
                    {recentActivity.map((notif) => (
                      <div key={notif.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors">
                        <div className="mt-1.5">
                          <CircleDot className={`h-3 w-3 ${notif.is_read ? "text-muted-foreground/40" : "text-primary"}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{notif.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{notif.message}</p>
                          <p className="text-xs text-muted-foreground/60 mt-0.5">
                            {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-4 space-y-6">

              {/* Profile Completion */}
              <div className="bg-card rounded-xl border border-border p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">Profile Completion</h3>
                  <span className="text-xs font-bold text-primary">{profilePct}%</span>
                </div>
                <Progress value={profilePct} className="h-2 mb-4" />
                <div className="space-y-2.5">
                  <ProfileCheckItem label="Profile photo" done={!!profile.avatar_url} to="/settings" />
                  <ProfileCheckItem label="Location" done={!!profile.state} to="/settings" />
                  {isFreelancer && (
                    <ProfileCheckItem label="Skills" done={hasSkills} to="/settings" />
                  )}
                  <ProfileCheckItem label="KYC Verified" done={kycVerified} to="/settings?tab=payment" />
                  <ProfileCheckItem label="Zentra Badge" done={isZentraVerified} to="/settings?tab=payment" />
                </div>
                <div className="mt-4 flex gap-2">
                  <Link to="/settings" className="flex-1">
                    <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                      <Settings className="h-3.5 w-3.5" /> Account Settings
                    </Button>
                  </Link>
                  {isFreelancer && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => navigate(`/expert/${user.id}/profile`)}
                    >
                      <Eye className="h-3.5 w-3.5" /> View
                    </Button>
                  )}
                </div>
              </div>

              {/* Overview quick stats */}
              <div className="bg-card rounded-xl border border-border p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">Overview</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Unread Messages</span>
                    <span className="text-sm font-semibold text-foreground">{stats.messages}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Active Contracts</span>
                    <span className="text-sm font-semibold text-foreground">{stats.contracts}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Completed</span>
                    <span className="text-sm font-semibold text-foreground">{completedContracts}</span>
                  </div>
                </div>
                <Link to="/messages" className="mt-4 block">
                  <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                    <MessageSquare className="h-3.5 w-3.5" /> Open Messages
                    {stats.messages > 0 && (
                      <Badge variant="destructive" className="ml-auto text-[10px] h-4 px-1.5">
                        {stats.messages}
                      </Badge>
                    )}
                  </Button>
                </Link>
              </div>

              {/* Wallet card */}
              <Link to="/transactions" className="block">
                <div className="bg-gradient-to-br from-primary to-primary/80 rounded-xl p-5 text-primary-foreground hover:shadow-lg transition-shadow">
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet className="h-4 w-4 opacity-80" />
                    <span className="text-xs font-medium opacity-80">Wallet Balance</span>
                  </div>
                  <p className="text-2xl font-bold">{format(walletBalance)}</p>
                  <div className="mt-3 flex items-center gap-1 text-xs opacity-70">
                    <span>View transactions</span>
                    <ArrowRight className="h-3 w-3" />
                  </div>
                </div>
              </Link>

              {/* Referral card — freelancers only */}
              {isFreelancer && referralQuery.data?.share_url && (
                <div className="bg-card rounded-xl border border-border p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <Gift className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Refer a Client</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Clients who sign up via your link and hire you pay <span className="font-semibold text-foreground">50% less</span> in platform fees.
                    {referralQuery.data.referral_count > 0 && (
                      <span className="ml-1">You've referred <span className="font-semibold text-foreground">{referralQuery.data.referral_count}</span> client{referralQuery.data.referral_count !== 1 ? "s" : ""} so far.</span>
                    )}
                  </p>
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground mb-3 overflow-hidden">
                    <span className="truncate flex-1">{referralQuery.data.share_url}</span>
                  </div>
                  <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs" onClick={handleCopyReferral}>
                    {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied!" : "Copy Referral Link"}
                  </Button>
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

/* ── Sub-components ── */

function StatCard({
  label, value, icon: Icon, to, accent,
}: {
  label: string;
  value: string | null;
  icon: React.ElementType;
  to: string;
  accent: "primary" | "accent";
}) {
  return (
    <Link
      to={to}
      className="bg-card rounded-xl border border-border p-4 hover:border-primary/30 hover:shadow-sm transition-all group"
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
          accent === "primary" ? "bg-primary/10" : "bg-accent/15"
        }`}>
          <Icon className={`h-[18px] w-[18px] ${accent === "primary" ? "text-primary" : "text-accent-foreground"}`} />
        </div>
        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      {value === null ? (
        <div className="h-7 w-16 animate-pulse rounded bg-muted/70 mb-1" />
      ) : (
        <p className="text-xl font-bold text-foreground">{value}</p>
      )}
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </Link>
  );
}

function ProfileCheckItem({ label, done, to }: { label: string; done: boolean; to: string }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 group">
      {done ? (
        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
      ) : (
        <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
      )}
      <span className={`text-xs ${done ? "text-muted-foreground line-through" : "text-foreground group-hover:text-primary transition-colors"}`}>
        {label}
      </span>
    </Link>
  );
}
