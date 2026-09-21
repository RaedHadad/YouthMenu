import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from './prisma';
import { findAdminSession, SESSION_NAME } from './admin/session';
import { AdminHttpError, requireAdminOrigin } from './admin/http';

export async function getAuthenticatedAdmin() {
  return findAdminSession(prisma, (await cookies()).get(SESSION_NAME)?.value);
}
export async function requireAdmin(request?: Request) {
  const admin = await getAuthenticatedAdmin();
  if (!admin) throw new AdminHttpError('غير مصرح', 401);
  if (request && !['GET', 'HEAD'].includes(request.method)) requireAdminOrigin(request);
  return admin;
}
export async function requireAdminPage() {
  const admin = await getAuthenticatedAdmin();
  if (!admin) redirect('/admin/login');
  return admin;
}
