import { UPLOAD_MAX_BYTES } from "@catafy/types";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createOwner, loggedInAgent, startDb, testConfig } from "./helpers.js";

let stopDb: () => Promise<void>;
let admin: Awaited<ReturnType<typeof loggedInAgent>>;

beforeAll(async () => {
  stopDb = await startDb();
  await createOwner();
  admin = await loggedInAgent(createApp(testConfig()));
});
afterAll(() => stopDb());

const presign = (body: object) => admin.post("/api/v1/admin/uploads/presign").send(body);

describe("POST /admin/uploads/presign", () => {
  it("returns a short-lived URL for a random key that signs type and size", async () => {
    const res = await presign({ folder: "products", contentType: "image/webp", size: 123_456 });
    expect(res.status).toBe(200);
    expect(res.body.key).toMatch(/^products\/[0-9a-f-]{36}\.webp$/);
    expect(res.body.publicUrl).toBe(`https://img.test.dev/${res.body.key}`);
    expect(res.body.headers["Content-Type"]).toBe("image/webp");

    const url = new URL(res.body.uploadUrl);
    expect(url.host).toBe("test-bucket.testaccount.r2.cloudflarestorage.com");
    expect(url.pathname).toBe(`/${res.body.key}`);
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    const signed = url.searchParams.get("X-Amz-SignedHeaders")?.split(";") ?? [];
    expect(signed).toEqual(expect.arrayContaining(["content-length", "content-type", "host"]));
  });

  it("gives every upload a different key", async () => {
    const body = { folder: "products", contentType: "image/jpeg", size: 1000 };
    const [a, b] = await Promise.all([presign(body), presign(body)]);
    expect(a.body.key).not.toBe(b.body.key);
  });

  it.each([
    ["a non-image type", { folder: "products", contentType: "application/pdf", size: 1000 }],
    [
      "an SVG (can carry scripts)",
      { folder: "products", contentType: "image/svg+xml", size: 1000 },
    ],
    [
      "a file over the size limit",
      { folder: "products", contentType: "image/png", size: UPLOAD_MAX_BYTES + 1 },
    ],
    ["a zero-byte file", { folder: "products", contentType: "image/png", size: 0 }],
    ["an unknown folder", { folder: "../secrets", contentType: "image/png", size: 1000 }],
  ])("rejects %s", async (_label, body) => {
    const res = await presign(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
