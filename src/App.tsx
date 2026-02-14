import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { RoleGuard } from "@/components/RoleGuard";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            {/* Find Talent - not for freelancers */}
            <Route path="/freelancers" element={<RoleGuard allowedRoles={["client", "admin"]}><Freelancers /></RoleGuard>} />
            {/* Browse Jobs - not for clients */}
            <Route path="/jobs" element={<RoleGuard allowedRoles={["freelancer", "admin"]}><Jobs /></RoleGuard>} />
            <Route path="/job/:id" element={<JobDetails />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/jobs" element={<RoleGuard allowedRoles={["client", "admin"]}><ClientJobs /></RoleGuard>} />
            <Route path="/dashboard/proposals" element={<RoleGuard allowedRoles={["client", "admin"]}><ProposalsReceived /></RoleGuard>} />
            <Route path="/dashboard/offers" element={<RoleGuard allowedRoles={["client", "admin"]}><SentOffers /></RoleGuard>} />
            <Route path="/dashboard/saved" element={<RoleGuard allowedRoles={["client", "admin"]}><SavedExperts /></RoleGuard>} />
            <Route path="/dashboard/contracts" element={<ContractsPage />} />
            <Route path="/dashboard/services" element={<BrowseServices />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/my-profile" element={<MyProfile />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/post-job" element={<RoleGuard allowedRoles={["client", "admin"]}><PostJob /></RoleGuard>} />
            <Route path="/launch-contest" element={<RoleGuard allowedRoles={["client", "admin"]}><LaunchContest /></RoleGuard>} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/manage-skills" element={<RoleGuard allowedRoles={["freelancer", "admin"]}><ManageSkills /></RoleGuard>} />
            <Route path="/manage-portfolio" element={<RoleGuard allowedRoles={["freelancer", "admin"]}><ManagePortfolio /></RoleGuard>} />
            <Route path="/dashboard/expert-proposals" element={<RoleGuard allowedRoles={["freelancer", "admin"]}><ExpertProposals /></RoleGuard>} />
            <Route path="/dashboard/contest-entries" element={<RoleGuard allowedRoles={["freelancer", "admin"]}><ContestEntries /></RoleGuard>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
