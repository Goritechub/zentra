INSERT INTO public.legal_documents (title, slug, content, is_published, sort_order)
VALUES (
  'IP Policy',
  'ip-policy',
  'ZentraGig IP Policy

This IP Policy sets out how intellectual property is handled for jobs posted on ZentraGig that involve proprietary designs, trade secrets, or other confidential material.

1. Ownership. Unless otherwise agreed in writing between the client and the expert, all intellectual property submitted by a client as part of a job posting remains the property of the client.

2. Confidentiality. Experts who view or apply to a job marked as IP-protected agree to treat the job description, attachments, and any related materials as confidential, and not to reproduce, share, or use them for any purpose outside of evaluating or completing the job.

3. Client responsibility. This policy is a legal agreement between the client and the expert, not a technical safeguard. Clients should avoid including highly sensitive proprietary details (e.g. unpublished designs, trade secrets, or source files) directly in a public job description, and should share such materials directly with a hired expert once a contract is in place.

4. Platform role. ZentraGig facilitates the connection between clients and experts and provides tools (such as gating of job details behind an agreement) to support this policy, but does not independently verify or enforce confidentiality obligations between parties.

5. Custom policies. Clients may attach their own IP Policy or confidentiality document to a specific job instead of relying on this standard policy. Experts should review whichever policy is attached to a given job before applying.',
  true,
  (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM public.legal_documents)
)
ON CONFLICT (slug) DO NOTHING;
