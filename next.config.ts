import type { NextConfig } from "next";

import {
  getApiCacheHeaders,
  getSecurityHeaders,
} from "./src/lib/security-headers";

const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit"],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: getSecurityHeaders(isProduction),
      },
      {
        source: "/api/:path*",
        headers: getApiCacheHeaders(),
      },
    ];
  },
};

export default nextConfig;
