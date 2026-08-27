import type { Meta, StoryObj } from "@storybook/react";
import { Skeleton } from "./skeleton";

const meta: Meta<typeof Skeleton> = {
  title: "FRAME/Skeleton",
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj<typeof Skeleton>;

export const SceneListRow: Story = {
  render: () => (
    <div className="flex w-[360px] flex-col gap-[var(--fs-space-12)]">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-[var(--fs-space-12)]">
          <Skeleton className="size-[32px] shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-[var(--fs-space-8)]">
            <Skeleton className="h-[12px] w-[70%]" />
            <Skeleton className="h-[10px] w-[45%]" />
          </div>
        </div>
      ))}
    </div>
  ),
};
