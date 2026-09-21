import { createHash } from 'node:crypto';
import { compare } from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';
import { adminLoginSchema } from '../validation';
import { AdminHttpError, readAdminJson, requireAdminOrigin } from './http';
import { createAdminSession } from './session';

// A fixed valid bcrypt hash keeps unknown-email requests on the password verification path.
const DUMMY_HASH = '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';

/** Shared atomic fixed-window limits: no process-local state or trusted client IP required. */
export async function consumeLoginAttempt(db: PrismaClient, email: string) {
  const account = createHash('sha256').update(`admin-login:${email}`).digest('hex');
  const results = await db.$transaction(async (tx) => {
    const counts: number[] = [];
    // Stable lock order avoids deadlocks across different accounts.
    for (const key of ['global', account]) {
      const rows = await tx.$queryRaw<Array<{ attempts: number }>>`
        INSERT INTO "AdminLoginLimit" ("key", "windowStartedAt", "attempts") VALUES (${key}, NOW(), 1)
        ON CONFLICT ("key") DO UPDATE SET
          "attempts" = CASE WHEN "AdminLoginLimit"."windowStartedAt" <= NOW() - INTERVAL '15 minutes'
            THEN 1 ELSE LEAST("AdminLoginLimit"."attempts" + 1, 10000) END,
          "windowStartedAt" = CASE WHEN "AdminLoginLimit"."windowStartedAt" <= NOW() - INTERVAL '15 minutes'
            THEN NOW() ELSE "AdminLoginLimit"."windowStartedAt" END
        RETURNING "attempts"
      `;
      counts.push(rows[0].attempts);
      // Do not allocate unbounded email buckets after the global cap is reached.
      if (key === 'global' && counts[0] > 100) break;
    }
    return counts;
  });
  if (results[0] > 100 || results[1] > 10) throw new AdminHttpError('محاولات كثيرة، حاول بعد 15 دقيقة', 429);
}

export async function loginAdmin(request: Request, db: PrismaClient, previous?: string) {
  requireAdminOrigin(request);
  const parsed = adminLoginSchema.safeParse(await readAdminJson(request));
  if (!parsed.success) throw new AdminHttpError('يرجى إدخال بريد إلكتروني وكلمة مرور صالحين', 400);
  const { email, password } = parsed.data;
  await consumeLoginAttempt(db, email);
  const admin = await db.admin.findUnique({ where: { email } });
  const valid = await compare(password, admin?.passwordHash ?? DUMMY_HASH);
  if (!admin || !valid) throw new AdminHttpError('بيانات الدخول غير صحيحة', 401);
  return createAdminSession(db, admin.id, previous);
}
