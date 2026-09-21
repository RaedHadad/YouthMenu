# Order credentials and retry recovery

## Configuration

Apply all migrations with `npm run db:migrate`, regenerate the client with
`npm run db:generate`, and configure ORDER_TOKEN_ENCRYPTION_KEY: a server-only
32-byte random key encoded as 64 lowercase hex characters.

For local development, `npm run orders:key` creates it in ignored `.env.local`
without printing or replacing an existing nonempty value. Provision a stable value
through the hosting secret configuration for deployment. Never prefix it with
NEXT_PUBLIC_ or commit it. Missing/malformed configuration rejects creation with
a safe 503 response; there is no fallback development key.

Set NEXT_PUBLIC_APP_URL to the exact browser-facing origin (scheme, host and local
port where applicable). Configure it separately for preview/production. This
public value is used for origin checks because a reverse proxy can give Next.js
a different internal URL. Client-supplied forwarded-host headers are not trusted.
Explicit cross-site requests are rejected. The endpoint requires JSON and provides
no permissive CORS behavior.

## Creation and replay

The browser saves a cryptographically random 256-bit Idempotency-Key and validated
input before sending. The server independently generates a 256-bit pickup token
and a separate 256-bit customer access token. Cryptographic randomness also selects
the six-character visible code, which is only a convenience label.

One transaction stores order snapshots, the database-generated number, separate
SHA-256 hashes for access/pickup/retry credentials, a canonical input hash, and an
AES-256-GCM encrypted copy of the two response tokens. Encryption uses a fresh
96-bit IV and binds the envelope to the retry-key hash as authenticated additional
data. Plaintext tokens are not stored in PostgreSQL.

A unique creationKeyHash constraint prevents concurrent submissions under one key
from creating multiple orders. Replays return the original price and credentials
with the current status, even if menu data changed. Different input under that key
returns 409 without credentials. Only confirmed serialization rollbacks and random
code collisions are retried, with a bounded attempt count. An uncertain connection
failure is recovered by a client retry using its saved key.

The retry key is a bearer recovery credential. Redact Idempotency-Key,
Authorization, response tokens and browser storage from telemetry. No hashes or
encrypted envelopes are included in customer responses. Keys remain reserved with
their orders; expiry does not allow a key to create a second order later.

## Customer status and local recovery

GET `/api/orders/:id/status` requires `Authorization: Bearer <access token>`.
Query-string tokens are not accepted. Missing/invalid tokens, pickup tokens, visible
codes, another customer's token and unknown orders all return the same Arabic 404.
Successful responses contain an explicit receipt-field allowlist. Creation/status
responses are private, non-cacheable and include no-referrer headers.

After an uncertain outcome, the browser retains the pending attempt and offers
recovery after refresh. New submission is blocked until that attempt is resolved.
A definitive validation rejection releases it for correction. If storage fails
before submission, no request is sent. If saving a successful ticket fails, its
pending key remains for recovery. Browser storage contains bearer credentials.

## Legacy orders and key rotation

The migration marks pre-existing token hashes as version 1 and new orders as
version 2. Legacy HMAC credentials work only with their explicitly configured
original SESSION_SECRET; implicit default secrets are no longer accepted. Reload
the updated customer client to use the new authorization-header API.

Version 2 token verification is independent of SESSION_SECRET and the encryption
key. Rotating the admin secret does not invalidate these customer/pickup tokens.
Replaying encrypted credentials still requires the original
ORDER_TOKEN_ENCRYPTION_KEY. Back it up separately from PostgreSQL and keep it stable.
Rotation requires a reviewed re-encryption migration (not implemented in this phase).
Losing it prevents replay recovery, though already-issued version 2 tokens remain
verifiable against their stored hashes.

## Verified scope

Tests exercise token separation, encryption tampering/record swapping, missing
configuration, exact replay, eight simultaneous retries, changed-payload conflicts,
visible-code collisions, protected status and proxy-origin checks. Chromium tests
create an order, deliberately discard its successful response, refresh, and recover
that same order and credentials.

Admin database sessions, shared rate limiting, Ably delivery and atomic QR pickup
remain separate phase gates before production deployment.
