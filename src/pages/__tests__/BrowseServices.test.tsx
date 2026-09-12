import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import BrowseServices from "@/pages/BrowseServices";
import { getBrowseServicesList } from "@/api/client-read.api";

// Regression guard: the "Hire Expert" button used to navigate to
// `/messages?user=<id>`, which is a dead end — Messages only renders
// conversations scoped to an existing contract. It must open the job form
// instead, with the expert pre-invited and visibility forced to private.

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("@/components/layout/Header", () => ({ Header: () => null }));
vi.mock("@/components/layout/Footer", () => ({ Footer: () => null }));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "client-1" }, profile: { role: "client" }, role: "client", bootstrapStatus: "ready" }),
}));

vi.mock("@/hooks/useCurrency", () => ({
  useCurrency: () => ({ format: (n: number) => `₦${n}` }),
}));

vi.mock("@/api/client-read.api", () => ({
  getBrowseServicesList: vi.fn(),
}));

const mockService = {
  id: "service-1",
  freelancer_id: "freelancer-1",
  title: "CAD Modeling for Industrial Parts",
  description: "Precision CAD models",
  category: "Mechanical",
  pricing_type: "fixed",
  price: 50000,
  delivery_days: 5,
  delivery_unit: "days",
  revisions_allowed: 2,
  skills: ["SolidWorks"],
  images: [],
  freelancer: { id: "freelancer-1", full_name: "Ada Okafor", avatar_url: null, username: "ada" },
  freelancer_rating: 4.8,
  freelancer_jobs: 12,
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BrowseServices />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("BrowseServices — Hire Expert button", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    vi.mocked(getBrowseServicesList).mockResolvedValue({
      data: { services: [mockService] },
    } as Awaited<ReturnType<typeof getBrowseServicesList>>);
  });

  it("opens the job form with the expert pre-invited instead of a dead /messages link", async () => {
    renderPage();

    const card = await screen.findByRole("heading", { name: mockService.title });
    fireEvent.click(card);

    const hireButton = await screen.findByRole("button", { name: /hire expert/i });
    fireEvent.click(hireButton);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const [destination] = mockNavigate.mock.calls[0];
    expect(destination).not.toMatch(/^\/messages/);
    expect(destination).toBe(
      `/post-job?invite=freelancer-1&name=${encodeURIComponent("Ada Okafor")}`,
    );
  });
});
