import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TermsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAgree: () => void;
}

const TERMS_CONTENT = `
ZentraGig Terms and Conditions

Effective Date: March 8, 2026

These Terms and Conditions ("Terms") govern the use of the ZentraGig platform. ZentraGig is owned and operated by Nextlayer Additive Manufacturing, a company registered in the Federal Republic of Nigeria.

By accessing or using the ZentraGig platform, you agree to comply with and be bound by these Terms.

If you do not agree with these Terms, you must not use the platform.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. About ZentraGig

ZentraGig is an online marketplace that connects clients seeking engineering or technical services with independent experts who provide such services.

ZentraGig provides infrastructure including:
• project listings
• expert discovery
• messaging
• contract management
• escrow payments
• dispute resolution
• identity verification

ZentraGig does not employ experts and does not control the work performed by experts.

All agreements formed through the platform are contracts directly between the client and the expert.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. Eligibility

To use ZentraGig you must:
• be at least 18 years old
• have the legal capacity to enter contracts
• provide accurate account information
• comply with applicable laws

ZentraGig reserves the right to suspend or terminate accounts that violate these requirements.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. Account Registration

Users must create an account to access core features.

Users are responsible for:
• maintaining account security
• protecting login credentials
• all activity occurring under their account

Providing false information may result in suspension or permanent removal.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. Identity Verification (KYC)

To promote trust and prevent fraud, ZentraGig may require identity verification.

Verification may include:
• government-issued ID
• facial verification
• personal identity information

Users who pass verification may receive an Identity Verified badge.

Experts may also receive a ZentraGig Verified Expert badge after manual review by the platform.

ZentraGig reserves the right to approve or deny verification requests.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. Platform Wallet

ZentraGig provides users with a platform wallet used for:
• deposits
• escrow funding
• receiving payments
• withdrawals

Currently supported currency: Nigerian Naira (NGN)

ZentraGig may support additional currencies including USD in the future.

Users are responsible for ensuring wallet information is accurate.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

6. Escrow Payments

ZentraGig may hold project funds in escrow to protect both parties.

When a client funds a project:
1. funds are placed in escrow
2. the expert begins work
3. payment is released when work is approved

Escrow funds may remain locked during disputes.

ZentraGig does not guarantee work quality but provides the infrastructure for secure payments.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

7. Platform Fees

ZentraGig charges a commission on completed contracts.

The commission structure is:
• 20% on earnings up to ₦1,000,000
• 15% on earnings between ₦1,000,000 – ₦20,000,000
• 10% on earnings between ₦20,000,000 – ₦50,000,000
• 8% on earnings above ₦50,000,000

Payment processing fees may also apply depending on the payment provider.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

8. Off-Platform Payments

All payments for projects initiated through ZentraGig must be processed through the platform.

Users are strictly prohibited from arranging payments outside the platform in order to avoid platform fees.

ZentraGig accepts no responsibility for losses, fraud, or disputes resulting from off-platform payments.

Accounts found violating this rule may be suspended or permanently banned.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

9. Withdrawals

Experts may withdraw funds from their wallet once payments are released from escrow.

Withdrawal policies include:
• withdrawals may require identity verification
• ZentraGig may impose minimum withdrawal amounts
• withdrawal processing may take 1–5 business days
• ZentraGig may delay withdrawals for security reviews or fraud prevention

Users are responsible for providing correct bank details.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

10. Refund Policy

Refunds may occur under the following conditions:
• project cancellation before work begins
• mutual agreement between client and expert
• dispute resolution decision
• failure to deliver agreed work

If a dispute occurs, escrow funds will remain locked until the dispute is resolved.

Refund decisions may be made by ZentraGig dispute adjudicators based on submitted evidence.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

11. Dispute Resolution

If disagreements arise, either party may open a dispute.

The dispute process includes:
1. submission of complaint and evidence
2. counter response by the other party
3. review by a ZentraGig adjudicator

Each party must respond within 48 hours.

After reviewing evidence, the adjudicator may decide to:
• release funds to the expert
• refund the client
• split funds between both parties

Dispute decisions issued by ZentraGig are final.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

12. Intellectual Property

Experts retain ownership of their work unless otherwise agreed in the contract.

Upon full payment, clients may receive usage rights to the delivered work as specified in the contract.

Users must not upload content that infringes on third-party intellectual property rights.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

13. User Conduct

Users must not:
• commit fraud
• impersonate others
• upload illegal content
• harass other users
• bypass platform systems
• misuse the dispute system

Violations may lead to suspension or termination.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

14. Platform Moderation

ZentraGig reserves the right to:
• remove projects
• suspend accounts
• moderate content
• investigate suspicious activity
• enforce platform rules

These actions may be taken to maintain platform integrity.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

15. Limitation of Liability

ZentraGig provides the platform on an "as-is" and "as-available" basis.

ZentraGig is not responsible for:
• project outcomes
• expert performance
• financial losses due to user actions
• disputes outside the platform

To the maximum extent permitted by law, ZentraGig's liability shall not exceed the total fees paid to the platform.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

16. Account Suspension

ZentraGig may suspend or terminate accounts for:
• fraudulent activity
• policy violations
• abuse of the platform
• illegal activities

ZentraGig reserves the right to investigate suspicious behavior.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

17. Privacy

ZentraGig collects personal information for:
• account verification
• fraud prevention
• service delivery
• regulatory compliance

Sensitive identification documents may not be stored permanently.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

18. Governing Law

These Terms shall be governed by the laws of the Federal Republic of Nigeria.

Any disputes relating to these Terms shall fall under the jurisdiction of Nigerian courts.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

19. International Use

ZentraGig may be accessible internationally.

Users outside Nigeria are responsible for complying with their local laws.

ZentraGig reserves the right to restrict access in certain jurisdictions.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

20. Changes to Terms

ZentraGig may update these Terms periodically.

Continued use of the platform after changes indicates acceptance of the revised Terms.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

21. Contact

ZentraGig is operated by:
Nextlayer Additive Manufacturing

For inquiries:
Email: hello@zentragig.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

By using ZentraGig, you acknowledge that you have read, understood, and agree to these Terms and Conditions.
`;

export function TermsModal({ open, onOpenChange, onAgree }: TermsModalProps) {
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const handleScroll = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const threshold = 40;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    if (atBottom && !scrolledToBottom) {
      setScrolledToBottom(true);
    }
  }, [scrolledToBottom]);

  const handleAgree = () => {
    onAgree();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="text-xl font-bold">Terms and Conditions</DialogTitle>
        </DialogHeader>
        <div
          ref={viewportRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 py-4"
          style={{ maxHeight: "60vh" }}
        >
          <pre className="whitespace-pre-wrap font-sans text-sm text-foreground/90 leading-relaxed">
            {TERMS_CONTENT.trim()}
          </pre>
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAgree} disabled={!scrolledToBottom}>
            {scrolledToBottom ? "I Agree" : "Scroll to bottom to agree"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
