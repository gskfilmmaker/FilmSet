import * as React from "react";
import { cn } from "../../lib/cn";

export interface AppShellProps {
  globalBar: React.ReactNode;
  sidebar: React.ReactNode;
  inspector?: React.ReactNode;
  statusBar?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Canonical desktop shell (§16): Global Bar over Primary Nav | Workspace |
 * Context Inspector, with an optional status/activity area. The workspace
 * always has layout priority; the inspector is the one pane allowed to be
 * absent.
 */
export function AppShell({ globalBar, sidebar, inspector, statusBar, children, className }: AppShellProps) {
  return (
    <div className={cn("flex h-full flex-col bg-[var(--color-background-canvas)]", className)}>
      {globalBar}
      <div className="flex min-h-0 flex-1">
        {sidebar}
        <main className="min-w-0 flex-1 overflow-y-auto bg-[var(--color-background-surface)]">{children}</main>
        {inspector}
      </div>
      {statusBar}
    </div>
  );
}
