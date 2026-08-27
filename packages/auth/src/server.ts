import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { ProductionRole } from "./index";

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
  return createServerClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
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

/** Returns the signed-in user, or null if there isn't one. Never throws for "no session". */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { id: user.id, email: user.email ?? null };
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
