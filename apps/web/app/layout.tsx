import { ThemeProvider } from "@filmset/ui";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "FilmSet — The Operating System for Filmmaking",
  description: "FRAME design system prototype shell.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark" data-density="comfortable" suppressHydrationWarning>
      <body>
        <ThemeProvider defaultTheme="dark" defaultDensity="comfortable">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
