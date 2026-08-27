import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  external: ["react", "react-dom"],
  // Every FRAME component is interactive UI meant to run in the browser —
  // the whole package is a client boundary for Next.js App Router consumers.
  // tsup bundles all exports into one file and drops per-file "use client"
  // directives in the process, so it has to be re-added at the bundle level.
  banner: { js: '"use client";' },
});
