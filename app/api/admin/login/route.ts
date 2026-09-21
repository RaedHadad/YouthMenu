import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { loginAdmin } from '@/lib/admin/login';
import { adminError, adminJson } from '@/lib/admin/http';
import { SESSION_NAME, sessionCookieOptions } from '@/lib/admin/session';

export async function POST(request: Request) {
  try {
    const jar = await cookies();
    const token = await loginAdmin(request, prisma, jar.get(SESSION_NAME)?.value);
    jar.set(SESSION_NAME, token, sessionCookieOptions());
    return adminJson({ success: true });
  } catch (error) {
    const response = adminError(error);
    if (response.status === 429) response.headers.set('Retry-After', '900');
    return response;
  }
}
