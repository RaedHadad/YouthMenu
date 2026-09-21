# Admin authentication

Phase 7 replaces the legacy signed cookies with opaque database sessions.
Existing admin accounts remain usable. Old cookies are intentionally rejected;
admins must log in again after deployment. Apply all migrations first.

## Provisioning

Set ADMIN_EMAIL and ADMIN_PASSWORD in the ignored local environment, then run
`npm run admin:create`. Emails are normalized to lowercase. Passwords must contain
at least 14 characters and no more than 72 UTF-8 bytes (bcrypt's input limit).
The command hashes at bcrypt cost 12, refuses duplicate emails and never prints
passwords or raw database errors. Remove ADMIN_PASSWORD after provisioning.
There is no public registration endpoint or default admin password.

## Sessions and authorization

Each login generates 32 random bytes. Only a domain-separated SHA-256 hash is
stored in AdminSession, alongside the admin relation and an absolute eight-hour
expiry. Every protected page and API checks the database and expiry. Deleting an
admin cascades session deletion. A successful login replaces the current browser
session; logout deletes it from the database before clearing the cookie. Other
devices remain logged in unless all sessions are explicitly revoked.

The cookie is HttpOnly, SameSite=Strict, Path=/, and Secure in production.
SESSION_SECRET is no longer used for admin authentication; retain it only if
legacy version-1 customer order tokens still need verification.
The proxy only redirects visitors with missing cookies; it grants no access.
API errors distinguish 401 unauthenticated, 403 invalid origin and 503 service
failure. Responses use private/no-store. Session tokens are never returned in JSON.

All admin mutations, including login/logout, require Origin to exactly match
NEXT_PUBLIC_APP_URL. Cross-site fetches are rejected. Set the actual public origin
in production; forwarding headers are not trusted to override it. Same-origin
browser fetches supply Origin automatically. CLI clients must explicitly send it.

## Shared login limits

PostgreSQL atomically counts attempts in a 15-minute fixed window: 10 per normalized
email and 100 across the application. Successful attempts also count. The global
cap bounds bcrypt work and creation of arbitrary account buckets; no client-supplied
IP header can bypass it. Unknown accounts follow the same bcrypt verification path
and receive the same error as incorrect passwords. Limits fail closed on database
failure, with 429 and Retry-After for exhausted limits.

These conservative limits suit a small kitchen team. An attacker can consume the
shared quota and temporarily prevent login; production ingress controls and
monitoring should complement it. Existing sessions continue working. Review quota
settings if staffing or traffic increases. Fixed windows permit a burst around a
window boundary. Order creation and pickup rate limits remain later-phase work.

## Revocation and maintenance

Set ADMIN_EMAIL to the target account and run `npm run admin:sessions` to revoke
all its sessions. Run `npm run admin:sessions -- --cleanup` periodically to remove
expired sessions and login buckets older than one day. This does not reset active
limits. Neither command displays session tokens. Never log Cookie, passwords or
request bodies on the login endpoint.

## Verification status

Unit coverage checks production cookie flags, token parsing, origin validation,
email normalization and bcrypt byte limits. New PostgreSQL tests cover expiry,
rotation, revocation, admin deletion and concurrent limits. New browser tests cover
all protected pages/APIs, login/logout, cookie privacy, malformed input and login
throttling. Verified: 58 unit tests, 38 PostgreSQL integration tests, 18 Chromium browser
tests, TypeScript, ESLint, Prisma schema validation and production build.
