import type { SessionUser } from "@catafy/types";

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth on admin routes. */
      user?: SessionUser;
    }
  }
}

export {};
