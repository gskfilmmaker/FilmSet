import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocked before importing the module under test, per Vitest's hoisting —
// getServerSupabase() calls next/headers's cookies() and
// @supabase/ssr's createServerClient(); both need to be request-context-free
// and controllable per test rather than requiring a running Next.js server.
const mockGetUser = vi.fn();
// The real server-only package throws unless imported from a genuine
// Next.js Server Component build — irrelevant to what this suite tests
// (the resilience/fail-closed behavior), so it's stubbed out rather than
// disabled at the source.
vi.mock("server-only", () => ({}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({ auth: { getUser: mockGetUser } })),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ getAll: () => [], set: () => {} })),
}));

const { checkAuth, getSessionUser, requireUser } = await import("./server");

const SAMPLE_USER = { id: "user-1", email: "producer@example.com" };

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
  mockGetUser.mockReset();
  vi.restoreAllMocks();
});

describe("checkAuth — the six required scenarios", () => {
  it("1. normal authenticated request", async () => {
    mockGetUser.mockResolvedValue({ data: { user: SAMPLE_USER } });
    await expect(checkAuth()).resolves.toEqual({ status: "authenticated", user: SAMPLE_USER });
  });

  it("2. delayed auth provider exceeding the deadline — resolves near the deadline, not after it", async () => {
    vi.useFakeTimers();
    try {
      mockGetUser.mockReturnValue(new Promise(() => {})); // never settles
      const outcome = checkAuth();

      let settled = false;
      outcome.then(() => {
        settled = true;
      });
      await vi.advanceTimersByTimeAsync(5_999);
      expect(settled).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      await expect(outcome).resolves.toEqual({ status: "upstream_timeout" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("3. immediately unavailable/failing provider", async () => {
    mockGetUser.mockRejectedValue(new Error("fetch failed: ECONNREFUSED"));
    await expect(checkAuth()).resolves.toEqual({ status: "upstream_error", message: "fetch failed: ECONNREFUSED" });
  });

  it("4. normal unauthenticated request", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await expect(checkAuth()).resolves.toEqual({ status: "unauthenticated" });
  });

  it("5. authenticated Server Component path (getSessionUser)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: SAMPLE_USER } });
    await expect(getSessionUser()).resolves.toEqual(SAMPLE_USER);
  });

  it("6. authenticated Server Action path (requireUser)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: SAMPLE_USER } });
    await expect(requireUser()).resolves.toEqual(SAMPLE_USER);
  });
});

describe("security invariants", () => {
  it("identity safety: a timed-out check never fabricates or reuses a user — getSessionUser returns null, not a cached/stale identity", async () => {
    vi.useFakeTimers();
    try {
      mockGetUser.mockReturnValue(new Promise(() => {}));
      const outcome = getSessionUser();
      await vi.advanceTimersByTimeAsync(6_000);
      await expect(outcome).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("identity safety: an upstream error never fabricates a user — getSessionUser returns null", async () => {
    mockGetUser.mockRejectedValue(new Error("upstream 503"));
    await expect(getSessionUser()).resolves.toBeNull();
  });

  it("mutation safety: requireUser rejects on timeout, and a protected action gated on it never runs its mutation", async () => {
    vi.useFakeTimers();
    try {
      mockGetUser.mockReturnValue(new Promise(() => {}));

      let mutationRanCount = 0;
      async function protectedAction() {
        await requireUser(); // must throw before the line below ever runs
        mutationRanCount += 1;
      }

      const outcome = protectedAction();
      const assertion = expect(outcome).rejects.toThrow("UNAUTHENTICATED");
      await vi.advanceTimersByTimeAsync(6_000);
      await assertion;
      expect(mutationRanCount).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("mutation safety: requireUser rejects on upstream error, and a protected action gated on it never runs its mutation", async () => {
    mockGetUser.mockRejectedValue(new Error("upstream 500"));

    let mutationRanCount = 0;
    async function protectedAction() {
      await requireUser();
      mutationRanCount += 1;
    }

    await expect(protectedAction()).rejects.toThrow("UNAUTHENTICATED");
    expect(mutationRanCount).toBe(0);
  });

  it("no secret logging: the timeout log line never includes token/cookie contents, only a status and the deadline", async () => {
    vi.useFakeTimers();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      mockGetUser.mockReturnValue(new Promise(() => {}));
      const outcome = checkAuth();
      await vi.advanceTimersByTimeAsync(6_000);
      await outcome;

      expect(errorSpy).toHaveBeenCalledWith("[auth] upstream auth check timed out", { deadlineMs: 6_000 });
      const loggedText = JSON.stringify(errorSpy.mock.calls);
      expect(loggedText).not.toMatch(/access_token|refresh_token|sb-.*-auth-token/i);
    } finally {
      vi.useRealTimers();
    }
  });

  it("no secret logging: an upstream-error log line carries only a message string, never the raw error/response object", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const rawError = new Error("upstream 500") as Error & { response?: unknown };
    rawError.response = { headers: { "set-cookie": "sb-access-token=super-secret; HttpOnly" } };
    mockGetUser.mockRejectedValue(rawError);

    await checkAuth();

    expect(errorSpy).toHaveBeenCalledWith("[auth] upstream auth check failed", { message: "upstream 500" });
    const loggedText = JSON.stringify(errorSpy.mock.calls);
    expect(loggedText).not.toContain("super-secret");
  });
});
