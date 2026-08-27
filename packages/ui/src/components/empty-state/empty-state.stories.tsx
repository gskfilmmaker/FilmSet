import type { Meta, StoryObj } from "@storybook/react";
import { FileText } from "lucide-react";
import { Button } from "../button/button";
import { EmptyState } from "./empty-state";

const meta: Meta<typeof EmptyState> = {
  title: "FRAME/EmptyState",
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj<typeof EmptyState>;

export const NoScenes: Story = {
  render: () => (
    <div className="w-[420px] border border-[var(--color-border-subtle)] rounded-lg">
      <EmptyState
        icon={<FileText className="size-full" />}
        title="No scenes yet"
        description="Import a screenplay to create scenes and begin your production breakdown."
        action={<Button>Import Screenplay</Button>}
        secondaryAction={<Button variant="quiet">Start empty</Button>}
      />
    </div>
  ),
};
