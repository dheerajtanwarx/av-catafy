# av-catafy

A personal digital catalogue and order store for a women's clothing business. The owner uploads products, shares one link (WhatsApp, Instagram or QR), buyers browse and place orders, and payment is handled offline.

- `apps/web`: Next.js storefront + `/admin` dashboard. Proxies `/api/v1/*` to the API.
- `apps/api`: Express + Mongoose REST API.
- `packages/types`: shared Zod schemas and TypeScript types.
- `packages/config`: shared tsconfig, ESLint and Prettier presets.

See [`docs/DECISIONS.md`](docs/DECISIONS.md) for the decisions made along the way.

## Requirements

- Node.js 22+ and pnpm
- A MongoDB **replica set** connection string. MongoDB Atlas (the free M0 tier works) is one out of the box.

## Local setup

```bash
pnpm install
cp .env.example .env        # fill in MONGODB_URI, JWT_SECRET, OWNER_*, R2_* ...
pnpm seed                   # creates indexes, the owner account and default store settings
pnpm dev                    # web on :3000, api on :4000
```

Check it works:

```bash
curl http://localhost:3000/api/v1/health   # via the Next.js proxy -> {"status":"ok","db":"up"}
```

## Scripts

| Command                                      | What it does                                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------------- |
| `pnpm dev`                                   | Runs all apps in watch mode                                                       |
| `pnpm build`                                 | Builds every package                                                              |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Quality gates; run all three before merging                                       |
| `pnpm seed`                                  | Idempotent: syncs indexes, creates or updates the owner, creates default settings |

> The web app's `typecheck` and `build` load `next.config.ts`, which validates env. In CI, copy `.env.example` to `.env` (placeholder values pass validation).

## Deployment (summary, expanded in Phase 8)

- **Web:** Vercel or a VPS. Set `API_INTERNAL_URL` to the API's URL.
- **API:** Render, Railway or a VPS. Run `pnpm seed` on each deploy.
- **R2:** public bucket domain set in `R2_PUBLIC_BASE_URL`, plus a CORS rule allowing `PUT` from the web origin.
