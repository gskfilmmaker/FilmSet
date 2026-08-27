import type { Meta, StoryObj } from "@storybook/react";
import { Plus } from "lucide-react";
import { Button } from "../button/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

const meta: Meta<typeof Tooltip> = {
  title: "FRAME/Tooltip",
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj<typeof Tooltip>;

export const Default: Story = {
  render: () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="tertiary" iconOnly aria-label="Add scene" icon={<Plus className="size-[14px]" aria-hidden="true" />} />
        </TooltipTrigger>
        <TooltipContent>Add scene</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
};
