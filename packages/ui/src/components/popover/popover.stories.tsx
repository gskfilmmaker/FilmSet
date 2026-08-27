import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../button/button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

const meta: Meta<typeof Popover> = {
  title: "FRAME/Popover",
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj<typeof Popover>;

export const Default: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary">Quick note</Button>
      </PopoverTrigger>
      <PopoverContent>
        <p className="font-medium text-[var(--color-text-primary)]">Add a note to Scene 47</p>
        <p className="mt-[var(--fs-space-4)] text-[var(--color-text-secondary)]">Notes are visible to the whole department.</p>
      </PopoverContent>
    </Popover>
  ),
};
