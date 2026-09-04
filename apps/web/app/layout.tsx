import { Toaster, ThemeProvider } from "@filmset/ui";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "FilmSet™ — The Operating System for Filmmaking",
  description: "FilmSet is the operating system for filmmaking — script, schedule, cast, crew, and call sheets in one place. A product of GSK Productions Inc.",
  applicationName: "FilmSet",
  authors: [{ name: "GSK Productions Inc.", url: "https://www.gskproductions.ca" }],
  creator: "GSK Productions Inc.",
  publisher: "GSK Productions Inc.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark" data-density="comfortable" suppressHydrationWarning>
      <body>
        <ThemeProvider defaultTheme="dark" defaultDensity="comfortable">
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
