import type { Meta, StoryObj } from "@storybook/react";
import {
  CalendarDays,
  FileText,
  FolderOpen,
  HardHat,
  LayoutDashboard,
  ListTree,
  MapPin,
  Settings,
  Sparkles,
  Users,
  Wallet,
  Building2,
} from "lucide-react";
import * as React from "react";
import { GlobalBar } from "../global-bar/global-bar";
import { Inspector, InspectorSection } from "../inspector/inspector";
import { Sidebar, type SidebarItem } from "../sidebar/sidebar";
import { StatusBadge } from "../status-badge/status-badge";
import { AppShell } from "./app-shell";

const items: SidebarItem[] = [
  { id: "overview", label: "Overview", icon: <LayoutDashboard className="size-full" /> },
  { id: "script", label: "Script", icon: <FileText className="size-full" /> },
  { id: "breakdown", label: "Breakdown", icon: <ListTree className="size-full" /> },
  { id: "schedule", label: "Schedule", icon: <CalendarDays className="size-full" /> },
  { id: "cast", label: "Cast", icon: <Users className="size-full" /> },
  { id: "crew", label: "Crew", icon: <HardHat className="size-full" /> },
  { id: "locations", label: "Locations", icon: <MapPin className="size-full" /> },
  { id: "set", label: "Set", icon: <Building2 className="size-full" /> },
  { id: "money", label: "Money", icon: <Wallet className="size-full" /> },
  { id: "documents", label: "Documents", icon: <FolderOpen className="size-full" /> },
];
const aiItem: SidebarItem = { id: "ai", label: "FilmSet AI", icon: <Sparkles className="size-full" /> };
const settingsItem: SidebarItem = { id: "settings", label: "Settings", icon: <Settings className="size-full" /> };

function Demo() {
  const [active, setActive] = React.useState("schedule");
  const [expanded, setExpanded] = React.useState(true);
  return (
    <AppShell
      globalBar={
        <GlobalBar
          productionName="THE BAND"
          phase="Production"
          notificationCount={3}
          userName="Priya Nair"
          userInitials="PN"
          onOpenCommandPalette={() => {}}
        />
      }
      sidebar={
        <Sidebar
          items={items}
          activeId={active}
          onNavigate={setActive}
          aiItem={aiItem}
          settingsItem={settingsItem}
          expanded={expanded}
          onToggleExpanded={() => setExpanded((e) => !e)}
        />
      }
      inspector={
        <Inspector objectType="Scene" title="Scene 47" subtitle="EXT. PAHARGANJ STREET — NIGHT" onClose={() => {}}>
          <InspectorSection label="Status">
            <StatusBadge tone="info">Scheduled</StatusBadge>
          </InspectorSection>
          <InspectorSection label="Shoot Day">Day 18</InspectorSection>
          <InspectorSection label="Cast">
            <div className="flex flex-col gap-4">
              <span>Abraham</span>
              <span>Aisha</span>
            </div>
          </InspectorSection>
        </Inspector>
      }
    >
      <div className="p-[var(--fs-space-24)] text-[var(--color-text-secondary)]">
        <p className="text-[13px]">
          Workspace content renders here. This shell — Global Bar, Sidebar, Inspector — is a single
          implementation. Switch the theme and density in the Storybook toolbar; no component here
          changes, only the active token values.
        </p>
      </div>
    </AppShell>
  );
}

const meta: Meta = {
  title: "FRAME/AppShell",
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj;

export const DesktopShell: Story = {
  render: () => (
    <div style={{ height: "720px" }}>
      <Demo />
    </div>
  ),
};
