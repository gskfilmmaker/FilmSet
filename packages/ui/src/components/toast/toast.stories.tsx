import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../button/button";
import { Toaster } from "./toaster";
import { toast } from "./use-toast";

const meta: Meta = {
  title: "FRAME/Toast",
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj;

export const Tones: Story = {
  render: () => (
    <>
      <div className="flex flex-wrap gap-[var(--fs-space-8)]">
        <Button
          variant="secondary"
          onClick={() =>
            toast({ tone: "success", title: "Call sheet published", description: "Day 18 — sent to 47 crew and cast." })
          }
        >
          Success
        </Button>
        <Button
          variant="secondary"
          onClick={() => toast({ tone: "warning", title: "Location permit expires soon", description: "Paharganj Street — expires before Day 18." })}
        >
          Warning
        </Button>
        <Button
          variant="secondary"
          onClick={() => toast({ tone: "danger", title: "Publish failed", description: "Schedule has an unresolved cast conflict." })}
        >
          Danger
        </Button>
        <Button variant="secondary" onClick={() => toast({ tone: "info", title: "Priya is editing Scene 47" })}>
          Info
        </Button>
      </div>
      <Toaster />
    </>
  ),
};
