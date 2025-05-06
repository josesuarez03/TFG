import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://localhost:8443/:path*',
      },
    ];
  },
  
};

export default nextConfig;