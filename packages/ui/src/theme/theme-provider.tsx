"use client";

import * as React from "react";

export type ThemeName = "light" | "dark" | "high-contrast";
export type Density = "comfortable" | "compact";

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  density: Density;
  setDensity: (density: Density) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

const THEME_STORAGE_KEY = "filmset-theme";
const DENSITY_STORAGE_KEY = "filmset-density";

export interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemeName;
  defaultDensity?: Density;
}

/**
 * Applies theme + density entirely through data attributes consumed by
 * generated token CSS. No component ever forks per theme or density —
 * see Constitution §8 and §15.
 */
export function ThemeProvider({
  children,
  defaultTheme = "dark",
  defaultDensity = "comfortable",
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<ThemeName>(defaultTheme);
  const [density, setDensityState] = React.useState<Density>(defaultDensity);

  React.useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeName | null;
    const storedDensity = window.localStorage.getItem(DENSITY_STORAGE_KEY) as Density | null;
    if (storedTheme) setThemeState(storedTheme);
    if (storedDensity) setDensityState(storedDensity);
  }, []);

  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  React.useEffect(() => {
    document.documentElement.setAttribute("data-density", density);
    window.localStorage.setItem(DENSITY_STORAGE_KEY, density);
  }, [density]);

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: setThemeState,
      density,
      setDensity: setDensityState,
    }),
    [theme, density],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
