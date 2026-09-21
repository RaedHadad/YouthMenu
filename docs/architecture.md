# Architecture and delivery plan

## Current checkpoint

Phases 1–9 establish the existing Next.js 16 App Router / React 19 / TypeScript /
Tailwind 4 foundation, PostgreSQL data model, customer menu, server pricing and
protected order credentials with retry recovery, plus printable Arabic receipts and protected admin sessions. This directory was not empty. Existing database, ordering,
admin and scanner code has been preserved, with compilation fixes and database integration; it is not yet
a verified production implementation. Versions remain locked in package-lock.json.

## Database

Use managed PostgreSQL with Prisma. A pooled DATABASE_URL serves Vercel requests;
DIRECT_URL serves schema migrations. Run migrations once per release, outside
request handling. Never connect to PostgreSQL from a browser.

Model Admin, AdminSession, MenuItem, Topping, MenuItemTopping, Order, OrderItem and
OrderItemTopping. Use integer agorot, snapshot names/prices on order creation,
archive menu records, and allocate order numbers with a database sequence.
Store hashes of separate customer access and pickup credentials; generate each
with 32 cryptographically random bytes. Customer order access never uses a public
sequential number as its authorization credential.

Cash pickup must use one conditional database update inside a transaction:
WHERE pickupTokenHash = suppliedHash AND status = READY. Only the request that
updates one row may set COLLECTED, CASH, PAID, collectedAt and collectedByAdminId.
Keep the order permanently in history. Test concurrent attempts on real PostgreSQL.

## Real-time architecture (Phase 8)

Use Ably Pub/Sub. Ably maintains WebSocket connections; Vercel handlers publish
through the REST API after database commits. This avoids a persistent server in
Vercel and works across function instances. A development/free offering is useful
for local work; verify current account quotas before deployment.

Reference: https://ably.com/blog/realtime-chat-app-nextjs-vercel

The server issues short-lived tokens with subscribe-only capabilities. Admins may
subscribe to the private kitchen channel after session validation. Customers may
subscribe only to their order channel after access-token verification. Never send
pickup tokens, customer names or whole order records in broadcast events. Publish
invalidation events and fetch authorized snapshots. Persist an event outbox in the
order transaction, retry delivery, and refetch on reconnect with polling fallback
so transient publish failures cannot permanently hide committed changes.

Phase 8 removes the old in-memory listener set, installs Ably and implements
private kitchen subscriptions, transactional outbox delivery and snapshot recovery.
Live-provider smoke testing remains pending; the user requested local tests.
See [real-time operations](realtime.md).

## Authentication decision (Phase 7)

Use bcrypt password hashes and random opaque, hashed database sessions with
server-enforced expiry and revocation. Cookies: HttpOnly, Secure in production,
SameSite=Strict, Path=/. Verify the session and admin record on every protected page
and API/action. Proxy is an optimistic navigation redirect only. Mutations also
need same-origin/CSRF protection. Use a shared rate-limit store for login,
customer order creation and pickup lookup; fail safely if the store is unavailable.

Phase 7 replaces signed cookies with verified database sessions. Customers do
not register. The menu seed no longer creates an admin or resets passwords.

## Directory layout

```text
app/
  layout.tsx, globals.css, loading.tsx, error.tsx, not-found.tsx
  page.tsx                         # customer menu
  admin/                           # login, kitchen, menu, history, scanner
  api/                             # validated request/response boundaries
components/                        # reusable customer and admin UI
lib/                               # auth, business rules, DB, realtime, money
prisma/
  schema.prisma
  migrations/                      # initial schema and integrity upgrade
scripts/                           # menu seed and explicit admin provisioning
__tests__/                         # unit tests; integration coverage in Phase 13
docs/architecture.md
proxy.ts                           # optimistic redirects, not authorization
```

Customer UI is now split into dish list, topping picker, order form, header and
receipt components under components/customer. Further split status, kitchen board,
estimated time and pickup confirmation as those phases are implemented. Keep database and secrets server-only.

## Phases and acceptance gates

1. Foundation: Arabic RTL layout, brand tokens, accessibility basics, loading/error
   routes, Next.js conventions, typecheck/lint/test scripts and production build.
2. Database: reviewed schema, migrations, constraints, safe idempotent seed,
   per-item topping assignments and database-generated order numbers.
3–6. Customer: database menu, validation, authoritative pricing, secure creation,
   immutable receipt data, QR, print and reliable persistence.
7. Authentication: database sessions, server authorization, provisioning, rate limits.
8–9. Live updates: Ably authorization/outbox, kitchen board, ETA, reconnect behavior,
   sound and optional browser notifications.
10. Menu management: archive/edit availability/prices and topping assignments.
11. Pickup: camera scanning, preview then explicit cash confirmation, atomic update.
12. History: bounded pagination, date/status/name/order filters and snapshots.
13. Security: integration tests for access control, token isolation, concurrent
    redemption, historical prices and all critical business requirements.
14. Responsive polish: actual browser checks at phone/tablet/desktop sizes, RTL,
    keyboard/focus behavior, print and camera permissions.
15. Deployment: Vercel envs, migration workflow, providers, production smoke tests.

Run npm run check after every major phase and npm run build when appropriate.
A successful build does not establish database, camera, live-update or security
correctness.

## Remaining release gates

Live Ably delivery, physical phone-camera/printing checks, production environment
setup and deployment are still required. See [final verification](final-verification.md)
and [release runbook](deployment.md). Code now covers pickup, history, shared quotas
and all requested implementation phases.

## Phase 2 checkpoint

Two migrations reconstruct the original schema and then add session storage,
archives, indexes, a sequence for order numbers, required access hashes and CHECK
constraints. The second migration preserves existing numbers and initializes the
sequence above their maximum. Legacy orders without an access credential receive
unrecoverable random hashes; no customer access is granted by this migration.

A transactional SeedRun marker and PostgreSQL advisory lock make concurrent seed
commands safe. On the first run, existing named menu records retain their prices,
availability and assignments. New food dishes receive the three default sauces;
تروبيت receives none. Later runs do nothing, including after renames or archives.
No admin is created by the menu seed.

The order creation route now relies on the database sequence, rejects archived
products/toppings and checks dish assignments. Customer topping selection uses the
same relations. Other ordering and authentication hardening remains in later phases.

See [database setup and upgrade procedures](database.md). Prisma remains on the
existing locked 5.22 release for this phase; a major ORM upgrade requires a separate
compatibility review before final deployment.


## Phase 3 checkpoint

The customer page queries PostgreSQL at request time through getCustomerMenu, using
one relational query and an explicit public-field projection. Archived dishes and
toppings are omitted; unavailable options remain visible and disabled. No menu
names, prices or topping assignments are hardcoded in the customer React UI.

Customers explicitly choose a dish via a native radio group, choose only its
assigned toppings through native checkboxes and see an accessible order form.
Switching dishes clears topping selection. Empty/sold-out states explain why an
order cannot be placed. A refresh button reads the current database menu without
redeployment and disables ordering if a selected dish has become unavailable.

Header, dish list, toppings, form and receipt are separate components. Brand colors,
large headings, rounded cards, RTL flow, keyboard focus and cash-only wording are
preserved. Receipt extraction also removed sample food/QR fallbacks and retains
initial order details before the first status fetch.

Verified with 7 unit tests, 14 PostgreSQL integration tests and 8 Chromium browser
checks, including 360/768/1440px layout screenshots. Order submission is intercepted
in the menu browser suite: this phase does not claim end-to-end secure ordering,
live delivery or pickup completion. Next is Phase 4's server-side validation and
pricing review, followed by secure creation and receipt/persistence work.


## Phase 4 checkpoint

The production route and PostgreSQL integration tests now call the same HTTP
handler. It enforces a strict JSON schema, bounded actual body bytes, Arabic
validation messages, integer-only quantities, unique bounded topping IDs and
rejection of client prices or unknown fields. Unsupported content types receive
415; malformed JSON receives 400 instead of an internal-server error.

`lib/pricing.ts` is the sole server price calculator. It charges toppings per unit,
rejects rounding/coercion and checks PostgreSQL integer bounds. Removed the unused
parallel validation/calculation functions that previously diverged from the route.
`lib/orders/` separates request parsing, database quote, transactional creation,
and HTTP error handling.

The database quote loads active menu data and assigned toppings in a serializable
transaction. Snapshots and total are persisted in the same transaction. Only
confirmed serialization rollbacks are retried, bounded to three attempts. This is
consistent with a serial execution of concurrent menu edits and ordering, not a
promise to lock in the price previously shown in the browser.

Verified: 44 unit tests, 26 PostgreSQL integration tests and 8 Chromium checks.
Integration coverage now includes the actual creation handler, stale menu prices,
unavailable/archived/unassigned choices, duplicate toppings, price injection,
malformed/oversized requests, snapshot values and atomic rejection without writes.

At the Phase 4 checkpoint, credential/idempotency hardening remained for Phase 5.

## Phase 5 checkpoint

Orders now have independent cryptographically random pickup/access credentials,
purpose-separated hashes, cryptographic visible codes with collision retries,
and a unique hashed retry key. Snapshots, retry metadata and encrypted response
credentials commit together. Concurrent retries return one order; changed inputs
cannot reuse its key. The browser saves attempts before sending and recovers the
same order after a lost response and refresh.

Status uses bearer headers and an explicit receipt-field projection. Invalid
credentials and unknown orders have the same response. Configured legacy HMAC
tokens remain supported through a versioned migration. Default-secret fallbacks
were removed, including from the existing admin helper; full database sessions
still require Phase 7.

Creation checks the configured public origin, compatible with reverse proxies.
Generate the local ORDER_TOKEN_ENCRYPTION_KEY with `npm run orders:key`; see
[credential operations](order-security.md) for deployment and rotation limits.
Rate limiting and the final security review remain later gates.

Verified: 54 unit tests, 36 PostgreSQL integration tests and 11 Chromium checks.
Next is Phase 6: receipt presentation, QR and print verification.


## Phase 6 checkpoint

The receipt now has a semantic Arabic RTL ticket layout, prominent order number,
wrapping detail rows, isolated left-to-right money/code text, status announcements,
preparation estimate and cash-at-pickup wording. The secure pickup QR uses a
180px canvas, a four-module quiet zone and medium error correction.

Print rules remove unrelated elements from layout, preserve the receipt header,
hide controls, and use an 80mm-wide monochrome ticket without absolute positioning
or clipped overflow. QR/pickup blocks stay together across page breaks. See
[receipt operation and printer limits](receipts.md).

Verified: 54 unit tests, 36 PostgreSQL integration tests and 15 Chromium checks,
including pixel-level QR decoding, refresh recovery, historical prices, long Arabic
names at 320/768/1440px, print-media isolation and generated A4 PDFs.
Next is Phase 7: admin authentication and server-side authorization.


## Phase 7 checkpoint

Replaced signed cookies with random hashed database sessions, absolute eight-hour
expiry, rotation and server-side logout revocation. Every existing admin page/API
checks the session and admin relation. Admin mutations enforce the configured
public origin; API errors are private and distinguish authorization from outages.
Added shared atomic PostgreSQL login limits, generic credential failures, bounded
login input, bcrypt byte-limit validation, accessible pending/error login states,
admin navigation/logout, and CLI session revocation/cleanup.

Verified: TypeScript, ESLint, 58 unit tests, 38 PostgreSQL tests, 18 Chromium
browser tests, Prisma schema validation and production build. Browser coverage
checks all existing protected pages and API methods with absent/forged cookies,
actual login/logout, session rotation, private cookies and login throttling.
Next is Phase 8: the admin real-time order dashboard.
See [authentication operations](admin-authentication.md).


## Phase 8 checkpoint — local verification

The kitchen now uses Ably subscribe-only five-minute credentials and private,
content-free invalidations, fetching authorized snapshots on events/reconnects.
Eight-second reconciliation remains enabled for missed publications and session
revocation. Connection mode, new-order notices, errors and manual retry are visible.

New orders and valid kitchen transitions commit an outbox record in the same
transaction. Conditional updates reject stale actions and prohibit generic cash
collection. Leased bounded outbox batches run after responses, with backoff and a
protected scheduler endpoint/CLI for recovery. No scheduler has been deployed.

Local verification: 62 unit tests, 41 PostgreSQL tests and 19 Chromium tests.
The browser suite disables real provider credentials. SDK events and reconnects
are simulated in unit tests; real Ably delivery remains a pre-deployment check,
as requested by the user. See [setup and limits](realtime.md).
Next is Phase 9: customer live status and preparation estimates.


## Phase 9 checkpoint — local verification

Customers receive a short-lived subscribe-only capability for their own order after
access-token verification. Outbox delivery now covers both kitchen and order
channels. Customer snapshots refresh on events/reconnect/visibility/network changes
and polling, with serialized requests and persisted latest receipt details.

Kitchen cards provide preset/custom estimates independent of status transitions.
Server validation restricts estimates to 1–180 minutes in waiting/preparing states
and rejects stale status expectations. Customers see an unknown-time message until
an estimate is set. Ready status always shows the green banner; optional user-enabled
sound and notifications are guarded and deduplicated within a tab across reloads.

Local checks include 62 unit tests, 43 PostgreSQL tests and 21 Chromium tests.
See [customer live status and alert limitations](customer-live-status.md).
Next is Phase 10: admin menu and topping management.


## Phase 10 checkpoint

Menu/topping administration supports creation, editing, availability, archives,
restoration and topping assignments. Server validation and serializable transactions
protect mutations; order snapshots remain unchanged. The reusable Arabic form uses
shekel prices, explicit labels, pending states and server-confirmed refreshes.

Verification: 62 unit tests, 44 database tests, a focused menu-management browser
workflow, TypeScript, ESLint and production build. Full browser regressions were
not repeated in this phase to respect the user's credit preference.
See [menu operations](menu-management.md). Next: Phase 11, secure QR cash pickup.

## Phases 11–15 checkpoint

See [final verification](final-verification.md) for pickup, history, security, responsive
checks and Vercel preparation. Live-provider/device checks remain pre-launch gates.
