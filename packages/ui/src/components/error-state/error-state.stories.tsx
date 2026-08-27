import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../button/button";
import { ErrorState } from "./error-state";

const meta: Meta<typeof ErrorState> = {
  title: "FRAME/ErrorState",
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj<typeof ErrorState>;

export const PermissionDenied: Story = {
  render: () => (
    <div className="w-[420px] border border-[var(--color-border-subtle)] rounded-lg">
      <ErrorState
        title="You don't have permission to publish this schedule."
        description="Ask the 1st AD or Production Administrator for publishing access."
        action={<Button variant="secondary">Request access</Button>}
        details={"403 Forbidden\nrequest_id: 8f2a-91cd\nrole: Crew"}
      />
    </div>
  ),
};
