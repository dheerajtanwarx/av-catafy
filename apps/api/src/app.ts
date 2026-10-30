import { randomUUID } from "node:crypto";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import type { AppConfig } from "./config.js";
import { clientIp } from "./middleware/client-ip.js";
import { createErrorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { v1Router } from "./routes/index.js";

export function createApp(config: AppConfig): Express {
  const { logger, webOrigin, isProd } = config;
  const app = express();

  // X-Forwarded-For is never trusted: anyone calling the API directly could set it. The buyer's
  // address arrives in a header only the Next.js proxy can vouch for (see clientIp).
  app.set("trust proxy", false);
  app.disable("x-powered-by");

  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const incoming = req.headers["x-request-id"];
        const id = typeof incoming === "string" && incoming.length <= 128 ? incoming : randomUUID();
        res.setHeader("x-request-id", id);
        return id;
      },
      autoLogging: { ignore: (req) => req.url === "/api/v1/health" },
    }),
  );
  app.use(helmet());
  // Browsers reach the API same-origin through the Next.js rewrite; CORS only covers direct calls.
  app.use(cors({ origin: webOrigin, credentials: true }));
  // Bulk import sends up to 2,000 spreadsheet rows; everything else stays small.
  app.use("/api/v1/admin/import", express.json({ limit: "2mb" }));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use(clientIp(config.proxySecret));

  app.use("/api/v1", v1Router(config));

  app.use(notFoundHandler);
  app.use(createErrorHandler(!isProd));

  return app;
}
