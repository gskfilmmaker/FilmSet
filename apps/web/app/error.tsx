"use client";

import { Button, ErrorState } from "@filmset/ui";
import * as React from "react";

/**
 * Root-level error boundary (§37 — actionable errors, not stack traces in
 * the user's face). Catches anything a Server Component throws — a failed
 * Supabase/Postgres query, an RLS rejection surfaced as a thrown error,
 * etc. `reset()` re-renders the segment, which re-runs the failed fetch.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background-canvas)] px-[var(--fs-space-16)]">
      <ErrorState
        title="Something went wrong"
        description="FilmSet ran into an unexpected error loading this page. Your data is safe — try again."
        details={error.message}
        action={<Button onClick={reset}>Try again</Button>}
      />
    </div>
  );
}
