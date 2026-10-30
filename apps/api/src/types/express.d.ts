import type { SessionUser } from "@catafy/types";
import type { AccessGrants } from "../lib/catalogue-access.js";
import type { Restrictions } from "../services/access.service.js";

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth on admin routes. */
      user?: SessionUser;
      /** Set by clientIp: the buyer's address, used only as the rate-limit key. */
      clientIp?: string;
      /** Set by catalogueAccess on public routes. */
      accessGrants?: AccessGrants;
      restrictions?: Restrictions;
    }
  }
}

export {};
