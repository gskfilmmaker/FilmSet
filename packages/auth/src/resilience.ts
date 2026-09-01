/**
 * Shared transport-layer resilience primitives for calls to Supabase's
 * Auth API — bounding how long we wait, never deciding what the result
 * means for security. That decision belongs to each call site
 * (middleware.ts's routing decision vs. server.ts's authentication
 * decision), because those two are not the same problem and must not be
 * forced to share failure semantics just because they share a timeout
 * mechanism (see server.ts's `checkAuth` and middleware.ts's
 * `updateSession` for where those decisions actually live).
 *
 * Exists because Vercel's Edge Middleware has a hard ~25s function
 * timeout, and Supabase's `GoTrueClient` can retry a slow/failed fetch
 * internally and eventually resolve "cleanly" (e.g. `{ user: null,
 * error }`) instead of rejecting — so bounding only the underlying
 * fetch() isn't enough to guarantee a caller returns in time. Racing the
 * whole call against `AUTH_UPSTREAM_DEADLINE_MS` here sidesteps needing
 * to know or trust anything about that internal retry/error behavior.
 */

/**
 * How long we wait for Supabase's Auth API before giving up. A constant,
 * not a magic number scattered across call sites — see server.ts's
 * `checkAuth` and middleware.ts's `updateSession` for where it's used.
 * Not exposed as end-user/client configuration; only ever set by this
 * module (tests inject a shorter deadline directly, see
 * `packages/auth/src/__tests__/resilience.test.ts`, rather than
 * changing this constant).
 */
export const AUTH_UPSTREAM_DEADLINE_MS = 6_000;

/** Thrown by `withDeadline` when the wrapped promise doesn't settle in time. Distinguishable from a real Supabase error — see `checkAuth`'s catch block. */
export class AuthCheckTimeoutError extends Error {
  constructor(ms: number) {
    super(`Auth check exceeded ${ms}ms`);
    this.name = "AuthCheckTimeoutError";
  }
}

/**
 * Races `promise` against a `ms`-millisecond deadline. If the deadline
 * wins, rejects with `AuthCheckTimeoutError` and stops waiting — the
 * original promise is left to settle on its own (harmless in a
 * request-scoped serverless/edge function that's about to return
 * anyway), never awaited further by this function.
 */
export function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new AuthCheckTimeoutError(ms)), ms);
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
 * A `fetch` implementation that aborts after `ms` — passed as
 * `global.fetch` to `createServerClient` so the underlying HTTP request
 * to Supabase is actually cancelled (not just ignored) once we've given
 * up on it. A courtesy on top of `withDeadline` (which alone is
 * sufficient for correctness), not a substitute for it.
 */
export function resilientFetch(ms: number = AUTH_UPSTREAM_DEADLINE_MS): typeof fetch {
  return (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => fetch(input, { ...init, signal: AbortSignal.timeout(ms) });
}
