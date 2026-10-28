import { rateLimit, type Options } from "express-rate-limit";
import { AppError } from "../lib/errors.js";

export function createRateLimit(options: Partial<Options>) {
  return rateLimit({
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(new AppError(429, "RATE_LIMITED", "Too many attempts, please try again later"));
    },
    ...options,
  });
}
