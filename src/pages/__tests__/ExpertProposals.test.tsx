import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ExpertProposalsPage from "@/pages/ExpertProposals";
import { getExpertProposalsOverview } from "@/api/proposals.api";

// Regression guard: offer cards used to include a "message client" icon
// pointing at `/messages?user=<id>` — dead before a contract exists, since
// Messages only supports conversations scoped to an existing contract, and
// there is no pre-contract chat feature in the app. That button was removed;
// this test ensures it doesn't quietly come back.

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("@/components/layout/Header", () => ({ Header: () => null }));
vi.mock("@/components/layout/Footer", () => ({ Footer: () => null }));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "freelancer-1" }, profile: { role: "freelancer" }, bootstrapStatus: "ready" }),
}));

vi.mock("@/hooks/useCurrency", () => ({
  useCurrency: () => ({ format: (n: number) => `₦${n}` }),
}));

vi.mock("@/api/proposals.api", () => ({
  getExpertProposalsOverview: vi.fn(),
  withdrawMyJobProposal: vi.fn(),
}));

vi.mock("@/api/offers.api", () => ({
  acceptDirectOffer: vi.fn(),
  declineReceivedOffer: vi.fn(),
}));

const pendingOffer = {
  id: "offer-1",
  client_id: "client-1",
  freelancer_id: "freelancer-1",
  job_id: null,
  title: "Fabricate a custom bracket",
  description: "Need 20 units machined",
  budget: 80000,
  status: "pending" as const,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  client: { full_name: "Chidi Umeh", avatar_url: null },
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ExpertProposalsPage />
    </MemoryRouter>,
  );
}

describe("ExpertProposals — offer cards", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    vi.mocked(getExpertProposalsOverview).mockResolvedValue({
      proposals: [], offers: [pendingOffer], invites: [], interviewContracts: {},
    } as Awaited<ReturnType<typeof getExpertProposalsOverview>>);
  });

  it("does not render a message-client button pointing at /messages", async () => {
    renderPage();

    await screen.findByText(pendingOffer.title);

    expect(screen.queryByTitle(/message chidi umeh/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /message/i })).not.toBeInTheDocument();
  });

  it("still renders Accept and Decline for a pending offer", async () => {
    renderPage();

    await screen.findByText(pendingOffer.title);

    expect(screen.getByRole("button", { name: /accept/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /decline/i })).toBeInTheDocument();
  });
});
