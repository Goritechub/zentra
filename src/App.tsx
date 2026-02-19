import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { RoleGuard } from "@/components/RoleGuard";
import { AuthGuard } from "@/components/AuthGuard";
import { ScrollToTop } from "@/components/ScrollToTop";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Freelancers from "./pages/Freelancers";
import Jobs from "./pages/Jobs";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import Messages from "./pages/Messages";
import MyProfile from "./pages/MyProfile";
import HowItWorks from "./pages/HowItWorks";
import JobDetails from "./pages/JobDetails";
import PostJob from "./pages/PostJob";
import LaunchContest from "./pages/LaunchContest";
import ClientJobs from "./pages/ClientJobs";
import SentOffers from "./pages/SentOffers";
import SavedExperts from "./pages/SavedExperts";
import BrowseServices from "./pages/BrowseServices";
import Transactions from "./pages/Transactions";
import ProposalsReceived from "./pages/ProposalsReceived";
import ContractsPage from "./pages/ContractsPage";
import ManageSkills from "./pages/ManageSkills";
import ManagePortfolio from "./pages/ManagePortfolio";
import ExpertProposals from "./pages/ExpertProposals";
import ContestEntries from "./pages/ContestEntries";
import AdminDashboard from "./pages/AdminDashboard";
import ContractDetail from "./pages/ContractDetail";
import ExpertProfile from "./pages/ExpertProfile";
import ApplyJob from "./pages/ApplyJob";
import Contact from "./pages/Contact";
import Notifications from "./pages/Notifications";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/expert/:id" element={<ExpertProfile />} />

            {/* Authenticated routes */}
            <Route path="/freelancers" element={<AuthGuard><RoleGuard allowedRoles={["client", "admin"]}><Freelancers /></RoleGuard></AuthGuard>} />
            <Route path="/jobs" element={<AuthGuard><RoleGuard allowedRoles={["freelancer", "admin"]}><Jobs /></RoleGuard></AuthGuard>} />
            <Route path="/job/:id" element={<AuthGuard><JobDetails /></AuthGuard>} />
            <Route path="/job/:id/apply" element={<AuthGuard><RoleGuard allowedRoles={["freelancer", "admin"]}><ApplyJob /></RoleGuard></AuthGuard>} />
            <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
            <Route path="/dashboard/jobs" element={<AuthGuard><RoleGuard allowedRoles={["client", "admin"]}><ClientJobs /></RoleGuard></AuthGuard>} />
            <Route path="/dashboard/proposals" element={<AuthGuard><RoleGuard allowedRoles={["client", "admin"]}><ProposalsReceived /></RoleGuard></AuthGuard>} />
            <Route path="/dashboard/offers" element={<AuthGuard><RoleGuard allowedRoles={["client", "admin"]}><SentOffers /></RoleGuard></AuthGuard>} />
            <Route path="/dashboard/saved" element={<AuthGuard><RoleGuard allowedRoles={["client", "admin"]}><SavedExperts /></RoleGuard></AuthGuard>} />
            <Route path="/dashboard/contracts" element={<AuthGuard><ContractsPage /></AuthGuard>} />
            <Route path="/dashboard/services" element={<AuthGuard><BrowseServices /></AuthGuard>} />
            <Route path="/contract/:id" element={<AuthGuard><ContractDetail /></AuthGuard>} />
            <Route path="/messages" element={<AuthGuard><Messages /></AuthGuard>} />
            <Route path="/my-profile" element={<AuthGuard><MyProfile /></AuthGuard>} />
            <Route path="/post-job" element={<AuthGuard><RoleGuard allowedRoles={["client", "admin"]}><PostJob /></RoleGuard></AuthGuard>} />
            <Route path="/launch-contest" element={<AuthGuard><RoleGuard allowedRoles={["client", "admin"]}><LaunchContest /></RoleGuard></AuthGuard>} />
            <Route path="/transactions" element={<AuthGuard><Transactions /></AuthGuard>} />
            <Route path="/manage-skills" element={<AuthGuard><RoleGuard allowedRoles={["freelancer", "admin"]}><ManageSkills /></RoleGuard></AuthGuard>} />
            <Route path="/manage-portfolio" element={<AuthGuard><RoleGuard allowedRoles={["freelancer", "admin"]}><ManagePortfolio /></RoleGuard></AuthGuard>} />
            <Route path="/dashboard/expert-proposals" element={<AuthGuard><RoleGuard allowedRoles={["freelancer", "admin"]}><ExpertProposals /></RoleGuard></AuthGuard>} />
            <Route path="/dashboard/contest-entries" element={<AuthGuard><RoleGuard allowedRoles={["freelancer", "admin"]}><ContestEntries /></RoleGuard></AuthGuard>} />
            <Route path="/admin" element={<AuthGuard><AdminDashboard /></AuthGuard>} />
            <Route path="/notifications" element={<AuthGuard><Notifications /></AuthGuard>} />
            <Route path="/contact" element={<Contact />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
