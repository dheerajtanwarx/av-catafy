import type { Logger } from "pino";
import type { Revalidate } from "./lib/revalidate.js";
import type { Storage } from "./lib/storage.js";

/** Everything the HTTP app needs, injected so tests can build it without real env/services. */
export interface AppConfig {
  logger: Logger;
  webOrigin: string;
  isProd: boolean;
  jwtSecret: string;
  storage: Storage;
  revalidate: Revalidate;
  /** Shared with the web app (REVALIDATE_SECRET): proves a forwarded client IP came from it. */
  proxySecret: string;
}
