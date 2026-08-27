import type { Decorator, Preview } from "@storybook/react";
import * as React from "react";
import "../src/styles.css";

const themes = {
  Dark: "dark",
  Light: "light",
  "High Contrast": "high-contrast",
} as const;

const densities = {
  Comfortable: "comfortable",
  Compact: "compact",
} as const;

export const globalTypes = {
  theme: {
    name: "Theme",
    description: "FRAME theme",
    defaultValue: "dark",
    toolbar: {
      icon: "mirror",
      items: Object.entries(themes).map(([title, value]) => ({ value, title })),
      dynamicTitle: true,
    },
  },
  density: {
    name: "Density",
    description: "FRAME density",
    defaultValue: "comfortable",
    toolbar: {
      icon: "ruler",
      items: Object.entries(densities).map(([title, value]) => ({ value, title })),
      dynamicTitle: true,
    },
  },
};

const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme ?? "dark";
  const density = context.globals.density ?? "comfortable";

  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-density", density);
  }, [theme, density]);

  return (
    <div
      data-theme={theme}
      data-density={density}
      style={{ background: "var(--color-background-canvas)", minHeight: "100%", color: "var(--color-text-primary)" }}
    >
      <Story />
    </div>
  );
};

const preview: Preview = {
  decorators: [withTheme],
  parameters: {
    layout: "centered",
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: { test: "todo" },
    backgrounds: { disable: true },
  },
};

export default preview;
