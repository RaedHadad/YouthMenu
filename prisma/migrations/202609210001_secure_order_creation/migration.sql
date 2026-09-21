BEGIN;

-- Existing hashes are legacy HMAC values. New orders use domain-separated SHA-256.
ALTER TABLE "Order" ADD COLUMN "credentialVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Order" ALTER COLUMN "credentialVersion" SET DEFAULT 2;
ALTER TABLE "Order" ADD COLUMN "creationKeyHash" TEXT;
ALTER TABLE "Order" ADD COLUMN "creationRequestHash" TEXT;
ALTER TABLE "Order" ADD COLUMN "encryptedCredentials" TEXT;
CREATE UNIQUE INDEX "Order_creationKeyHash_key" ON "Order"("creationKeyHash");

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_credential_version_valid" CHECK ("credentialVersion" IN (1, 2)),
  ADD CONSTRAINT "Order_creation_metadata_complete" CHECK (
    ("creationKeyHash" IS NULL AND "creationRequestHash" IS NULL AND "encryptedCredentials" IS NULL)
    OR
    ("creationKeyHash" IS NOT NULL AND "creationRequestHash" IS NOT NULL AND "encryptedCredentials" IS NOT NULL
      AND "creationKeyHash" ~ '^[a-f0-9]{64}$'
      AND "creationRequestHash" ~ '^[a-f0-9]{64}$'
      AND char_length("encryptedCredentials") > 0)
  );

COMMIT;
