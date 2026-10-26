import { createApp } from "./app.js";
import { connectDb, disconnectDb } from "./db.js";
import { env, isProd } from "./env.js";
import { createLogger } from "./lib/logger.js";

const logger = createLogger(env.LOG_LEVEL, env.NODE_ENV === "development");

async function main(): Promise<void> {
  // Indexes are built automatically in dev; in production run `pnpm seed`, which syncs them.
  await connectDb(env.MONGODB_URI, logger, !isProd);

  const app = createApp({ logger, webOrigin: env.WEB_ORIGIN, isProd });
  const server = app.listen(env.API_PORT, () => {
    logger.info(`API listening on http://localhost:${env.API_PORT}`);
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, "Shutting down");
    server.close(() => {
      void disconnectDb().finally(() => process.exit(0));
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err: unknown) => {
  logger.fatal({ err }, "Failed to start API");
  process.exit(1);
});
