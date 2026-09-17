import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useResendVerification } from "@/hooks/useResendVerification";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      resend: vi.fn(),
    },
  },
}));

describe("useResendVerification", () => {
  beforeEach(() => {
    vi.mocked(supabase.auth.resend).mockReset();
  });

  it("resends and starts a 60s cooldown on success", async () => {
    vi.mocked(supabase.auth.resend).mockResolvedValue({
      data: {},
      error: null,
    } as Awaited<ReturnType<typeof supabase.auth.resend>>);
    const { result } = renderHook(() => useResendVerification());

    await act(async () => {
      await result.current.resend("user@example.com");
    });

    expect(supabase.auth.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "user@example.com",
    });
    expect(result.current.feedback).toEqual({
      type: "success",
      message: "Verification email resent.",
    });
    expect(result.current.cooldown).toBe(60);
  });

  it("surfaces the error message when the resend call fails", async () => {
    vi.mocked(supabase.auth.resend).mockResolvedValue({
      data: null,
      error: new Error("Too many requests"),
    } as Awaited<ReturnType<typeof supabase.auth.resend>>);
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
    vi.mocked(supabase.auth.resend).mockResolvedValue({
      data: {},
      error: null,
    } as Awaited<ReturnType<typeof supabase.auth.resend>>);
    const { result } = renderHook(() => useResendVerification());

    await act(async () => {
      await result.current.resend("user@example.com");
    });
    expect(supabase.auth.resend).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.resend("user@example.com");
    });
    expect(supabase.auth.resend).toHaveBeenCalledTimes(1);
  });

  it("ignores resend attempts with no email", async () => {
    const { result } = renderHook(() => useResendVerification());

    await act(async () => {
      await result.current.resend("");
    });

    expect(supabase.auth.resend).not.toHaveBeenCalled();
  });

  it("reset clears cooldown and feedback", async () => {
    vi.mocked(supabase.auth.resend).mockResolvedValue({
      data: {},
      error: null,
    } as Awaited<ReturnType<typeof supabase.auth.resend>>);
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
