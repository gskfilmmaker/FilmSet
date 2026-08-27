import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../button/button";
import { Input } from "../input/input";
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "./drawer";

const meta: Meta<typeof Drawer> = {
  title: "FRAME/Drawer",
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj<typeof Drawer>;

export const CreateLocation: Story = {
  render: () => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button>New location</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>New Location</DrawerTitle>
          <DrawerDescription>Add a location to the production graph.</DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-[var(--fs-space-16)]">
          <Input label="Location name" placeholder="Paharganj Street" />
          <Input label="Address" placeholder="Paharganj, New Delhi" />
        </DrawerBody>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DrawerClose>
          <Button>Create location</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  ),
};
