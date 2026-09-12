import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ExpertProfile from "@/pages/ExpertProfile";
import { getExpertProfileOverview } from "@/api/expert-read.api";

// Regression guard for the "hire this expert" bug: a button that looks like it
// starts a hire/select-package flow must never fall back to `/messages?user=`,
// since Messages only supports conversations scoped to an existing contract.

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("@/components/layout/Header", () => ({ Header: () => null }));
vi.mock("@/components/layout/Footer", () => ({ Footer: () => null }));
vi.mock("@/components/SEO", () => ({ SEO: () => null }));
vi.mock("@/components/KycVerificationCard", () => ({ KycVerificationCard: () => null }));
vi.mock("html2canvas", () => ({ default: vi.fn() }));

vi.mock("@/hooks/useKycVerification", () => ({
  useKycVerification: () => ({ isVerified: false, isZentraVerified: false }),
}));

vi.mock("@/api/auth.api", () => ({
  getReferralInfo: vi.fn().mockResolvedValue({ data: null }),
}));

vi.mock("@/hooks/useCurrency", () => ({
  useCurrency: () => ({ format: (n: number) => `₦${n}` }),
}));

vi.mock("@/api/expert-read.api", () => ({
  getExpertProfileOverview: vi.fn(),
}));

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: mockUseAuth }));

const EXPERT_ID = "expert-1";

const overview = {
  profile: {
    id: EXPERT_ID,
    full_name: "Ada Okafor",
    username: "ada",
    avatar_url: null,
    city: "Lagos",
    state: "Lagos",
    occupation: "Mechanical Engineer",
    is_verified: true,
    role: "freelancer",
  },
  kyc: null,
  freelancerProfile: null,
  certifications: [],
  workExperience: [],
  services: [
    {
      id: "service-1",
      title: "CAD Modeling Package",
      description: "Precision CAD models",
      price: 50000,
      pricing_type: "fixed",
      category: "Mechanical",
      delivery_days: 5,
      delivery_unit: "days",
      revisions_allowed: 2,
    },
  ],
  portfolio: [],
  pastContracts: [],
  completedContractCount: 0,
  reviews: [],
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/expert/${EXPERT_ID}/profile`]}>
        <Routes>
          <Route path="/expert/:id/profile" element={<ExpertProfile />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ExpertProfile — pre-contract package CTA", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    vi.mocked(getExpertProfileOverview).mockResolvedValue({
      data: overview,
    } as Awaited<ReturnType<typeof getExpertProfileOverview>>);
  });

  it("client viewing an expert: 'Select Package' opens the private job form with the expert pre-invited", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "client-1" },
      profile: { role: "client" },
    });
    renderPage();

    const button = await screen.findByRole("button", { name: /select package/i });
    fireEvent.click(button);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const [destination] = mockNavigate.mock.calls[0];
    expect(destination).not.toMatch(/^\/messages/);
    expect(destination).toBe(`/post-job?invite=${EXPERT_ID}&name=${encodeURIComponent("Ada Okafor")}`);
  });

  it("freelancer viewing another freelancer's profile: no dead 'Contact' link is rendered", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "other-freelancer" },
      profile: { role: "freelancer" },
    });
    renderPage();

    await screen.findByText("CAD Modeling Package");
    expect(screen.queryByRole("button", { name: /select package/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /contact/i })).not.toBeInTheDocument();
  });

  it("owner viewing their own profile: no dead 'Contact' link is rendered", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: EXPERT_ID },
      profile: { role: "freelancer" },
    });
    renderPage();

    await screen.findByText("CAD Modeling Package");
    expect(screen.queryByRole("button", { name: /select package/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /contact/i })).not.toBeInTheDocument();
  });

  it("logged-out visitor: 'Contact' sends to auth, not to /messages", async () => {
    mockUseAuth.mockReturnValue({ user: null, profile: null });
    renderPage();

    const links = await screen.findAllByRole("link", { name: /contact/i });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute("href")).not.toMatch(/^\/messages/);
      expect(link.getAttribute("href")).toBe(
        `/auth?redirect=${encodeURIComponent(`/expert/${EXPERT_ID}/profile`)}`,
      );
    }
  });
});
