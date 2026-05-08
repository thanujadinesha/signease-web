/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  webpack: (config) => {
    // Suppress pdfjs canvas optional dependency warning
    config.resolve.alias.canvas = false;
    // Allow pdfjs legacy CJS build
    config.resolve.alias['pdfjs-dist'] = 'pdfjs-dist/legacy/build/pdf.js';
    return config;
  },
};

export default nextConfig;
