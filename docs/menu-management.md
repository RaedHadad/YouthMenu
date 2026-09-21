# Menu and topping management

The Arabic admin editor supports creating and renaming dishes/toppings, integer
agorot prices entered as decimal shekels, availability, archiving/restoration and
dish-specific topping assignments. Prices support up to two decimal places and a
server-enforced maximum of ₪500. Assign at most 30 distinct toppings to a dish.

All writes require an active admin session and matching origin. Strict bounded
input rejects unknown fields, negative/fractional agorot, invalid identifiers and
archived/missing topping assignments. Serializable transactions update dish fields
and replace assignments together, retrying confirmed conflicts at most twice.
Duplicate names return an Arabic conflict message, including names held by archives.

Archive hides an item from customer queries without deleting order snapshots.
Restore preserves its availability setting. Archived toppings remain in historical
orders; the editor excludes them from new assignments. Customer menu refreshes and
new visits load database changes without a deployment. The server always rechecks
availability/prices when an order is submitted.

The UI waits for successful server responses, disables writes while saving, asks
before archiving and displays errors. After a network failure, refresh the page to
check whether a write committed before repeating it. Concurrent edits to the same
field use the last committed value; editor version-conflict detection is not provided.

Phase 10 verification: full unit/database suites and one focused browser workflow
covering topping creation, decimal pricing, assignment, customer visibility and
archive/restore. The full browser suite was not rerun to keep this phase economical.
