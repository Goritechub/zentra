import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { PlatformFreezeProvider } from "@/hooks/usePlatformFreeze";
import { PlatformFrozenBanner } from "@/components/PlatformFrozenBanner";
import { RoleGuard } from "@/components/RoleGuard";
import { AuthGuard } from "@/components/AuthGuard";
import { AuthCodeSetupGuard } from "@/components/AuthCodeSetupGuard";
import { ScrollToTop } from "@/components/ScrollToTop";
import { Loader2 } from "lucide-react";

// Lazy-loaded pages
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Freelancers = lazy(() => import("./pages/Freelancers"));
const Jobs = lazy(() => import("./pages/Jobs"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Messages = lazy(() => import("./pages/Messages"));
const MyProfile = lazy(() => import("./pages/MyProfile"));
const HowItWorks = lazy(() => import("./pages/HowItWorks"));
const JobDetails = lazy(() => import("./pages/JobDetails"));
const PostJob = lazy(() => import("./pages/PostJob"));
const LaunchContest = lazy(() => import("./pages/LaunchContest"));
const ClientJobs = lazy(() => import("./pages/ClientJobs"));
const SentOffers = lazy(() => import("./pages/SentOffers"));
const Transactions = lazy(() => import("./pages/Transactions"));
const ProposalsReceived = lazy(() => import("./pages/ProposalsReceived"));
const ContractsPage = lazy(() => import("./pages/ContractsPage"));
const ManageSkills = lazy(() => import("./pages/ManageSkills"));
const ManagePortfolio = lazy(() => import("./pages/ManagePortfolio"));
const ExpertProposals = lazy(() => import("./pages/ExpertProposals"));
const ContestEntries = lazy(() => import("./pages/ContestEntries"));
const ContractDetail = lazy(() => import("./pages/ContractDetail"));
const DisputeDetail = lazy(() => import("./pages/DisputeDetail"));
const ExpertProfile = lazy(() => import("./pages/ExpertProfile"));
const ApplyJob = lazy(() => import("./pages/ApplyJob"));
const Contact = lazy(() => import("./pages/Contact"));
const Notifications = lazy(() => import("./pages/Notifications"));
const ReceivedOffers = lazy(() => import("./pages/ReceivedOffers"));
const BrowseContests = lazy(() => import("./pages/BrowseContests"));
const ContestDetailPage = lazy(() => import("./pages/ContestDetail"));
const MyContests = lazy(() => import("./pages/MyContests"));
const MyServices = lazy(() => import("./pages/MyServices"));
const BrowseServices = lazy(() => import("./pages/BrowseServices"));
const Terms = lazy(() => import("./pages/Terms"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const SavedExperts = lazy(() => import("./pages/SavedExperts"));

// Admin pages
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminOverview = lazy(() => import("./pages/admin/AdminOverview"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminJobs = lazy(() => import("./pages/admin/AdminJobs"));
const AdminContracts = lazy(() => import("./pages/admin/AdminContracts"));
const AdminPayments = lazy(() => import("./pages/admin/AdminPayments"));
const AdminDisputes = lazy(() => import("./pages/admin/AdminDisputes"));
const AdminReviews = lazy(() => import("./pages/admin/AdminReviews"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminActivity = lazy(() => import("./pages/admin/AdminActivity"));
const AdminContests = lazy(() => import("./pages/admin/AdminContests"));
const AdminManagement = lazy(() => import("./pages/admin/AdminManagement"));
const AdminVerification = lazy(() => import("./pages/admin/AdminVerification"));
const AdminSupport = lazy(() => import("./pages/admin/AdminSupport"));
const AdminPlatformReviews = lazy(() => import("./pages/admin/AdminPlatformReviews"));
const AdminLegalDocuments = lazy(() => import("./pages/admin/AdminLegalDocuments"));

import { FloatingSupport } from "./components/support/FloatingSupport";

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <AuthProvider>
      <PlatformFreezeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <PlatformFrozenBanner />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/expert/:id" element={<ExpertProfile />} />
              <Route path="/expert/:id/profile" element={<ExpertProfile />} />

              {/* Authenticated routes */}
              <Route path="/freelancers" element={<AuthGuard><RoleGuard allowedRoles={["client", "admin"]}><Freelancers /></RoleGuard></AuthGuard>} />
              <Route path="/jobs" element={<AuthGuard><RoleGuard allowedRoles={["freelancer", "admin"]}><Jobs /></RoleGuard></AuthGuard>} />
              <Route path="/job/:id" element={<AuthGuard><JobDetails /></AuthGuard>} />
              <Route path="/job/:id/apply" element={<AuthGuard><RoleGuard allowedRoles={["freelancer", "admin"]}><ApplyJob /></RoleGuard></AuthGuard>} />
              <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
              <Route path="/dashboard/jobs" element={<AuthGuard><RoleGuard allowedRoles={["client", "admin"]}><ClientJobs /></RoleGuard></AuthGuard>} />
              <Route path="/dashboard/proposals" element={<AuthGuard><RoleGuard allowedRoles={["client", "admin"]}><ProposalsReceived /></RoleGuard></AuthGuard>} />
              <Route path="/dashboard/offers" element={<AuthGuard><RoleGuard allowedRoles={["client", "admin"]}><SentOffers /></RoleGuard></AuthGuard>} />
              <Route path="/dashboard/contracts" element={<AuthGuard><ContractsPage /></AuthGuard>} />
              <Route path="/contract/:id" element={<AuthGuard><ContractDetail /></AuthGuard>} />
              <Route path="/dispute/:disputeId" element={<AuthGuard><DisputeDetail /></AuthGuard>} />
              <Route path="/messages" element={<AuthGuard><Messages /></AuthGuard>} />
              <Route path="/my-profile" element={<AuthGuard><MyProfile /></AuthGuard>} />
              <Route path="/post-job" element={<AuthGuard><RoleGuard allowedRoles={["client", "admin"]}><PostJob /></RoleGuard></AuthGuard>} />
              <Route path="/launch-contest" element={<AuthGuard><RoleGuard allowedRoles={["client", "admin"]}><LaunchContest /></RoleGuard></AuthGuard>} />
              <Route path="/transactions" element={<AuthGuard><Transactions /></AuthGuard>} />
              <Route path="/manage-skills" element={<AuthGuard><RoleGuard allowedRoles={["freelancer", "admin"]}><ManageSkills /></RoleGuard></AuthGuard>} />
              <Route path="/manage-portfolio" element={<AuthGuard><RoleGuard allowedRoles={["freelancer", "admin"]}><ManagePortfolio /></RoleGuard></AuthGuard>} />
              <Route path="/dashboard/expert-proposals" element={<AuthGuard><RoleGuard allowedRoles={["freelancer", "admin"]}><ExpertProposals /></RoleGuard></AuthGuard>} />
              <Route path="/dashboard/contest-entries" element={<AuthGuard><RoleGuard allowedRoles={["freelancer", "admin"]}><ContestEntries /></RoleGuard></AuthGuard>} />
              <Route path="/dashboard/received-offers" element={<AuthGuard><RoleGuard allowedRoles={["freelancer", "admin"]}><ReceivedOffers /></RoleGuard></AuthGuard>} />
              <Route path="/notifications" element={<AuthGuard><Notifications /></AuthGuard>} />
              <Route path="/contact" element={<Contact />} />

              {/* Contests */}
              <Route path="/contests" element={<AuthGuard><BrowseContests /></AuthGuard>} />
              <Route path="/contest/:id" element={<AuthGuard><ContestDetailPage /></AuthGuard>} />
              <Route path="/dashboard/my-contests" element={<AuthGuard><RoleGuard allowedRoles={["client", "admin"]}><MyContests /></RoleGuard></AuthGuard>} />

              {/* Services */}
              <Route path="/dashboard/my-services" element={<AuthGuard><RoleGuard allowedRoles={["freelancer", "admin"]}><MyServices /></RoleGuard></AuthGuard>} />
              <Route path="/browse-services" element={<AuthGuard><RoleGuard allowedRoles={["client", "admin"]}><BrowseServices /></RoleGuard></AuthGuard>} />

              {/* Admin Panel */}
              <Route path="/admin" element={<AuthGuard><AdminLayout /></AuthGuard>}>
                <Route index element={<AdminOverview />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="jobs" element={<AdminJobs />} />
                <Route path="contests" element={<AdminContests />} />
                <Route path="contracts" element={<AdminContracts />} />
                <Route path="payments" element={<AdminPayments />} />
                <Route path="disputes" element={<AdminDisputes />} />
                <Route path="reviews" element={<AdminReviews />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="activity" element={<AdminActivity />} />
                <Route path="management" element={<AdminManagement />} />
                <Route path="verification" element={<AdminVerification />} />
                <Route path="support" element={<AdminSupport />} />
                <Route path="platform-reviews" element={<AdminPlatformReviews />} />
                <Route path="legal-documents" element={<AdminLegalDocuments />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <FloatingSupport />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
