import { SESSION_COOKIE } from "@catafy/types";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { clearDb, createOwner, OWNER, startDb, testConfig, WEB_ORIGIN } from "./helpers.js";

let stopDb: () => Promise<void>;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  stopDb = await startDb();
});
afterAll(() => stopDb());
beforeEach(async () => {
  // Fresh app per test so the login rate limiter starts empty.
  app = createApp(testConfig());
  await clearDb();
  await createOwner();
});

const login = (body: object) =>
  request(app).post("/api/v1/admin/auth/login").set("origin", WEB_ORIGIN).send(body);

describe("owner login", () => {
  it("sets an httpOnly, secure, sameSite=lax session cookie in production", async () => {
    const res = await request(createApp(testConfig({ isProd: true })))
      .post("/api/v1/admin/auth/login")
      .set("origin", WEB_ORIGIN)
      .send(OWNER);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(OWNER.email);
    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toContain(`${SESSION_COOKIE}=`);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it("accepts the email case-insensitively", async () => {
    expect((await login({ ...OWNER, email: OWNER.email.toUpperCase() })).status).toBe(200);
  });

  it("returns the same 401 for a wrong password and an unknown email", async () => {
    const wrongPassword = await login({ ...OWNER, password: "nope" });
    const unknownEmail = await login({ email: "someone@else.dev", password: "nope" });
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    const { code, message } = wrongPassword.body.error;
    expect(unknownEmail.body.error).toMatchObject({ code, message });
  });

  it("rate limits repeated failures", async () => {
    for (let i = 0; i < 10; i++) await login({ ...OWNER, password: "wrong" });
    const res = await login(OWNER);
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("RATE_LIMITED");
  });
});

describe("admin route protection", () => {
  it("rejects requests without a session", async () => {
    const res = await request(app).get("/api/v1/admin/products");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects a forged/tampered cookie", async () => {
    const res = await request(app)
      .get("/api/v1/admin/auth/me")
      .set("cookie", `${SESSION_COOKIE}=eyJhbGciOiJIUzI1NiJ9.e30.invalid`);
    expect(res.status).toBe(401);
  });

  it("rejects a token signed with a different secret", async () => {
    const other = createApp(
      testConfig({ jwtSecret: "another-secret-that-is-32-characters-long!!" }),
    );
    const res = await request(other)
      .post("/api/v1/admin/auth/login")
      .set("origin", WEB_ORIGIN)
      .send(OWNER);
    const cookie = String(res.headers["set-cookie"]).split(";")[0]!;
    expect((await request(app).get("/api/v1/admin/auth/me").set("cookie", cookie)).status).toBe(
      401,
    );
  });

  it("returns the session user and clears it on logout", async () => {
    const agent = request.agent(app);
    await agent.post("/api/v1/admin/auth/login").set("origin", WEB_ORIGIN).send(OWNER);
    expect((await agent.get("/api/v1/admin/auth/me")).body.user.email).toBe(OWNER.email);

    const out = await agent.post("/api/v1/admin/auth/logout").set("origin", WEB_ORIGIN);
    expect(out.status).toBe(204);
    expect((await agent.get("/api/v1/admin/auth/me")).status).toBe(401);
  });
});

describe("cross-origin protection", () => {
  it("blocks mutating admin requests from another origin", async () => {
    const res = await request(app)
      .post("/api/v1/admin/auth/login")
      .set("origin", "https://evil.example")
      .send(OWNER);
    expect(res.status).toBe(403);
  });

  it("blocks mutating admin requests without Origin or Referer", async () => {
    const res = await request(app).post("/api/v1/admin/auth/login").send(OWNER);
    expect(res.status).toBe(403);
  });

  it("accepts a same-origin Referer when Origin is absent", async () => {
    const res = await request(app)
      .post("/api/v1/admin/auth/login")
      .set("referer", `${WEB_ORIGIN}/admin/login`)
      .send(OWNER);
    expect(res.status).toBe(200);
  });
});
