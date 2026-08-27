import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { Button } from "../button/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "./dropdown-menu";

const meta: Meta<typeof DropdownMenu> = {
  title: "FRAME/DropdownMenu",
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj<typeof DropdownMenu>;

export const SceneActions: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary">Scene actions</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Scene 47</DropdownMenuLabel>
        <DropdownMenuItem>
          Open breakdown
          <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>Show in stripboard</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive>Remove from schedule</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

export const CheckboxAndRadio: Story = {
  render: () => {
    const [showOmitted, setShowOmitted] = React.useState(false);
    const [group, setGroup] = React.useState("day");
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary">View options</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem checked={showOmitted} onCheckedChange={setShowOmitted}>
            Show omitted scenes
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Group by</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={group} onValueChange={setGroup}>
            <DropdownMenuRadioItem value="day">Shoot day</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="location">Location</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="unit">Unit</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
};
