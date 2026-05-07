import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Menu, X, User, LogOut, Briefcase, Search, MessageSquare, Palette, ChevronDown,
  FileText, FolderOpen, Mail, Trophy, Eye, Send, Wallet,
  Home, Bookmark, PenLine, Users, Settings, ShieldAlert,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { useColorTheme, THEME_OPTIONS } from "@/hooks/useTheme";
import { ZentraGigLogo } from "@/components/ZentraGigLogo";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/* ── Dropdown helpers ── */

interface NavDropdownProps {
  label: string;
  items: { to: string; icon: React.ElementType; label: string }[];
  active?: boolean;
}

function NavDropdown({ label, items, active }: NavDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 text-sm font-medium transition-colors px-1 py-1 ${
          active ? "text-primary" : "text-foreground/80 hover:text-foreground"
        }`}
      >
        {label}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-2 w-52 rounded-xl border border-border bg-popover shadow-xl py-1.5 z-50 animate-fade-in">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm text-foreground/80 hover:bg-muted hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function MobileDropdown({
  label, items, open, toggle, close,
}: {
  label: string;
  items: { to: string; icon: React.ElementType; label: string }[];
  open: boolean;
  toggle: () => void;
  close: () => void;
}) {
  return (
    <div>
      <button
        onClick={toggle}
        className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-muted text-sm font-medium"
      >
        {label}
        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="ml-4 flex flex-col gap-0.5 animate-fade-in">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-muted text-sm text-muted-foreground"
              onClick={close}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Header ── */

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSubMenu, setMobileSubMenu] = useState<string | null>(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const [bootstrapStalled, setBootstrapStalled] = useState(false);

  const {
    user, profile, signOut, isAdmin,
    bootstrapStatus, onboardingComplete,
    role, authError, refreshProfile, profileLoading,
  } = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();
  const unreadCount = useUnreadMessages();
  const { colorTheme, setColorTheme } = useColorTheme();

  const isAuthenticated = !!user && bootstrapStatus === "ready";
  const isBootstrapPending = !!user && bootstrapStatus === "loading";
  const needsSetup = isAuthenticated && !onboardingComplete;
  const isClient = role === "client";
  const isFreelancer = role === "freelancer";
  const profileLoaded = !!profile;
  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email || "User";
  const displayRole = role || profile?.role || null;
  const profileHref = user
    ? isFreelancer
      ? `/expert/${user.id}/profile`
      : isClient
        ? `/client/${user.id}/profile`
        : "/my-profile"
    : "/my-profile";

  useEffect(() => {
    if (!user || bootstrapStatus !== "loading") { setBootstrapStalled(false); return; }
    const timer = window.setTimeout(() => setBootstrapStalled(true), 5000);
    return () => window.clearTimeout(timer);
  }, [bootstrapStatus, user]);

  const handleSignOut = () => { setMobileMenuOpen(false); signOut(); };

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

  const isActive = (paths: string[]) => paths.some((p) => location.pathname.startsWith(p));

  /* ── Nav item arrays ── */
  const findGigsItems = isFreelancer
    ? [
        { to: "/jobs", icon: Search, label: "Job Listings" },
        { to: "/contests", icon: Trophy, label: "Browse Contests" },
        { to: "/dashboard/my-services", icon: Briefcase, label: "My Services" },
      ]
    : [
        { to: "/freelancers", icon: Search, label: "Find Experts" },
        { to: "/saved-experts", icon: Bookmark, label: "Saved Experts" },
        { to: "/contests", icon: Trophy, label: "Browse Contests" },
        { to: "/browse-services", icon: Briefcase, label: "Browse Services" },
      ];

  const myWorkItems = isFreelancer
    ? [
        { to: "/dashboard/received-offers", icon: Mail, label: "Offers" },
        { to: "/dashboard/contracts", icon: FolderOpen, label: "Contracts" },
        { to: "/dashboard/contest-entries", icon: Trophy, label: "Contest Entries" },
        { to: "/dashboard/expert-proposals", icon: FileText, label: "My Proposals" },
      ]
    : [
        { to: "/dashboard/offers", icon: Send, label: "Offers" },
        { to: "/dashboard/contracts", icon: FolderOpen, label: "Contracts" },
        { to: "/dashboard/my-contests", icon: Trophy, label: "My Contests" },
        { to: "/dashboard/proposals", icon: FileText, label: "Proposals" },
      ];


  const browseItems = [
    { to: "/browse-services", icon: Eye, label: "Services" },
    { to: "/freelancers", icon: Users, label: "Experts" },
    { to: "/blog", icon: PenLine, label: "Blog" },
    { to: "/how-it-works", icon: FileText, label: "How It Works" },
  ];

  // Admins and unauthenticated users cannot access Services or Experts routes
  const browseItemsLimited = [
    { to: "/blog", icon: PenLine, label: "Blog" },
    { to: "/how-it-works", icon: FileText, label: "How It Works" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container-wide">
        <div className="flex h-16 items-center justify-between">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <ZentraGigLogo size="md" />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1 ml-8">
            <Link
              to="/"
              className={`text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
                location.pathname === "/" ? "text-primary" : "text-foreground/80 hover:text-foreground"
              }`}
            >
              Home
            </Link>
            {isAdmin ? (
              <>
                <NavDropdown
                  label="Browse"
                  items={browseItemsLimited}
                  active={isActive(["/blog", "/how-it-works"])}
                />
                <Link
                  to="/admin"
                  className={`text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
                    isActive(["/admin"]) ? "text-primary" : "text-foreground/80 hover:text-foreground"
                  }`}
                >
                  Admin Panel
                </Link>
              </>
            ) : (
              <>
                {!user && (
                  <NavDropdown
                    label="Browse"
                    items={browseItemsLimited}
                    active={isActive(["/blog", "/how-it-works"])}
                  />
                )}
                {isAuthenticated && !needsSetup && profileLoaded && (
                  <>
                    <NavDropdown
                      label={isClient ? "Find Experts" : "Find Gigs"}
                      items={findGigsItems}
                      active={isActive(["/jobs", "/freelancers", "/browse-services", "/contests", "/saved-experts", "/dashboard/my-services"])}
                    />
                    <NavDropdown
                      label="My Work"
                      items={myWorkItems}
                      active={isActive(["/dashboard/contracts", "/dashboard/received-offers", "/dashboard/offers", "/dashboard/contest-entries", "/dashboard/my-contests", "/dashboard/expert-proposals", "/dashboard/proposals"])}
                    />
                    <Link
                      to="/transactions"
                      className={`text-sm font-medium transition-colors px-1 py-1 ${
                        isActive(["/transactions"]) ? "text-primary" : "text-foreground/80 hover:text-foreground"
                      }`}
                    >
                      Payments
                    </Link>
                    <NavDropdown
                      label="Browse"
                      items={browseItems}
                      active={isActive(["/blog", "/how-it-works"])}
                    />
                  </>
                )}
              </>
            )}
          </nav>

          {/* Desktop right */}
          <div className="hidden lg:flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                  <Palette className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {THEME_OPTIONS.map((t) => (
                  <DropdownMenuItem key={t.value} onClick={() => setColorTheme(t.value)} className="gap-2 cursor-pointer">
                    <div className="h-4 w-4 rounded-full border border-border" style={{ backgroundColor: t.color }} />
                    <span>{t.label}</span>
                    {colorTheme === t.value && <span className="ml-auto text-xs">✓</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {needsSetup ? (
              <>
                <Button variant="outline" asChild><Link to="/onboarding">Complete setup</Link></Button>
                <Button variant="ghost" onClick={handleSignOut}>Sign Out</Button>
              </>
            ) : isAuthenticated ? (
              <>
                <NotificationBell />
                {/* Avatar → individual profile */}
                <Link to={profileHref} className="rounded-full shrink-0 mx-1">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={profile?.avatar_url || undefined} alt={displayName} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {getInitials(displayName)}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                {/* User menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full">
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-52" align="end">
                    <div className="px-2 py-1.5">
                      <p className="text-sm font-medium">{displayName}</p>
                      <p className="text-xs text-muted-foreground capitalize">{isAdmin ? "Admin" : displayRole}</p>
                    </div>
                    <DropdownMenuSeparator />
                    {isAdmin ? (
                      <DropdownMenuItem asChild>
                        <Link to="/admin" className="cursor-pointer">
                          <ShieldAlert className="mr-2 h-4 w-4" />Admin Panel
                        </Link>
                      </DropdownMenuItem>
                    ) : (
                      <>
                        <DropdownMenuItem asChild>
                          <Link to="/dashboard" className="cursor-pointer">
                            <User className="mr-2 h-4 w-4" />Dashboard
                          </Link>
                        </DropdownMenuItem>
                        {isFreelancer && (
                          <DropdownMenuItem asChild>
                            <Link to={profileHref} className="cursor-pointer">
                              <Eye className="mr-2 h-4 w-4" />My Profile
                            </Link>
                          </DropdownMenuItem>
                        )}
                        {isClient && (
                          <>
                            <DropdownMenuItem asChild>
                              <Link to={profileHref} className="cursor-pointer">
                                <Eye className="mr-2 h-4 w-4" />My Profile
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link to="/post-job" className="cursor-pointer">
                                <Briefcase className="mr-2 h-4 w-4" />Post a Job
                              </Link>
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuItem asChild>
                          <Link to="/settings" className="cursor-pointer">
                            <Settings className="mr-2 h-4 w-4" />Account Settings
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/messages" className="cursor-pointer">
                            <MessageSquare className="mr-2 h-4 w-4" />Messages
                            {unreadCount > 0 && (
                              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                                {unreadCount > 99 ? "99+" : unreadCount}
                              </span>
                            )}
                          </Link>
                        </DropdownMenuItem>
                      </>
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
                  <Button variant="ghost" onClick={handleSignOut}>Sign Out</Button>
                </>
              ) : (
                <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
              )
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild><Link to="/auth">Sign In</Link></Button>
                <Button size="sm" asChild><Link to="/auth?tab=signup">Get Started</Link></Button>
              </>
            )}
          </div>

          {/* Mobile right */}
          <div className="flex lg:hidden items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setThemeOpen((o) => !o)}
                className="p-2 rounded-lg border border-border bg-card hover:bg-accent transition-colors"
                aria-label="Change color theme"
              >
                <Palette className="h-4 w-4 text-muted-foreground" />
              </button>
              {themeOpen && (
                <div className="absolute right-0 mt-2 bg-popover border border-border rounded-lg shadow-lg p-2 flex gap-2 z-50">
                  {THEME_OPTIONS.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => { setColorTheme(t.value); setThemeOpen(false); }}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        colorTheme === t.value ? "border-foreground scale-110" : "border-transparent hover:scale-105"
                      }`}
                      style={{ backgroundColor: t.color }}
                      aria-label={`${t.label} theme`}
                    />
                  ))}
                </div>
              )}
            </div>
            {user && <NotificationBell />}
            {isAuthenticated && !needsSetup && (
              <Link to={profileHref} className="rounded-full shrink-0">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile?.avatar_url || undefined} alt={displayName} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {getInitials(displayName)}
                  </AvatarFallback>
                </Avatar>
              </Link>
            )}
            <button className="p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Auth error banner */}
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

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-border bg-background">
          <div className="container-wide py-4 space-y-1">
            <Link
              to="/"
              className="flex items-center gap-2 p-3 rounded-lg hover:bg-muted text-sm font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Home className="h-4 w-4" /> Home
            </Link>
            {isAuthenticated && !needsSetup && profileLoaded && !isAdmin && (
              <>
                <MobileDropdown
                  label={isClient ? "Find Experts" : "Find Gigs"}
                  items={findGigsItems}
                  open={mobileSubMenu === "find"}
                  toggle={() => setMobileSubMenu(mobileSubMenu === "find" ? null : "find")}
                  close={() => setMobileMenuOpen(false)}
                />
                <MobileDropdown
                  label="My Work"
                  items={myWorkItems}
                  open={mobileSubMenu === "work"}
                  toggle={() => setMobileSubMenu(mobileSubMenu === "work" ? null : "work")}
                  close={() => setMobileMenuOpen(false)}
                />
                <Link
                  to="/transactions"
                  className={`flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-muted text-sm font-medium transition-colors ${
                    isActive(["/transactions"]) ? "text-primary" : "text-foreground/80"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Wallet className="h-4 w-4" />
                  Payments
                </Link>
              </>
            )}
            <MobileDropdown
              label="Browse"
              items={isAdmin || !user ? browseItemsLimited : browseItems}
              open={mobileSubMenu === "browse"}
              toggle={() => setMobileSubMenu(mobileSubMenu === "browse" ? null : "browse")}
              close={() => setMobileMenuOpen(false)}
            />
            {isAuthenticated && !needsSetup && !isAdmin && (
              <Link
                to="/messages"
                className="flex items-center gap-2 p-3 rounded-lg hover:bg-muted text-sm font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                <MessageSquare className="h-4 w-4" />Messages
                {unreadCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
            )}
            <div className="pt-3 mt-2 border-t border-border space-y-2">
              {isAuthenticated ? (
                <>
                  {needsSetup ? (
                    <Link to="/onboarding" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="outline" className="w-full">Complete Setup</Button>
                    </Link>
                  ) : isAdmin ? (
                    <Link to="/admin" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="outline" className="w-full">
                        <ShieldAlert className="h-4 w-4 mr-2" />Admin Panel
                      </Button>
                    </Link>
                  ) : (
                    <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="outline" className="w-full">Dashboard</Button>
                    </Link>
                  )}
                  <Button variant="ghost" className="w-full text-destructive" onClick={handleSignOut}>
                    Sign Out
                  </Button>
                </>
              ) : isBootstrapPending ? (
                bootstrapStalled ? (
                  <>
                    <Button variant="outline" className="w-full" onClick={() => void handleRetryAccountSync()}>Refresh</Button>
                    <Button variant="ghost" className="w-full text-destructive" onClick={handleSignOut}>Sign Out</Button>
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
