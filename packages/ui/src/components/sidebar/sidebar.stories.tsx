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
import { Sidebar, type SidebarItem } from "./sidebar";

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

const meta: Meta<typeof Sidebar> = {
  title: "FRAME/Sidebar",
  component: Sidebar,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof Sidebar>;

function Interactive({ startExpanded = true }: { startExpanded?: boolean }) {
  const [active, setActive] = React.useState("schedule");
  const [expanded, setExpanded] = React.useState(startExpanded);
  return (
    <div style={{ height: "640px" }}>
      <Sidebar
        items={items}
        activeId={active}
        onNavigate={setActive}
        aiItem={aiItem}
        settingsItem={settingsItem}
        expanded={expanded}
        onToggleExpanded={() => setExpanded((e) => !e)}
      />
    </div>
  );
}

export const Expanded: Story = { render: () => <Interactive startExpanded /> };
export const Collapsed: Story = { render: () => <Interactive startExpanded={false} /> };
