import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  webpack: (config) => {
    // pdf.js worker
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
