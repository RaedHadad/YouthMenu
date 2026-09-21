# الأحداث — YouthMenu

Arabic RTL food ordering for cash payment at pickup. No online payment gateway.

**Status: Phases 1–7 completed; Phase 8 implemented and locally verified.** The existing partial application now has a checked
Next.js foundation, PostgreSQL migrations, safe initial seeding and a database-driven
Arabic customer menu with keyboard and responsive browser checks. Order requests
now use strict validation, transactional integer pricing, protected credentials
and safe retry recovery. Customers receive an Arabic ticket with a verified pickup QR
and receipt-only print styling; see [receipt and print notes](docs/receipts.md).
Later phases are still in progress; this is not ready for public production use.
See [architecture and phase gates](docs/architecture.md).

## Local setup

Use Node.js 22.9+ (Node 22 LTS or a newer compatible release).

```sh
npm ci
cp .env.example .env.local
```

Configure PostgreSQL in `.env.local`. The optional `compose.yaml` provides a local
database after you set LOCAL_POSTGRES_PASSWORD. Follow the
[database setup guide](docs/database.md), then:

```sh
npm run db:generate
npm run db:migrate
npm run db:seed
npm run orders:key
npm run dev
```

Never commit real credentials. Next.js and the database scripts load `.env.local`;
explicit process environment variables take precedence. The menu reads PostgreSQL;
without a reachable initialized database, the Arabic error page offers a retry.

## Checks

```sh
npm run check       # route types, TypeScript, ESLint, 62 unit tests
npm run db:validate
npm run test:db     # 41 PostgreSQL integration tests; requires TEST_DATABASE_URL
npm run test:browser # 19 Chromium checks; requires TEST_DATABASE_URL and browser install
npm run build
npm start
```

`npm run test:watch` starts Vitest in watch mode. Database tests use isolated local
schemas and fail explicitly if not configured. The production build uses supported
Webpack because this environment blocks Turbopack worker port binding.

## Environment

| Variable | Purpose |
| --- | --- |
| DATABASE_URL | Pooled PostgreSQL application connection |
| DIRECT_URL | Direct PostgreSQL migration connection |
| LOCAL_POSTGRES_PASSWORD / LOCAL_POSTGRES_PORT | Optional local Compose database |
| TEST_DATABASE_URL | Disposable local database for integration tests |
| SESSION_SECRET | Legacy version-1 customer token verification only; no longer used by admin sessions |
| ORDER_TOKEN_ENCRYPTION_KEY | Required 64-character hex key for encrypted order-retry credentials |
| ABLY_API_KEY | Server-only kitchen publish/token credential; see docs/realtime.md |
| CRON_SECRET | Optional 32+ character secret for scheduled outbox delivery |
| UPSTASH_REDIS_URL / UPSTASH_REDIS_TOKEN | Reserved for shared rate limiting |
| NEXT_PUBLIC_APP_URL | Exact browser-facing origin, used to validate request origins |
| ADMIN_EMAIL / ADMIN_PASSWORD | Explicit one-time admin provisioning inputs |

Generate a secret with `openssl rand -hex 32`. `.env.example` has placeholders only.
`npm run orders:key` generates the order key in ignored `.env.local` without
printing it or overwriting an existing nonempty value. Keep the key stable and
set it in the deployment environment; see [credential setup](docs/order-security.md).

## First admin

After migrations, set ADMIN_EMAIL and a unique ADMIN_PASSWORD in your ignored local
environment file. Use at least 14 characters and at most 72 UTF-8 bytes for bcrypt.

```sh
npm run admin:create
```

The command rejects duplicate emails instead of resetting passwords. Remove the
provisioning password from the environment after use. The menu seed never creates
admins. Admin sessions now use database-backed expiry and revocation. See
[admin authentication and session maintenance](docs/admin-authentication.md).

## Deployment plan

Use Vercel for Next.js, managed PostgreSQL for data and Ably for real-time transport.
Keep the database close to the Vercel function region. Use separate preview and
production databases and put secrets in server environment variables.

Before public deployment, finish [all phase gates](docs/architecture.md), review
[database migration procedures](docs/database.md), run migrations, generate the
Prisma client and pass the checks/build. Configure Ably and shared rate limiting,
then test creation through cash pickup on actual devices. The current checkpoint
still lacks completed live delivery, secure pickup and full authentication hardening.


## Customer menu browser checks

Install Chromium once with `npx playwright install chromium`, configure the local
TEST_DATABASE_URL described in [database setup](docs/database.md), then run
`npm run test:browser`. The runner creates a random isolated schema, applies
migrations, starts a test Next.js server on port 3107 and removes the schema when
the suite finishes. It does not reset your application database. Keep port 3107
free and avoid running another Next.js process in this checkout during these tests.

Checks cover explicit selection, assigned toppings, unavailable/archived records,
empty and sold-out menus, prices refreshed from PostgreSQL, identifier-only order
submission, keyboard operation and widths of 360, 768 and 1440 pixels. Screenshots
are written to ignored `test-results/` directories. Tests also cover committed
orders with deliberately lost responses, recovery after refresh, authorization
headers and storage failure before submission. These tests use Chromium;
Safari, Firefox, real-device camera and full pickup tests remain for later phases.


## Order pricing and validation

POST `/api/orders` accepts JSON containing `menuItemId`, `selectedToppingIds`,
`quantity` and `customerName`. Toppings may be omitted for an empty selection.
An `Idempotency-Key` header is required: 32 random bytes encoded as 64 lowercase
hex characters. The browser saves this key before sending and reuses it with the
same payload when retrying an uncertain outcome.
Unknown fields (including prices or payment status) are rejected. Quantity must be
an integer from 1 to 20; topping IDs must be unique, with at most 30 selections.
Names are trimmed and limited to 2–80 characters; bodies are limited to 8 KiB.

The server checks active dish/topping records and dish assignments, calculates
`(dish price + selected topping prices) × quantity` in integer agorot, and saves
immutable name/price snapshots in a serializable transaction. Conflicts are retried
up to three attempts; connection failures are not automatically retried.

Responses: 201 for creation or replay, 400 for invalid input/unavailable choices,
403 for a rejected origin, 413 for oversized bodies, 415 for unsupported formats,
409 for changed input under an existing key or exhausted serialization retries,
503 for missing credential configuration and generic Arabic 500 errors for
unexpected failures. Responses
are not cached. Prices are resolved at submission time, so a price changed after
loading the menu becomes the authoritative receipt price.

An existing retry key returns its original price and credentials, even after menu
changes. Status requests use `Authorization: Bearer <customerAccessToken>`; URL
tokens are no longer accepted. Unknown orders and invalid credentials return the
same 404 response. Customer order rate limiting, real-time delivery
and secure pickup remain in later phases before production deployment.

## Kitchen real-time setup

See [Ably configuration, durable delivery and verification](docs/realtime.md).
Without an Ably key the kitchen uses automatic eight-second refreshes. A live
provider smoke test remains required before deployment.
