import type { Prisma } from '@prisma/client';
import type { CreateOrderInput } from '../validation';
import { MAX_DATABASE_AMOUNT } from '../order-limits';
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
  const selectedDrinks = input.drinks ?? [];
  const availableDrinks = selectedDrinks.length ? await db.menuItem.findMany({
    where: { id: { in: selectedDrinks.map((drink) => drink.menuItemId), not: item.id }, category: 'DRINK', archivedAt: null, isAvailable: true },
    select: { id: true, name: true, priceInAgorot: true },
  }) : [];
  const drinks = selectedDrinks.map((selection) => {
    const drink = availableDrinks.find((entry) => entry.id === selection.menuItemId);
    if (!drink) throw new OrderRequestError('المشروب غير متوفر حالياً');
    return { ...drink, quantity: selection.quantity };
  });
  const totalAmount = calculateOrderTotal(item, toppings, input.quantity) +
    drinks.reduce((sum, drink) => sum + calculateOrderTotal(drink, [], drink.quantity), 0);
  if (!Number.isSafeInteger(totalAmount) || totalAmount > MAX_DATABASE_AMOUNT) throw new OrderRequestError('إجمالي الطلب أكبر من المسموح');
  return { item, toppings, drinks, totalAmount };
}
