import argon2 from "argon2";
import mongoose from "mongoose";
import { connectDb, disconnectDb } from "../db.js";
import { env } from "../env.js";
import { createLogger } from "../lib/logger.js";
import { STORE_SETTINGS_KEY, StoreSettings, User } from "../models/index.js";

/**
 * Idempotent: safe to run on every deploy.
 * - Creates/updates indexes for every model.
 * - Creates the owner, or updates the password hash if OWNER_PASSWORD changed.
 * - Creates default store settings once (never overwrites edits made in the dashboard).
 */
const logger = createLogger(env.LOG_LEVEL, env.NODE_ENV === "development");

async function seed(): Promise<void> {
  if (!env.OWNER_EMAIL || !env.OWNER_PASSWORD) {
    throw new Error("OWNER_EMAIL and OWNER_PASSWORD must be set to run the seed script");
  }

  await connectDb({ uri: env.MONGODB_URI, dbName: env.MONGODB_DB_NAME, autoIndex: false }, logger);
  await mongoose.syncIndexes();
  logger.info("Indexes synced");

  const existing = await User.findOne({ email: env.OWNER_EMAIL.toLowerCase() }).select(
    "+passwordHash",
  );
  if (!existing) {
    await User.create({
      email: env.OWNER_EMAIL,
      passwordHash: await argon2.hash(env.OWNER_PASSWORD),
    });
    logger.info({ email: env.OWNER_EMAIL }, "Owner created");
  } else if (!(await argon2.verify(existing.passwordHash, env.OWNER_PASSWORD))) {
    existing.passwordHash = await argon2.hash(env.OWNER_PASSWORD);
    await existing.save();
    logger.info({ email: env.OWNER_EMAIL }, "Owner password updated");
  } else {
    logger.info({ email: env.OWNER_EMAIL }, "Owner already up to date");
  }

  const settings = await StoreSettings.updateOne(
    { key: STORE_SETTINGS_KEY },
    {
      $setOnInsert: {
        key: STORE_SETTINGS_KEY,
        storeName: "My Boutique",
        orderConfirmationTemplate:
          "Hi {{name}}, thank you for your order {{orderNumber}} of {{total}}. We will confirm it shortly.",
      },
    },
    { upsert: true },
  );
  logger.info(settings.upsertedCount ? "Default store settings created" : "Store settings exist");
}

seed()
  .catch((err: unknown) => {
    logger.fatal({ err }, "Seed failed");
    process.exitCode = 1;
  })
  .finally(() => disconnectDb());
