import type { Prisma } from '@prisma/client';
import type { CreateOrderInput } from '../validation';
import { calculateOrderTotal } from '../pricing';
import { OrderRequestError } from './errors';

/** Read names, prices, availability and assignments from one database snapshot. */
export async function quoteOrder(db: Prisma.TransactionClient, input: CreateOrderInput) {
  const item = await db.menuItem.findFirst({
    where: { id: input.menuItemId, archivedAt: null, isAvailable: true },
    select: {
      id: true, name: true, priceInAgorot: true,
      toppings: {
        where: { topping: { id: { in: input.selectedToppingIds }, archivedAt: null, isAvailable: true } },
        select: { topping: { select: { id: true, name: true, priceInAgorot: true } } },
      },
    },
  });
  if (!item) throw new OrderRequestError('هذا الصنف غير متوفر حالياً');
  const allowed = new Map(item.toppings.map(({ topping }) => [topping.id, topping]));
  const toppings = input.selectedToppingIds.map((id) => {
    const topping = allowed.get(id);
    if (!topping) throw new OrderRequestError('إضافة غير صالحة أو غير متوفرة لهذا الصنف');
    return topping;
  });
  const totalAmount = calculateOrderTotal(item, toppings, input.quantity);
  return { item, toppings, totalAmount };
}
