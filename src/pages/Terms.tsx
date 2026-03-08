import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { TermsModal } from "@/components/TermsModal";
import { useState } from "react";

export default function Terms() {
  // Reuse the modal content inline as a full page
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container-wide section-padding">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-8">Terms and Conditions</h1>
          <div className="prose prose-sm max-w-none">
            <TermsContent />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function TermsContent() {
  const sections = [
    { title: "About ZentraGig", content: `ZentraGig is an online marketplace that connects clients seeking engineering or technical services with independent experts who provide such services.\n\nZentraGig provides infrastructure including:\n• project listings\n• expert discovery\n• messaging\n• contract management\n• escrow payments\n• dispute resolution\n• identity verification\n\nZentraGig does not employ experts and does not control the work performed by experts.\n\nAll agreements formed through the platform are contracts directly between the client and the expert.` },
    { title: "Eligibility", content: `To use ZentraGig you must:\n• be at least 18 years old\n• have the legal capacity to enter contracts\n• provide accurate account information\n• comply with applicable laws\n\nZentraGig reserves the right to suspend or terminate accounts that violate these requirements.` },
    { title: "Account Registration", content: `Users must create an account to access core features.\n\nUsers are responsible for:\n• maintaining account security\n• protecting login credentials\n• all activity occurring under their account\n\nProviding false information may result in suspension or permanent removal.` },
    { title: "Identity Verification (KYC)", content: `To promote trust and prevent fraud, ZentraGig may require identity verification.\n\nVerification may include:\n• government-issued ID\n• facial verification\n• personal identity information\n\nUsers who pass verification may receive an Identity Verified badge.\n\nExperts may also receive a ZentraGig Verified Expert badge after manual review by the platform.\n\nZentraGig reserves the right to approve or deny verification requests.` },
    { title: "Platform Wallet", content: `ZentraGig provides users with a platform wallet used for:\n• deposits\n• escrow funding\n• receiving payments\n• withdrawals\n\nCurrently supported currency: Nigerian Naira (NGN)\n\nZentraGig may support additional currencies including USD in the future.\n\nUsers are responsible for ensuring wallet information is accurate.` },
    { title: "Escrow Payments", content: `ZentraGig may hold project funds in escrow to protect both parties.\n\nWhen a client funds a project:\n1. funds are placed in escrow\n2. the expert begins work\n3. payment is released when work is approved\n\nEscrow funds may remain locked during disputes.\n\nZentraGig does not guarantee work quality but provides the infrastructure for secure payments.` },
    { title: "Platform Fees", content: `ZentraGig charges a commission on completed contracts.\n\nThe commission structure is:\n• 20% on earnings up to ₦1,000,000\n• 15% on earnings between ₦1,000,000 – ₦20,000,000\n• 10% on earnings between ₦20,000,000 – ₦50,000,000\n• 8% on earnings above ₦50,000,000\n\nPayment processing fees may also apply depending on the payment provider.` },
    { title: "Off-Platform Payments", content: `All payments for projects initiated through ZentraGig must be processed through the platform.\n\nUsers are strictly prohibited from arranging payments outside the platform in order to avoid platform fees.\n\nZentraGig accepts no responsibility for losses, fraud, or disputes resulting from off-platform payments.\n\nAccounts found violating this rule may be suspended or permanently banned.` },
    { title: "Withdrawals", content: `Experts may withdraw funds from their wallet once payments are released from escrow.\n\nWithdrawal policies include:\n• withdrawals may require identity verification\n• ZentraGig may impose minimum withdrawal amounts\n• withdrawal processing may take 1–5 business days\n• ZentraGig may delay withdrawals for security reviews or fraud prevention\n\nUsers are responsible for providing correct bank details.` },
    { title: "Refund Policy", content: `Refunds may occur under the following conditions:\n• project cancellation before work begins\n• mutual agreement between client and expert\n• dispute resolution decision\n• failure to deliver agreed work\n\nIf a dispute occurs, escrow funds will remain locked until the dispute is resolved.\n\nRefund decisions may be made by ZentraGig dispute adjudicators based on submitted evidence.` },
    { title: "Dispute Resolution", content: `If disagreements arise, either party may open a dispute.\n\nThe dispute process includes:\n1. submission of complaint and evidence\n2. counter response by the other party\n3. review by a ZentraGig adjudicator\n\nEach party must respond within 48 hours.\n\nAfter reviewing evidence, the adjudicator may decide to:\n• release funds to the expert\n• refund the client\n• split funds between both parties\n\nDispute decisions issued by ZentraGig are final.` },
    { title: "Intellectual Property", content: `Experts retain ownership of their work unless otherwise agreed in the contract.\n\nUpon full payment, clients may receive usage rights to the delivered work as specified in the contract.\n\nUsers must not upload content that infringes on third-party intellectual property rights.` },
    { title: "User Conduct", content: `Users must not:\n• commit fraud\n• impersonate others\n• upload illegal content\n• harass other users\n• bypass platform systems\n• misuse the dispute system\n\nViolations may lead to suspension or termination.` },
    { title: "Platform Moderation", content: `ZentraGig reserves the right to:\n• remove projects\n• suspend accounts\n• moderate content\n• investigate suspicious activity\n• enforce platform rules\n\nThese actions may be taken to maintain platform integrity.` },
    { title: "Limitation of Liability", content: `ZentraGig provides the platform on an "as-is" and "as-available" basis.\n\nZentraGig is not responsible for:\n• project outcomes\n• expert performance\n• financial losses due to user actions\n• disputes outside the platform\n\nTo the maximum extent permitted by law, ZentraGig's liability shall not exceed the total fees paid to the platform.` },
    { title: "Account Suspension", content: `ZentraGig may suspend or terminate accounts for:\n• fraudulent activity\n• policy violations\n• abuse of the platform\n• illegal activities\n\nZentraGig reserves the right to investigate suspicious behavior.` },
    { title: "Privacy", content: `ZentraGig collects personal information for:\n• account verification\n• fraud prevention\n• service delivery\n• regulatory compliance\n\nSensitive identification documents may not be stored permanently.` },
    { title: "Governing Law", content: `These Terms shall be governed by the laws of the Federal Republic of Nigeria.\n\nAny disputes relating to these Terms shall fall under the jurisdiction of Nigerian courts.` },
    { title: "International Use", content: `ZentraGig may be accessible internationally.\n\nUsers outside Nigeria are responsible for complying with their local laws.\n\nZentraGig reserves the right to restrict access in certain jurisdictions.` },
    { title: "Changes to Terms", content: `ZentraGig may update these Terms periodically.\n\nContinued use of the platform after changes indicates acceptance of the revised Terms.` },
    { title: "Contact", content: `ZentraGig is operated by:\nNextlayer Additive Manufacturing\n\nFor inquiries:\nEmail: hello@zentragig.com` },
  ];

  return (
    <div className="space-y-8">
      <p className="text-muted-foreground">
        Effective Date: March 8, 2026
      </p>
      <p className="text-foreground/90">
        These Terms and Conditions ("Terms") govern the use of the ZentraGig platform. ZentraGig is owned and operated by Nextlayer Additive Manufacturing, a company registered in the Federal Republic of Nigeria.
      </p>
      <p className="text-foreground/90">
        By accessing or using the ZentraGig platform, you agree to comply with and be bound by these Terms. If you do not agree with these Terms, you must not use the platform.
      </p>

      {sections.map((section, i) => (
        <div key={i} className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            {i + 1}. {section.title}
          </h2>
          <p className="text-foreground/80 whitespace-pre-line leading-relaxed text-sm">
            {section.content}
          </p>
        </div>
      ))}

      <p className="text-foreground/90 font-medium pt-4 border-t border-border">
        By using ZentraGig, you acknowledge that you have read, understood, and agree to these Terms and Conditions.
      </p>
    </div>
  );
}
