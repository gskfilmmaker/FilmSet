import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { ProductionRole } from "./index";
import { AUTH_UPSTREAM_DEADLINE_MS, AuthCheckTimeoutError, resilientFetch, withDeadline } from "./resilience";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — see docs/design-system/README.md#environment.`);
  return value;
}

/**
 * Server Component / Server Action / Route Handler Supabase client. Reads
 * the session from the request's cookies; writes refreshed cookies back
 * where the runtime allows it (Server Actions and Route Handlers — Server
 * Component rendering can't set cookies, so refresh there is a no-op and
 * relies on middleware.ts having already refreshed the session).
 */
export async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), {
    global: { fetch: resilientFetch(AUTH_UPSTREAM_DEADLINE_MS) },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render — no-op; middleware.ts
          // handles session refresh for that path instead.
        }
      },
    },
  });
}

export interface SessionUser {
  id: string;
  email: string | null;
}

/**
 * The five outcomes an auth check can reach — kept distinguishable
 * internally (for logging/diagnostics) even though most callers only
 * need the collapsed authenticated/not-authenticated view `getSessionUser`
 * exposes. Never includes token/cookie contents — only what's safe to log
 * (a status and, for `error`, a message string).
 */
export type AuthCheckResult =
  | { status: "authenticated"; user: SessionUser }
  | { status: "unauthenticated" }
  | { status: "upstream_timeout" }
  | { status: "upstream_error"; message: string };

/**
 * THE AUTHENTICATION BOUNDARY. Every Server Component/Server Action that
 * needs to know who's signed in goes through this, directly or via
 * `getSessionUser`/`requireUser` below.
 *
 * FAILS CLOSED: if the upstream Supabase Auth API times out
 * (`AUTH_UPSTREAM_DEADLINE_MS`, shared with middleware.ts's routing
 * check via resilience.ts) or errors outright, this returns a
 * non-authenticated result — it never fabricates or reuses a stale
 * identity, and it never treats "we couldn't verify" as "verified."
 * This is deliberately a stricter posture than middleware.ts's routing
 * decision (see that file's docstring): a routing layer that skips a
 * redirect it can't currently compute is an availability trade-off,
 * but the boundary that actually gates data access and mutations must
 * never grant privileges because identity verification failed.
 */
export async function checkAuth(): Promise<AuthCheckResult> {
  const supabase = await getServerSupabase();
  try {
    const {
      data: { user },
    } = await withDeadline(supabase.auth.getUser(), AUTH_UPSTREAM_DEADLINE_MS);
    if (!user) return { status: "unauthenticated" };
    return { status: "authenticated", user: { id: user.id, email: user.email ?? null } };
  } catch (err) {
    if (err instanceof AuthCheckTimeoutError) {
      console.error("[auth] upstream auth check timed out", { deadlineMs: AUTH_UPSTREAM_DEADLINE_MS });
      return { status: "upstream_timeout" };
    }
    // Log only a message, never the raw error/response object — it may
    // wrap header or cookie data we don't want in logs.
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[auth] upstream auth check failed", { message });
    return { status: "upstream_error", message };
  }
}

/**
 * Returns the signed-in user, or null if there isn't one — including
 * when there isn't one because the upstream check couldn't be verified
 * in time. Never throws for "no session"; never fabricates a user.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const result = await checkAuth();
  return result.status === "authenticated" ? result.user : null;
}

/** Throws if there's no signed-in user — use at the top of a protected Server Action / Route Handler. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export interface ProductionMembership {
  productionId: string;
  role: ProductionRole;
}

/**
 * Confirms the current user belongs to the given production, and
 * optionally that their role is one of `allowedRoles`. This is the
 * authorization boundary — every production-scoped Server Action/Route
 * Handler must call this before touching @filmset/db (see
 * apps/web/lib/authz.ts for the composed helper against the real schema).
 */
export function assertRole(membership: ProductionMembership | null, allowedRoles?: ProductionRole[]): ProductionMembership {
  if (!membership) throw new Error("FORBIDDEN: not a member of this production");
  if (allowedRoles && !allowedRoles.includes(membership.role)) {
    throw new Error(`FORBIDDEN: requires one of [${allowedRoles.join(", ")}], has "${membership.role}"`);
  }
  return membership;
}
