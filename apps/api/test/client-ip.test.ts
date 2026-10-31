import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { CLIENT_IP_HEADER, PROXY_SECRET_HEADER } from "../src/middleware/client-ip.js";
import { testConfig } from "./helpers.js";

/**
 * The events limit (120 a minute) is a convenient probe: an empty body fails validation before
 * any database access, so this file needs no database.
 */
const LIMIT = 120;
const hit = (app: ReturnType<typeof createApp>, headers: Record<string, string>) =>
  request(app).post("/api/v1/public/events").set(headers).send({});

describe("rate limits per buyer behind the Next.js proxy", () => {
  it("keys on the forwarded client IP when the proxy secret matches", async () => {
    const app = createApp(testConfig());
    const from = (ip: string) => ({
      [CLIENT_IP_HEADER]: ip,
      [PROXY_SECRET_HEADER]: "test-proxy-secret-1234",
    });
    for (let i = 0; i < LIMIT; i++) await hit(app, from("203.0.113.7"));
    expect((await hit(app, from("203.0.113.7"))).status).toBe(429);
    // A different buyer is unaffected.
    expect((await hit(app, from("198.51.100.4"))).status).toBe(400);
  });

  it("ignores forwarded IPs without the secret, and X-Forwarded-For entirely", async () => {
    const app = createApp(testConfig());
    for (let i = 0; i < LIMIT; i++) {
      await hit(app, {
        [CLIENT_IP_HEADER]: `203.0.113.${i % 250}`,
        [PROXY_SECRET_HEADER]: "wrong-secret-000000000",
        "x-forwarded-for": `198.51.100.${i % 250}`,
      });
    }
    // All counted against the real socket address, so rotating headers didn't help.
    expect(
      (await hit(app, { [CLIENT_IP_HEADER]: "203.0.113.99", "x-forwarded-for": "1.2.3.4" })).status,
    ).toBe(429);
  });
});
