import { existsSync } from "node:fs";
import path from "node:path";
import { parseEnv, webEnvSchema } from "@catafy/types";
import type { NextConfig } from "next";

// Single .env at the monorepo root, shared with the API.
const rootEnvFile = path.resolve(process.cwd(), "../../.env");
if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

const env = parseEnv(webEnvSchema, process.env);
const r2 = new URL(env.R2_PUBLIC_BASE_URL);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Lint runs as its own turbo task.
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      {
        protocol: r2.protocol === "http:" ? "http" : "https",
        hostname: r2.hostname,
        port: r2.port,
        pathname: `${r2.pathname.replace(/\/$/, "")}/**`,
      },
    ],
  },
  // The browser only ever talks to this origin; Express sits behind it. This keeps auth cookies
  // first-party and removes the need for CORS / COOKIE_DOMAIN / CSRF tokens.
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${env.API_INTERNAL_URL}/api/v1/:path*` }];
  },
};

export default nextConfig;
