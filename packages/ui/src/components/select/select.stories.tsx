import type { Meta, StoryObj } from "@storybook/react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "./select";

const meta: Meta<typeof Select> = {
  title: "FRAME/Select",
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj<typeof Select>;

export const Default: Story = {
  render: () => (
    <Select defaultValue="int">
      <SelectTrigger className="w-[220px]" aria-label="Scene type">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="int">INT</SelectItem>
        <SelectItem value="ext">EXT</SelectItem>
        <SelectItem value="int-ext">INT/EXT</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const Grouped: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-[220px]" aria-label="Assign shoot day">
        <SelectValue placeholder="Select a shoot day" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Week 3</SelectLabel>
          <SelectItem value="day-17">Day 17 — Old Delhi</SelectItem>
          <SelectItem value="day-18">Day 18 — Paharganj Street</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Week 4</SelectLabel>
          <SelectItem value="day-19">Day 19 — Studio A</SelectItem>
          <SelectItem value="day-20" disabled>
            Day 20 — Unconfirmed
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
};
