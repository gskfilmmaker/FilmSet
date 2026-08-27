import type { Meta, StoryObj } from "@storybook/react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "./button";

const meta: Meta<typeof Button> = {
  title: "FRAME/Button",
  component: Button,
  parameters: { layout: "centered" },
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "tertiary", "quiet", "destructive"],
    },
  },
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Hierarchy: Story = {
  render: () => (
    <div className="flex gap-16">
      <Button variant="primary">Publish Schedule</Button>
      <Button variant="secondary">Save Draft</Button>
      <Button variant="tertiary">Compare</Button>
      <Button variant="quiet">Dismiss</Button>
      <Button variant="destructive">Remove Location</Button>
    </div>
  ),
};

export const WithIcon: Story = {
  render: () => (
    <div className="flex gap-16">
      <Button icon={<Plus className="size-[14px]" aria-hidden="true" />}>Add Scene</Button>
      <Button variant="destructive" icon={<Trash2 className="size-[14px]" aria-hidden="true" />}>
        Delete
      </Button>
    </div>
  ),
};

export const IconOnly: Story = {
  render: () => (
    <Button variant="tertiary" iconOnly aria-label="Add scene" icon={<Plus className="size-[14px]" aria-hidden="true" />} />
  ),
};

export const States: Story = {
  render: () => (
    <div className="flex gap-16">
      <Button>Default</Button>
      <Button loading>Loading</Button>
      <Button disabled>Disabled</Button>
    </div>
  ),
};

export const Density: Story = {
  render: () => (
    <div className="flex items-center gap-16">
      <div data-density="comfortable" className="flex gap-8">
        <Button>Comfortable</Button>
      </div>
      <div data-density="compact" className="flex gap-8">
        <Button>Compact</Button>
      </div>
    </div>
  ),
};
