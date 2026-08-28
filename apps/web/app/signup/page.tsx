"use client";

import { BrandFooter } from "@/components/shell";
import { getBrowserSupabase } from "@filmset/auth/browser";
import { Button, FrameMark, Input } from "@filmset/ui";
import { useRouter } from "next/navigation";
import * as React from "react";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [checkEmail, setCheckEmail] = React.useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = getBrowserSupabase();
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      if (data.session) {
        router.replace("/onboarding");
        router.refresh();
      } else {
        setCheckEmail(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create your account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (checkEmail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-background-canvas)] px-[var(--fs-space-16)]">
        <div className="flex w-full max-w-[360px] flex-col items-center gap-[var(--fs-space-12)] text-center">
          <FrameMark className="size-[32px] text-[var(--color-action-primary)]" aria-hidden="true" />
          <h1 className="text-[18px] font-semibold text-[var(--color-text-primary)]">Check your email</h1>
          <p className="text-[13px] text-[var(--color-text-tertiary)]">
            We sent a confirmation link to {email}. Follow it to finish creating your account.
          </p>
          <BrandFooter className="justify-center" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background-canvas)] px-[var(--fs-space-16)]">
      <div className="flex w-full max-w-[360px] flex-col gap-[var(--fs-space-24)]">
        <div className="flex flex-col items-center gap-[var(--fs-space-8)]">
          <FrameMark className="size-[32px] text-[var(--color-action-primary)]" aria-hidden="true" />
          <h1 className="text-[18px] font-semibold text-[var(--color-text-primary)]">Create your FilmSet account</h1>
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
            Create account
          </Button>
        </form>
        <p className="text-center text-[13px] text-[var(--color-text-tertiary)]">
          Already have an account?{" "}
          <a href="/login" className="text-[var(--color-action-primary)] hover:underline">
            Sign in
          </a>
        </p>
        <BrandFooter className="justify-center" />
      </div>
    </div>
  );
}
