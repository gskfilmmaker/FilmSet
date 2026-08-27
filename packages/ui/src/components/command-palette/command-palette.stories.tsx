import type { Meta, StoryObj } from "@storybook/react";
import {
  CalendarDays,
  FileText,
  LayoutDashboard,
  ListTree,
  MapPin,
  Sparkles,
} from "lucide-react";
import * as React from "react";
import { Button } from "../button/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "./command-palette";

const meta: Meta = {
  title: "FRAME/CommandPalette",
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj;

const modules = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, shortcut: "G O" },
  { id: "script", label: "Script", icon: FileText, shortcut: "G S" },
  { id: "breakdown", label: "Breakdown", icon: ListTree, shortcut: "G B" },
  { id: "schedule", label: "Schedule", icon: CalendarDays, shortcut: "G C" },
  { id: "locations", label: "Locations", icon: MapPin },
];

/** Reproduces the Constitution §19 walkthrough: typing "scene 47" surfaces the scene with its contextual actions. */
function Demo() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const matchesScene47 = /scene\s*47|^47$/i.test(query.trim());

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Open ⌘K
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search or run a command…" value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>No results for "{query}".</CommandEmpty>

          {matchesScene47 && (
            <>
              <CommandGroup heading="Scene 47 — Paharganj Street, Night">
                <CommandItem value="scene-47-open" onSelect={() => setOpen(false)}>
                  Open Scene
                </CommandItem>
                <CommandItem value="scene-47-breakdown" onSelect={() => setOpen(false)}>
                  Open Breakdown
                </CommandItem>
                <CommandItem value="scene-47-stripboard" onSelect={() => setOpen(false)}>
                  Show in Stripboard
                </CommandItem>
                <CommandItem value="scene-47-shootday" onSelect={() => setOpen(false)}>
                  Show Shoot Day
                </CommandItem>
                <CommandItem value="scene-47-ai" onSelect={() => setOpen(false)}>
                  <Sparkles className="size-[14px] text-[var(--color-action-primary)]" aria-hidden="true" />
                  Ask FilmSet AI about Scene 47
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          <CommandGroup heading="Navigate">
            {modules.map((m) => (
              <CommandItem key={m.id} value={m.label} onSelect={() => setOpen(false)}>
                <m.icon className="size-[14px] text-[var(--color-text-tertiary)]" aria-hidden="true" />
                {m.label}
                {m.shortcut && <CommandShortcut>{m.shortcut}</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />
          <CommandGroup heading="FilmSet AI">
            <CommandItem value="ask-ai" onSelect={() => setOpen(false)}>
              <Sparkles className="size-[14px] text-[var(--color-action-primary)]" aria-hidden="true" />
              Ask FilmSet AI: "{query || "What's at risk this week?"}"
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

export const Default: Story = { render: () => <Demo /> };
