import { SESSION_COOKIE } from "@catafy/types";
import type { RequestHandler } from "express";
import { AppError } from "../lib/errors.js";
import { verifySession } from "../lib/session.js";

export function requireAuth(jwtSecret: string): RequestHandler {
  return async (req, _res, next) => {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    const user = await verifySession(typeof token === "string" ? token : undefined, jwtSecret);
    if (!user) throw AppError.unauthorized();
    req.user = user;
    next();
  };
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defence for cookie-authenticated mutations: browsers always send Origin on cross-site
 * POST/PUT/PATCH/DELETE, so requiring it to match the web origin blocks forged requests.
 * Combined with the sameSite=lax cookie this replaces a CSRF token.
 */
export function requireSameOrigin(webOrigin: string): RequestHandler {
  const allowed = new URL(webOrigin).origin;
  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();
    const origin = req.headers.origin ?? originOf(req.headers.referer);
    if (origin !== allowed) throw AppError.forbidden("Cross-origin request rejected");
    next();
  };
}

function originOf(referer: string | undefined): string | undefined {
  if (!referer) return undefined;
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}
