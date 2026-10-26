import { randomUUID } from "node:crypto";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import type { Logger } from "pino";
import { pinoHttp } from "pino-http";
import { createErrorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { v1Router } from "./routes/index.js";

export interface AppOptions {
  logger: Logger;
  webOrigin: string;
  isProd: boolean;
}

export function createApp({ logger, webOrigin, isProd }: AppOptions): Express {
  const app = express();

  // Requests normally arrive via the Next.js proxy (and a load balancer in prod).
  app.set("trust proxy", 1);
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
  app.use(express.json({ limit: "100kb" }));

  app.use("/api/v1", v1Router);

  app.use(notFoundHandler);
  app.use(createErrorHandler(!isProd));

  return app;
}
