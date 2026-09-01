import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({ auth: { getUser: mockGetUser } })),
}));

const { updateSession } = await import("./middleware");

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
  mockGetUser.mockReset();
});

function protectedRequest() {
  return new NextRequest("https://filmset.test/cast");
}

describe("updateSession — routing decision under upstream failure", () => {
  it("redirects an unauthenticated request to /login under normal (fast) auth", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const response = await updateSession(protectedRequest());
    expect(response.headers.get("location")).toContain("/login");
  });

  it("does NOT redirect when the upstream auth check times out — it defers the decision (pass-through), never fabricating an authenticated OR forcing a redirect that could loop", async () => {
    vi.useFakeTimers();
    try {
      mockGetUser.mockReturnValue(new Promise(() => {}));
      const outcome = updateSession(protectedRequest());
      await vi.advanceTimersByTimeAsync(6_000);
      const response = await outcome;

      // The concrete guarantee against a redirect loop: this path never
      // calls NextResponse.redirect() at all, so there is no /login ->
      // timeout -> /login cycle to enter in the first place.
      expect(response.headers.get("location")).toBeNull();
      expect([307, 308]).not.toContain(response.status);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does NOT redirect when the upstream auth check errors outright — same deferred-decision behavior as a timeout", async () => {
    mockGetUser.mockRejectedValue(new Error("upstream 500"));
    const response = await updateSession(protectedRequest());
    expect(response.headers.get("location")).toBeNull();
    expect([307, 308]).not.toContain(response.status);
  });
});
