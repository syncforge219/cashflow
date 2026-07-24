import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  compress: true,
  experimental: {
    optimizePackageImports: ["framer-motion", "exceljs", "file-saver"],
  },
};

export default nextConfig;
