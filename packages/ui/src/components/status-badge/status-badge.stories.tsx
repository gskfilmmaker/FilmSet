import type { Meta, StoryObj } from "@storybook/react";
import { StatusBadge } from "./status-badge";

const meta: Meta<typeof StatusBadge> = {
  title: "FRAME/StatusBadge",
  component: StatusBadge,
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj<typeof StatusBadge>;

export const ProductionStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-[var(--fs-space-8)]">
      <StatusBadge tone="info">Draft</StatusBadge>
      <StatusBadge tone="warning">Review</StatusBadge>
      <StatusBadge tone="success">Approved</StatusBadge>
      <StatusBadge tone="success">Published</StatusBadge>
      <StatusBadge tone="neutral">Locked</StatusBadge>
      <StatusBadge tone="neutral">Superseded</StatusBadge>
      <StatusBadge tone="info">Scheduled</StatusBadge>
      <StatusBadge tone="success">Shot</StatusBadge>
      <StatusBadge tone="neutral">Omitted</StatusBadge>
      <StatusBadge tone="warning">Pickup</StatusBadge>
      <StatusBadge tone="danger">Reshoot</StatusBadge>
    </div>
  ),
};

export const AllTones: Story = {
  render: () => (
    <div className="flex flex-wrap gap-[var(--fs-space-8)]">
      <StatusBadge tone="success">Success</StatusBadge>
      <StatusBadge tone="warning">Warning</StatusBadge>
      <StatusBadge tone="danger">Danger</StatusBadge>
      <StatusBadge tone="info">Info</StatusBadge>
      <StatusBadge tone="neutral">Neutral</StatusBadge>
    </div>
  ),
};
