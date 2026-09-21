import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { adminError, adminJson, requireAdminOrigin } from '@/lib/admin/http';
import { revokeAdminSession, SESSION_NAME, sessionCookieOptions } from '@/lib/admin/session';

export async function POST(request: Request) {
  try {
    requireAdminOrigin(request);
    const jar = await cookies();
    await revokeAdminSession(prisma, jar.get(SESSION_NAME)?.value);
    jar.set(SESSION_NAME, '', { ...sessionCookieOptions(), maxAge: 0 });
    return adminJson({ success: true });
  } catch (error) { return adminError(error); }
}
