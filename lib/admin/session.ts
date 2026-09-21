import { createHash, randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

export const SESSION_NAME = 'admin_session';
export const SESSION_SECONDS = 8 * 60 * 60;
export const sessionHash = (token: string) => createHash('sha256').update(`youthmenu:admin:v1:${token}`).digest('hex');
export const validSessionToken = (token: string | undefined): token is string => !!token && /^[a-f0-9]{64}$/.test(token);
export const sessionCookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const, path: '/', maxAge: SESSION_SECONDS });

export async function findAdminSession(db: PrismaClient, token: string | undefined) {
  if (!validSessionToken(token)) return null;
  const session = await db.adminSession.findUnique({ where: { tokenHash: sessionHash(token) },
    select: { expiresAt: true, admin: { select: { id: true, email: true } } } });
  return session && session.expiresAt > new Date() ? session.admin : null;
}

export async function createAdminSession(db: PrismaClient, adminId: string, previous?: string) {
  const token = randomBytes(32).toString('hex');
  await db.$transaction(async (tx) => {
    if (validSessionToken(previous)) await tx.adminSession.deleteMany({ where: { tokenHash: sessionHash(previous) } });
    await tx.adminSession.create({ data: { adminId, tokenHash: sessionHash(token),
      expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000) } });
  });
  return token;
}

export async function revokeAdminSession(db: PrismaClient, token: string | undefined) {
  if (validSessionToken(token)) await db.adminSession.deleteMany({ where: { tokenHash: sessionHash(token) } });
}
