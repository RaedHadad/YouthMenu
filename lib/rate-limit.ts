import type { PrismaClient } from '@prisma/client';
/** Shared fixed-minute quota; bucket keys are supplied only by server code. */
export async function takeQuota(db: PrismaClient, key: string, limit: number) {
  const rows = await db.$queryRaw<Array<{ attempts: number }>>`
    INSERT INTO "AdminLoginLimit" ("key", "windowStartedAt", "attempts") VALUES (${key}, NOW(), 1)
    ON CONFLICT ("key") DO UPDATE SET
      "attempts" = CASE WHEN "AdminLoginLimit"."windowStartedAt" <= NOW() - INTERVAL '1 minute' THEN 1 ELSE LEAST("AdminLoginLimit"."attempts" + 1, 10000) END,
      "windowStartedAt" = CASE WHEN "AdminLoginLimit"."windowStartedAt" <= NOW() - INTERVAL '1 minute' THEN NOW() ELSE "AdminLoginLimit"."windowStartedAt" END
    RETURNING "attempts"
  `;
  return rows[0].attempts <= limit;
}
