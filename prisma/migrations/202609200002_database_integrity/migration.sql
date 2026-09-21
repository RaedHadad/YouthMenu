-- Transactional: invalid legacy data aborts the upgrade without partial changes.
BEGIN;

-- Older orders without access credentials stay inaccessible. No plaintext token
-- is issued or retained for these new random hashes.
UPDATE "Order"
SET "customerAccessTokenHash" = encode(sha256(
  (gen_random_uuid()::text || gen_random_uuid()::text)::bytea
), 'hex')
WHERE "customerAccessTokenHash" IS NULL;

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_collectedByAdminId_fkey";

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_orderId_fkey";

-- DropForeignKey
ALTER TABLE "OrderItemTopping" DROP CONSTRAINT "OrderItemTopping_orderItemId_fkey";

-- DropIndex
DROP INDEX "Order_status_idx";

-- DropIndex
DROP INDEX "Order_visibleCode_idx";

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Topping" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
CREATE SEQUENCE order_ordernumber_seq;
ALTER TABLE "Order" ALTER COLUMN "orderNumber" SET DEFAULT nextval('order_ordernumber_seq'),
ALTER COLUMN "customerAccessTokenHash" SET NOT NULL;
ALTER SEQUENCE order_ordernumber_seq OWNED BY "Order"."orderNumber";
-- Preserve existing visible numbers; the next number is above the maximum.
SELECT setval('order_ordernumber_seq',
  GREATEST(COALESCE((SELECT MAX("orderNumber") FROM "Order"), 0) + 1, 1), false);

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeedRun" (
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeedRun_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AdminSession_adminId_idx" ON "AdminSession"("adminId");

-- CreateIndex
CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");

-- CreateIndex
CREATE INDEX "MenuItem_archivedAt_isAvailable_idx" ON "MenuItem"("archivedAt", "isAvailable");

-- CreateIndex
CREATE INDEX "Topping_archivedAt_isAvailable_idx" ON "Topping"("archivedAt", "isAvailable");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_collectedByAdminId_idx" ON "Order"("collectedByAdminId");

-- CreateIndex
CREATE INDEX "OrderItem_menuItemId_idx" ON "OrderItem"("menuItemId");

-- CreateIndex
CREATE INDEX "OrderItemTopping_toppingId_idx" ON "OrderItemTopping"("toppingId");

-- AddForeignKey
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_collectedByAdminId_fkey" FOREIGN KEY ("collectedByAdminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemTopping" ADD CONSTRAINT "OrderItemTopping_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma 5 cannot express CHECK constraints; maintain them in migration SQL.
ALTER TABLE "MenuItem"
  ADD CONSTRAINT "MenuItem_price_nonnegative" CHECK ("priceInAgorot" >= 0),
  ADD CONSTRAINT "MenuItem_name_valid" CHECK (char_length(btrim("name")) BETWEEN 1 AND 80);
ALTER TABLE "Topping"
  ADD CONSTRAINT "Topping_price_nonnegative" CHECK ("priceInAgorot" >= 0),
  ADD CONSTRAINT "Topping_name_valid" CHECK (char_length(btrim("name")) BETWEEN 1 AND 80);
ALTER TABLE "Order"
  ADD CONSTRAINT "Order_number_positive" CHECK ("orderNumber" > 0),
  ADD CONSTRAINT "Order_total_nonnegative" CHECK ("totalAmount" >= 0),
  ADD CONSTRAINT "Order_customer_name_valid" CHECK (char_length(btrim("customerName")) BETWEEN 2 AND 80),
  ADD CONSTRAINT "Order_estimate_valid" CHECK ("estimatedMinutes" IS NULL OR "estimatedMinutes" BETWEEN 1 AND 180),
  ADD CONSTRAINT "Order_pickup_hash_valid" CHECK ("pickupTokenHash" ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT "Order_access_hash_valid" CHECK ("customerAccessTokenHash" ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT "Order_cash_collection_consistent" CHECK (
    ("status" = 'COLLECTED' AND "paymentStatus" = 'PAID'
      AND "collectedAt" IS NOT NULL AND "collectedByAdminId" IS NOT NULL)
    OR
    ("status" <> 'COLLECTED' AND "paymentStatus" = 'UNPAID'
      AND "collectedAt" IS NULL AND "collectedByAdminId" IS NULL)
  );
ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_quantity_valid" CHECK ("quantity" BETWEEN 1 AND 20),
  ADD CONSTRAINT "OrderItem_price_nonnegative" CHECK ("unitPrice" >= 0);
ALTER TABLE "OrderItemTopping"
  ADD CONSTRAINT "OrderItemTopping_price_nonnegative" CHECK ("toppingPrice" >= 0);
ALTER TABLE "AdminSession"
  ADD CONSTRAINT "AdminSession_hash_valid" CHECK ("tokenHash" ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT "AdminSession_expiry_valid" CHECK ("expiresAt" > "createdAt");

COMMIT;
