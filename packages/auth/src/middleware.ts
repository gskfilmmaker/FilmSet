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
 * on the affected page. 6s is generous for a call that normally takes
 * well under a second; giving up early and failing open (see below)
 * trades a rare, brief auth hiccup for keeping the site reachable.
 */
const AUTH_CHECK_TIMEOUT_MS = 6_000;

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, { ...init, signal: AbortSignal.timeout(AUTH_CHECK_TIMEOUT_MS) });
}

class AuthCheckTimeoutError extends Error {}

/**
 * supabase-js's own GoTrueClient can swallow a slow/failed fetch
 * internally (retrying, then resolving normally with `{ user: null,
 * error }` instead of throwing) — so bounding just the underlying
 * fetch() isn't enough to guarantee this function returns in time: a
 * signed-in user would get bounced to /login because `user` came back
 * null, not because Supabase actually said they were signed out. Racing
 * the whole call against our own deadline sidesteps needing to know or
 * trust anything about that internal retry/error behavior — if Supabase
 * hasn't answered by the deadline, we stop waiting, full stop.
 */
function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new AuthCheckTimeoutError(`Auth check exceeded ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
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
    const result = await withDeadline(supabase.auth.getUser(), AUTH_CHECK_TIMEOUT_MS);
    user = result.data.user;
  } catch (err) {
    // Supabase didn't answer in time (or errored outright) — fail open
    // rather than 504 the whole site or bounce a real signed-in user back
    // to /login. Page- and action-level auth checks
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
