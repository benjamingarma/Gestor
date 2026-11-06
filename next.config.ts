import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sin "cacheComponents": en una app de dinero preferimos que cada pantalla se arme
  // con los datos del momento, sin cachés que puedan mostrar saldos viejos.
  // Ver docs/decisiones/modulo-1.0.md.
  poweredByHeader: false,
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
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
