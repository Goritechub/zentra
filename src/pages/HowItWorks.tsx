import { Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import {
  UserPlus, Search, FileText, MessageSquare, Handshake, CreditCard,
  Trophy, Upload, Briefcase, CheckCircle2, ArrowRight, Star
} from "lucide-react";

const freelancerSteps = [
  { icon: UserPlus, title: "Create Your Profile", description: "Sign up as a freelancer, add your skills, software expertise, portfolio items, and set your rates." },
  { icon: Search, title: "Browse & Apply", description: "Find jobs matching your skills. Submit proposals with your bid, timeline, and cover letter." },
  { icon: MessageSquare, title: "Discuss & Collaborate", description: "Chat with clients, clarify requirements, share files, and agree on deliverables." },
  { icon: CreditCard, title: "Get Paid Securely", description: "Complete milestones, get approved, and receive payment through our secure escrow system." },
];

const clientSteps = [
  { icon: FileText, title: "Post a Job or Contest", description: "Describe your engineering project, set a budget, required skills, and timeline. Or launch a contest for multiple submissions." },
  { icon: Search, title: "Review Proposals", description: "Browse proposals from qualified engineers. Check portfolios, ratings, and reviews." },
  { icon: Handshake, title: "Hire & Collaborate", description: "Select your expert, set milestones, and work together with built-in messaging and file sharing." },
  { icon: CheckCircle2, title: "Approve & Pay", description: "Review deliverables, request revisions if needed, and release payment when satisfied." },
];

const benefits = [
  { icon: Star, title: "Verified Nigerian Experts", description: "All freelancers are verified professionals with real portfolios and reviews." },
  { icon: Trophy, title: "Contest Mode", description: "Launch design contests to receive multiple submissions and pick the best one." },
  { icon: Upload, title: "Portfolio Showcase", description: "Freelancers showcase their best CAD work with detailed project galleries." },
  { icon: Briefcase, title: "Escrow Protection", description: "Funds are held securely until you approve the work. No risk for either party." },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-hero-gradient text-white py-16 md:py-24">
          <div className="container-wide text-center">
            <h1 className="text-3xl md:text-5xl font-bold mb-4">How ZentraGig Works</h1>
            <p className="text-white/80 text-lg max-w-2xl mx-auto">
              Whether you're hiring engineering talent or looking for technical work, 
              our platform makes it simple, secure, and professional.
            </p>
          </div>
        </section>

        {/* For Clients */}
        <section className="section-padding">
          <div className="container-wide">
            <div className="text-center mb-16">
              <span className="inline-block px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">For Clients</span>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Hire Engineers in 4 Easy Steps</h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Find the perfect professional for your project and get quality work delivered on time.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {clientSteps.map((step, i) => (
                <div key={i} className="relative text-center group">
                  <div className="relative z-10 mx-auto w-20 h-20 rounded-2xl bg-card border-2 border-border flex items-center justify-center mb-6 group-hover:border-primary group-hover:shadow-lg transition-all">
                    <step.icon className="h-8 w-8 text-primary" />
                    <span className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center shadow-lg">{i + 1}</span>
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">{step.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                </div>
              ))}
            </div>
            <div className="text-center mt-12">
              <Button size="lg" asChild>
                <Link to="/auth?tab=signup&role=client">Start Hiring <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </div>
        </section>

        {/* For Freelancers */}
        <section className="section-padding bg-muted/30">
          <div className="container-wide">
            <div className="text-center mb-16">
              <span className="inline-block px-4 py-1 rounded-full bg-accent/10 text-accent-foreground text-sm font-semibold mb-4">For Freelancers</span>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Start Earning as an Engineering Professional</h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Showcase your skills, find quality projects, and grow your engineering career.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {freelancerSteps.map((step, i) => (
                <div key={i} className="relative text-center group">
                  <div className="relative z-10 mx-auto w-20 h-20 rounded-2xl bg-card border-2 border-border flex items-center justify-center mb-6 group-hover:border-accent group-hover:shadow-lg transition-all">
                    <step.icon className="h-8 w-8 text-accent" />
                    <span className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-accent text-accent-foreground text-sm font-bold flex items-center justify-center shadow-lg">{i + 1}</span>
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">{step.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                </div>
              ))}
            </div>
            <div className="text-center mt-12">
              <Button size="lg" variant="outline" asChild>
                <Link to="/auth?tab=signup&role=freelancer">Join as Freelancer <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="section-padding">
          <div className="container-wide">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Why Choose ZentraGig?</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {benefits.map((b, i) => (
                <div key={i} className="bg-card rounded-xl border border-border p-6 card-hover text-center">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <b.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{b.title}</h3>
                  <p className="text-sm text-muted-foreground">{b.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-hero-gradient text-white py-16">
          <div className="container-wide text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="text-white/80 mb-8 max-w-lg mx-auto">
              Join thousands of Nigerian engineers and clients on the platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" variant="secondary" asChild>
                <Link to="/auth?tab=signup&role=client">Hire an Expert</Link>
              </Button>
              <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10" asChild>
                <Link to="/auth?tab=signup&role=freelancer">Find Work</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
