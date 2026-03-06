import { Link } from "react-router-dom";
import { MapPin, Mail, Phone, MessageCircle } from "lucide-react";
import { ZentraGigLogo } from "@/components/ZentraGigLogo";

export function Footer() {
  return (
    <footer className="bg-foreground text-background">
      <div className="container-wide section-padding">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="inline-block">
              <ZentraGigLogo size="md" />
            </Link>
            <p className="text-sm text-background/70">
              Nigeria's premier marketplace for CAD professionals. Connect with verified engineers, 
              architects, and designers across the country.
            </p>
            <div className="flex items-center gap-4 text-background/70">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="text-sm">Lagos, Nigeria</span>
            </div>
          </div>

          {/* For Clients */}
          <div className="space-y-4">
            <h4 className="font-semibold text-lg">For Clients</h4>
            <ul className="space-y-2 text-sm text-background/70">
              <li><Link to="/freelancers" className="hover:text-primary transition-colors">Find CAD Experts</Link></li>
              <li><Link to="/post-job" className="hover:text-primary transition-colors">Post a Project</Link></li>
              <li><Link to="/how-it-works" className="hover:text-primary transition-colors">How It Works</Link></li>
              <li><Link to="/pricing" className="hover:text-primary transition-colors">Pricing</Link></li>
            </ul>
          </div>

          {/* For Freelancers */}
          <div className="space-y-4">
            <h4 className="font-semibold text-lg">For Freelancers</h4>
            <ul className="space-y-2 text-sm text-background/70">
              <li><Link to="/auth?tab=signup&role=freelancer" className="hover:text-primary transition-colors">Become a Freelancer</Link></li>
              <li><Link to="/jobs" className="hover:text-primary transition-colors">Browse Jobs</Link></li>
              <li><Link to="/resources" className="hover:text-primary transition-colors">Resources</Link></li>
              <li><Link to="/success-stories" className="hover:text-primary transition-colors">Success Stories</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h4 className="font-semibold text-lg">Contact Us</h4>
            <ul className="space-y-3 text-sm text-background/70">
              <li className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-primary" />
                <a href="mailto:hello@zentragig.com" className="hover:text-primary transition-colors">hello@zentragig.com</a>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-primary" />
                <a href="tel:+2348012345678" className="hover:text-primary transition-colors">+234 801 234 5678</a>
              </li>
              <li className="flex items-center gap-3">
                <MessageCircle className="h-4 w-4 text-primary" />
                <a href="https://wa.me/2348012345678" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">WhatsApp Support</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-background/10 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-background/60">© {new Date().getFullYear()} ZentraGig. All rights reserved.</p>
          <div className="flex items-center gap-6 text-sm text-background/60">
            <Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
