import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MessageCircle, X, HelpCircle, ChevronRight, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const FAQ_ITEMS = [
  {
    q: "How do I post a job?",
    a: "Go to your Dashboard and click 'Post a Job'. Fill in the job details, set your budget, and publish. Engineers will start sending proposals shortly.",
  },
  {
    q: "How do I submit a proposal?",
    a: "Browse available jobs, click on one that matches your skills, and click 'Apply'. Write a cover letter, set your bid amount, and submit your proposal.",
  },
  {
    q: "How do contests work?",
    a: "Clients launch contests with prize pools. Engineers submit entries. The client reviews entries and selects winners who receive the prize money.",
  },
  {
    q: "How do I fund my wallet?",
    a: "Go to Transactions in your Dashboard. Click 'Fund Wallet' and follow the Paystack payment flow to add funds.",
  },
  {
    q: "How does the escrow system work?",
    a: "When a contract starts, the client funds milestones into escrow. Once the expert delivers and the client approves, funds are released to the expert's wallet.",
  },
  {
    q: "How do I contact support?",
    a: "Visit the Contact Support page from the footer or use this widget. You can submit a complaint, chat with support, or reach us via email/phone/WhatsApp.",
  },
  {
    q: "How do I get verified?",
    a: "Go to My Profile and click 'Request Verification'. Complete the identity verification process. Once approved, you'll receive a verified badge on your profile.",
  },
];

export function FloatingSupport() {
  const [open, setOpen] = useState(false);
  const [selectedFaq, setSelectedFaq] = useState<number | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Don't show on admin pages or auth page
  if (location.pathname.startsWith("/admin") || location.pathname === "/auth") return null;

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-105",
          open ? "bg-foreground text-background" : "bg-primary text-primary-foreground"
        )}
        aria-label={open ? "Close help" : "Get help"}
      >
        {open ? <X className="h-6 w-6" /> : <HelpCircle className="h-6 w-6" />}
      </button>

      {/* Popup */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[340px] max-h-[480px] bg-card rounded-2xl border border-border shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in-0 duration-300">
          {/* Header */}
          <div className="bg-primary px-5 py-4 text-primary-foreground">
            <h3 className="font-bold text-lg">Hi there! 👋</h3>
            <p className="text-sm text-primary-foreground/80">How can we help you today?</p>
          </div>

          <ScrollArea className="max-h-[320px]">
            {selectedFaq !== null ? (
              <div className="p-4">
                <button onClick={() => setSelectedFaq(null)} className="text-xs text-primary hover:underline mb-3 flex items-center gap-1">
                  ← Back to questions
                </button>
                <p className="font-semibold text-sm text-foreground mb-2">{FAQ_ITEMS[selectedFaq].q}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{FAQ_ITEMS[selectedFaq].a}</p>
              </div>
            ) : (
              <div className="p-3 space-y-1">
                {FAQ_ITEMS.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedFaq(i)}
                    className="w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    <MessageCircle className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm text-foreground flex-1">{item.q}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          <div className="border-t border-border p-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => { navigate("/contact"); setOpen(false); }}
            >
              <Headphones className="h-4 w-4" />
              Contact Support Team
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
