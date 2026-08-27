"use client";

import { theBandProduction, theBandScenes } from "@filmset/db";
import {
  AppShell,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  GlobalBar,
  Inspector,
  InspectorSection,
  KeyboardShortcutsOverlay,
  Sidebar,
  StatusBadge,
  useKeyboardShortcutsOverlay,
  useTheme,
  type SidebarItem,
} from "@filmset/ui";
import {
  Building2,
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
} from "lucide-react";
import { useEffect, useState } from "react";

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

function PrototypeControls() {
  const { theme, setTheme, density, setDensity } = useTheme();
  return (
    <div className="flex items-center gap-[var(--fs-space-8)] border-t border-[var(--color-border-subtle)] bg-[var(--color-background-canvas)] px-[var(--fs-space-16)] py-[var(--fs-space-8)] text-[12px] text-[var(--color-text-tertiary)]">
      <span>Prototype controls —</span>
      <label className="flex items-center gap-[var(--fs-space-4)]">
        Theme
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value as typeof theme)}
          className="rounded-sm border border-[var(--color-border-standard)] bg-[var(--color-background-surface)] px-[var(--fs-space-4)] py-[2px] text-[var(--color-text-primary)]"
        >
          <option value="dark">Dark</option>
          <option value="light">Light</option>
          <option value="high-contrast">High Contrast</option>
        </select>
      </label>
      <label className="flex items-center gap-[var(--fs-space-4)]">
        Density
        <select
          value={density}
          onChange={(e) => setDensity(e.target.value as typeof density)}
          className="rounded-sm border border-[var(--color-border-standard)] bg-[var(--color-background-surface)] px-[var(--fs-space-4)] py-[2px] text-[var(--color-text-primary)]"
        >
          <option value="comfortable">Comfortable</option>
          <option value="compact">Compact</option>
        </select>
      </label>
    </div>
  );
}

export default function Home() {
  const [active, setActive] = useState("schedule");
  const [expanded, setExpanded] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState("");
  const shortcuts = useKeyboardShortcutsOverlay();
  const scene = theBandScenes[0];

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const matchesScene = scene && new RegExp(`scene\\s*${scene.number}|^${scene.number}$`, "i").test(query.trim());

  return (
    <div className="flex h-screen flex-col">
      <div className="min-h-0 flex-1">
        <AppShell
          globalBar={
            <GlobalBar
              productionName={theBandProduction.name}
              phase={theBandProduction.phase}
              notificationCount={3}
              userName="Priya Nair"
              userInitials="PN"
              onOpenCommandPalette={() => setPaletteOpen(true)}
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
            scene && (
              <Inspector
                objectType="Scene"
                title={`Scene ${scene.number}`}
                subtitle={`${scene.intExt}. ${scene.setName.toUpperCase()} — ${scene.dayNight}`}
              >
                <InspectorSection label="Status">
                  <StatusBadge tone="info">{scene.status}</StatusBadge>
                </InspectorSection>
                <InspectorSection label="Pages">{scene.pageCount}</InspectorSection>
                <InspectorSection label="Synopsis">{scene.synopsis}</InspectorSection>
              </Inspector>
            )
          }
        >
          <div className="p-[var(--fs-space-24)]">
            <h1 className="text-[22px] font-semibold leading-[28px] text-[var(--color-text-primary)]">
              FRAME shell prototype
            </h1>
            <p className="mt-[8px] max-w-[560px] text-[14px] leading-[20px] text-[var(--color-text-secondary)]">
              Global Bar, Sidebar, and Inspector are one implementation, driven entirely by design
              tokens. Use the controls below to switch theme and density — no component changes,
              only which token values are active.
            </p>
          </div>
        </AppShell>
      </div>
      <PrototypeControls />
      <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <CommandInput placeholder="Search or run a command…" value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>No results for &quot;{query}&quot;.</CommandEmpty>
          {matchesScene && scene && (
            <>
              <CommandGroup heading={`Scene ${scene.number} — ${scene.setName}, ${scene.dayNight}`}>
                <CommandItem value={`scene-${scene.id}-open`} onSelect={() => setPaletteOpen(false)}>
                  Open Scene
                </CommandItem>
                <CommandItem value={`scene-${scene.id}-breakdown`} onSelect={() => setPaletteOpen(false)}>
                  Open Breakdown
                </CommandItem>
                <CommandItem value={`scene-${scene.id}-stripboard`} onSelect={() => setPaletteOpen(false)}>
                  Show in Stripboard
                </CommandItem>
                <CommandItem value={`scene-${scene.id}-shootday`} onSelect={() => setPaletteOpen(false)}>
                  Show Shoot Day
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
            </>
          )}
          <CommandGroup heading="Navigate">
            {items.map((item) => (
              <CommandItem
                key={item.id}
                value={item.label}
                onSelect={() => {
                  setActive(item.id);
                  setPaletteOpen(false);
                }}
              >
                {item.icon}
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="FilmSet AI">
            <CommandItem value="ask-ai" onSelect={() => setPaletteOpen(false)}>
              <Sparkles className="size-[14px] text-[var(--color-action-primary)]" aria-hidden="true" />
              Ask FilmSet AI: &quot;{query || "What's at risk this week?"}&quot;
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
      <KeyboardShortcutsOverlay open={shortcuts.open} onOpenChange={shortcuts.setOpen} />
    </div>
  );
}
