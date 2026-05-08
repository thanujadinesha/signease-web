/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  webpack: (config) => {
    // Suppress pdfjs canvas optional dependency warning
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
