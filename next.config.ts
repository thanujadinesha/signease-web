import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',   // needed for Docker multi-stage build
  webpack: (config) => {
    // pdf.js worker
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
