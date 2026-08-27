"use client";

import { createProduction, listMyProductions, switchActiveProduction, type MyProduction } from "@/app/production-actions";
import { getBrowserSupabase } from "@filmset/auth/browser";
import type { Production, Scene } from "@filmset/core";
import {
  AppShell,
  Button,
  cn,
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
  Check,
  FileText,
  FolderOpen,
  HardHat,
  LayoutDashboard,
  ListTree,
  MapPin,
  Plus,
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
  userEmail?: string;
  production: Pick<Production, "id" | "name" | "phase">;
  scenes: Pick<Scene, "id" | "number" | "setName" | "dayNight" | "intExt" | "shootDayId">[];
}

export function Shell({ children, inspector, userEmail, production, scenes }: ShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [expanded, setExpanded] = React.useState(true);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [switcherOpen, setSwitcherOpen] = React.useState(false);
  const [productions, setProductions] = React.useState<MyProduction[] | null>(null);
  const [productionsLoading, setProductionsLoading] = React.useState(false);
  const [switching, setSwitching] = React.useState<string | null>(null);
  const [creatingOpen, setCreatingOpen] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const shortcuts = useKeyboardShortcutsOverlay();

  function openSwitcher() {
    setSwitcherOpen((open) => {
      const next = !open;
      if (next && productions === null && !productionsLoading) {
        setProductionsLoading(true);
        listMyProductions()
          .then(setProductions)
          .catch(() => setProductions([]))
          .finally(() => setProductionsLoading(false));
      }
      return next;
    });
  }

  async function onSwitch(productionId: string) {
    if (productionId === production.id) {
      setSwitcherOpen(false);
      return;
    }
    setSwitching(productionId);
    try {
      await switchActiveProduction(productionId);
    } finally {
      setSwitching(null);
      setSwitcherOpen(false);
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    const formData = new FormData();
    formData.set("name", newName);
    try {
      await createProduction(formData);
    } finally {
      setCreating(false);
    }
  }

  async function handleSignOut() {
    setUserMenuOpen(false);
    try {
      await getBrowserSupabase().auth.signOut();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : "PN";

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
    return scenes.find((s) => s.number === m[1]) ?? null;
  }, [query, scenes]);

  function go(href: string) {
    setPaletteOpen(false);
    router.push(href);
  }

  return (
    <div className="relative flex h-screen flex-col">
      <div className="min-h-0 flex-1">
        <AppShell
          globalBar={
            <GlobalBar
              productionName={production.name}
              phase={production.phase}
              notificationCount={3}
              userName={userEmail ?? "Priya Nair"}
              userInitials={initials}
              onOpenCommandPalette={() => setPaletteOpen(true)}
              onOpenProductionSwitcher={openSwitcher}
              onOpenUserMenu={() => setUserMenuOpen((open) => !open)}
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

      {switcherOpen && (
        <>
          <button
            type="button"
            aria-label="Close production switcher"
            className="fixed inset-0 z-[var(--fs-z-dropdown)] cursor-default"
            onClick={() => {
              setSwitcherOpen(false);
              setCreatingOpen(false);
            }}
          />
          <div className="fixed left-[var(--fs-space-16)] top-[52px] z-[var(--fs-z-dropdown)] w-[280px] rounded-md border border-[var(--color-border-standard)] bg-[var(--color-background-elevated)] p-[var(--fs-space-8)] shadow-[var(--fs-shadow-md)]">
            <p className="px-[var(--fs-space-8)] py-[4px] text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-tertiary)]">
              Productions
            </p>
            {productionsLoading && (
              <p className="px-[var(--fs-space-8)] py-[var(--fs-space-8)] text-[13px] text-[var(--color-text-tertiary)]">Loading…</p>
            )}
            {!productionsLoading && (
              <ul className="flex max-h-[240px] flex-col gap-[2px] overflow-y-auto">
                {(productions ?? []).map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => onSwitch(p.id)}
                      disabled={switching !== null}
                      className={cn(
                        "flex w-full items-center justify-between gap-[var(--fs-space-8)] rounded-[4px] px-[var(--fs-space-8)] py-[6px] text-left text-[13px] outline-none",
                        "hover:bg-[var(--color-background-surface)] focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]",
                        p.id === production.id ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]",
                      )}
                    >
                      <span className="truncate">{p.name}</span>
                      {p.id === production.id ? (
                        <Check className="size-[14px] shrink-0 text-[var(--color-action-primary)]" aria-hidden="true" />
                      ) : switching === p.id ? (
                        <span className="shrink-0 text-[11px] text-[var(--color-text-tertiary)]">Switching…</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-[var(--fs-space-8)] border-t border-[var(--color-border-subtle)] pt-[var(--fs-space-8)]">
              {creatingOpen ? (
                <form onSubmit={onCreate} className="flex flex-col gap-[var(--fs-space-8)]">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Production name"
                    className="h-[28px] rounded-[4px] border border-[var(--color-border-standard)] bg-[var(--color-background-surface)] px-[var(--fs-space-8)] text-[13px] text-[var(--color-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]"
                  />
                  <Button type="submit" loading={creating} disabled={creating || !newName.trim()}>
                    Create
                  </Button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setCreatingOpen(true)}
                  className="flex h-[32px] w-full items-center gap-[var(--fs-space-8)] rounded-[4px] px-[var(--fs-space-8)] text-left text-[13px] text-[var(--color-action-primary)] outline-none hover:bg-[var(--color-background-surface)] focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]"
                >
                  <Plus className="size-[14px]" aria-hidden="true" />
                  New production
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {userMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Close user menu"
            className="fixed inset-0 z-[var(--fs-z-dropdown)] cursor-default"
            onClick={() => setUserMenuOpen(false)}
          />
          <div className="fixed right-[var(--fs-space-16)] top-[52px] z-[var(--fs-z-dropdown)] w-[220px] rounded-md border border-[var(--color-border-standard)] bg-[var(--color-background-elevated)] p-[var(--fs-space-8)] shadow-[var(--fs-shadow-md)]">
            {userEmail && (
              <p className="truncate px-[var(--fs-space-8)] py-[4px] text-[12px] text-[var(--color-text-tertiary)]">{userEmail}</p>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              className="flex h-[32px] w-full items-center rounded-[4px] px-[var(--fs-space-8)] text-left text-[13px] text-[var(--color-status-danger)] outline-none hover:bg-[var(--color-background-surface)] focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]"
            >
              Sign out
            </button>
          </div>
        </>
      )}

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
