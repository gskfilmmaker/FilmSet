import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../button/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./dialog";

const meta: Meta<typeof Dialog> = {
  title: "FRAME/Dialog",
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj<typeof Dialog>;

export const DestructiveConfirmation: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive">Remove location</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove Paharganj Street?</DialogTitle>
          <DialogDescription>
            This affects 14 scenes and 3 scheduled shoot days. Scenes will lose their location
            assignment; shoot days will need a new location before they can be published.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button variant="destructive">Remove location</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
