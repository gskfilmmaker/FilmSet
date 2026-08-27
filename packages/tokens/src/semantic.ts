import { danger, graphite, highContrast, info, signal, success, warning } from "./primitives";

export type ThemeName = "light" | "dark" | "high-contrast";
export type Density = "comfortable" | "compact";

export interface ColorTokens {
  background: {
    /** Deepest layer — app canvas, sidebar rests here. */
    canvas: string;
    /** Primary content surfaces — workspace panels, sidebar fill. */
    surface: string;
    /** Raised surfaces — inspector, cards, popovers, dropdowns, modal content. */
    elevated: string;
    /** Scrim behind modals/dialogs. */
    overlay: string;
  };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    inverse: string;
  };
  border: {
    subtle: string;
    standard: string;
    strong: string;
  };
  action: {
    primary: string;
    hover: string;
    active: string;
    /** Text/icon color for content placed directly on `action.primary` — kept distinct from `text.inverse` because the two don't always coincide (light mode needs white-on-signal at a darker signal step than the accent itself). */
    onPrimary: string;
  };
  status: {
    success: string;
    warning: string;
    danger: string;
    info: string;
  };
}

/**
 * Signature dark mode (§9). Layered graphite, never pure black. Depth comes
 * from contrast + borders + spacing, not heavy shadows. Tuned for readability
 * across 12-hour production days.
 */
const dark: ColorTokens = {
  background: {
    canvas: graphite[950],
    surface: graphite[900],
    elevated: graphite[850],
    overlay: "rgba(6, 7, 9, 0.64)",
  },
  text: {
    primary: graphite[75],
    secondary: graphite[300],
    tertiary: graphite[400],
    inverse: graphite[950],
  },
  border: {
    subtle: graphite[800],
    standard: graphite[700],
    strong: graphite[600],
  },
  action: {
    primary: signal[500],
    hover: signal[400],
    active: signal[600],
    onPrimary: graphite[950],
  },
  status: {
    success: success[400],
    warning: warning[400],
    danger: danger[400],
    info: info[400],
  },
};

/**
 * Light mode (§10). Independently optically tuned — not an inverted dark
 * theme. Brighter offices, printed-document comparison, finance workflows.
 */
const light: ColorTokens = {
  background: {
    canvas: graphite[50],
    surface: graphite[0],
    elevated: graphite[0],
    overlay: "rgba(15, 17, 20, 0.4)",
  },
  text: {
    primary: graphite[900],
    secondary: graphite[600],
    // Lighter than secondary — in light mode "recedes toward the
    // background" means lighter, not darker. graphite[400] (used pre-audit)
    // only clears 4.5:1 against elevated dark surfaces, not near-white ones;
    // graphite[500] clears both directions. See a11y-tests/frame.spec.ts.
    tertiary: graphite[500],
    inverse: graphite[0],
  },
  border: {
    subtle: graphite[100],
    standard: graphite[150],
    strong: graphite[300],
  },
  action: {
    // One step darker than the dark-theme accent so white on-primary text
    // clears 4.5:1 (signal[500] + white measured 3.91:1 — audit finding).
    primary: signal[600],
    hover: signal[700],
    active: signal[800],
    onPrimary: graphite[0],
  },
  status: {
    // 700, not 600 — 600 measured 3.58–4.37:1 against the ~10%-tint chip
    // background StatusBadge composites to; 700 clears 4.5:1. Danger was
    // already fine at 600 and is left as-is.
    success: success[700],
    warning: warning[700],
    danger: danger[600],
    info: info[700],
  },
};

/**
 * High Contrast (§8). Maximizes separation for low-vision and high-glare
 * (bright exterior set) use. Pure black/white base, strong borders replace
 * subtle-gray hierarchy, saturated status colors.
 */
const highContrastTheme: ColorTokens = {
  background: {
    canvas: "#000000",
    surface: "#000000",
    elevated: "#0D0D0D",
    overlay: "rgba(0, 0, 0, 0.8)",
  },
  text: {
    primary: "#FFFFFF",
    secondary: "#E6E6E6",
    tertiary: "#C4C4C4",
    inverse: "#000000",
  },
  border: {
    subtle: "#6B6B6B",
    standard: "#9A9A9A",
    strong: "#FFFFFF",
  },
  action: {
    primary: highContrast.signal,
    hover: highContrast.signalHover,
    active: highContrast.signalActive,
    onPrimary: "#000000",
  },
  status: {
    success: highContrast.success,
    warning: highContrast.warning,
    danger: highContrast.danger,
    info: highContrast.info,
  },
};

export const themes: Record<ThemeName, ColorTokens> = {
  dark,
  light,
  "high-contrast": highContrastTheme,
};

/** 4px base unit (§14). Do not invent one-off values without justification. */
export const spacing = {
  0: "0px",
  2: "2px",
  4: "4px",
  8: "8px",
  12: "12px",
  16: "16px",
  20: "20px",
  24: "24px",
  32: "32px",
  40: "40px",
  48: "48px",
  64: "64px",
} as const;

export const radius = {
  none: "0px",
  sm: "4px",
  md: "6px",
  lg: "8px",
  xl: "12px",
  full: "9999px",
} as const;

export const typography = {
  fontFamily: {
    ui: 'Inter, "Inter Placeholder", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  },
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  // role: [fontSize, lineHeight, weight, letterSpacing?]
  role: {
    display: { size: "28px", lineHeight: "36px", weight: 600 },
    pageTitle: { size: "22px", lineHeight: "28px", weight: 600 },
    sectionHeading: { size: "16px", lineHeight: "22px", weight: 600 },
    subheading: { size: "14px", lineHeight: "20px", weight: 500 },
    body: { size: "14px", lineHeight: "20px", weight: 400 },
    uiLabel: { size: "13px", lineHeight: "16px", weight: 500 },
    caption: { size: "12px", lineHeight: "16px", weight: 400 },
    metadata: { size: "12px", lineHeight: "16px", weight: 400, tabularNums: true },
    numeric: { size: "14px", lineHeight: "20px", weight: 500, tabularNums: true },
    code: { size: "13px", lineHeight: "20px", weight: 400, family: "mono" },
  },
} as const;

export const shadow = {
  none: "none",
  sm: "0 1px 2px rgba(11, 13, 15, 0.06)",
  md: "0 2px 8px rgba(11, 13, 15, 0.10)",
  lg: "0 8px 24px rgba(11, 13, 15, 0.16)",
} as const;

export const opacity = {
  disabled: 0.45,
  hoverOverlay: 0.06,
  activeOverlay: 0.1,
  backdrop: 0.5,
} as const;

/** 120–240ms (§34). Motion communicates state; never ornamental. */
export const motion = {
  duration: {
    instant: "100ms",
    fast: "150ms",
    base: "200ms",
    slow: "240ms",
  },
  easing: {
    standard: "cubic-bezier(0.2, 0, 0, 1)",
    enter: "cubic-bezier(0, 0, 0.2, 1)",
    exit: "cubic-bezier(0.4, 0, 1, 1)",
  },
} as const;

/** Density is a feature (§15) — components take these, never fork. */
export const controlHeight = {
  comfortable: "36px",
  compact: "28px",
} as const;

export const tableRow = {
  comfortable: "40px",
  compact: "32px",
} as const;

export const panelWidth = {
  sidebarExpanded: "248px",
  sidebarCollapsed: "56px",
  inspectorDefault: "340px",
  inspectorWide: "420px",
} as const;

export const zIndex = {
  base: 0,
  sticky: 10,
  dropdown: 20,
  overlay: 30,
  modal: 40,
  toast: 50,
  tooltip: 60,
} as const;
