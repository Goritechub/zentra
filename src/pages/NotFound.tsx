import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Home, Briefcase, Search } from "lucide-react";

const NotFoundIllustration = () => (
  <svg
    viewBox="0 0 480 320"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full max-w-md mx-auto"
    aria-hidden="true"
  >
    {/* Background blobs */}
    <ellipse cx="100" cy="260" rx="80" ry="40" fill="hsl(var(--primary)/0.06)" />
    <ellipse cx="380" cy="80" rx="60" ry="30" fill="hsl(var(--primary)/0.06)" />

    {/* Large 404 text — decorative */}
    <text
      x="50%"
      y="55%"
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize="148"
      fontWeight="800"
      fontFamily="ui-monospace,monospace"
      fill="hsl(var(--primary)/0.08)"
      letterSpacing="-4"
    >
      404
    </text>

    {/* Magnifying glass handle */}
    <line x1="302" y1="222" x2="344" y2="264" stroke="hsl(var(--primary))" strokeWidth="14" strokeLinecap="round" />

    {/* Magnifying glass circle */}
    <circle cx="240" cy="160" r="88" stroke="hsl(var(--primary))" strokeWidth="14" fill="hsl(var(--card))" />

    {/* Inner dashed circle — "nothing found" */}
    <circle cx="240" cy="160" r="56" stroke="hsl(var(--primary)/0.25)" strokeWidth="3" strokeDasharray="8 6" fill="none" />

    {/* Question mark inside glass */}
    <text
      x="240"
      y="152"
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize="52"
      fontWeight="700"
      fontFamily="ui-monospace,monospace"
      fill="hsl(var(--primary)/0.45)"
    >
      ?
    </text>

    {/* Floating dots */}
    <circle cx="108" cy="108" r="8" fill="hsl(var(--primary)/0.4)" />
    <circle cx="88"  cy="140" r="5" fill="hsl(var(--primary)/0.2)" />
    <circle cx="372" cy="200" r="10" fill="hsl(var(--primary)/0.3)" />
    <circle cx="396" cy="228" r="5"  fill="hsl(var(--primary)/0.15)" />
    <circle cx="148" cy="272" r="6"  fill="hsl(var(--primary)/0.2)" />
    <circle cx="344" cy="104" r="7"  fill="hsl(var(--primary)/0.25)" />
  </svg>
);

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  useEffect(() => {
    console.error("404:", location.pathname);
  }, [location.pathname]);

  const role = profile?.role;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center bg-muted/30 py-16 px-4">
        <div className="max-w-lg w-full text-center space-y-6">
          <NotFoundIllustration />

          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">Page not found</h1>
            <p className="text-muted-foreground">
              The page you're looking for doesn't exist or may have been moved.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button variant="outline" onClick={() => navigate(-1)} className="gap-2 w-full sm:w-auto">
              <ArrowLeft className="h-4 w-4" /> Go Back
            </Button>

            {!user && (
              <Button onClick={() => navigate("/")} className="gap-2 w-full sm:w-auto">
                <Home className="h-4 w-4" /> Home
              </Button>
            )}

            {user && role === "freelancer" && (
              <>
                <Button onClick={() => navigate("/dashboard")} className="gap-2 w-full sm:w-auto">
                  <Home className="h-4 w-4" /> Dashboard
                </Button>
                <Button variant="outline" onClick={() => navigate("/jobs")} className="gap-2 w-full sm:w-auto">
                  <Search className="h-4 w-4" /> Browse Jobs
                </Button>
              </>
            )}

            {user && role === "client" && (
              <>
                <Button onClick={() => navigate("/dashboard")} className="gap-2 w-full sm:w-auto">
                  <Home className="h-4 w-4" /> Dashboard
                </Button>
                <Button variant="outline" onClick={() => navigate("/freelancers")} className="gap-2 w-full sm:w-auto">
                  <Briefcase className="h-4 w-4" /> Find Experts
                </Button>
              </>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default NotFound;
