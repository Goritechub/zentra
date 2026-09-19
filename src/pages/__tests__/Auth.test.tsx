import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AuthPage from "@/pages/Auth";
import { lookupAuthUser, resendVerificationEmail } from "@/api/auth.api";

// Regression guard: a user who signs up, abandons the verification email
// (closes the tab, deletes it, etc.) and later retries sign-in used to hit a
// static "confirm your email" error with no way to get unstuck. Sign-in must
// now surface a working "Resend verification email" link in that case.

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("@/components/layout/Header", () => ({ Header: () => null }));
vi.mock("@/components/layout/Footer", () => ({ Footer: () => null }));
vi.mock("@/components/SEO", () => ({ SEO: () => null }));
vi.mock("@/components/TermsModal", () => ({ TermsModal: () => null }));

const { mockSignIn } = vi.hoisted(() => ({ mockSignIn: vi.fn() }));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: null,
    profile: null,
    signUp: vi.fn(),
    signIn: mockSignIn,
    loading: false,
    bootstrapStatus: "ready",
    refreshProfile: vi.fn(),
    onboardingComplete: true,
    role: "client",
  }),
}));

vi.mock("@/hooks/usePlatformFreeze", () => ({
  usePlatformFreeze: () => ({ signupsPaused: false, platformFrozen: false }),
}));

vi.mock("@/api/auth.api", () => ({
  lookupAuthUser: vi.fn(),
  checkAuthUsernameAvailability: vi.fn(),
  applyAuthOccupation: vi.fn(),
  buildGoogleOauthStartUrl: vi.fn(),
  requestPasswordReset: vi.fn(),
  updateAuthRole: vi.fn(),
  resendVerificationEmail: vi.fn(),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthPage />
    </MemoryRouter>,
  );
}

describe("Auth — resend verification on sign-in dead end", () => {
  beforeEach(() => {
    vi.mocked(lookupAuthUser).mockResolvedValue({
      found: true,
      email: "abandoned@example.com",
    } as Awaited<ReturnType<typeof lookupAuthUser>>);
    mockSignIn.mockResolvedValue({ error: new Error("Email not confirmed") });
    vi.mocked(resendVerificationEmail).mockResolvedValue({ success: true });
  });

  it("shows a working resend link instead of a dead end when sign-in reports an unconfirmed email", async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText(/email or username/i), {
      target: { value: "abandoned@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "whatever-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await screen.findByText(/please confirm your email before signing in/i);

    const resendButton = await screen.findByRole("button", {
      name: /resend verification email/i,
    });
    fireEvent.click(resendButton);

    await waitFor(() =>
      expect(resendVerificationEmail).toHaveBeenCalledWith("abandoned@example.com"),
    );
    await screen.findByText(/verification email resent/i);
  });

  it("clears the resend link once the identifier field is edited", async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText(/email or username/i), {
      target: { value: "abandoned@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "whatever-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await screen.findByRole("button", { name: /resend verification email/i });

    fireEvent.change(screen.getByLabelText(/email or username/i), {
      target: { value: "abandoned2@example.com" },
    });

    expect(
      screen.queryByRole("button", { name: /resend verification email/i }),
    ).not.toBeInTheDocument();
  });
});
