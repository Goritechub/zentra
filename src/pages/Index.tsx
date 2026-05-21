import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SEO } from "@/components/SEO";
import { HeroSection } from "@/components/home/HeroSection";
import { CategoriesSection } from "@/components/home/CategoriesSection";
import { HowItWorksSection } from "@/components/home/HowItWorksSection";
import { FeaturedFreelancers } from "@/components/home/FeaturedFreelancers";
import { TestimonialsSection } from "@/components/home/TestimonialsSection";
import { CTASection } from "@/components/home/CTASection";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <SEO
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "ZentraGig",
            url: "https://zentragig.com",
            logo: "https://zentragig.com/zentragig-logo.PNG",
            description: "ZentraGig is Nigeria's marketplace for hiring verified engineers, makers, and technical experts.",
            sameAs: ["https://twitter.com/ZentraGig"],
          },
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "ZentraGig",
            url: "https://zentragig.com",
            potentialAction: {
              "@type": "SearchAction",
              target: { "@type": "EntryPoint", urlTemplate: "https://zentragig.com/jobs?q={search_term_string}" },
              "query-input": "required name=search_term_string",
            },
          },
        ]}
      />
      <Header />
      <main className="flex-1">
        <HeroSection />
        <CategoriesSection />
        <FeaturedFreelancers />
        <HowItWorksSection />
        <TestimonialsSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
