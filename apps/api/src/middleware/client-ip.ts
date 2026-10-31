import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import type { RequestHandler } from "express";

/** Set by the Next.js middleware on every proxied /api/v1 request. */
export const CLIENT_IP_HEADER = "x-catafy-client-ip";
export const PROXY_SECRET_HEADER = "x-catafy-proxy-secret";

function matches(provided: string | undefined, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The buyer's IP, for rate limiting only (never stored). Browsers reach Express through the
 * Next.js rewrite, which doesn't forward the client address, so without this every buyer would
 * share one rate-limit bucket. The forwarded address is trusted only alongside the shared secret,
 * so a request sent straight to the API can't pick its own IP.
 */
export function clientIp(secret: string): RequestHandler {
  return (req, _res, next) => {
    const forwarded = req.get(CLIENT_IP_HEADER)?.trim();
    req.clientIp =
      forwarded && isIP(forwarded) && matches(req.get(PROXY_SECRET_HEADER), secret)
        ? forwarded
        : (req.ip ?? "unknown");
    next();
  };
}
