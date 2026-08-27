import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./input";

const meta: Meta<typeof Input> = {
  title: "FRAME/Input",
  component: Input,
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: { label: "Location name", placeholder: "Paharganj Street" },
};

export const WithDescription: Story = {
  args: {
    label: "Call time",
    placeholder: "06:00",
    description: "Local time at the shoot location.",
  },
};

export const ErrorState: Story = {
  args: {
    label: "Location permit expiry",
    defaultValue: "06/12/2026",
    error: "This permit expires before the scheduled shoot day.",
  },
};

export const Numeric: Story = {
  args: { label: "Estimated cost", defaultValue: "84,200", numeric: true },
};

export const Disabled: Story = {
  args: { label: "Production code", defaultValue: "THE-BAND-01", disabled: true },
};

export const Density: Story = {
  render: () => (
    <div className="flex items-end gap-16">
      <div data-density="comfortable">
        <Input label="Comfortable" placeholder="36px" />
      </div>
      <div data-density="compact">
        <Input label="Compact" placeholder="28px" />
      </div>
    </div>
  ),
};
