import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Search, ArrowRight, CheckCircle2, Users, Briefcase } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-hero-gradient text-white">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }} />

      </div>

      <div className="container-wide relative">
        <div className="py-20 md:py-28 lg:py-32">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 animate-fade-in">
              <span className="flex h-2 w-2 rounded-full bg-accent animate-pulse-soft" />
              <span className="text-sm font-medium">The Freelance Marketplace for Engineers & Makers</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight animate-fade-in-up">
              Hire <span className="text-accent">Engineers</span> & Makers.
              <span className="block text-2xl md:text-3xl lg:text-4xl mt-3 font-semibold text-white/90">Build Real Things.</span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto animate-fade-in-up animation-delay-100">
              Connect with skilled engineers, architects, and technical professionals across Nigeria.
              Find the perfect expert for your engineering projects.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 animate-fade-in-up animation-delay-200">
              <Button size="xl" variant="hero" asChild>
                <Link to="/freelancers">
                   <Search className="h-5 w-5 mr-2" />
                   Find Skills
                </Link>
              </Button>
              <Button size="xl" variant="heroOutline" asChild>
                <Link to="/auth?tab=signup&role=freelancer">
                  Become a Freelancer
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Link>
              </Button>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap items-center justify-center gap-6 pt-8 text-sm text-white/70 animate-fade-in-up animation-delay-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-accent" />
                <span>Verified Professionals</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-accent" />
                <span>500+ Engineers</span>
              </div>
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-accent" />
                <span>1,000+ Projects Completed</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
          <path
            d="M0 100V50C240 83.3333 480 100 720 100C960 100 1200 83.3333 1440 50V100H0Z"
            fill="hsl(var(--background))" />

        </svg>
      </div>
    </section>);

}