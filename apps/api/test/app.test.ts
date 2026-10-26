import { pino } from "pino";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { errorEnvelopeSchema } from "@catafy/types";
import { createApp } from "../src/app.js";

const app = createApp({
  logger: pino({ level: "silent" }),
  webOrigin: "http://localhost:3000",
  isProd: true,
});

describe("GET /api/v1/health", () => {
  it("reports degraded when the database is not connected", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: "degraded", db: "down" });
  });

  it("echoes or generates a request id", async () => {
    const echoed = await request(app).get("/api/v1/health").set("x-request-id", "abc-123");
    expect(echoed.headers["x-request-id"]).toBe("abc-123");

    const generated = await request(app).get("/api/v1/health");
    expect(generated.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("error envelope", () => {
  it("returns 404 in the standard format for unknown routes", async () => {
    const res = await request(app).get("/api/v1/nope");
    expect(res.status).toBe(404);
    expect(errorEnvelopeSchema.parse(res.body).error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for malformed JSON without leaking a stack in production", async () => {
    const res = await request(app)
      .post("/api/v1/health")
      .set("content-type", "application/json")
      .send("{bad json");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
    expect(res.body.error.stack).toBeUndefined();
  });

  it("rejects bodies over the size limit", async () => {
    const res = await request(app)
      .post("/api/v1/health")
      .set("content-type", "application/json")
      .send(JSON.stringify({ data: "x".repeat(200_000) }));
    expect(res.status).toBe(413);
    expect(res.body.error.message).toBe("Request body too large");
  });
});
