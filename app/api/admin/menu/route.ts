import { adminJson, adminError, readAdminJson } from '@/lib/admin/http';
import { getAdminMenu, mutateMenu } from '@/lib/admin/menu';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
export async function GET() {
  try { await requireAdmin(); return adminJson(await getAdminMenu(prisma)); }
  catch (error) { return adminError(error); }
}
async function write(request: Request, create: boolean) {
  try {
    await requireAdmin(request);
    return adminJson(await mutateMenu(prisma, await readAdminJson(request), create), create ? 201 : 200);
  } catch (error) { return adminError(error); }
}
export async function POST(request: Request) { return write(request, true); }
export async function PATCH(request: Request) { return write(request, false); }
