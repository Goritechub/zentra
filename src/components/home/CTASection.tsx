import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Briefcase, Users } from "lucide-react";

export function CTASection() {
  return (
    <section className="section-padding bg-hero-gradient text-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent rounded-full blur-3xl" />
      </div>

      <div className="container-wide relative">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 md:gap-12">
            {/* For Clients */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
              <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center mb-6">
                <Briefcase className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Looking to Hire?</h3>
              <p className="text-white/80 mb-6 leading-relaxed">
                Post your engineering project and receive proposals from verified Nigerian experts within hours.
              </p>
              <Button size="lg" variant="hero" asChild className="w-full sm:w-auto">
                <Link to="/post-job">
                  Post a Project
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </div>

            {/* For Freelancers */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
              <div className="w-14 h-14 rounded-xl bg-accent/80 flex items-center justify-center mb-6">
                <Users className="h-7 w-7 text-accent-foreground" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Are You an Engineer?</h3>
              <p className="text-white/80 mb-6 leading-relaxed">
                Join Nigeria's fastest-growing engineering marketplace. Set your rates, build your portfolio, and grow your career.
              </p>
              <Button size="lg" variant="heroOutline" asChild className="w-full sm:w-auto">
                <Link to="/auth?tab=signup&role=freelancer">
                  Join as Freelancer
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
