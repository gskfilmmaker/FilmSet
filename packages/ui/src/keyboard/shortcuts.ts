/**
 * Canonical keyboard shortcut registry (§42) — designed and documented
 * up front, not improvised per screen. This is the single source both the
 * shortcut overlay and any future real keybinding wiring should read from.
 *
 * Conventions:
 * - `⌘K` / `Ctrl+K` — universal search/command (§19), never reassigned.
 * - `G then <letter>` — "go to" navigation, chorded to stay out of typing's way.
 * - `?` — open this overlay, from anywhere text isn't focused.
 * - `Esc` — close the topmost inspector/overlay/dialog; never destroys data.
 * - Single letters are reserved for the most frequent, least destructive
 *   actions in a given surface; anything irreversible always requires a
 *   confirmation regardless of how it's triggered (§38).
 */
export interface ShortcutEntry {
  keys: string[];
  description: string;
}

export interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutEntry[];
}

export const shortcutGroups: ShortcutGroup[] = [
  {
    title: "Global",
    shortcuts: [
      { keys: ["⌘", "K"], description: "Search or run a command" },
      { keys: ["?"], description: "Show keyboard shortcuts" },
      { keys: ["Esc"], description: "Close inspector, overlay, or dialog" },
      { keys: ["/"], description: "Focus contextual search, where available" },
    ],
  },
  {
    title: "Navigate",
    shortcuts: [
      { keys: ["G", "O"], description: "Go to Overview" },
      { keys: ["G", "S"], description: "Go to Script" },
      { keys: ["G", "B"], description: "Go to Breakdown" },
      { keys: ["G", "C"], description: "Go to Schedule" },
      { keys: ["G", "A"], description: "Go to Cast" },
    ],
  },
  {
    title: "Sidebar",
    shortcuts: [
      { keys: ["↑", "↓"], description: "Move between sidebar items" },
      { keys: ["Home", "End"], description: "Jump to first or last sidebar item" },
    ],
  },
  {
    title: "Tables",
    shortcuts: [
      { keys: ["↑", "↓"], description: "Move between rows" },
      { keys: ["Enter"], description: "Open the focused row" },
      { keys: ["Space"], description: "Toggle row selection" },
    ],
  },
];
