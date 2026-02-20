import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  ...(isDev ? ["'unsafe-eval'"] : []),
  "https://accounts.google.com",
  "https://apis.google.com",
].join(" ");

const connectSrc = [
  "'self'",
  "https:",
  "wss:",
  "ws:",
  ...(isDev
    ? [
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:5000",
        "http://127.0.0.1:5000",
      ]
    : []),
].join(" ");

const styleSrc = [
  "'self'",
  "'unsafe-inline'",
  "https://accounts.google.com",
].join(" ");

const csp = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  `connect-src ${connectSrc}`,
  "img-src 'self' data: https:",
  `style-src ${styleSrc}`,
  `style-src-elem ${styleSrc}`,
  "frame-src 'self' https://accounts.google.com",
].join("; ");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://localhost:8443/:path*',
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            value: csp,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
