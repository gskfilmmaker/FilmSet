import type { Meta, StoryObj } from "@storybook/react";
import { StatusBadge } from "../status-badge/status-badge";
import { Inspector, InspectorSection } from "./inspector";

const meta: Meta<typeof Inspector> = {
  title: "FRAME/Inspector",
  component: Inspector,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof Inspector>;

export const Scene: Story = {
  render: () => (
    <div style={{ height: "640px" }}>
      <Inspector objectType="Scene" title="Scene 47" subtitle="EXT. PAHARGANJ STREET — NIGHT" onClose={() => {}}>
        <InspectorSection label="Status">
          <StatusBadge tone="info">Scheduled</StatusBadge>
        </InspectorSection>
        <InspectorSection label="Pages">2 1/8 pages</InspectorSection>
        <InspectorSection label="Shoot Day">Day 18</InspectorSection>
        <InspectorSection label="Cast">
          <div className="flex flex-col gap-4">
            <span>Abraham</span>
            <span>Aisha</span>
          </div>
        </InspectorSection>
        <InspectorSection label="Location">Paharganj Street</InspectorSection>
        <InspectorSection label="Elements">17</InspectorSection>
        <InspectorSection label="Notes">4</InspectorSection>
      </Inspector>
    </div>
  ),
};
