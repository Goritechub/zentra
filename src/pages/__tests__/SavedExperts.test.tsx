import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SavedExpertsPage from "@/pages/SavedExperts";
import { getSavedExpertsList } from "@/api/client-read.api";

// Regression guard: saved-expert cards used to be a single dead link to
// `/messages?user=<id>`. A card should open the expert's profile, and offer
// an explicit Hire action that pre-invites the expert into a private job —
// never the dead Messages link.

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("@/components/layout/Header", () => ({ Header: () => null }));
vi.mock("@/components/layout/Footer", () => ({ Footer: () => null }));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "client-1" }, bootstrapStatus: "ready" }),
}));

vi.mock("@/api/client-read.api", () => ({
  getSavedExpertsList: vi.fn(),
  removeSavedExpert: vi.fn(),
}));

const savedExpert = {
  id: "saved-1",
  freelancer_id: "freelancer-1",
  created_at: new Date().toISOString(),
  freelancer: { full_name: "Ada Okafor", avatar_url: null, state: "Lagos", city: "Ikeja" },
  freelancerProfile: { title: "Mechanical Engineer", rating: 4.8, total_jobs_completed: 12, skills: ["SolidWorks"] },
};

function renderPage() {
  return render(
    <MemoryRouter>
      <SavedExpertsPage />
    </MemoryRouter>,
  );
}

describe("SavedExperts — card actions", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    vi.mocked(getSavedExpertsList).mockResolvedValue({
      data: { savedExperts: [savedExpert] },
    } as Awaited<ReturnType<typeof getSavedExpertsList>>);
  });

  it("card links to the expert's profile, not to a dead /messages conversation", async () => {
    renderPage();

    const card = await screen.findByRole("link", { name: /ada okafor/i });
    expect(card.getAttribute("href")).not.toMatch(/^\/messages/);
    expect(card.getAttribute("href")).toBe("/expert/freelancer-1/profile");
  });

  it("Hire button opens the job form with the expert pre-invited, not /messages", async () => {
    renderPage();

    const hireButton = await screen.findByRole("button", { name: /hire/i });
    fireEvent.click(hireButton);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const [destination] = mockNavigate.mock.calls[0];
    expect(destination).not.toMatch(/^\/messages/);
    expect(destination).toBe(
      `/post-job?invite=freelancer-1&name=${encodeURIComponent("Ada Okafor")}`,
    );
  });
});
