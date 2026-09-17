import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import BrowseServices from "@/pages/BrowseServices";
import { getBrowseServicesList } from "@/api/client-read.api";

// Regression guard: service cards used to open an in-page modal. They now
// navigate to a full public page at /service/:id (so the service can be
// shared and previewed on social platforms).

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

describe("BrowseServices — service card navigation", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    vi.mocked(getBrowseServicesList).mockResolvedValue({
      data: { services: [mockService] },
    } as Awaited<ReturnType<typeof getBrowseServicesList>>);
  });

  it("navigates to the service's full public page instead of opening a modal", async () => {
    renderPage();

    const card = await screen.findByRole("heading", { name: mockService.title });
    fireEvent.click(card);

    expect(mockNavigate).toHaveBeenCalledWith(`/service/${mockService.id}`);
  });
});
