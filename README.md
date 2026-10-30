# av-catafy

A personal digital catalogue and order store for a women's clothing business. The owner uploads products once and shares one link (WhatsApp, Instagram or a QR code). Buyers browse on their phones and place orders without paying online; the owner confirms on WhatsApp, tracks payment by hand, and watches visitors live.

- **Storefront:** home, listing with search/filter/sort, product pages with size × colour stock, shareable catalogues (`/c/<slug>`), private catalogues behind a passcode, "price on request" catalogues, a bag, checkout without payment, and a "Send order on WhatsApp" confirmation. Link previews show the image, title and price.
- **Admin (`/admin`):** products with image galleries, categories, catalogues, Excel/CSV import, orders with a status workflow and manual payment tracking, printable invoices and packing slips, customers, live visitors, reports and store settings.

`docs/DECISIONS.md` records every decision that changes or clarifies the original brief, with the reason.

## Contents

- [How it fits together](#how-it-fits-together)
- [Local setup](#local-setup)
- [Configuration](#configuration)
- [Scripts and tests](#scripts-and-tests)
- [Deployment](#deployment)
- [Operations](#operations)
- [Security notes](#security-notes)

## How it fits together

```
 buyer / owner browser
        │  only ever talks to the web origin
        ▼
 ┌──────────────────────────┐   /api/v1/*  (rewrite + buyer IP header)   ┌───────────────────┐
 │ apps/web  (Next.js)       │ ─────────────────────────────────────────► │ apps/api (Express) │──► MongoDB (Atlas)
 │ storefront + /admin       │ ◄──── POST /api/revalidate (after writes) ─ │ Mongoose, Zod      │
 └──────────────────────────┘                                             └───────────────────┘
        │ images                                                                 │ presigned PUT URLs
        ▼                                                                        ▼
 Cloudflare R2 public domain  ◄──────────── browser uploads directly ──────────  R2 bucket
```

- **One origin.** Next.js proxies `/api/v1/*` to Express, so cookies stay first-party and there is no CORS or CSRF-token setup. Express is never called from the browser directly.
- **Server Components** call the API on `API_INTERNAL_URL` and cache anonymous responses under one tag. The API revalidates that tag after every admin write and after each order (stock changed).
- **Images** go straight from the browser to R2 with presigned PUT URLs. The API only signs and stores keys.
- **Shared code:** `packages/types` holds the Zod schemas and types both apps use (forms and API validation share one schema). `packages/config` holds the tsconfig, ESLint and Prettier presets.

```
apps/api/src   routes → services → models (Mongoose); lib/ (session, storage, access cookie, …)
apps/web       app/(store) storefront · app/admin dashboard · components · lib (API client, queries)
packages/types Zod schemas, DTOs and pure helpers (pricing, status workflow, import rows, …)
```

## Local setup

**Requirements:** Node.js 22+, pnpm, and a MongoDB **replica set** (transactions are required for orders). A free MongoDB Atlas M0 cluster is a replica set out of the box. For a local `mongod`, start it with `--replSet rs0` and run `rs.initiate()` once.

```bash
pnpm install
cp .env.example .env     # then fill in MONGODB_URI, JWT_SECRET, REVALIDATE_SECRET, OWNER_*, R2_*
pnpm seed                # indexes, the owner account and default store settings (safe to re-run)
pnpm dev                 # web on http://localhost:3000, API on http://localhost:4000
```

Then sign in at <http://localhost:3000/admin> with `OWNER_EMAIL` / `OWNER_PASSWORD`.

Optional sample data: `pnpm demo` adds 7 products, 3 categories and a catalogue (tagged `demo`); `pnpm demo:remove` deletes exactly those.

Check the stack: `curl http://localhost:3000/api/v1/health` → `{"status":"ok","db":"up"}`.

### Cloudflare R2

1. Create a bucket and an API token with **Object Read & Write** on it (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ACCOUNT_ID`).
2. Make it publicly readable through its `r2.dev` URL or, better for production, a custom domain → `R2_PUBLIC_BASE_URL`.
3. Bucket → Settings → **CORS policy**, so browsers can upload directly. List every origin that serves the admin:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://shop.example.com"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type", "cache-control"],
    "MaxAgeSeconds": 3600
  }
]
```

Uploads are signed for one exact type, size and cache header, and expire after 5 minutes. A mismatch gets a 403 from R2, not a silent bad upload.

## Configuration

Both apps read one `.env` at the repo root locally. In production, set the variables on each host. Everything is validated at startup (`packages/types/src/env.ts`), and a bad or missing value stops the app with a list of what's wrong.

| Variable                                                                 | Used by | What it is                                                                                                                                                                   |
| ------------------------------------------------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                                               | both    | `production` in production. It makes cookies `Secure` and hides error details.                                                                                               |
| `MONGODB_URI`                                                            | API     | Replica-set connection string (Atlas `mongodb+srv://…`).                                                                                                                     |
| `MONGODB_DB_NAME`                                                        | API     | Database name, default `catafy`.                                                                                                                                             |
| `API_PORT`                                                               | API     | Port Express listens on, default 4000.                                                                                                                                       |
| `WEB_ORIGIN`                                                             | API     | Public origin of the web app, e.g. `https://shop.example.com`. Admin writes must come from it.                                                                               |
| `WEB_INTERNAL_URL`                                                       | API     | Where the API reaches Next.js to revalidate the storefront. Often the same as `WEB_ORIGIN`.                                                                                  |
| `JWT_SECRET`                                                             | both    | ≥ 32 random characters (`openssl rand -base64 48`). Signs the owner session and the catalogue-access cookie. Must be the same on both apps.                                  |
| `REVALIDATE_SECRET`                                                      | both    | ≥ 16 random characters, same on both apps. Authenticates revalidation calls and proves the buyer IP forwarded by Next.js is genuine (see [Security notes](#security-notes)). |
| `OWNER_EMAIL`, `OWNER_PASSWORD`                                          | seed    | The single owner login; `pnpm seed` creates it or updates the password (≥ 10 characters).                                                                                    |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | API     | R2 credentials and bucket. `R2_ENDPOINT` is optional.                                                                                                                        |
| `R2_PUBLIC_BASE_URL`                                                     | both    | Public image domain, no trailing slash.                                                                                                                                      |
| `API_INTERNAL_URL`                                                       | web     | Where Next.js proxies `/api/v1/*` and Server Components fetch from. Never sent to browsers.                                                                                  |
| `NEXT_PUBLIC_SITE_URL`                                                   | web     | Canonical public URL; used for Open Graph, the sitemap and share links.                                                                                                      |
| `LOG_LEVEL`                                                              | API     | `info` by default.                                                                                                                                                           |

Store name, logo, banner, WhatsApp number, accent colour, the order confirmation message, low-stock alert, currency, GSTIN and the "prices include tax" invoice line are all edited in **Admin → Settings**, not in env.

## Scripts and tests

| Command                                      | What it does                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------- |
| `pnpm dev`                                   | All apps in watch mode                                                          |
| `pnpm build`                                 | Builds `@catafy/types`, the API and the web app (Turborepo orders them)         |
| `pnpm lint` · `pnpm typecheck` · `pnpm test` | Quality gates. All three must pass before merging.                              |
| `pnpm seed`                                  | Syncs indexes, creates/updates the owner, creates default settings. Idempotent. |
| `pnpm demo` / `pnpm demo:remove`             | Add / remove the sample catalogue                                               |

Tests run with Vitest. API tests use an in-memory MongoDB replica set (`mongodb-memory-server`, which downloads a MongoDB binary on first run), so they need no database or credentials. Main areas:

- **Pricing and totals:** integer paise, server-side re-pricing, never trusting client prices (`packages/types/test`, `apps/api/test/orders.test.ts`).
- **Stock reservation:** concurrent buyers for the last piece, rollback of the whole transaction, restore-once on cancellation (`orders.test.ts`, `admin-orders.test.ts`).
- **Passcode access control:** private products never leak through any endpoint, rate-limited guessing, revocation on passcode change, forged cookies (`catalogue-access.test.ts`).
- **Presigned uploads:** type, size and key validation (`uploads.test.ts`).
- **Other areas:** bulk import, analytics and reports (Indian-time bucketing), per-buyer rate limits behind the proxy, auth and CSRF, the storefront cache, and the web app's WhatsApp/import helpers.

> `next build` and the web `typecheck` load `next.config.ts`, which validates env. In CI, `cp .env.example .env` first; the placeholder values pass validation.

## Deployment

Any setup works as long as browsers only reach the **web app**, and the web app can reach the API. Two common setups:

### Option A: Vercel (web) + Render or Railway (API)

**API (Render web service or Railway service)**

- Root: the repository. Node 22.
- Build: `pnpm install --frozen-lockfile && pnpm turbo run build --filter=@catafy/api`
- Pre-deploy / release command: `pnpm seed` (syncs indexes; in production they are not auto-built on boot)
- Start: `node apps/api/dist/server.js`
- Health check path: `/api/v1/health`
- Env: everything marked _API_ or _both_ above, with `NODE_ENV=production`, `WEB_ORIGIN=https://<your web domain>` and `WEB_INTERNAL_URL=https://<your web domain>`.
- Keep the dev dependencies installed during the build and seed (`tsx` runs the seed). Don't build with `--prod`.

**Web (Vercel)**

- Import the repo and set **Root Directory** to `apps/web`. Vercel detects pnpm workspaces and Next.js.
- Build command: `cd ../.. && pnpm turbo run build --filter=@catafy/web` (builds `@catafy/types` first)
- Env: `API_INTERNAL_URL=https://<api host>`, `JWT_SECRET`, `REVALIDATE_SECRET`, `NEXT_PUBLIC_SITE_URL=https://<your web domain>`, `R2_PUBLIC_BASE_URL`, `NODE_ENV=production`.
- Vercel sets `X-Forwarded-For` itself, which the middleware uses for per-buyer rate limits.

### Option B: one VPS (Ubuntu + nginx + systemd or pm2)

```bash
pnpm install --frozen-lockfile && pnpm build && pnpm seed
node apps/api/dist/server.js                     # API on :4000 (bind it to localhost only)
pnpm --filter @catafy/web start                  # Next.js on :3000
```

Put nginx (or Caddy) in front of **Next.js only**, terminate HTTPS there, and keep port 4000 closed to the internet (`API_INTERNAL_URL=http://127.0.0.1:4000`, `WEB_INTERNAL_URL=http://127.0.0.1:3000`). Next.js takes the buyer's address from the **last** `X-Forwarded-For` entry, so your proxy must set it:

```nginx
server {
  server_name shop.example.com;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

### After the first deploy

1. Sign in at `/admin`, open **Settings**, and set the store name, WhatsApp number, logo and banner.
2. Add your production origin to the R2 CORS policy.
3. Share a product link on WhatsApp and check the preview shows the image, title and price.

## Operations

- **Backups:** turn on Atlas backups (or `mongodump` on a schedule). Images live in R2; removed images are not deleted, because past orders still show them.
- **Storefront cache:** admin writes and orders refresh it automatically, and it also refreshes hourly. After restoring or switching the database, redeploy the web app (or wait an hour) so stale cached pages are replaced.
- **Analytics** keeps 180 days of events (TTL index), with no IPs. Orders and revenue in reports come from orders, so they don't expire.
- **Logs** are JSON (pino) with a request id on every line; cookies, auth headers and the internal proxy secret are redacted.

## Security notes

- **Owner auth:** argon2-hashed password, 14-day signed httpOnly `SameSite=Lax` cookie, login rate-limited. The Next.js middleware only redirects to the login page; the API checks the session on every admin request. Admin writes must carry an `Origin` equal to `WEB_ORIGIN` (CSRF protection). Signing out clears the cookie; to cut off every session at once, rotate `JWT_SECRET`.
- **Buyers:** all input is validated with Zod; prices and totals are always recomputed from the database; stock is reserved in a transaction. Order pages use unguessable tokens, not order numbers.
- **Rate limits** (orders, cart quotes, passcodes, events, login, uploads) are per buyer. The Next.js proxy doesn't pass the client address on, so the middleware sends it in a header together with `REVALIDATE_SECRET`. Express trusts that address only when the secret matches and ignores `X-Forwarded-For`, so a request sent straight to the API can't choose its own IP.
- **Private catalogues:** one signed httpOnly cookie lists unlocked catalogues; changing a passcode revokes old unlocks. Responses for buyers holding that cookie are never cached.
- **Headers:** helmet on the API. On the web app: `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, a strict referrer policy and a restrictive permissions policy. There is no full script CSP, because Next.js inline scripts would need per-request nonces.
- **Uploads:** image types only (no SVG), size-capped, server-generated keys; the API never handles image bytes.
- **Dependency audit:** `pnpm audit --prod` reports two advisories, accepted for now:
  - `zod` < 4.6.6 (memory use on oversized collections): request bodies are capped at 100 KB (2 MB for import) and every array has a `max`, which bounds the input. The fix is a zod 4 migration.
  - `uuid` in `exceljs`: the affected call (passing a buffer) is never made; it runs only in the owner's browser on the import page.

  Next.js's bundled `postcss` is overridden to a patched version in `pnpm-workspace.yaml`.
