import type { PrismaClient } from '@prisma/client';
import type { CustomerMenuItem } from './customer-types';

/** Called on the server with a database client; returns only public menu fields. */
export async function getCustomerMenu(db: Pick<PrismaClient, 'menuItem'>): Promise<CustomerMenuItem[]> {
  const items = await db.menuItem.findMany({
    where: { archivedAt: null },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true, name: true, priceInAgorot: true, isAvailable: true,
      toppings: {
        where: { topping: { archivedAt: null } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { topping: { select: { id: true, name: true, priceInAgorot: true, isAvailable: true } } },
      },
    },
  });
  return items.map((item) => ({ ...item, toppings: item.toppings.map((link) => link.topping) }));
}
