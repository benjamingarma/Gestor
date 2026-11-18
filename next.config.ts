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
  // Ruta vieja del cobro (antes del módulo 1.7). Se redirige acá y no desde una página: así la redirección es inmediata
  // y no pasa por la pantalla de carga de la ficha del cliente. Los parámetros (?importe=, ?venta=) se conservan.
  async redirects() {
    return [{ source: "/clientes/:id/cobrar", destination: "/cobrar/:id", permanent: false }];
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
