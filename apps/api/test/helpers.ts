import { SESSION_COOKIE } from "@catafy/types";
import argon2 from "argon2";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { pino } from "pino";
import request from "supertest";
import type { createApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";
import { createR2Storage } from "../src/lib/storage.js";
import { User } from "../src/models/index.js";

export const WEB_ORIGIN = "http://localhost:3000";
export const OWNER = { email: "owner@test.dev", password: "correct-horse-battery" };

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    logger: pino({ level: "silent" }),
    webOrigin: WEB_ORIGIN,
    // Non-prod so the session cookie isn't `Secure` (supertest speaks plain HTTP).
    isProd: false,
    jwtSecret: "test-secret-that-is-at-least-32-characters-long",
    // Presigning is pure computation, so fake credentials work offline.
    storage: createR2Storage({
      accountId: "testaccount",
      accessKeyId: "AKIATEST",
      secretAccessKey: "secret",
      bucket: "test-bucket",
      publicBaseUrl: "https://img.test.dev",
    }),
    revalidate: () => undefined,
    ...overrides,
  };
}

/** In-memory replica set (transactions work, like Atlas). */
export async function startDb(): Promise<() => Promise<void>> {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri(), { dbName: "test" });
  await mongoose.connection.syncIndexes();
  return async () => {
    await mongoose.disconnect();
    await replSet.stop();
  };
}

export async function clearDb(): Promise<void> {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

export async function createOwner(): Promise<void> {
  await User.create({ email: OWNER.email, passwordHash: await argon2.hash(OWNER.password) });
}

/** Logs in and returns a supertest agent that carries the session cookie and Origin header. */
export async function loggedInAgent(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  const res = await agent.post("/api/v1/admin/auth/login").set("origin", WEB_ORIGIN).send(OWNER);
  if (res.status !== 200)
    throw new Error(`Login failed: ${res.status} ${JSON.stringify(res.body)}`);
  if (!String(res.headers["set-cookie"]).includes(SESSION_COOKIE)) throw new Error("No cookie");
  return {
    get: (url: string) => agent.get(url).set("origin", WEB_ORIGIN),
    post: (url: string) => agent.post(url).set("origin", WEB_ORIGIN),
    put: (url: string) => agent.put(url).set("origin", WEB_ORIGIN),
    patch: (url: string) => agent.patch(url).set("origin", WEB_ORIGIN),
    delete: (url: string) => agent.delete(url).set("origin", WEB_ORIGIN),
  };
}
