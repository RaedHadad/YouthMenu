import { OrderStatus, type PrismaClient, type Prisma } from '@prisma/client';
import { adminOrderSelect } from './orders';
export async function orderHistory(db: PrismaClient, params: Record<string, string | string[] | undefined>) {
  const text = (key: string) => typeof params[key] === 'string' ? params[key].trim() : '';
  const query = text('q').slice(0, 80);
  const status = text('status');
  const date = text('date');
  const page = Math.max(1, Math.min(10000, Number.parseInt(text('page'), 10) || 1));
  const where: Prisma.OrderWhereInput = {};
  if (query) where.OR = [{ customerName: { contains: query, mode: 'insensitive' } },
    ...(/^\d+$/.test(query) && Number(query) <= 2147483647 ? [{ orderNumber: Number(query) }] : [])];
  if (Object.values(OrderStatus).includes(status as OrderStatus)) where.status = status as OrderStatus;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const start = new Date(`${date}T00:00:00Z`);
    if (Number.isFinite(start.getTime())) where.createdAt = { gte: start, lt: new Date(start.getTime() + 86400000) };
  }
  const [orders, total] = await db.$transaction([
    db.order.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * 25, take: 25,
      select: { ...adminOrderSelect, readyAt: true, collectedAt: true, paymentStatus: true } }),
    db.order.count({ where }),
  ]);
  return { orders, total, page, query, status, date };
}
