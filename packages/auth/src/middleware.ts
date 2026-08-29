import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — see docs/design-system/README.md#environment.`);
  return value;
}

/**
 * A Supabase outage/slowdown must not take the whole app down with it:
 * Vercel's Edge Middleware has a hard ~25s timeout, and every route goes
 * through this function, so an unbounded auth.getUser() call here turns
 * into a site-wide 504 the moment Supabase's Auth API is slow — not just
 * on the affected page. 8s is generous for a call that normally takes
 * well under a second; aborting it early and failing open (see below)
 * trades a rare, brief auth hiccup for keeping the site reachable.
 */
const AUTH_CHECK_TIMEOUT_MS = 8_000;

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, { ...init, signal: AbortSignal.timeout(AUTH_CHECK_TIMEOUT_MS) });
}

/**
 * Refreshes the Supabase session cookie on every request and redirects
 * signed-out users away from protected routes. Called from
 * apps/web/middleware.ts — Next.js Server Components can't write cookies,
 * so this is the only place the session's refresh token actually rotates.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), {
    global: { fetch: fetchWithTimeout },
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
    ({
      data: { user },
    } = await supabase.auth.getUser());
  } catch (err) {
    // Supabase didn't answer in time (or errored outright) — fail open
    // rather than 504 the whole site. Page- and action-level auth checks
    // (requireUser/requireCurrentProduction, backed by Postgres RLS) are
    // the real security boundary and still apply; this only affects the
    // redirect-to-login UX for this one request.
    console.error("[auth middleware] Supabase auth check failed, letting the request through:", err);
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
