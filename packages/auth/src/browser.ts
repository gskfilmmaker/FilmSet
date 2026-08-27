"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Next.js only inlines `NEXT_PUBLIC_*` vars into the client bundle when the
 * full `process.env.NEXT_PUBLIC_X` member expression appears literally in
 * source — its build-time replacement is a static text search, not a real
 * `process.env` object in the browser. A dynamic `process.env[name]` helper
 * (this file's previous shape) can't be statically matched, so it silently
 * resolves to undefined at runtime here even though the identical pattern
 * works fine server-side (server.ts, middleware.ts run in Node/Edge, where
 * process.env is real and un-restricted).
 *
 * The env read stays lazy (inside getBrowserSupabase, not at module top
 * level) so importing this file never throws during Next's build-time
 * static prerendering of "use client" pages — only an actual call, i.e. a
 * user clicking a real auth button, can throw.
 */
function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is not set — see docs/design-system/README.md#environment.`);
  return value;
}

let client: ReturnType<typeof createBrowserClient> | undefined;

export function getBrowserSupabase() {
  if (!client) {
    const supabaseUrl = required(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
    const supabasePublishableKey = required(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
    client = createBrowserClient(supabaseUrl, supabasePublishableKey);
  }
  return client;
}
