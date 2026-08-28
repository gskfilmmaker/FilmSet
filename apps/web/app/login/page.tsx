"use client";

import { BrandFooter } from "@/components/shell";
import { getBrowserSupabase } from "@filmset/auth/browser";
import { Button, FrameMark, Input } from "@filmset/ui";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/overview";
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = getBrowserSupabase();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background-canvas)] px-[var(--fs-space-16)]">
      <div className="flex w-full max-w-[360px] flex-col gap-[var(--fs-space-24)]">
        <div className="flex flex-col items-center gap-[var(--fs-space-8)]">
          <FrameMark className="size-[32px] text-[var(--color-action-primary)]" aria-hidden="true" />
          <h1 className="text-[18px] font-semibold text-[var(--color-text-primary)]">Sign in to FilmSet</h1>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-[var(--fs-space-16)]" noValidate>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p role="alert" className="text-[13px] text-[var(--color-status-danger)]">
              {error}
            </p>
          )}
          <Button type="submit" loading={loading}>
            Sign in
          </Button>
          <a href="/forgot-password" className="text-center text-[13px] text-[var(--color-action-primary)] hover:underline">
            Forgot password?
          </a>
        </form>
        <p className="text-center text-[13px] text-[var(--color-text-tertiary)]">
          No account?{" "}
          <a href="/signup" className="text-[var(--color-action-primary)] hover:underline">
            Create one
          </a>
        </p>
        <BrandFooter className="justify-center" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={null}>
      <LoginInner />
    </React.Suspense>
  );
}
