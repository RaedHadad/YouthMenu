import { takeQuota } from '@/lib/rate-limit';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { adminJson, adminError, readAdminJson } from '@/lib/admin/http';
import { pickupOrder } from '@/lib/admin/pickup';
import { scheduleOutbox } from '@/lib/realtime/schedule';
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if (!await takeQuota(prisma, `scanner:${admin.id}`, 60)) return adminJson({ message: 'محاولات كثيرة، حاول بعد دقيقة' }, 429);
    const result = await pickupOrder(prisma, admin.id, await readAdminJson(request));
    if (result.collected) scheduleOutbox();
    return adminJson(result);
  } catch (error) { return adminError(error); }
}
