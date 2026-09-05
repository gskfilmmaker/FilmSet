import type { Meta, StoryObj } from "@storybook/react";
import { GlobalBar } from "./global-bar";

const meta: Meta<typeof GlobalBar> = {
  title: "FRAME/GlobalBar",
  component: GlobalBar,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof GlobalBar>;

export const Default: Story = {
  args: {
    productionName: "THE BAND",
    phase: "Production",
    notificationCount: 3,
    userName: "Priya Nair",
    userInitials: "PN",
    onOpenCommandPalette: () => {},
  },
};

export const NoNotifications: Story = {
  args: {
    ...Default.args,
    notificationCount: 0,
  },
};

/** The mobile nav entry point — only rendered (lg:hidden) when `onOpenMobileNav` is passed, since the persistent Sidebar is desktop-only. View this story at a narrow viewport. */
export const MobileWithHamburger: Story = {
  args: {
    ...Default.args,
    onOpenMobileNav: () => {},
  },
};
