import { createHmac } from 'node:crypto';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { hashOrderToken } from '../orders/credentials';
import { AdminHttpError } from './http';
import { adminOrderSelect } from './orders';

const schema = z.strictObject({ pickupToken: z.string().regex(/^[a-f0-9]{64}$/), confirm: z.boolean().default(false) });
export async function pickupOrder(db: PrismaClient, adminId: string, input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new AdminHttpError('رمز QR غير صالح', 400);
  const { pickupToken, confirm } = parsed.data;
  const hashes = [{ credentialVersion: 2, pickupTokenHash: hashOrderToken(pickupToken, 'pickup') }];
  if (process.env.SESSION_SECRET) hashes.push({ credentialVersion: 1,
    pickupTokenHash: createHmac('sha256', process.env.SESSION_SECRET).update(pickupToken).digest('hex') });
  return db.$transaction(async (tx) => {
    const order = await tx.order.findFirst({ where: { OR: hashes }, select: adminOrderSelect });
    if (!order) throw new AdminHttpError('رمز QR غير صالح', 404);
    if (order.status === 'COLLECTED') throw new AdminHttpError('تم استلام هذا الطلب مسبقاً', 409);
    if (order.status === 'CANCELLED') throw new AdminHttpError('تم إلغاء هذا الطلب', 409);
    if (order.status !== 'READY') throw new AdminHttpError('الطلب لم يجهز بعد', 409);
    if (!confirm) return { order, collected: false };
    const result = await tx.order.updateMany({ where: { id: order.id, status: 'READY', paymentStatus: 'UNPAID' }, data: {
      status: 'COLLECTED', paymentMethod: 'CASH', paymentStatus: 'PAID', collectedAt: new Date(), collectedByAdminId: adminId,
    } });
    if (result.count !== 1) throw new AdminHttpError('تغيّر الطلب أو تم استلامه مسبقاً', 409);
    await tx.realtimeEvent.create({ data: { orderId: order.id } });
    return { collected: true, order: { ...order, status: 'COLLECTED' as const } };
  });
}
