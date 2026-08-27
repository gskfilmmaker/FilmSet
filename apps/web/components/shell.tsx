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
  KeyboardShortcutsOverlay,
  Sidebar,
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
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

const navItems: (SidebarItem & { href: string })[] = [
  { id: "overview", label: "Overview", href: "/overview", icon: <LayoutDashboard className="size-full" /> },
  { id: "script", label: "Script", href: "/script", icon: <FileText className="size-full" /> },
  { id: "breakdown", label: "Breakdown", href: "/script", icon: <ListTree className="size-full" /> },
  { id: "schedule", label: "Schedule", href: "/schedule", icon: <CalendarDays className="size-full" /> },
  { id: "cast", label: "Cast", href: "/overview", icon: <Users className="size-full" /> },
  { id: "crew", label: "Crew", href: "/overview", icon: <HardHat className="size-full" /> },
  { id: "locations", label: "Locations", href: "/overview", icon: <MapPin className="size-full" /> },
  { id: "set", label: "Set", href: "/shoot-day", icon: <Building2 className="size-full" /> },
  { id: "money", label: "Money", href: "/overview", icon: <Wallet className="size-full" /> },
  { id: "documents", label: "Documents", href: "/overview", icon: <FolderOpen className="size-full" /> },
];
const aiItem: SidebarItem & { href: string } = { id: "ai", label: "FilmSet AI", href: "/ai", icon: <Sparkles className="size-full" /> };
const settingsItem: SidebarItem = { id: "settings", label: "Settings", icon: <Settings className="size-full" /> };

function routeForActiveId(pathname: string): string {
  if (pathname.startsWith("/script")) return "script";
  if (pathname.startsWith("/schedule")) return "schedule";
  if (pathname.startsWith("/shoot-day")) return "set";
  if (pathname.startsWith("/ai")) return "ai";
  return "overview";
}

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

export interface ShellProps {
  children: React.ReactNode;
  inspector?: React.ReactNode;
}

export function Shell({ children, inspector }: ShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [expanded, setExpanded] = React.useState(true);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const shortcuts = useKeyboardShortcutsOverlay();

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const sceneMatch = React.useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return null;
    const m = /(?:scene\s*)?(\d+)$/i.exec(trimmed);
    if (!m) return null;
    return theBandScenes.find((s) => s.number === m[1]) ?? null;
  }, [query]);

  function go(href: string) {
    setPaletteOpen(false);
    router.push(href);
  }

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
              onOpenProductionSwitcher={() => router.push("/overview")}
            />
          }
          sidebar={
            <Sidebar
              items={navItems}
              activeId={routeForActiveId(pathname)}
              onNavigate={(id) => {
                const item = [...navItems, aiItem].find((i) => i.id === id);
                if (item) router.push(item.href);
              }}
              aiItem={aiItem}
              settingsItem={settingsItem}
              expanded={expanded}
              onToggleExpanded={() => setExpanded((e) => !e)}
            />
          }
          inspector={inspector}
        >
          {children}
        </AppShell>
      </div>
      <PrototypeControls />

      <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <CommandInput placeholder="Search or run a command…" value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>No results for &quot;{query}&quot;.</CommandEmpty>
          {sceneMatch && (
            <>
              <CommandGroup heading={`Scene ${sceneMatch.number} — ${sceneMatch.setName}, ${sceneMatch.dayNight}`}>
                <CommandItem value={`scene-${sceneMatch.id}-open`} onSelect={() => go(`/script?scene=${sceneMatch.id}`)}>
                  Open Scene
                </CommandItem>
                <CommandItem value={`scene-${sceneMatch.id}-breakdown`} onSelect={() => go(`/script?scene=${sceneMatch.id}`)}>
                  Open Breakdown
                </CommandItem>
                <CommandItem value={`scene-${sceneMatch.id}-stripboard`} onSelect={() => go(`/schedule?scene=${sceneMatch.id}`)}>
                  Show in Stripboard
                </CommandItem>
                {sceneMatch.shootDayId && (
                  <CommandItem value={`scene-${sceneMatch.id}-shootday`} onSelect={() => go("/shoot-day")}>
                    Show Shoot Day
                  </CommandItem>
                )}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}
          <CommandGroup heading="Navigate">
            <CommandItem value="Overview" onSelect={() => go("/overview")}>
              <LayoutDashboard className="size-[14px] text-[var(--color-text-tertiary)]" aria-hidden="true" />
              Overview
            </CommandItem>
            <CommandItem value="Script" onSelect={() => go("/script")}>
              <FileText className="size-[14px] text-[var(--color-text-tertiary)]" aria-hidden="true" />
              Script
            </CommandItem>
            <CommandItem value="Schedule Stripboard" onSelect={() => go("/schedule")}>
              <CalendarDays className="size-[14px] text-[var(--color-text-tertiary)]" aria-hidden="true" />
              Schedule
            </CommandItem>
            <CommandItem value="Shoot Day Call Sheet" onSelect={() => go("/shoot-day")}>
              <Building2 className="size-[14px] text-[var(--color-text-tertiary)]" aria-hidden="true" />
              Today's Shoot Day
            </CommandItem>
            <CommandItem value="FilmSet AI" onSelect={() => go("/ai")}>
              <Sparkles className="size-[14px] text-[var(--color-action-primary)]" aria-hidden="true" />
              FilmSet AI
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="FilmSet AI">
            <CommandItem value="ask-ai" onSelect={() => go("/ai")}>
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
