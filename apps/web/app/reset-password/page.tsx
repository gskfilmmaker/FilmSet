"use client";

import { getBrowserSupabase } from "@filmset/auth/browser";
import { Button, FrameMark, Input } from "@filmset/ui";
import { useRouter } from "next/navigation";
import * as React from "react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [checking, setChecking] = React.useState(true);
  const [hasRecoverySession, setHasRecoverySession] = React.useState(false);

  React.useEffect(() => {
    try {
      const supabase = getBrowserSupabase();

      supabase.auth.getSession().then(({ data }) => {
        setHasRecoverySession(Boolean(data.session));
        setChecking(false);
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") {
          setHasRecoverySession(true);
          setChecking(false);
        }
      });
      return () => subscription.unsubscribe();
    } catch {
      setChecking(false);
    }
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = getBrowserSupabase();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      router.replace("/overview");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (checking) return null;

  if (!hasRecoverySession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-background-canvas)] px-[var(--fs-space-16)]">
        <div className="flex w-full max-w-[360px] flex-col items-center gap-[var(--fs-space-12)] text-center">
          <FrameMark className="size-[32px] text-[var(--color-action-primary)]" aria-hidden="true" />
          <h1 className="text-[18px] font-semibold text-[var(--color-text-primary)]">Link expired</h1>
          <p className="text-[13px] text-[var(--color-text-tertiary)]">
            This password reset link is invalid or has expired.
          </p>
          <a href="/forgot-password" className="text-[13px] text-[var(--color-action-primary)] hover:underline">
            Request a new one
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background-canvas)] px-[var(--fs-space-16)]">
      <div className="flex w-full max-w-[360px] flex-col gap-[var(--fs-space-24)]">
        <div className="flex flex-col items-center gap-[var(--fs-space-8)] text-center">
          <FrameMark className="size-[32px] text-[var(--color-action-primary)]" aria-hidden="true" />
          <h1 className="text-[18px] font-semibold text-[var(--color-text-primary)]">Set a new password</h1>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-[var(--fs-space-16)]" noValidate>
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            minLength={6}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            description="At least 6 characters."
          />
          {error && (
            <p role="alert" className="text-[13px] text-[var(--color-status-danger)]">
              {error}
            </p>
          )}
          <Button type="submit" loading={loading}>
            Update password
          </Button>
        </form>
      </div>
    </div>
  );
}
