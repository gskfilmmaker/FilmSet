import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_UPSTREAM_DEADLINE_MS, resilientFetch, withDeadline } from "./resilience";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — see docs/design-system/README.md#environment.`);
  return value;
}

/**
 * Refreshes the Supabase session cookie on every request and redirects
 * signed-out users away from protected routes. Called from
 * apps/web/middleware.ts — Next.js Server Components can't write cookies,
 * so this is the only place the session's refresh token actually rotates.
 *
 * This is a ROUTING decision, not the authentication boundary — see
 * server.ts's `checkAuth`/`requireUser` for that. Vercel's Edge
 * Middleware has a hard ~25s function timeout and every route goes
 * through this function, so an unbounded auth.getUser() call here turns
 * into a site-wide 504 the moment Supabase's Auth API is slow, not just
 * on the affected page (this happened in production once already).
 *
 * When the upstream auth check can't complete in time, this function
 * DOES NOT decide the user is authenticated and DOES NOT grant access to
 * anything — it simply stops trying to make the redirect-to-/login
 * decision for *this* request and lets Next.js continue routing it.
 * That is safe only because the real authentication boundary
 * (requireUser/requireCurrentProduction, backed by Postgres RLS) runs
 * independently on every protected page and Server Action and fails
 * CLOSED on the same kind of failure (see server.ts) — this function's
 * behavior is an availability/UX trade-off (skip a redirect we can't
 * currently compute) layered on top of a boundary that never trusts it.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), {
    global: { fetch: resilientFetch(AUTH_UPSTREAM_DEADLINE_MS) },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] = null;
  try {
    const result = await withDeadline(supabase.auth.getUser(), AUTH_UPSTREAM_DEADLINE_MS);
    user = result.data.user;
  } catch (err) {
    // Upstream auth check didn't complete in time (or errored outright).
    // We defer the redirect-to-/login decision for this one request
    // rather than hang until Vercel kills the function — we are NOT
    // marking this request as authenticated, and nothing downstream
    // treats it as such (see the docstring above).
    console.error("[auth middleware] upstream auth check did not complete; deferring redirect decision for this request:", err);
    return response;
  }

  const pathname = request.nextUrl.pathname;
  // Bounces to /overview when already signed in (a normal "public" route).
  const isAuthOnlyRoute = pathname.startsWith("/login") || pathname.startsWith("/signup") || pathname.startsWith("/forgot-password");
  // /reset-password is reachable either way: the recovery link lands here
  // with no session cookie yet (the token only arrives via URL, processed
  // client-side after this response), and once that recovery session
  // exists we must NOT bounce the user away before they set a new password.
  const isResetPasswordRoute = pathname.startsWith("/reset-password");

  if (!user && !isAuthOnlyRoute && !isResetPasswordRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAuthOnlyRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/overview";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
