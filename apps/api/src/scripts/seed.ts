import argon2 from "argon2";
import mongoose from "mongoose";
import { z } from "zod";
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
const ownerSchema = z.object({
  email: z.string({ required_error: "required" }).email("must be a valid email"),
  password: z
    .string({ required_error: "required" })
    .min(10, "must be at least 10 characters (this login protects your store)"),
});

const logger = createLogger(env.LOG_LEVEL, env.NODE_ENV === "development");

async function seed(): Promise<void> {
  const owner = ownerSchema.safeParse({ email: env.OWNER_EMAIL, password: env.OWNER_PASSWORD });
  if (!owner.success) {
    const problems = owner.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Fix OWNER_EMAIL / OWNER_PASSWORD in .env:\n${problems}`);
  }
  const { email, password } = owner.data;

  await connectDb({ uri: env.MONGODB_URI, dbName: env.MONGODB_DB_NAME, autoIndex: false }, logger);
  await mongoose.syncIndexes();
  logger.info("Indexes synced");

  const existing = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  if (!existing) {
    await User.create({
      email,
      passwordHash: await argon2.hash(password),
    });
    logger.info({ email }, "Owner created");
  } else if (!(await argon2.verify(existing.passwordHash, password))) {
    existing.passwordHash = await argon2.hash(password);
    await existing.save();
    logger.info({ email }, "Owner password updated");
  } else {
    logger.info({ email }, "Owner already up to date");
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
