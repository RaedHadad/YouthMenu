# Customer live status and preparation estimates

Each customer's browser subscribes only to `youthmenu:order:<internal order ID>`.
POST /api/orders/[id]/realtime-token verifies the customer access credential in the
Authorization header before signing a five-minute subscribe-only capability for
that exact channel. Pickup tokens, another order's token, query tokens and unknown
orders cannot authorize it. The server key never reaches the browser.

The same durable outbox event now publishes a content-free invalidation to the
kitchen and the corresponding order channel. Both publications must succeed before
the event is marked delivered. A partial failure retries the event; duplicate
invalidations are safe because clients fetch current authorized state. Extend the
server Ably key capability to publish/subscribe on `youthmenu:order:*` as well as
`youthmenu:kitchen`. Customer-issued capabilities never contain wildcards.

Customers refresh on messages, channel reattachment, network recovery and returning
to the tab. Eight-second polling remains enabled even while connected. Requests are
serialized, with a queued refresh and ten-second update timeout, preventing older
responses from overwriting newer state. The latest receipt snapshot is saved for
refresh/offline use; stale cached state is accompanied by an update error.

## Preparation estimates

Admin cards offer 5/10/15/20/30-minute presets and a custom integer from 1 to 180.
“تحديث الوقت” changes the estimate while PENDING or PREPARING without changing
status. Starting preparation is a separate action. The server validates the value
and conditionally checks the expected status; stale changes cannot move READY or
terminal orders back to preparation. Estimate changes create outbox events inside
the update transaction. No arbitrary default time is displayed before assignment.
The estimate is approximate, not a countdown or guaranteed completion timestamp.

## Optional ready alerts

The receipt offers “تفعيل تنبيه الجاهزية” while the order is active. This explicit
user action requests notification permission and attempts to unlock browser audio.
A READY status displays the large green banner regardless of permission/support.
If enabled, a short tone and optional browser notification accompany it. A session
storage marker suppresses repeat alerts from polling/reconnect/reload in the same
tab; in-memory suppression still works when storage is blocked. Separate tabs may
each alert once. Audio/notification failures never prevent receipt rendering.

Keep the page open for alerts. This implementation does not provide service-worker
push notifications after the browser/page is closed. Mobile browser restrictions
may also prevent background audio or page-created notifications. The status banner
and automatic refresh continue without notification permission.

## Verification

Database tests verify exact-channel authorization, cross-order/pickup rejection,
custom estimates, invalid values and stale state protection. Browser tests follow
PENDING → estimate update → PREPARING → READY automatically, verify a single
notification across refresh, and exercise custom/preset estimates from the kitchen.
Local tests disable actual Ably keys. Live provider and real-device notification
checks remain pre-deployment work, as agreed for local development.
