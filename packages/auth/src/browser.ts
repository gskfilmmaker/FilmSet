"use client";

import { createBrowserClient } from "@supabase/ssr";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — see docs/design-system/README.md#environment.`);
  return value;
}

/** One Supabase client per browser tab — safe to call repeatedly, memoized module-side. */
let client: ReturnType<typeof createBrowserClient> | undefined;

export function getBrowserSupabase() {
  client ??= createBrowserClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  );
  return client;
}
