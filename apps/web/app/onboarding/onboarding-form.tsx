"use client";

import { Button, FrameMark, Input } from "@filmset/ui";
import { createProduction } from "@/app/production-actions";

export function OnboardingForm() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background-canvas)] px-[var(--fs-space-16)]">
      <form action={createProduction} className="flex w-full max-w-[360px] flex-col gap-[var(--fs-space-24)]">
        <div className="flex flex-col items-center gap-[var(--fs-space-8)] text-center">
          <FrameMark className="size-[32px] text-[var(--color-action-primary)]" aria-hidden="true" />
          <h1 className="text-[18px] font-semibold text-[var(--color-text-primary)]">Name your production</h1>
          <p className="text-[13px] text-[var(--color-text-tertiary)]">
            You can add cast, crew, and scenes once it&apos;s created.
          </p>
        </div>
        <Input label="Production name" name="name" placeholder="e.g. THE BAND" required autoFocus />
        <Button type="submit">Create production</Button>
      </form>
    </div>
  );
}
