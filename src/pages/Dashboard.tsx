import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { 
  Briefcase, 
  MessageSquare, 
  FileText, 
  Settings, 
  Users,
  PlusCircle,
  Eye,
  Star,
  Loader2,
  ArrowRight
} from "lucide-react";

export default function DashboardPage() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  const isFreelancer = profile.role === "freelancer";
  const isClient = profile.role === "client";

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-wide">
          {/* Welcome Section */}
          <div className="bg-hero-gradient text-white rounded-2xl p-8 mb-8">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              Welcome back, {profile.full_name?.split(" ")[0] || "User"}! 👋
            </h1>
            <p className="text-white/80">
              {isFreelancer
                ? "Manage your profile, view proposals, and track your projects."
                : "Find talent, manage your projects, and track progress."}
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Briefcase className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">0</p>
                  <p className="text-sm text-muted-foreground">
                    {isFreelancer ? "Active Projects" : "Posted Jobs"}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">0</p>
                  <p className="text-sm text-muted-foreground">
                    {isFreelancer ? "Proposals Sent" : "Proposals Received"}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <MessageSquare className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">0</p>
                  <p className="text-sm text-muted-foreground">Messages</p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <Star className="h-6 w-6 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">0</p>
                  <p className="text-sm text-muted-foreground">Reviews</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Actions Panel */}
            <div className="bg-card rounded-xl border border-border p-6">
              <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
              <div className="space-y-3">
                {isClient && (
                  <>
                    <Link to="/post-job">
                      <Button className="w-full justify-start" size="lg">
                        <PlusCircle className="h-5 w-5 mr-3" />
                        Post a New Job
                        <ArrowRight className="h-4 w-4 ml-auto" />
                      </Button>
                    </Link>
                    <Link to="/freelancers">
                      <Button variant="outline" className="w-full justify-start" size="lg">
                        <Users className="h-5 w-5 mr-3" />
                        Browse CAD Experts
                        <ArrowRight className="h-4 w-4 ml-auto" />
                      </Button>
                    </Link>
                  </>
                )}
                {isFreelancer && (
                  <>
                    <Link to="/jobs">
                      <Button className="w-full justify-start" size="lg">
                        <Eye className="h-5 w-5 mr-3" />
                        Browse Available Jobs
                        <ArrowRight className="h-4 w-4 ml-auto" />
                      </Button>
                    </Link>
                    <Link to="/my-profile">
                      <Button variant="outline" className="w-full justify-start" size="lg">
                        <Settings className="h-5 w-5 mr-3" />
                        Edit My Profile
                        <ArrowRight className="h-4 w-4 ml-auto" />
                      </Button>
                    </Link>
                  </>
                )}
                <Link to="/messages">
                  <Button variant="outline" className="w-full justify-start" size="lg">
                    <MessageSquare className="h-5 w-5 mr-3" />
                    View Messages
                    <ArrowRight className="h-4 w-4 ml-auto" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Profile Completion */}
            <div className="bg-card rounded-xl border border-border p-6">
              <h2 className="text-lg font-semibold mb-4">Complete Your Profile</h2>
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-lg">📍</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">Add Your Location</p>
                    <p className="text-sm text-muted-foreground">
                      Help clients find you by adding your state and city
                    </p>
                  </div>
                  <Button size="sm" variant="outline">Add</Button>
                </div>

                {isFreelancer && (
                  <>
                    <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-lg">💼</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">Add Skills</p>
                        <p className="text-sm text-muted-foreground">
                          Showcase your CAD software expertise
                        </p>
                      </div>
                      <Button size="sm" variant="outline">Add</Button>
                    </div>

                    <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-lg">🖼️</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">Add Portfolio Items</p>
                        <p className="text-sm text-muted-foreground">
                          Show off your best CAD work
                        </p>
                      </div>
                      <Button size="sm" variant="outline">Add</Button>
                    </div>
                  </>
                )}

                <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-lg">📱</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">Add Phone/WhatsApp</p>
                    <p className="text-sm text-muted-foreground">
                      Make it easy for clients to reach you
                    </p>
                  </div>
                  <Button size="sm" variant="outline">Add</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
