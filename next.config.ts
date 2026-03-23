import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // turbopack: {} silences the Turbopack/webpack conflict warning
  experimental: {
    turbo: {},
  },
};

export default nextConfig;
