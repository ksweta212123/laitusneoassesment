import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships a WASM binary that must be loaded from node_modules at
  // runtime rather than bundled. It is only used when DATABASE_URL is unset.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
