import { ACCESS_COOKIE } from "@catafy/types";
import type { RequestHandler } from "express";
import { verifyAccess } from "../lib/catalogue-access.js";
import { resolveRestrictions } from "../services/access.service.js";

/**
 * Works out what this buyer may see from their (signed) unlocked-catalogues cookie. Responses
 * that depend on that cookie are marked private so no shared cache ever stores them.
 */
export function catalogueAccess(secret: string): RequestHandler {
  return async (req, res, next) => {
    const token: unknown = req.cookies?.[ACCESS_COOKIE];
    req.accessGrants = await verifyAccess(typeof token === "string" ? token : undefined, secret);
    req.restrictions = await resolveRestrictions(req.accessGrants);
    if (Object.keys(req.accessGrants).length) res.set("Cache-Control", "private, no-store");
    next();
  };
}
