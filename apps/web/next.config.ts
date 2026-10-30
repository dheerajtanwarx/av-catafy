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
  // Lets a production build/test run alongside `next dev` without sharing .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  // Put metadata in <head> for every client instead of streaming it to "non-bots". Link previews
  // (title, image, price) are how this store is shared, and a preview fetcher missing from
  // Next's bot list would otherwise see none. The metadata reads the same cached data as the page.
  htmlLimitedBots: /.*/,
  env: {
    // Needed client-side to build image URLs from stored R2 keys.
    NEXT_PUBLIC_R2_PUBLIC_BASE_URL: env.R2_PUBLIC_BASE_URL.replace(/\/+$/, ""),
  },
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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Nothing here is meant to be framed (clickjacking on the admin in particular).
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  // The browser only ever talks to this origin; Express sits behind it. This keeps auth cookies
  // first-party and removes the need for CORS / COOKIE_DOMAIN / CSRF tokens.
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${env.API_INTERNAL_URL}/api/v1/:path*` }];
  },
};

export default nextConfig;
