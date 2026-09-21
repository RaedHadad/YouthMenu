import { z } from 'zod';
import { isOrderStatusTransitionAllowed } from '../business';
import type { PrismaClient } from '@prisma/client';
import { AdminHttpError } from './http';

export const adminOrderSelect = {
  id: true, orderNumber: true, customerName: true, status: true, totalAmount: true,
  visibleCode: true, estimatedMinutes: true, createdAt: true,
  items: { select: { itemName: true, quantity: true, unitPrice: true,
    toppings: { select: { toppingName: true, toppingPrice: true } } } },
} as const;

export async function activeOrders(db: PrismaClient) {
  return db.order.findMany({ where: { status: { in: ['PENDING', 'PREPARING', 'READY'] } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: adminOrderSelect });
}
const mutation = z.strictObject({
  id: z.string().min(1).max(128),
  expectedStatus: z.enum(['PENDING', 'PREPARING', 'READY']),
  status: z.enum(['PREPARING', 'READY', 'CANCELLED']),
  estimatedMinutes: z.number().int().min(1).max(180).optional(),
});
export async function updateKitchenOrder(db: PrismaClient, input: unknown) {
  const parsed = mutation.safeParse(input);
  if (!parsed.success) throw new AdminHttpError('بيانات الطلب غير صالحة', 400);
  const { id, expectedStatus, status, estimatedMinutes } = parsed.data;
  if (!isOrderStatusTransitionAllowed(expectedStatus, status) || (estimatedMinutes !== undefined && status !== 'PREPARING')) {
    throw new AdminHttpError('تغيير الحالة غير مسموح', 400);
  }
  return db.$transaction(async (tx) => {
    const changed = await tx.order.updateMany({ where: { id, status: expectedStatus }, data: {
      status, ...(estimatedMinutes !== undefined ? { estimatedMinutes } : {}),
      ...(status === 'READY' ? { readyAt: new Date() } : {}),
      ...(status === 'CANCELLED' ? { cancelledAt: new Date() } : {}),
    } });
    if (!changed.count) throw new AdminHttpError('تغيّر الطلب، حدّث القائمة وحاول مرة أخرى', 409);
    await tx.realtimeEvent.create({ data: { orderId: id } });
    return { id, status };
  });
}
