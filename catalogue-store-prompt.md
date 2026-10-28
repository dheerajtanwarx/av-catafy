# Project: Personal Digital Catalogue & Order Store (Catafy-style) for a Women's Clothing Business

You are building a production-quality, single-owner digital catalogue and order-collection web app for my women's clothing business. It is inspired by Catafy (catafy.com): the owner uploads products once, shares one link (WhatsApp / Instagram / QR), buyers browse and place orders themselves, and the owner sees orders and live visitor activity in an admin dashboard.

This is for my own individual use, so it is single-tenant: one owner account, one store. Do NOT build multi-tenant / multi-store SaaS features.

**There is NO payment gateway.** Orders are placed without online payment. Payment is handled offline (UPI / bank transfer / COD) and the owner marks it manually. Do not integrate Razorpay, Stripe, PayU, PhonePe or similar.

## 1. Tech stack (fixed, do not substitute)

- **Monorepo:** Turborepo with npm or pnpm workspaces (use pnpm unless something blocks it)
- **Language:** TypeScript everywhere, `strict: true`
- **Frontend:** Next.js (App Router) in `apps/web`, Tailwind CSS, shadcn/ui, React Hook Form + Zod, TanStack Query
- **Backend:** Express in `apps/api`, Zod for request validation, Mongoose ODM (TypeScript-typed schemas, use `InferSchemaType` or explicit interfaces, no `any`)
- **Database:** MongoDB (docker-compose for local dev, configured as a single-node **replica set** so multi-document transactions work; MongoDB Atlas for production)
- **Object storage:** Cloudflare R2 via the S3-compatible API (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`). Images are uploaded directly from the browser with presigned PUT URLs; the API never proxies image bytes.
- **Shared packages:** `packages/types` (shared Zod schemas and TS types used by both apps), `packages/config` (shared tsconfig, eslint, prettier)
- **Tooling:** ESLint, Prettier, Husky + lint-staged, Vitest for tests, Supertest for API tests

## 2. Monorepo layout

```
.
├── apps/
│   ├── web/            # Next.js storefront + admin dashboard
│   └── api/            # Express API
├── packages/
│   ├── types/          # shared zod schemas + inferred types
│   └── config/         # tsconfig, eslint, prettier presets
├── docker-compose.yml  # mongodb as single-node replica set (use real R2 via env)
├── turbo.json
├── .env.example        # every env var documented
└── README.md
```

## 3. Product requirements

### 3.1 Public storefront (no login for buyers)

- Home page with store branding (logo, name, banner, short description, WhatsApp number), category tiles, and featured/new products.
- **Catalogues:** the owner can group products into named catalogues (e.g. "Diwali Collection", "Summer Kurtis"). Each catalogue has its own shareable URL slug (`/c/[slug]`). Also a main "all products" view.
- Product listing with category filter, search, sort (newest, price low-high, price high-low), pagination or infinite scroll.
- Product detail page: image gallery with zoom, title, description, price, optional MRP and discount %, fabric, care instructions, **variants (size x colour) with per-variant stock**, minimum order quantity (MOQ) if set, and set/pack ordering if enabled.
- **Cart** persisted in localStorage, with quantity editing and per-line subtotal.
- **Checkout without payment:** the buyer enters name, phone, address, city, pincode, and optional note, then places the order. The order is saved in the DB with status `PENDING` and payment status `UNPAID`. After placing, show an order confirmation page with the order number and a **"Send order on WhatsApp" button** that opens `https://wa.me/<owner_number>?text=<prefilled order summary>`.
- **Private catalogues:** a catalogue can be marked private and protected by a simple passcode that the owner shares. Buyers enter the passcode once; store an httpOnly signed cookie scoped to that catalogue. Private catalogue products must never be returned by public APIs without that cookie. (No SMS OTP, since no SMS provider is configured. Design the verification service behind an interface so OTP could be added later.)
- Optional per-catalogue "hide prices until unlocked" / "price on request" flag.
- Fully mobile-first and fast. Most traffic will come from WhatsApp links on phones. Target Lighthouse mobile performance of 90+.
- SEO: metadata, Open Graph tags per product/catalogue (so WhatsApp link previews show the image, title and price), sitemap.xml, robots.txt.

### 3.2 Admin dashboard (`/admin`, single owner, login required)

- Auth: email + password login for the single owner (seeded via script from env vars, hashed with argon2 or bcrypt). Use JWT in an httpOnly, secure, sameSite cookie with refresh handling, or server-side sessions. Protect all `/admin` routes via Next.js middleware and all admin API routes via Express middleware. Include rate limiting on login.
- **Products CRUD:** title, slug, description, category, tags, price, MRP, fabric, care, active/inactive, featured, MOQ, variants (size/colour/SKU/stock), multiple images with drag-to-reorder and a cover image.
- **Image upload flow:** browser asks the API for a presigned PUT URL (validated: image MIME types only, max size, random object key like `products/<uuid>.<ext>`), uploads straight to R2, then the API stores the key. Generate and store width/height. Serve images through a public R2 bucket domain or custom domain via `R2_PUBLIC_BASE_URL`. Use `next/image` with that remote pattern.
- **Bulk import:** upload an Excel/CSV (`.xlsx`) of products and variants; validate row by row, show a preview with errors, then commit in a single Mongoose transaction (or `bulkWrite` with ordered=false and a per-row result report). Provide a downloadable template. Images for bulk import can be attached afterwards or referenced by URL.
- **Categories CRUD** and **Catalogues CRUD** (assign products, set public/private, passcode, slug, ordering of products within a catalogue, cover image).
- **Orders:** list with filters (status, date, search by name/phone/order number), order detail view, status workflow `PENDING -> CONFIRMED -> PACKED -> SHIPPED -> DELIVERED` plus `CANCELLED`, manual payment status (`UNPAID`, `PARTIAL`, `PAID`) with an amount-received field and notes, tracking number/courier text field, internal notes. Reduce stock when an order is confirmed and restore it if cancelled. Print-friendly invoice/packing slip page (no GST engine required, but include an optional GSTIN/tax-inclusive price display toggle in settings).
- **Customers:** auto-created from orders by phone number; show order history and total spent.
- **Live visitor analytics (Catafy-style, simple version):**
  - Public pages send lightweight events (`catalogue_view`, `product_view`, `add_to_cart`, `checkout_started`, `order_placed`) with an anonymous visitor id (cookie/localStorage), session id, referrer, and device type. Do not store raw IPs; if you derive a coarse city, store only that.
  - Admin "Live" page shows visitors active in the last 5 minutes, what they are viewing, and time on page, updated via Server-Sent Events or short polling (pick one, document why).
  - Basic reports: views per product, top products, conversion funnel, orders per day, revenue (sum of order totals) per day/week/month.
- **Settings:** store name, logo, banner, WhatsApp number, address, currency (default INR), social links, order-confirmation message template, low-stock threshold.

## 4. Data model (Mongoose) - starting point, refine as needed

Collections: `users` (owner), `storesettings` (single doc), `categories`, `products`, `catalogues`, `customers`, `orders`, `analyticsevents`, `visitorsessions`, `counters`.

Modelling guidance (think document-first, not relational):
- **Embed** what is always read together: `Product` embeds `images[]` and `variants[]` (size, colour, sku, stock); `Order` embeds `items[]` as a snapshot (title, image, price, size, colour, qty) and the shipping address; `Catalogue` holds an ordered `productIds[]` array (ObjectId refs) instead of a join collection.
- **Reference** what is shared or grows unbounded: `Product.categoryId`, `Order.customerId`, analytics events (separate collection).
- Define Mongoose schemas with `timestamps: true`, strict mode, validators, and exported TS types; share Zod schemas from `packages/types` for API input/output.

Rules:
- Store money as integer paise (not floats).
- Order items snapshot product data so later edits never change past orders.
- Soft delete products (`deletedAt`).
- Add explicit indexes: unique `slug` on products/categories/catalogues, unique `orderNumber`, unique `customers.phone`, compound index on `analyticsevents` (`createdAt`, `type`), `visitorsessions.lastSeenAt`, and a text index on product title/tags for search. Add a TTL index on `analyticsevents` (e.g. 180 days) so the collection does not grow forever.
- Human-friendly order numbers (e.g. `ORD-2026-00042`) generated from a `counters` collection using an atomic `findOneAndUpdate` with `$inc` and `upsert`, never by counting documents.

## 5. API design

- REST, versioned under `/api/v1`. Separate routers: `public/*` (storefront, no auth) and `admin/*` (auth required).
- All inputs validated with Zod schemas imported from `packages/types`; the same schemas power form validation on the frontend.
- Consistent error format `{ error: { code, message, details? } }`, a central error handler, and request ID logging (pino).
- Security: helmet, CORS limited to the web origin, rate limiting on public order/analytics/passcode endpoints, input size limits, no stack traces in production, CSRF protection for cookie-authenticated mutating admin requests, and never trust client-sent prices (always recompute totals on the server from DB prices).
- Concurrency: two buyers must never oversell the same variant stock. Decrement stock with an atomic conditional update (e.g. `updateOne({ _id, 'variants._id': variantId, 'variants.stock': { $gte: qty } }, { $inc: { 'variants.$.stock': -qty } })` using arrayFilters/positional operator) and check `modifiedCount`. Wrap order creation + stock updates in a Mongoose transaction (`session.withTransaction`) and roll back if any line fails. This requires the replica-set setup noted above.

## 6. Frontend guidelines

- Next.js App Router with Server Components for public pages (ISR/revalidation on product and catalogue changes via an authenticated revalidate endpoint), Client Components only where interactive.
- Clean, elegant, fashion-oriented design: generous whitespace, large product imagery, soft neutral palette with one accent colour configurable in settings. Use the `frontend-design` mindset: avoid generic template looks.
- Accessible (labels, focus states, alt text, keyboard navigation) and responsive from 360px up.
- Loading skeletons, empty states, optimistic UI where sensible, toast feedback.

## 7. Environment variables (document all in `.env.example`)

`MONGODB_URI`, `API_PORT`, `WEB_ORIGIN`, `JWT_SECRET` (or session secret), `COOKIE_DOMAIN`, `OWNER_EMAIL`, `OWNER_PASSWORD` (seed only), `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`, `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SITE_URL`. Validate env at startup with Zod and fail fast with a clear message.

## 8. How I want you to work

1. **Start with a plan.** Before writing code, inspect the repo, then give me a short implementation plan with phases and any assumptions or decisions you need me to confirm. Ask only questions that truly block progress; otherwise decide, and record the decision in `docs/DECISIONS.md`.
2. **Build in these phases, one at a time, and stop for my review after each:**
   - Phase 1: Turborepo scaffold, shared config, docker-compose MongoDB (single-node replica set), env validation, Mongoose connection + models + indexes + seed script (owner user, default settings), Express skeleton (health check, error handling, logging), Next.js skeleton, CI-ready scripts (`dev`, `build`, `lint`, `typecheck`, `test`).
   - Phase 2: Owner auth, admin layout, categories and products CRUD, R2 presigned uploads with image gallery management.
   - Phase 3: Public storefront (home, listing, product page, search/filter/sort), catalogues with public URLs, SEO and Open Graph.
   - Phase 4: Cart, checkout without payment, order creation with stock handling, WhatsApp prefilled message, order confirmation page.
   - Phase 5: Admin orders, customers, status workflow, manual payment tracking, printable invoice/packing slip.
   - Phase 6: Private catalogues with passcode, price-on-request option, Excel/CSV bulk import.
   - Phase 7: Analytics events, live visitors page, reports, settings page.
   - Phase 8: Hardening: tests, security review, performance pass, README with local setup and deployment notes (Next.js on Vercel or a VPS; API on a VPS/Render/Railway; R2 bucket + CORS config for browser PUT uploads).
3. **Quality bar:** no `any`; shared types from `packages/types`; small focused modules (routes -> controllers -> services -> repositories, or similar clear layering); meaningful tests for pricing/total calculation, stock reservation, passcode access control, and presigned-upload validation; run `typecheck`, `lint` and `test` before declaring a phase done.
4. **Git hygiene:** make small, conventional commits per logical step. Never commit secrets.
5. **Don't over-build.** No payment gateway, no multi-tenant, no native mobile app, no email/SMS integrations in v1. Mention any future-extension hooks in the README instead.
6. At the end of each phase, give me: what was built, how to run and verify it, and what comes next.

Begin now with the plan and Phase 1.
