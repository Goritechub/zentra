import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Menu, X, User, LogOut, Briefcase, Search, MessageSquare, Bell, Palette, ChevronRight, FileText, FolderOpen, Mail } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { useNotifications } from "@/hooks/useNotifications";
import { useColorTheme, THEME_OPTIONS } from "@/hooks/useTheme";
import { ZentraGigLogo } from "@/components/ZentraGigLogo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [jobsMenuOpen, setJobsMenuOpen] = useState(false);
  const [mobileJobsOpen, setMobileJobsOpen] = useState(false);
  const [bootstrapStalled, setBootstrapStalled] = useState(false);
  const { user, profile, signOut, isAdmin, bootstrapStatus, onboardingComplete, role, authError, refreshProfile, profileLoading } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const unreadCount = useUnreadMessages();
  const { unreadCount: notifUnreadCount } = useNotifications();
  const { colorTheme, setColorTheme } = useColorTheme();

  const isAuthenticated = !!user && bootstrapStatus === "ready";
  const isBootstrapPending = !!user && bootstrapStatus === "loading";
  const needsSetup = isAuthenticated && !onboardingComplete;
  const isClient = role === "client";
  const isFreelancer = role === "freelancer";
  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email || "User";
  const displayRole = role || profile?.role || null;
  const profileHref = isFreelancer && user ? `/expert/${user.id}/profile` : "/my-profile";

  useEffect(() => {
    if (!user || bootstrapStatus !== "loading") {
      setBootstrapStalled(false);
      return;
    }

    const timer = window.setTimeout(() => setBootstrapStalled(true), 5000);
    return () => window.clearTimeout(timer);
  }, [bootstrapStatus, user]);

  const handleSignOut = async () => {
    setMobileMenuOpen(false);
    await signOut();
  };

  const handleRetryAccountSync = async () => {
    const recovered = await refreshProfile();
    if (!recovered) return;

    await queryClient.invalidateQueries();
    await queryClient.refetchQueries({ type: "active" });
  };

  const getInitials = (name: string | null) => {
    if (!name) return "U";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const navLinkClass = (path: string) =>
    `text-sm font-medium transition-colors ${
      location.pathname === path
        ? "text-primary"
        : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container-wide">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <ZentraGigLogo size="md" />
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {isAuthenticated && !needsSetup && isClient && (
              <Link to="/freelancers" className={navLinkClass("/freelancers")}>
                Find Talent
              </Link>
            )}
            {isAuthenticated && !needsSetup && isFreelancer && (
              <div className="relative">
                <button
                  onClick={() => setJobsMenuOpen(!jobsMenuOpen)}
                  onBlur={() => setTimeout(() => setJobsMenuOpen(false), 150)}
                  className={`flex items-center gap-1 text-sm font-medium transition-colors ${
                    ["/jobs", "/expert-proposals", "/contracts", "/received-offers"].includes(location.pathname)
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Jobs
                  <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-200 ${jobsMenuOpen ? "rotate-90" : ""}`} />
                </button>
                {jobsMenuOpen && (
                  <div className="absolute top-full left-0 mt-2 w-48 rounded-lg border border-border bg-popover shadow-lg py-1 z-50 animate-fade-in">
                    <Link to="/jobs" onClick={() => setJobsMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors">
                      <Search className="h-3.5 w-3.5" />Browse Jobs
                    </Link>
                    <Link to="/dashboard/expert-proposals" onClick={() => setJobsMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors">
                      <FileText className="h-3.5 w-3.5" />View Proposals
                    </Link>
                    <Link to="/dashboard/contracts" onClick={() => setJobsMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors">
                      <FolderOpen className="h-3.5 w-3.5" />View Contracts
                    </Link>
                    <Link to="/dashboard/received-offers" onClick={() => setJobsMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors">
                      <Mail className="h-3.5 w-3.5" />View Received Offers
                    </Link>
                  </div>
                )}
              </div>
            )}
            {isAuthenticated && !needsSetup && (
              <Link to="/messages" className={`relative ${navLinkClass("/messages")}`}>
                Messages
                {unreadCount > 0 && (
                  <span className="absolute -top-2 -right-4 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
            )}
            <Link to="/how-it-works" className={navLinkClass("/how-it-works")}>
              How It Works
            </Link>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {/* Theme Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Palette className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {THEME_OPTIONS.map((t) => (
                  <DropdownMenuItem
                    key={t.value}
                    onClick={() => setColorTheme(t.value)}
                    className="gap-2 cursor-pointer"
                  >
                    <div className="h-4 w-4 rounded-full border border-border" style={{ backgroundColor: t.color }} />
                    <span>{t.label}</span>
                    {colorTheme === t.value && <span className="ml-auto text-xs">✓</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {needsSetup ? (
              <>
                <Button variant="outline" asChild>
                  <Link to="/onboarding">Complete setup</Link>
                </Button>
                <Button variant="ghost" onClick={handleSignOut}>
                  Sign Out
                </Button>
              </>
            ) : isAuthenticated ? (
              <>
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={profile?.avatar_url || undefined} alt={displayName} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getInitials(displayName)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  <div className="flex items-center gap-2 p-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={profile?.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {getInitials(displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <p className="text-sm font-medium">{displayName}</p>
                      {displayRole && <p className="text-xs text-muted-foreground capitalize">{displayRole}</p>}
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to={isAdmin ? "/admin" : "/dashboard"} className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />Dashboard
                    </Link>
                  </DropdownMenuItem>
                  {isFreelancer && (
                    <DropdownMenuItem asChild>
                      <Link to={profileHref} className="cursor-pointer">
                        <Briefcase className="mr-2 h-4 w-4" />My Profile
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {isClient && (
                    <DropdownMenuItem asChild>
                      <Link to="/post-job" className="cursor-pointer">
                        <Briefcase className="mr-2 h-4 w-4" />Post a Job
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </>
            ) : isBootstrapPending ? (
              bootstrapStalled ? (
                <>
                  <Button variant="outline" onClick={() => void handleRetryAccountSync()} disabled={profileLoading}>
                    {profileLoading ? "Retrying..." : "Retry"}
                  </Button>
                  <Button variant="ghost" onClick={handleSignOut}>
                    Sign Out
                  </Button>
                </>
              ) : (
                <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
              )
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/auth">Sign In</Link>
                </Button>
                <Button asChild>
                  <Link to="/auth?tab=signup">Get Started</Link>
                </Button>
              </>
            )}
          </div>

          <div className="flex md:hidden items-center gap-2">
            {isAuthenticated && <NotificationBell />}
            <button className="p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {isAuthenticated && authError && (
        <div className="border-t border-border/60 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <div className="container-wide flex flex-col gap-2 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
            <p>{authError}</p>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-0 text-xs font-medium text-amber-900 hover:bg-transparent hover:text-amber-950 dark:text-amber-100 dark:hover:text-white"
              onClick={() => void handleRetryAccountSync()}
              disabled={profileLoading}
            >
              {profileLoading ? "Refreshing..." : "Retry account sync"}
            </Button>
          </div>
        </div>
      )}

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-background">
          <div className="container-wide py-4 space-y-4">
            <nav className="flex flex-col gap-2">
              {isAuthenticated && !needsSetup && isClient && (
                <Link to="/freelancers" className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted" onClick={() => setMobileMenuOpen(false)}>
                  <Search className="h-4 w-4" />Find Talent
                </Link>
              )}
              {isAuthenticated && !needsSetup && isFreelancer && (
                <>
                  <button
                    onClick={() => setMobileJobsOpen(!mobileJobsOpen)}
                    className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-muted"
                  >
                    <span className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4" />Jobs
                    </span>
                    <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${mobileJobsOpen ? "rotate-90" : ""}`} />
                  </button>
                  {mobileJobsOpen && (
                    <div className="ml-6 flex flex-col gap-1 animate-fade-in">
                      <Link to="/jobs" className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted text-sm" onClick={() => setMobileMenuOpen(false)}>
                        <Search className="h-3.5 w-3.5" />Browse Jobs
                      </Link>
                      <Link to="/dashboard/expert-proposals" className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted text-sm" onClick={() => setMobileMenuOpen(false)}>
                        <FileText className="h-3.5 w-3.5" />View Proposals
                      </Link>
                      <Link to="/dashboard/contracts" className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted text-sm" onClick={() => setMobileMenuOpen(false)}>
                        <FolderOpen className="h-3.5 w-3.5" />View Contracts
                      </Link>
                      <Link to="/dashboard/received-offers" className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted text-sm" onClick={() => setMobileMenuOpen(false)}>
                        <Mail className="h-3.5 w-3.5" />View Received Offers
                      </Link>
                    </div>
                  )}
                </>
              )}
              {isAuthenticated && !needsSetup && (
                <Link to="/messages" className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted" onClick={() => setMobileMenuOpen(false)}>
                  <MessageSquare className="h-4 w-4" />Messages
                  {unreadCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </Link>
              )}
              {isAuthenticated && !needsSetup && (
                <Link to="/notifications" className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted" onClick={() => setMobileMenuOpen(false)}>
                  <Bell className="h-4 w-4" />Notifications
                  {notifUnreadCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                      {notifUnreadCount > 99 ? "99+" : notifUnreadCount}
                    </span>
                  )}
                </Link>
              )}
            </nav>
            <div className="pt-4 border-t border-border space-y-2">
              {isAuthenticated ? (
                <>
                  {needsSetup ? (
                    <Link to="/onboarding" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="outline" className="w-full">Complete Setup</Button>
                    </Link>
                  ) : (
                    <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="outline" className="w-full">Dashboard</Button>
                    </Link>
                  )}
                  <Button variant="ghost" className="w-full text-destructive" onClick={() => { handleSignOut(); setMobileMenuOpen(false); }}>
                    Sign Out
                  </Button>
                </>
              ) : isBootstrapPending ? (
                bootstrapStalled ? (
                  <>
                    <Button variant="outline" className="w-full" onClick={() => void handleRetryAccountSync()}>
                      Refresh
                    </Button>
                    <Button variant="ghost" className="w-full text-destructive" onClick={() => { handleSignOut(); setMobileMenuOpen(false); }}>
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <div className="h-10 rounded-lg bg-muted animate-pulse" />
                )
              ) : (
                <>
                  <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="outline" className="w-full">Sign In</Button>
                  </Link>
                  <Link to="/auth?tab=signup" onClick={() => setMobileMenuOpen(false)}>
                    <Button className="w-full">Get Started</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
