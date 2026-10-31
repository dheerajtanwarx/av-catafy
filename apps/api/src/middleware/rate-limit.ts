import { ipKeyGenerator, rateLimit, type Options } from "express-rate-limit";
import { AppError } from "../lib/errors.js";

export function createRateLimit(options: Partial<Options>) {
  return rateLimit({
    standardHeaders: "draft-7",
    legacyHeaders: false,
    // Keyed on the buyer's address forwarded by Next.js (see clientIp); IPv6 is grouped by /56.
    keyGenerator: (req) => ipKeyGenerator(req.clientIp ?? req.ip ?? "unknown"),
    handler: (_req, _res, next) => {
      next(new AppError(429, "RATE_LIMITED", "Too many attempts, please try again later"));
    },
    ...options,
  });
}
