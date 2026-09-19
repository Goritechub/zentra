import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useResendVerification } from "@/hooks/useResendVerification";
import { resendVerificationEmail } from "@/api/auth.api";

vi.mock("@/api/auth.api", () => ({
  resendVerificationEmail: vi.fn(),
}));

describe("useResendVerification", () => {
  beforeEach(() => {
    vi.mocked(resendVerificationEmail).mockReset();
  });

  it("resends and starts a 60s cooldown on success", async () => {
    vi.mocked(resendVerificationEmail).mockResolvedValue({ success: true });
    const { result } = renderHook(() => useResendVerification());

    await act(async () => {
      await result.current.resend("user@example.com");
    });

    expect(resendVerificationEmail).toHaveBeenCalledWith("user@example.com");
    expect(result.current.feedback).toEqual({
      type: "success",
      message: "Verification email resent.",
    });
    expect(result.current.cooldown).toBe(60);
  });

  it("surfaces the error message when the resend call fails", async () => {
    vi.mocked(resendVerificationEmail).mockRejectedValue(new Error("Too many requests"));
    const { result } = renderHook(() => useResendVerification());

    await act(async () => {
      await result.current.resend("user@example.com");
    });

    expect(result.current.feedback).toEqual({
      type: "error",
      message: "Too many requests",
    });
    expect(result.current.cooldown).toBe(0);
  });

  it("ignores resend attempts while a cooldown is active", async () => {
    vi.mocked(resendVerificationEmail).mockResolvedValue({ success: true });
    const { result } = renderHook(() => useResendVerification());

    await act(async () => {
      await result.current.resend("user@example.com");
    });
    expect(resendVerificationEmail).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.resend("user@example.com");
    });
    expect(resendVerificationEmail).toHaveBeenCalledTimes(1);
  });

  it("ignores resend attempts with no email", async () => {
    const { result } = renderHook(() => useResendVerification());

    await act(async () => {
      await result.current.resend("");
    });

    expect(resendVerificationEmail).not.toHaveBeenCalled();
  });

  it("reset clears cooldown and feedback", async () => {
    vi.mocked(resendVerificationEmail).mockResolvedValue({ success: true });
    const { result } = renderHook(() => useResendVerification());

    await act(async () => {
      await result.current.resend("user@example.com");
    });
    expect(result.current.cooldown).toBe(60);

    act(() => {
      result.current.reset();
    });

    expect(result.current.cooldown).toBe(0);
    expect(result.current.feedback).toBeNull();
  });
});
