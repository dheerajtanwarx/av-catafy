import type { RequestHandler } from "express";
import type { Revalidate } from "../lib/revalidate.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** After any successful admin write, refresh the storefront cache. */
export function revalidateOnWrite(revalidate: Revalidate): RequestHandler {
  return (req, res, next) => {
    if (!SAFE_METHODS.has(req.method)) {
      res.on("finish", () => {
        if (res.statusCode < 400) revalidate();
      });
    }
    next();
  };
}
