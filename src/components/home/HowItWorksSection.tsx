import {
  Search,
  MessageSquare,
  FileCheck,
  CreditCard,
  User,
  ShieldCheck,
} from "lucide-react";

const steps = [
  {
    title: "Find Your Expert",
    description: "Browse verified engineering professionals by skill, location, and budget. View portfolios and reviews.",
    render: () => (
      <div className="absolute inset-0 overflow-hidden rounded-2xl">
        <User className="absolute h-3 w-3 text-muted-foreground/30 top-3 left-3" />
        <User className="absolute h-3 w-3 text-muted-foreground/30 top-3 right-3" />
        <User className="absolute h-3 w-3 text-muted-foreground/30 bottom-3 left-1/2 -translate-x-1/2" />
        <Search className="how-it-works-search-icon absolute left-1/2 top-1/2 h-8 w-8 -ml-4 -mt-4 text-primary" />
      </div>
    ),
  },
  {
    title: "Discuss Your Project",
    description: "Chat directly with freelancers, share requirements, and get quotes tailored to your needs.",
    render: () => (
      <div className="absolute inset-0 overflow-hidden rounded-2xl">
        <MessageSquare className="absolute left-1/2 top-1/2 h-8 w-8 -ml-4 -mt-4 text-primary transition-opacity duration-300 group-hover:opacity-20" />
        <div className="how-it-works-bubble-left absolute h-3 w-6 rounded-md rounded-bl-sm bg-accent/80 bottom-4 left-3 opacity-0" />
        <div className="how-it-works-bubble-right absolute h-3 w-6 rounded-md rounded-br-sm bg-accent/80 bottom-4 right-3 opacity-0" />
      </div>
    ),
  },
  {
    title: "Get Work Done",
    description: "Track progress, receive deliverables, and request revisions until you're satisfied.",
    render: () => (
      <div className="absolute inset-0 overflow-hidden rounded-2xl">
        <FileCheck className="how-it-works-file-icon absolute left-1/2 top-1/2 h-8 w-8 -ml-4 -mt-4 text-primary" />
        <svg
          className="how-it-works-progress-ring absolute inset-0 h-full w-full -rotate-90"
          viewBox="0 0 80 80"
        >
          <circle
            cx="40"
            cy="40"
            r="37"
            fill="none"
            stroke="hsl(var(--accent))"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="233"
            strokeDashoffset="233"
          />
        </svg>
      </div>
    ),
  },
  {
    title: "Pay Securely",
    description: "Release payment only when you're happy. ZentraGig holds your payment securely until you approve the work.",
    render: () => (
      <div className="absolute inset-0 overflow-hidden rounded-2xl">
        <ShieldCheck className="absolute left-1/2 top-1/2 h-8 w-8 -ml-4 -mt-4 text-primary" />
        <div className="absolute left-3 right-3 top-1/2 -mt-px h-px bg-border" />
        <CreditCard className="how-it-works-card-swipe absolute left-1/2 top-1/2 h-4 w-4 -ml-2 -mt-2 text-accent opacity-0" />
      </div>
    ),
  },
];

export function HowItWorksSection() {
  return (
    <section className="section-padding">
      <div className="container-wide">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            How ZentraGig Works
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Hiring engineering talent has never been easier. Get started in minutes.
          </p>
        </div>

        <div className="relative">
          {/* Connection line */}
          <div className="hidden lg:block absolute top-24 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-border to-transparent" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="relative text-center group">
                {/* Step number */}
                <div className="relative z-10 mx-auto w-20 h-20 rounded-2xl bg-card border-2 border-border mb-6 group-hover:shadow-lg transition-all duration-300">
                  {step.render()}
                  <span className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center shadow-lg">
                    {index + 1}
                  </span>
                </div>

                <h3 className="text-xl font-semibold text-foreground mb-3">
                  {step.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
