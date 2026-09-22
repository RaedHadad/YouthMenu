import { Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AdminHttpError } from './http';

const id = z.string().min(1).max(128);
const schema = z.strictObject({
  entity: z.enum(['item', 'topping']), id: id.optional(),
  category: z.enum(['FOOD', 'DRINK']).optional(),
  name: z.string().trim().min(2).max(80).refine((s) => !/[\p{Cc}\u202A-\u202E\u2066-\u2069]/u.test(s)).optional(),
  priceInAgorot: z.number().int().min(0).max(50000).optional(),
  isAvailable: z.boolean().optional(), archived: z.boolean().optional(),
  toppingIds: z.array(id).max(30).refine((ids) => new Set(ids).size === ids.length).optional(),
});
export async function getAdminMenu(db: PrismaClient) {
  const [menuItems, toppings] = await Promise.all([
    db.menuItem.findMany({ orderBy: { createdAt: 'asc' }, include: { toppings: { select: { toppingId: true } } } }),
    db.topping.findMany({ orderBy: { createdAt: 'asc' } }),
  ]);
  return { menuItems: menuItems.map(({ toppings, ...item }) => ({ ...item, archivedAt: item.archivedAt?.toISOString() ?? null,
    toppingIds: toppings.map((link) => link.toppingId) })),
  toppings: toppings.map((topping) => ({ ...topping, archivedAt: topping.archivedAt?.toISOString() ?? null })) };
}
export async function mutateMenu(db: PrismaClient, value: unknown, create: boolean) {
  const result = schema.safeParse(value);
  if (!result.success) throw new AdminHttpError('بيانات القائمة غير صالحة', 400);
  const { entity, id, name, priceInAgorot, isAvailable, archived, toppingIds, category } = result.data;
  if ((create && (id || name === undefined || priceInAgorot === undefined || archived !== undefined)) ||
      (!create && (!id || Object.keys(result.data).length <= 2)) || (entity === 'topping' && (toppingIds !== undefined || category !== undefined))) {
    throw new AdminHttpError('بيانات القائمة غير صالحة', 400);
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        if (toppingIds?.length) {
          const count = await tx.topping.count({ where: { id: { in: toppingIds }, archivedAt: null } });
          if (count !== toppingIds.length) throw new AdminHttpError('إحدى الإضافات غير موجودة أو مؤرشفة', 400);
        }
        const data = { name, priceInAgorot, isAvailable, ...(archived !== undefined ? { archivedAt: archived ? new Date() : null } : {}) };
        if (entity === 'item') {
          const current = !create ? await tx.menuItem.findUnique({ where: { id }, select: { category: true } }) : null;
          const resolvedCategory = category ?? current?.category ?? 'FOOD';
          if (resolvedCategory === 'DRINK' && toppingIds?.length) throw new AdminHttpError('المشروبات لا تقبل إضافات الطعام', 400);
          const item = create
            ? await tx.menuItem.create({ data: { ...data, category: resolvedCategory, name: name!, priceInAgorot: priceInAgorot! } })
            : await tx.menuItem.update({ where: { id }, data: { ...data, category: resolvedCategory } });
          if (toppingIds !== undefined || resolvedCategory === 'DRINK') {
            await tx.menuItemTopping.deleteMany({ where: { menuItemId: item.id } });
            if (resolvedCategory === 'FOOD' && toppingIds?.length) await tx.menuItemTopping.createMany({ data: toppingIds.map((toppingId) => ({ menuItemId: item.id, toppingId })) });
          }
          return { id: item.id };
        }
        const topping = create
          ? await tx.topping.create({ data: { ...data, name: name!, priceInAgorot: priceInAgorot! } })
          : await tx.topping.update({ where: { id }, data });
        return { id: topping.id };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2034' && attempt < 2) continue;
        if (error.code === 'P2002') throw new AdminHttpError('هذا الاسم مستخدم بالفعل، بما في ذلك العناصر المؤرشفة', 409);
        if (error.code === 'P2025') throw new AdminHttpError('العنصر غير موجود', 404);
        if (error.code === 'P2034') throw new AdminHttpError('تغيّرت القائمة، حاول مرة أخرى', 409);
      }
      throw error;
    }
  }
}
