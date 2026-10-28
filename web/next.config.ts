import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { apiContentSecurityPolicy, securityHeaders } from "./src/lib/security/headers";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// cacheComponents (Partial Prerendering) is off: it is incompatible with
// per-request CSP nonces. Data is cached by tag in the data layer instead.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: [...securityHeaders] },
      {
        source: "/api/:path*",
        headers: [
          { key: "Content-Security-Policy", value: apiContentSecurityPolicy },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
