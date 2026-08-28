"use client";

import { Shell } from "@/components/shell";
import type { Production, Scene } from "@filmset/core";
import { Button, Input, useToast } from "@filmset/ui";
import { useRouter } from "next/navigation";
import * as React from "react";
import { updateFullName } from "./actions";

export function SettingsForm({
  production,
  scenes,
  userEmail,
  fullName,
}: {
  production: Pick<Production, "id" | "name" | "phase">;
  scenes: Pick<Scene, "id" | "number" | "setName" | "dayNight" | "intExt" | "shootDayId">[];
  userEmail: string | null;
  fullName: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = React.useState(fullName);
  const [saving, setSaving] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateFullName(name);
      toast({ tone: "success", title: "Saved" });
      router.refresh();
    } catch {
      toast({ tone: "danger", title: "Couldn't save", description: "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell production={production} scenes={scenes} userEmail={userEmail ?? undefined}>
      <div className="mx-auto flex max-w-[480px] flex-col gap-[var(--fs-space-24)] p-[var(--fs-space-24)]">
        <h1 className="text-[22px] font-semibold leading-[28px] text-[var(--color-text-primary)]">Settings</h1>
        <section className="flex flex-col gap-[var(--fs-space-16)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-16)]">
          <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Account</h2>
          <Input label="Email" value={userEmail ?? ""} disabled />
          <form onSubmit={onSubmit} className="flex flex-col gap-[var(--fs-space-12)]">
            <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            <Button type="submit" loading={saving} disabled={saving} className="self-start">
              Save
            </Button>
          </form>
          <a href="/forgot-password" className="text-[13px] text-[var(--color-action-primary)] hover:underline">
            Change password →
          </a>
        </section>

        <section className="flex flex-col items-center gap-[var(--fs-space-12)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-16)] text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, no benefit from next/image here */}
          <img src="/brand/gsk-productions-logo.png" alt="GSK Productions Inc." className="h-[36px] w-auto" />
          <p className="text-[13px] text-[var(--color-text-secondary)]">
            FilmSet is a product of{" "}
            <a href="https://www.gskproductions.ca" target="_blank" rel="noopener noreferrer" className="text-[var(--color-action-primary)] hover:underline">
              GSK Productions Inc.
            </a>
          </p>
          <a href="mailto:info@gskproductions.ca" className="text-[13px] text-[var(--color-action-primary)] hover:underline">
            info@gskproductions.ca
          </a>
        </section>
      </div>
    </Shell>
  );
}
