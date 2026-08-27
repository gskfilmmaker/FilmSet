import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

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
