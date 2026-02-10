import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
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
            <Route path="/freelancers" element={<Freelancers />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/job/:id" element={<JobDetails />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/jobs" element={<ClientJobs />} />
            <Route path="/dashboard/offers" element={<SentOffers />} />
            <Route path="/dashboard/saved" element={<SavedExperts />} />
            <Route path="/dashboard/services" element={<BrowseServices />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/my-profile" element={<MyProfile />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/post-job" element={<PostJob />} />
            <Route path="/launch-contest" element={<LaunchContest />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
