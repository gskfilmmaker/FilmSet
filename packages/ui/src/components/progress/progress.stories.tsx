import type { Meta, StoryObj } from "@storybook/react";
import { Progress } from "./progress";

const meta: Meta<typeof Progress> = {
  title: "FRAME/Progress",
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj<typeof Progress>;

export const Determinate: Story = {
  render: () => (
    <div className="w-[320px]">
      <Progress value={72} label="Analyzing screenplay" />
    </div>
  ),
};

export const Indeterminate: Story = {
  render: () => (
    <div className="w-[320px]">
      <Progress label="Publishing call sheet" />
    </div>
  ),
};
