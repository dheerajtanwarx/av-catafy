import { loginInputSchema, SESSION_COOKIE } from "@catafy/types";
import { Router, type CookieOptions } from "express";
import type { AppConfig } from "../../config.js";
import { SESSION_TTL_SECONDS, signSession } from "../../lib/session.js";
import { parse } from "../../lib/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { createRateLimit } from "../../middleware/rate-limit.js";
import { authenticate } from "../../services/auth.service.js";

export function authRouter({ jwtSecret, isProd }: AppConfig): Router {
  const router = Router();
  const cookieOptions: CookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
  };

  const loginLimit = createRateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
  });

  router.post("/login", loginLimit, async (req, res) => {
    const user = await authenticate(parse(loginInputSchema, req.body));
    res.cookie(SESSION_COOKIE, await signSession(user, jwtSecret), {
      ...cookieOptions,
      maxAge: SESSION_TTL_SECONDS * 1000,
    });
    res.json({ user });
  });

  router.post("/logout", (_req, res) => {
    res.clearCookie(SESSION_COOKIE, cookieOptions);
    res.status(204).end();
  });

  router.get("/me", requireAuth(jwtSecret), (req, res) => {
    res.json({ user: req.user });
  });

  return router;
}
