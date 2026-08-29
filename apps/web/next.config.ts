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
};

export default nextConfig;
