# PostgreSQL setup and verification

## New local database

Use Node.js 22.9+ and Docker Compose, or provide your own PostgreSQL instance.
Copy `.env.example` to `.env.local` if you have not already done so. For the included
Compose service, set LOCAL_POSTGRES_PASSWORD to a unique local password and use:

```text
DATABASE_URL="postgresql://youthmenu:URL_ENCODED_PASSWORD@localhost:5432/youthmenu?schema=public"
DIRECT_URL="postgresql://youthmenu:URL_ENCODED_PASSWORD@localhost:5432/youthmenu?schema=public"
```

If you change LOCAL_POSTGRES_PORT, update both connection URLs. Compose binds only
to loopback and stores data in a named volume. Changing the environment password
later does not rotate a password already stored in the PostgreSQL volume.

```sh
docker compose --env-file .env.local up -d --wait
npm run db:generate
npm run db:validate
npm run db:migrate
npm run db:seed
npm run db:status
npm run dev
```

`docker compose --env-file .env.local stop` stops the service without deleting data.

The first seed inserts مقدوحه (₪5), توست (₪5), مقدوحه مع جبنه (₪5), تروبيت (₪1),
and كاتشب / خردل / طحينة (free). Newly created food dishes receive all three sauces;
تروبيت receives none. Existing records retain their assignments. A completed seed
never resets renamed items, prices, availability, archived records or assignments.

The seed is atomic and concurrent commands are serialized. Its SeedRun record is
intentional: do not remove it to reset production data. New seed data should use a
separate reviewed data migration. The seed never creates an admin.

## Migrations

- `202609200001_initial`: the schema present before Phase 2.
- `202609200002_database_integrity`: session and seed records, archive fields,
  sequence-backed order numbers, required customer hashes, indexes, foreign-key
  rules and database CHECK constraints.
- `202609210001_secure_order_creation`: versioned credential hashing, a unique
  retry-key hash, request fingerprint and encrypted response credentials.
- `202609210002_admin_login_limits`: shared atomic login attempt counters.
- `202609210003_realtime_outbox`: durable order invalidations with delivery leases
  and retry metadata.

Use `npm run db:migrate` to apply committed migrations. Use
`npm run db:migrate:dev -- --name descriptive_name` only on a development database
when authoring a new migration. Review the generated SQL. Prisma 5 does not represent
CHECK constraints in schema.prisma, so keep the handwritten SQL checks intact.
Do not use db push or migrate reset as a production deployment procedure.

Menu deletions detach source references from historical snapshots. Parent order
and order-item deletion is restricted when historical children exist. Archiving
is the intended menu removal flow. Application-level order deletion is not provided.

## Existing database without migration history

Back up first and rehearse against a copy. Do not run the initial migration on a
non-empty schema or assume that an arbitrary database matches this baseline.
Compare its tables against `202609200001_initial/migration.sql`. Only if they match,
mark that baseline applied, then run the upgrade:

```sh
node --env-file=.env.local node_modules/prisma/build/index.js migrate resolve --applied 202609200001_initial
npm run db:migrate
npm run db:generate
```

The upgrade preserves order numbers and advances the sequence above the highest
existing number. Orders without customer access hashes get new random hashes whose
credentials are never issued; those legacy orders remain inaccessible to customers.
It does not overwrite valid existing access hashes.

Existing invalid prices, quantities, hashes or inconsistent collection/payment
data cause the integrity upgrade to fail and roll back. Review and repair the
actual data rather than weakening constraints. With a failed migration recorded,
follow Prisma's failed migration recovery procedure before retrying.

Prisma references: [baselining](https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining)
and [migration CLI](https://docs.prisma.io/docs/cli/v7/migrate). Commands here are
verified against this project's installed Prisma 5.22 CLI.

## Database integration tests

Set TEST_DATABASE_URL to a disposable **local** PostgreSQL database whose name
contains `test`. The test role needs permission to create schemas. Each run creates
random isolated schemas, applies the real migrations and drops only those schemas
in teardown. It never resets the default schema or uses DATABASE_URL for tests.

For the included local service, create a separate test database once:

```sh
docker compose --env-file .env.local exec postgres createdb -U youthmenu youthmenu_test
```

Set TEST_DATABASE_URL using the same credentials and port with database name
youthmenu_test, then run:

```sh
npm run test:db
```

The suite covers fresh/repeated deployment, schema consistency, upgrading an old
order, concurrent numbering and seeding, preserving admin menu edits, exact Arabic
seed data, constraints, session foreign keys and historical snapshots. Missing test
configuration fails explicitly; the ordinary unit test command does not run this
separate database suite. It also verifies the creation handler, concurrent retry
safety, credentials and private status access. Pickup integration remains for later phases.

## Hosted PostgreSQL and Vercel

Set DATABASE_URL to the provider's pooled connection string and DIRECT_URL to its
direct migration connection. Use provider-required TLS settings. Configure these
as server-only Vercel environment variables. Provision separate databases for
preview and production. Run migrations once in a controlled release step, then
build and deploy. Do not invoke migrations or seed from a request handler.

Menu items have a `FOOD` or `DRINK` category (food by default). Migration
`202609220001_menu_drinks` categorizes the existing تروبيت item as a drink without
changing its price or historical orders. Admins choose the category when adding
or editing an item. Drinks do not have food toppings.

Customers can add optional drinks, each with its own quantity, alongside the
selected food. Each drink is stored as a separate order item with a price/name
snapshot. The server validates drink category and availability, computes the
combined total, and includes drink selections in the idempotency fingerprint.
Existing food-only pending requests retain their original replay fingerprint.

Customers can select up to 20 different foods, each with its own quantity and
allowed toppings. Quantity controls appear beneath each selected food card.
Additional foods use the optional `additionalFoods` request field, keeping
existing single-food requests and pending-order recovery compatible. All food
and drink lines are priced server-side and saved on the same order/receipt.

Drinks are selectable without food. For drink-only orders, the first selected
drink uses the primary item fields and remaining drinks use `drinks`; quantities,
prices, receipt snapshots, and pending-order recovery follow the same flow.

A selected food can have multiple topping versions using "إضافة نسخة بإضافات مختلفة".
Each version has its own quantity and toppings and is saved as a separate order
item. The 20-piece limit applies across versions of the same food; an order can
contain at most 20 food lines. Kitchen cards keep toppings with their corresponding
line, matching the customer receipt and order history.
