import { describe, expect, it, vi } from "vitest";
import { AUTH_UPSTREAM_DEADLINE_MS, AuthCheckTimeoutError, withDeadline } from "./resilience";

describe("withDeadline", () => {
  it("resolves with the underlying value when it settles before the deadline", async () => {
    const result = await withDeadline(Promise.resolve("ok"), AUTH_UPSTREAM_DEADLINE_MS);
    expect(result).toBe("ok");
  });

  it("rejects with the original error when the underlying promise rejects before the deadline", async () => {
    const boom = new Error("upstream 500");
    await expect(withDeadline(Promise.reject(boom), AUTH_UPSTREAM_DEADLINE_MS)).rejects.toBe(boom);
  });

  it("rejects with AuthCheckTimeoutError, resolving near the configured deadline rather than waiting indefinitely, when the promise never settles", async () => {
    vi.useFakeTimers();
    try {
      const neverSettles = new Promise<string>(() => {});
      const deadlineMs = 6_000;
      const outcome = withDeadline(neverSettles, deadlineMs);
      // Attach the rejection assertion synchronously, before advancing
      // timers — otherwise the promise can reject with no handler
      // attached yet and Node flags it as an unhandled rejection.
      const assertion = expect(outcome).rejects.toBeInstanceOf(AuthCheckTimeoutError);

      // Deadline safety: resolves at the configured deadline, not later —
      // advancing just short of it must not have settled yet.
      let settled = false;
      outcome.catch(() => {
        settled = true;
      });
      await vi.advanceTimersByTimeAsync(deadlineMs - 1);
      expect(settled).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops waiting at the deadline even if the underlying promise later resolves 'cleanly' — the exact GoTrueClient retry-then-resolve failure mode this exists to guard against", async () => {
    vi.useFakeTimers();
    try {
      let resolveLate!: (value: string) => void;
      const resolvesLate = new Promise<string>((resolve) => {
        resolveLate = resolve;
      });
      const deadlineMs = 6_000;
      const outcome = withDeadline(resolvesLate, deadlineMs);
      const assertion = expect(outcome).rejects.toBeInstanceOf(AuthCheckTimeoutError);

      await vi.advanceTimersByTimeAsync(deadlineMs);
      await assertion;

      // The late resolution must not retroactively change anything —
      // withDeadline already gave up and the caller already has its
      // (rejected) result.
      resolveLate("too late");
    } finally {
      vi.useRealTimers();
    }
  });
});
