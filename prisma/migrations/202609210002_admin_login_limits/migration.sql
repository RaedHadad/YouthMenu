CREATE TABLE "AdminLoginLimit" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "attempts" INTEGER NOT NULL DEFAULT 0 CHECK ("attempts" >= 0)
);
CREATE INDEX "AdminLoginLimit_windowStartedAt_idx" ON "AdminLoginLimit"("windowStartedAt");
