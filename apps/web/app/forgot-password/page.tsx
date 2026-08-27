"use client";

import { getBrowserSupabase } from "@filmset/auth/browser";
import { Button, FrameMark, Input } from "@filmset/ui";
import * as React from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = getBrowserSupabase();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send reset link. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-background-canvas)] px-[var(--fs-space-16)]">
        <div className="flex w-full max-w-[360px] flex-col items-center gap-[var(--fs-space-12)] text-center">
          <FrameMark className="size-[32px] text-[var(--color-action-primary)]" aria-hidden="true" />
          <h1 className="text-[18px] font-semibold text-[var(--color-text-primary)]">Check your email</h1>
          <p className="text-[13px] text-[var(--color-text-tertiary)]">
            If an account exists for {email}, we sent a link to reset your password.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background-canvas)] px-[var(--fs-space-16)]">
      <div className="flex w-full max-w-[360px] flex-col gap-[var(--fs-space-24)]">
        <div className="flex flex-col items-center gap-[var(--fs-space-8)] text-center">
          <FrameMark className="size-[32px] text-[var(--color-action-primary)]" aria-hidden="true" />
          <h1 className="text-[18px] font-semibold text-[var(--color-text-primary)]">Reset your password</h1>
          <p className="text-[13px] text-[var(--color-text-tertiary)]">We&apos;ll email you a link to set a new one.</p>
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
          {error && (
            <p role="alert" className="text-[13px] text-[var(--color-status-danger)]">
              {error}
            </p>
          )}
          <Button type="submit" loading={loading}>
            Send reset link
          </Button>
        </form>
        <p className="text-center text-[13px] text-[var(--color-text-tertiary)]">
          <a href="/login" className="text-[var(--color-action-primary)] hover:underline">
            Back to sign in
          </a>
        </p>
      </div>
    </div>
  );
}
