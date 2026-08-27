import type { Meta, StoryObj } from "@storybook/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

const meta: Meta<typeof Tabs> = {
  title: "FRAME/Tabs",
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj<typeof Tabs>;

export const LocationForm: Story = {
  render: () => (
    <Tabs defaultValue="overview" className="w-[480px]">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="address">Address</TabsTrigger>
        <TabsTrigger value="contacts">Contacts</TabsTrigger>
        <TabsTrigger value="permits">Permits</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="text-[13px] text-[var(--color-text-secondary)]">
        General location details — name, type, description.
      </TabsContent>
      <TabsContent value="address" className="text-[13px] text-[var(--color-text-secondary)]">
        Street address, city, coordinates.
      </TabsContent>
      <TabsContent value="contacts" className="text-[13px] text-[var(--color-text-secondary)]">
        Location manager and on-site contacts.
      </TabsContent>
      <TabsContent value="permits" className="text-[13px] text-[var(--color-text-secondary)]">
        Filming permit status and expiry.
      </TabsContent>
    </Tabs>
  ),
};
