"use client";

import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatusBadge, useToast } from "@filmset/ui";
import { ShieldCheck } from "lucide-react";
import * as React from "react";
import { verifyAccess, type ScanOutcome } from "./actions";
import { humanizeEnum } from "./format";
import type { PersonOption } from "./identities-section";

const DIRECTIONS = ["ENTRY", "EXIT"] as const;

const toneFor: Record<ScanOutcome["decision"], "success" | "danger" | "warning"> = {
  ALLOW: "success",
  DENY: "danger",
  WARN: "warning",
};

/**
 * The real "scan a badge and get an allow/deny" flow — evaluateAccess()
 * (packages/auth) run against live data, decision written to access_events.
 * Manual reference entry stands in for camera-based QR scanning (a
 * separate, later undertaking): the operator selects checkpoint, device,
 * and direction, then pastes or types the credential's public_reference
 * (whatever the badge's QR actually encodes — see
 * docs/security/QR_SECURITY_ACCESS_CONTROL.md).
 */
export function ScanSection({
  checkpointOptions,
  deviceOptions,
  productionId,
}: {
  checkpointOptions: PersonOption[];
  deviceOptions: PersonOption[];
  productionId: string;
}) {
  const { toast } = useToast();
  const [checkpointId, setCheckpointId] = React.useState("");
  const [deviceId, setDeviceId] = React.useState("");
  const [direction, setDirection] = React.useState<(typeof DIRECTIONS)[number] | "">("");
  const [reference, setReference] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<ScanOutcome | null>(null);
  const referenceInputRef = React.useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!checkpointId) {
      toast({ tone: "danger", title: "Choose a checkpoint" });
      return;
    }
    if (!deviceId) {
      toast({ tone: "danger", title: "Choose a device" });
      return;
    }
    if (!reference.trim()) {
      toast({ tone: "danger", title: "Scan or enter a credential reference" });
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const outcome = await verifyAccess(productionId, {
        checkpointId,
        deviceId,
        direction: direction || null,
        publicReference: reference,
      });
      setResult(outcome);
    } catch (err) {
      toast({ tone: "danger", title: "Couldn't verify this credential", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSubmitting(false);
      setReference("");
      referenceInputRef.current?.focus();
    }
  }

  return (
    <div className="flex flex-col gap-[var(--fs-space-16)]">
      <p className="text-[13px] text-[var(--color-text-tertiary)]">
        Select the checkpoint and device this scan is happening at, then scan or paste the credential&rsquo;s reference.
        Every attempt is recorded, allowed or not.
      </p>

      <form onSubmit={onSubmit} className="flex flex-col gap-[var(--fs-space-12)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-16)]">
        <div className="flex flex-col gap-[var(--fs-space-8)] sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex w-full flex-col gap-[4px] sm:w-auto">
            <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Checkpoint</label>
            <Select value={checkpointId} onValueChange={setCheckpointId}>
              <SelectTrigger className="w-full sm:w-[190px]">
                <SelectValue placeholder="Choose…" />
              </SelectTrigger>
              <SelectContent>
                {checkpointOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-full flex-col gap-[4px] sm:w-auto">
            <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Device</label>
            <Select value={deviceId} onValueChange={setDeviceId}>
              <SelectTrigger className="w-full sm:w-[190px]">
                <SelectValue placeholder="Choose…" />
              </SelectTrigger>
              <SelectContent>
                {deviceOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-full flex-col gap-[4px] sm:w-auto">
            <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">Direction</label>
            <Select value={direction || undefined} onValueChange={(v) => setDirection(v as (typeof DIRECTIONS)[number])}>
              <SelectTrigger className="w-full sm:w-[110px]">
                <SelectValue placeholder="Either" />
              </SelectTrigger>
              <SelectContent>
                {DIRECTIONS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {humanizeEnum(d)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-[var(--fs-space-8)] sm:flex-row sm:items-end">
          <Input
            ref={referenceInputRef}
            label="Credential reference"
            placeholder="Scan or paste the badge's QR value"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            containerClassName="w-full sm:min-w-[260px] sm:flex-1"
            autoFocus
          />
          <Button type="submit" loading={submitting} disabled={submitting} className="w-full sm:w-auto">
            Verify
          </Button>
        </div>
      </form>

      {result && (
        <div className="flex flex-col gap-[var(--fs-space-8)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-16)]">
          <div className="flex items-center gap-[var(--fs-space-8)]">
            <StatusBadge tone={toneFor[result.decision]} className="text-[14px] px-[var(--fs-space-12)] py-[4px]">
              {result.decision === "ALLOW" ? "ALLOW" : result.decision === "WARN" ? "ALLOW — WARNING" : "DENY"}
            </StatusBadge>
            {result.escortRequired && <StatusBadge tone="warning">Escort required</StatusBadge>}
          </div>
          <p className="text-[13px] text-[var(--color-text-primary)]">{result.reason}</p>
          <p className="text-[12px] text-[var(--color-text-tertiary)]">Reason code: {result.reasonCode}</p>
        </div>
      )}

      {checkpointOptions.length === 0 && (
        <p className="flex items-center gap-[var(--fs-space-8)] text-[13px] text-[var(--color-text-tertiary)]">
          <ShieldCheck className="size-[16px]" aria-hidden="true" />
          Add a checkpoint on the Checkpoints tab before scanning.
        </p>
      )}
    </div>
  );
}
