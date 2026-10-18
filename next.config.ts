import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 es un módulo nativo: Next no debe empaquetarlo.
  serverExternalPackages: ["better-sqlite3"],
  // La raíz del proyecto es esta carpeta, aunque haya otro package-lock.json más arriba.
  turbopack: { root: __dirname },
};

export default nextConfig;
