import { Search, MessageSquare, FileCheck, CreditCard } from "lucide-react";

const steps = [
  {
    icon: Search,
    title: "Find Your Expert",
    description: "Browse verified engineering professionals by skill, location, and budget. View portfolios and reviews.",
  },
  {
    icon: MessageSquare,
    title: "Discuss Your Project",
    description: "Chat directly with freelancers, share requirements, and get quotes tailored to your needs.",
  },
  {
    icon: FileCheck,
    title: "Get Work Done",
    description: "Track progress, receive deliverables, and request revisions until you're satisfied.",
  },
  {
    icon: CreditCard,
    title: "Pay Securely",
    description: "Release payment only when you're happy. Funds are held safely in escrow during the project.",
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
                <div className="relative z-10 mx-auto w-20 h-20 rounded-2xl bg-card border-2 border-border flex items-center justify-center mb-6 group-hover:border-primary group-hover:shadow-lg transition-all duration-300">
                  <step.icon className="h-8 w-8 text-primary" />
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
