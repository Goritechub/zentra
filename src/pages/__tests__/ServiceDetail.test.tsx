import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ServiceDetail from "@/pages/ServiceDetail";
import { getPublicServiceById } from "@/api/client-read.api";

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
vi.mock("@/components/SEO", () => ({ SEO: () => null }));

vi.mock("@/hooks/useCurrency", () => ({
  useCurrency: () => ({ format: (n: number) => `₦${n}` }),
}));

vi.mock("@/hooks/useShare", () => ({
  useShare: () => ({ share: vi.fn() }),
}));

vi.mock("@/api/client-read.api", () => ({
  getPublicServiceById: vi.fn(),
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
  other_services: [],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/service/service-1"]}>
      <Routes>
        <Route path="/service/:id" element={<ServiceDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ServiceDetail — Hire Expert button", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    vi.mocked(getPublicServiceById).mockResolvedValue({
      data: mockService,
    } as Awaited<ReturnType<typeof getPublicServiceById>>);
  });

  it("opens the job form with the expert pre-invited instead of a dead /messages link", async () => {
    renderPage();

    const hireButton = await screen.findByRole("button", { name: /hire expert/i });
    fireEvent.click(hireButton);

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
    const [destination] = mockNavigate.mock.calls[0];
    expect(destination).not.toMatch(/^\/messages/);
    expect(destination).toBe(
      `/post-job?invite=freelancer-1&name=${encodeURIComponent("Ada Okafor")}`,
    );
  });
});
