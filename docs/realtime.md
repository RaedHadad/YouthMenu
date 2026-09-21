# Kitchen real-time updates (Phase 8)

## Architecture

Ably Pub/Sub hosts persistent browser connections; Next.js handlers publish via
Ably REST. The application does not run a persistent Socket.IO server. PostgreSQL
remains the source of truth. Official references:

- https://ably.com/docs/api/rest-sdk/authentication
- https://ably.com/docs/api/rest-api

Every new order, kitchen status change and estimate update inserts a RealtimeEvent inside the same
transaction. Replaying an existing order creates no second event. After the HTTP
response, Next.js `after()` attempts delivery. Dashboard snapshot requests also
trigger delivery, so pending events recover while the kitchen is open.

The outbox uses conditional leases to avoid simultaneous publishers, retry backoff
up to five minutes, and bounded batches of five. A process crash leaves a one-minute
lease that another worker can reclaim. Stable event IDs support Ably idempotent
publishing; clients also tolerate duplicate invalidations. No exactly-once delivery
claim is made. Delivery failures do not roll back committed orders.

## Configuration

Create separate Ably apps/keys for development and production. Set ABLY_API_KEY
only in the server environment. Restrict its capability to publish and subscribe
on `youthmenu:kitchen` and `youthmenu:order:*`. Never use a NEXT_PUBLIC variable for this key. Apply the
`202609210003_realtime_outbox` migration before running the updated application.

Authenticated admins obtain a five-minute signed TokenRequest from
POST /api/admin/realtime-token. The server fixes the channel, client identity and
subscribe-only capability; callers cannot request broader access. The endpoint
requires the configured public Origin, returns no-store responses, and rejects
expired/revoked sessions. Never log signed TokenRequests or authentication headers.

Events contain only `{ version: 1 }`, an event name and event ID. No order details,
customer names, access tokens or pickup credentials are broadcast. Each event and
channel reattachment triggers a fresh authorized snapshot. A revoked subscriber
may remain connected until its short-lived token expires, but cannot fetch order
details after session revocation.

The dashboard always reconciles every eight seconds, including when connected.
This covers lost publications and checks session revocation. It refetches on network
recovery and tab visibility. The screen distinguishes live connection from periodic
updates, keeps the last snapshot on errors, and announces newly observed orders.
It serializes refreshes so older responses cannot overwrite a newer snapshot.

## Delivery recovery and maintenance

Run `npm run realtime:flush` to attempt one batch manually. For unattended recovery,
configure an external scheduler to GET /api/internal/realtime with
Authorization: Bearer <CRON_SECRET>. Set a random CRON_SECRET of at least 32 characters
in the server and scheduler environments. No scheduler is deployed by this phase.
Choose a schedule/batch throughput appropriate to the workload and provider quotas.
The endpoint is denied when the secret is missing or incorrect. Admin sessions do
not grant access to it. Pending events remain durable if the scheduler is absent;
new activity and dashboard polling still retry delivery.

Monitor oldest pending createdAt, pending count and attempts in RealtimeEvent.
Investigate growing backlog, key capability errors or provider outages. After
confirming delivery, periodically delete delivered rows older than your retention
window (for example seven days); never delete undelivered rows during cleanup.

## Kitchen actions

The PATCH endpoint requires a valid admin session and matching origin, validates a
strict body, and compares expectedStatus in the atomic update. Supported transitions:
PENDING → PREPARING, PREPARING → READY, and cancellation from an active state.
A stale update returns 409; invalid actions return 400. Generic dashboard updates
cannot mark orders COLLECTED or paid. Those require Phase 11's pickup transaction.
Status changes persist a matching outbox event atomically and preserve history.
The dashboard disables actions while a mutation runs and asks before cancellation.

## Local verification and limits

The local browser suite explicitly disables Ably credentials, so tests cannot
publish test events to a real kitchen. Tests cover the fallback workflow and the
protected token endpoint; unit tests cover signed capabilities and simulated SDK
messages/reconnect/cleanup. PostgreSQL tests cover event creation, idempotent
creation replay, simultaneous actions, leases, retry and expired-lease recovery.

Live Ably delivery has not been exercised because no real API key is configured;
the user chose local tests. Before deployment, configure the key and open two admin
browsers: create an order, change status and cancel it, checking prompt updates in
both. Interrupt connectivity and restore it, then verify reconciliation. Also test
an actual publisher outage and scheduler recovery. Phase 9 adds customer private subscriptions and live estimates; see
[customer live status](customer-live-status.md).
