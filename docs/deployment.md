# Vercel release runbook

The repository is prepared for Vercel; no production deployment or paid service
has been created by this implementation. Use separate production and preview
PostgreSQL databases and Ably apps. Keep the database near the function region.

1. Import the GitHub repository into Vercel with the Next.js preset. Use Node 22
   or a compatible supported newer version, npm ci, and npm run build. postinstall
   generates the locked Prisma 5 client. Do not switch to Prisma 7 setup commands.
2. Set DATABASE_URL (pooled), DIRECT_URL (migration connection), a stable random
   ORDER_TOKEN_ENCRYPTION_KEY (64 hex characters), and NEXT_PUBLIC_APP_URL (the exact
   HTTPS public origin). Set ABLY_API_KEY with publish/subscribe capability for
   youthmenu:kitchen and youthmenu:order:*. Never put secrets in NEXT_PUBLIC fields.
   SESSION_SECRET is needed only when preserving legacy version-1 customer tokens.
3. From a trusted release environment targeting the correct database, run
   npm run db:migrate, then npm run db:seed. The seed is once-only and does not reset
   admin menu changes. Back up existing data before migrating. Never run migrate
   reset or db push against production. Do not let preview builds migrate production.
4. Provision the first admin with npm run admin:create using one-time ADMIN_EMAIL
   and ADMIN_PASSWORD. Remove ADMIN_PASSWORD afterward. Session revocation is
   available through npm run admin:sessions.
5. Deploy the application after schema preparation. Build does not seed or migrate.
   Confirm the configured origin matches the domain used by admins and customers.
6. Configure a scheduler for GET /api/internal/realtime using a random 32+ character
   CRON_SECRET and its Bearer authorization header. Choose frequency within your
   Vercel/provider plan and monitor backlog; the outbox sends five events per call.
   No cron schedule is imposed in vercel.json. Active requests also retry delivery.
   Vercel sends CRON_SECRET in the Authorization header for its scheduled requests:
   https://vercel.com/docs/cron-jobs/manage-cron-jobs
7. Run the smoke checklist below before opening ordering to customers.

## Required live smoke checks

- Create an order from a phone; confirm the exact total, Arabic details, saved receipt
  after reload, readable printed QR and cash-only wording.
- Open two admin browsers. Verify new-order/status/estimate delivery through actual
  Ably connections, and recovery after network/provider interruption.
- Grant/deny camera and notification permissions on intended iOS/Android devices.
  Scan a real receipt. Preview must not collect it. Confirm once after receiving
  cash; a second scan must report already collected. History must retain payment,
  admin attribution and timestamps. Test two staff devices scanning simultaneously.
- Check secure cookies over HTTPS, unauthorized API access, logout revocation,
  no credentials in logs, backups, migration restore, and dependency monitoring.
- Exercise the actual thermal/printer settings; automated PDFs do not validate
  physical printers or cameras. Notifications require an open page and browser support.

## Operational limits

PostgreSQL provides shared login quotas plus 120 order requests/minute globally and
60 scanner requests/minute per admin. The global order limit is intentionally
simple and can be exhausted by an attacker; complement it with provider ingress
protection and tune limits for the expected venue. The quota includes retries.
Failures in the quota database fail closed. Counters share the AdminLoginLimit
storage table with distinct server-chosen keys; daily cleanup removes old buckets.

Retain pending outbox events; prune old delivered events after an agreed retention
period. Run expired-session cleanup regularly. Alert on outbox backlog, quota/5xx
spikes and database capacity. No external uptime/backups/monitoring service is
provisioned by this repository. A full CSP and independent penetration test are
not claimed; security headers include framing denial, MIME sniffing protection,
no-referrer and camera-only permissions. Customer status/token requests require
unguessable credentials; additional edge throttling is advised for public ingress.

Rollback application code only to a version compatible with the migrated schema.
Use forward-fix migrations for schema errors; restore backups only under an explicit
recovery procedure. Keep the order encryption key backed up to preserve retries.
