# Remaining phase delivery

Phase 11: authenticated QR preview and explicit cash confirmation. Conditional
READY + UNPAID updates atomically set COLLECTED, CASH, PAID, timestamp and staff ID,
with an outbox event in the same transaction. Concurrent confirmations permit one
winner. Scanner camera start/stop, retry, permission errors and manual token entry
are supported. Tokens are not rendered as scanned-result text or placed in URLs.

Phase 12: authenticated history, customer/order-number search, status and UTC date
filters, 25-row pagination, snapshot details/prices, payment state and lifecycle
timestamps. Display times use Asia/Jerusalem. Records are never deleted on pickup.

Phase 13: session/origin checks on all admin routes, strict request input, bounded
bodies, hashed credentials, shared quotas, safe error responses, atomic pickup,
private response projections, dependency audit and full regression tests. This is
an implementation review, not a claim of independent penetration testing.

Phase 14: customer layouts at phone/tablet/desktop widths, Arabic RTL, keyboard
selection, receipt print checks, and phone-width scanner/history checks. Physical
camera, printer and mobile background-notification checks remain release gates.

Phase 15: Vercel config, automatic Prisma generation and release/rollback/env/cron
instructions in deployment.md. Live deployment remains external setup work.

Final checks passed: 62 unit tests, 47 PostgreSQL integration tests, 23 Chromium
browser tests, TypeScript, ESLint, Prisma schema validation and production build.
The npm dependency audit reported zero known vulnerabilities at verification time.
