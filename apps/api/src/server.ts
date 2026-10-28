import { createApp } from "./app.js";
import { connectDb, disconnectDb } from "./db.js";
import { env, isProd } from "./env.js";
import { createLogger } from "./lib/logger.js";
import { createR2Storage } from "./lib/storage.js";

const logger = createLogger(env.LOG_LEVEL, env.NODE_ENV === "development");

async function main(): Promise<void> {
  // Indexes are built automatically in dev; in production run `pnpm seed`, which syncs them.
  await connectDb(
    { uri: env.MONGODB_URI, dbName: env.MONGODB_DB_NAME, autoIndex: !isProd },
    logger,
  );

  const storage = createR2Storage({
    accountId: env.R2_ACCOUNT_ID,
    endpoint: env.R2_ENDPOINT,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET,
    publicBaseUrl: env.R2_PUBLIC_BASE_URL,
  });

  const app = createApp({
    logger,
    webOrigin: env.WEB_ORIGIN,
    isProd,
    jwtSecret: env.JWT_SECRET,
    storage,
  });
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
