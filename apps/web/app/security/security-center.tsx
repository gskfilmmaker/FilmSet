"use client";

import { Shell } from "@/components/shell";
import type { Production, Scene } from "@filmset/core";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToast,
} from "@filmset/ui";
import { AlertTriangle, CheckCircle2, HelpCircle, LogIn, Monitor, ShieldQuestion } from "lucide-react";
import * as React from "react";
import { FIXTURE_EXPLAIN_EXAMPLES, FIXTURE_LOGIN_HISTORY, FIXTURE_OTHER_SESSIONS } from "./fixtures";

const loginEventCopy: Record<(typeof FIXTURE_LOGIN_HISTORY)[number]["event"], { label: string; tone: "success" | "warning" | "danger" }> = {
  "auth.login_success": { label: "Signed in", tone: "success" },
  "auth.login_failure": { label: "Sign-in failed", tone: "danger" },
  "auth.new_device": { label: "New device", tone: "warning" },
};

function DemoDataNotice() {
  return (
    <div className="flex items-start gap-[var(--fs-space-8)] rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-background-surface)] p-[var(--fs-space-12)]">
      <AlertTriangle className="mt-[1px] size-[14px] shrink-0 text-[var(--color-status-warning)]" aria-hidden="true" />
      <p className="text-[12px] text-[var(--color-text-secondary)]">
        Demo data. Session and login tracking (<code>Session</code>/<code>AuthenticationEvent</code>,{" "}
        <a
          href="https://github.com/gskfilmmaker/FilmSet/blob/main/docs/security/SECURITY_ARCHITECTURE_V1.md"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--color-action-primary)] hover:underline"
        >
          SECURITY_ARCHITECTURE_V1.md
        </a>{" "}
        §2) isn&apos;t built yet — this screen shows the real layout with placeholder rows a future migration will replace.
      </p>
    </div>
  );
}

function ExplainAccessDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [index, setIndex] = React.useState(0);
  // Non-null: index is always kept in [0, length) by the "Next example" handler below, against a fixed non-empty array.
  const example = FIXTURE_EXPLAIN_EXAMPLES[index % FIXTURE_EXPLAIN_EXAMPLES.length]!;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Why can {example.subject} {example.allowed ? "" : "not "}access {example.resource}?
          </DialogTitle>
        </DialogHeader>
        <div className="mt-[var(--fs-space-16)] flex flex-col gap-[var(--fs-space-12)]">
          <div className="flex items-center gap-[var(--fs-space-8)]">
            {example.allowed ? (
              <CheckCircle2 className="size-[16px] text-[var(--color-status-success)]" aria-hidden="true" />
            ) : (
              <AlertTriangle className="size-[16px] text-[var(--color-status-danger)]" aria-hidden="true" />
            )}
            <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">{example.allowed ? "Granted" : "Denied"}</span>
          </div>
          <p className="text-[13px] leading-[20px] text-[var(--color-text-secondary)]">{example.reason}</p>
          <p className="text-[12px] text-[var(--color-text-tertiary)]">Permission checked: {example.action}</p>
        </div>
        <div className="mt-[var(--fs-space-16)] flex items-center justify-between gap-[var(--fs-space-8)]">
          <p className="text-[12px] text-[var(--color-text-tertiary)]">
            Reproduced from <code>evaluateAuthorization()</code>&apos;s real return shape (P1b) — not invented text.
          </p>
          <Button variant="secondary" onClick={() => setIndex((i) => (i + 1) % FIXTURE_EXPLAIN_EXAMPLES.length)}>
            Next example
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SecurityCenter({
  production,
  scenes,
  userEmail,
}: {
  production: Pick<Production, "id" | "name" | "phase">;
  scenes: Pick<Scene, "id" | "number" | "setName" | "dayNight" | "intExt" | "shootDayId">[];
  userEmail: string | null;
}) {
  const { toast } = useToast();
  const [explainOpen, setExplainOpen] = React.useState(false);

  function onDemoLogout(deviceLabel: string) {
    toast({ title: "Demo data", description: `No real session backs "${deviceLabel}" yet — nothing to revoke.` });
  }

  return (
    <Shell production={production} scenes={scenes} userEmail={userEmail ?? undefined}>
      <div className="flex flex-col gap-[var(--fs-space-24)] p-[var(--fs-space-24)]">
        <div className="flex flex-col gap-[var(--fs-space-4)]">
          <h1 className="text-[22px] font-semibold leading-[28px] text-[var(--color-text-primary)]">Security Center</h1>
          <p className="text-[13px] text-[var(--color-text-secondary)]">Sessions, login history, and access explanations for your account.</p>
        </div>

        <DemoDataNotice />

        <Tabs defaultValue="sessions" className="flex flex-col gap-[var(--fs-space-16)]">
          <TabsList>
            <TabsTrigger value="sessions">Active Sessions</TabsTrigger>
            <TabsTrigger value="logins">Login History</TabsTrigger>
          </TabsList>

          <TabsContent value="sessions">
            <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)] rounded-lg border border-[var(--color-border-subtle)]">
              <li className="flex items-center justify-between gap-[var(--fs-space-16)] p-[var(--fs-space-12)]">
                <div className="flex items-center gap-[var(--fs-space-8)]">
                  <Monitor className="size-[16px] text-[var(--color-text-tertiary)]" aria-hidden="true" />
                  <div>
                    <p className="text-[13px] font-medium text-[var(--color-text-primary)]">This device</p>
                    <p className="text-[12px] text-[var(--color-text-tertiary)]">{userEmail ?? "Current session"} · Active now</p>
                  </div>
                </div>
                <StatusBadge tone="success">This session</StatusBadge>
              </li>
              {FIXTURE_OTHER_SESSIONS.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-[var(--fs-space-16)] p-[var(--fs-space-12)]">
                  <div className="flex items-center gap-[var(--fs-space-8)]">
                    <Monitor className="size-[16px] text-[var(--color-text-tertiary)]" aria-hidden="true" />
                    <div>
                      <p className="text-[13px] font-medium text-[var(--color-text-primary)]">{s.deviceLabel}</p>
                      <p className="text-[12px] text-[var(--color-text-tertiary)]">
                        {s.location} · Last active {s.lastActiveAt}
                      </p>
                    </div>
                  </div>
                  <Button variant="secondary" onClick={() => onDemoLogout(s.deviceLabel)}>
                    Log out
                  </Button>
                </li>
              ))}
            </ul>
          </TabsContent>

          <TabsContent value="logins">
            <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)] rounded-lg border border-[var(--color-border-subtle)]">
              {FIXTURE_LOGIN_HISTORY.map((e) => {
                const copy = loginEventCopy[e.event];
                return (
                  <li key={e.id} className="flex items-center justify-between gap-[var(--fs-space-16)] p-[var(--fs-space-12)]">
                    <div className="flex items-center gap-[var(--fs-space-8)]">
                      <LogIn className="size-[16px] text-[var(--color-text-tertiary)]" aria-hidden="true" />
                      <div>
                        <p className="text-[13px] font-medium text-[var(--color-text-primary)]">{e.deviceLabel}</p>
                        <p className="text-[12px] text-[var(--color-text-tertiary)]">
                          {e.location} · {e.occurredAt}
                        </p>
                      </div>
                    </div>
                    <StatusBadge tone={copy.tone}>{copy.label}</StatusBadge>
                  </li>
                );
              })}
            </ul>
          </TabsContent>
        </Tabs>

        <section className="flex flex-col gap-[var(--fs-space-8)] rounded-lg border border-[var(--color-border-subtle)] p-[var(--fs-space-16)]">
          <h2 className="flex items-center gap-[var(--fs-space-8)] text-[13px] font-semibold text-[var(--color-text-primary)]">
            <HelpCircle className="size-[16px]" aria-hidden="true" />
            Why can this user access this?
          </h2>
          <p className="text-[13px] text-[var(--color-text-secondary)]">
            See a worked example of how <code>authorize()</code>&apos;s decision trace explains a grant or a denial.
          </p>
          <Button variant="secondary" onClick={() => setExplainOpen(true)} className="self-start">
            View example
          </Button>
        </section>

        <section className="flex flex-col gap-[var(--fs-space-8)] rounded-lg border border-dashed border-[var(--color-border-subtle)] p-[var(--fs-space-16)] opacity-70">
          <h2 className="flex items-center gap-[var(--fs-space-8)] text-[13px] font-semibold text-[var(--color-text-primary)]">
            <ShieldQuestion className="size-[16px]" aria-hidden="true" />
            Permission Simulator
          </h2>
          <p className="text-[13px] text-[var(--color-text-secondary)]">
            Not built here on purpose. SECURITY_CENTER_UX_SPEC.md §4.2 requires the simulator to call the real{" "}
            <code>authorize()</code>/data-fetching path with a swapped principal — never a mocked approximation, since the entire point
            is showing what another user&apos;s screens <em>actually</em> look like. Faking that with fixture data here would violate
            the one constraint the design explicitly calls out, so this stays a stub until it can be built for real.
          </p>
          <Button variant="secondary" disabled>
            Not available yet
          </Button>
        </section>
      </div>

      <ExplainAccessDialog open={explainOpen} onOpenChange={setExplainOpen} />
    </Shell>
  );
}
