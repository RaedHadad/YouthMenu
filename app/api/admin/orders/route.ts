import { adminJson, adminError, readAdminJson } from '@/lib/admin/http';
import { activeOrders, updateKitchenOrder } from '@/lib/admin/orders';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { scheduleOutbox } from '@/lib/realtime/schedule';

export async function GET() {
  try {
    await requireAdmin();
    const orders = await activeOrders(prisma);
    scheduleOutbox();
    return adminJson({ orders });
  } catch (error) { return adminError(error); }
}
export async function PATCH(request: Request) {
  try {
    await requireAdmin(request);
    const order = await updateKitchenOrder(prisma, await readAdminJson(request));
    scheduleOutbox();
    return adminJson({ success: true, order });
  } catch (error) { return adminError(error); }
}
