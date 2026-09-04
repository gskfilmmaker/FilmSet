"use client";

import { PhotoAvatar } from "@/components/photo-avatar";
import { Shell } from "@/components/shell";
import type { Production, Scene } from "@filmset/core";
import { Button, Input, useToast } from "@filmset/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { deriveShortCode } from "@/lib/id-format";
import { updateBrandColor, updateFullName, updateShortCode, uploadProductionLogo } from "./actions";

const DEFAULT_BRAND_COLOR = "#111318";

export function SettingsForm({
  production,
  scenes,
  userEmail,
  fullName,
  logoUrl,
  canManageBranding,
}: {
  production: Pick<Production, "id" | "name" | "phase" | "logoPath" | "brandColor" | "shortCode">;
  scenes: Pick<Scene, "id" | "number" | "setName" | "dayNight" | "intExt" | "shootDayId">[];
  userEmail: string | null;
  fullName: string;
  logoUrl: string | null;
  canManageBranding: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = React.useState(fullName);
  const [saving, setSaving] = React.useState(false);
  const [brandColor, setBrandColor] = React.useState(production.brandColor ?? DEFAULT_BRAND_COLOR);
  const [savingColor, setSavingColor] = React.useState(false);
  const [shortCode, setShortCode] = React.useState(production.shortCode ?? deriveShortCode(production.name));
  const [savingShortCode, setSavingShortCode] = React.useState(false);

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

  async function onSaveBrandColor() {
    setSavingColor(true);
    try {
      await updateBrandColor(production.id, brandColor);
      toast({ tone: "success", title: "Brand color saved" });
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't save brand color", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSavingColor(false);
    }
  }

  async function onSaveShortCode() {
    setSavingShortCode(true);
    try {
      await updateShortCode(production.id, shortCode);
      toast({ tone: "success", title: "ID prefix saved" });
      router.refresh();
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't save ID prefix", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSavingShortCode(false);
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

        <section className="flex flex-col gap-[var(--fs-space-12)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-16)]">
          <div>
            <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Production branding</h2>
            <p className="text-[13px] text-[var(--color-text-secondary)]">The logo and accent color shown on this production&apos;s Security &amp; Access credential badges.</p>
          </div>
          {canManageBranding ? (
            <>
              <div className="flex items-center gap-[var(--fs-space-12)]">
                <PhotoAvatar
                  photoUrl={logoUrl}
                  fallbackLabel={production.name}
                  alt={`${production.name} logo`}
                  size={56}
                  onUpload={(file) => {
                    const formData = new FormData();
                    formData.set("logo", file);
                    return uploadProductionLogo(production.id, formData).then(() => {});
                  }}
                />
                <p className="text-[12px] text-[var(--color-text-tertiary)]">Click to upload a logo (JPEG, PNG, WebP, or GIF, up to 5MB).</p>
              </div>
              <div className="flex items-end gap-[var(--fs-space-8)]">
                <div className="flex flex-col gap-[4px]">
                  <label htmlFor="brand-color" className="text-[12px] font-medium text-[var(--color-text-secondary)]">
                    Brand color
                  </label>
                  <div className="flex items-center gap-[var(--fs-space-8)]">
                    <input
                      id="brand-color"
                      type="color"
                      value={brandColor}
                      onChange={(e) => setBrandColor(e.target.value)}
                      className="size-[var(--fs-control-height)] cursor-pointer rounded-[4px] border border-[var(--color-border-subtle)] bg-transparent p-[2px]"
                      aria-label="Brand color"
                    />
                    <Input value={brandColor} onChange={(e) => setBrandColor(e.target.value)} containerClassName="w-[110px]" />
                  </div>
                </div>
                <Button onClick={onSaveBrandColor} loading={savingColor} disabled={savingColor}>
                  Save color
                </Button>
              </div>
              <div className="flex items-end gap-[var(--fs-space-8)]">
                <Input
                  label="ID prefix"
                  description="Used for auto-generated credential numbers and resource/checkpoint codes, e.g. VMPA-CR-000001."
                  value={shortCode}
                  onChange={(e) => setShortCode(e.target.value.toUpperCase())}
                  containerClassName="w-[140px]"
                  maxLength={8}
                />
                <Button onClick={onSaveShortCode} loading={savingShortCode} disabled={savingShortCode}>
                  Save prefix
                </Button>
              </div>
            </>
          ) : (
            <p className="text-[13px] text-[var(--color-text-tertiary)]">Only a Producer can change production branding.</p>
          )}
        </section>

        <section className="flex flex-col gap-[var(--fs-space-8)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-16)]">
          <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Departments</h2>
          <p className="text-[13px] text-[var(--color-text-secondary)]">Manage department heads, membership, and permissions.</p>
          <Link href="/settings/departments" className="self-start text-[13px] text-[var(--color-action-primary)] hover:underline">
            View departments →
          </Link>
        </section>

        <section className="flex flex-col gap-[var(--fs-space-8)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-16)]">
          <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Security Center</h2>
          <p className="text-[13px] text-[var(--color-text-secondary)]">Review active sessions, login history, and access explanations.</p>
          <Link href="/security" className="self-start text-[13px] text-[var(--color-action-primary)] hover:underline">
            Open Security Center →
          </Link>
        </section>

        <p className="flex items-center justify-center gap-[6px] text-[12px] text-[var(--color-text-tertiary)]">
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, no benefit from next/image here */}
          <img src="/brand/gsk-productions-logo.png" alt="" aria-hidden="true" className="h-[13px] w-auto shrink-0 opacity-70" />
          <span>
            Built by{" "}
            <a href="https://www.gskproductions.ca" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-text-secondary)] hover:underline">
              GSK Productions Inc.
            </a>{" "}
            ·{" "}
            <a href="mailto:info@gskproductions.ca" className="hover:text-[var(--color-text-secondary)] hover:underline">
              info@gskproductions.ca
            </a>
          </span>
        </p>
      </div>
    </Shell>
  );
}
