import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { Button } from "../button/button";
import { KeyboardShortcutsOverlay, useKeyboardShortcutsOverlay } from "./keyboard-shortcuts-overlay";

const meta: Meta<typeof KeyboardShortcutsOverlay> = {
  title: "FRAME/KeyboardShortcutsOverlay",
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj<typeof KeyboardShortcutsOverlay>;

export const Default: Story = {
  render: () => {
    const { open, setOpen } = useKeyboardShortcutsOverlay();
    return (
      <>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Show shortcuts (or press ?)
        </Button>
        <KeyboardShortcutsOverlay open={open} onOpenChange={setOpen} />
      </>
    );
  },
};
