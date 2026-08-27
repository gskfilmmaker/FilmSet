import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@filmset/ui", "@filmset/tokens", "@filmset/core", "@filmset/db"],
  reactStrictMode: true,
};

export default nextConfig;
