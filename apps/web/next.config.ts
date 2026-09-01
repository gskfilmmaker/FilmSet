import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@filmset/ui", "@filmset/tokens", "@filmset/core", "@filmset/db"],
  reactStrictMode: true,
  // pdf-parse's package.json "exports" map lists a "browser" condition before
  // "node"/"import" — webpack's default server bundling picks that browser
  // build and inlines it into the server chunk, where it throws
  // "DOMMatrix is not defined" (a canvas/browser-only global) the moment the
  // module loads, breaking every page that references the import pipeline
  // (cast/crew/locations/script), not just PDF uploads. Marking it (and its
  // native/document-parsing dependencies) external makes Next use Node's own
  // require() at runtime instead, which resolves the correct "node" build.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas", "mammoth"],
  eslint: {
    // CI (see .github/workflows/ci.yml) already runs `pnpm lint` as its own,
    // separately-reported step — this repo had no ESLint config at all
    // until P0B added apps/web/.eslintrc.json, so `next build` re-running
    // lint here would newly couple the build's pass/fail to lint findings
    // (including the two pre-existing, unrelated findings reported in P0B's
    // PR description) instead of keeping Lint and Build as distinct checks.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
