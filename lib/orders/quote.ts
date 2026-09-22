import type { Prisma } from '@prisma/client';
import type { CreateOrderInput } from '../validation';
import { MAX_DATABASE_AMOUNT } from '../order-limits';
import { calculateOrderTotal } from '../pricing';
import { OrderRequestError } from './errors';

/** Read names, prices, availability and assignments from one database snapshot. */
export async function quoteOrder(db: Prisma.TransactionClient, input: CreateOrderInput) {
  const selections = [input, ...(input.additionalFoods ?? [])];
  const availableFoods = await db.menuItem.findMany({
    where: { id: { in: selections.map((food) => food.menuItemId) }, archivedAt: null, isAvailable: true },
    select: {
      id: true, name: true, priceInAgorot: true, category: true,
      toppings: {
        where: { topping: { archivedAt: null, isAvailable: true } },
        select: { topping: { select: { id: true, name: true, priceInAgorot: true } } },
      },
    },
  });
  const foods = selections.map((selection, index) => {
    const item = availableFoods.find((food) => food.id === selection.menuItemId);
    // Retain support for older clients that selected a drink as their primary item.
    if (!item || (index > 0 && item.category !== 'FOOD')) throw new OrderRequestError('هذا الصنف غير متوفر حالياً');
    const allowed = new Map(item.toppings.map(({ topping }) => [topping.id, topping]));
    const toppings = selection.selectedToppingIds.map((id) => {
      const topping = allowed.get(id);
      if (!topping) throw new OrderRequestError('إضافة غير صالحة أو غير متوفرة لهذا الصنف');
      return topping;
    });
    return { item, toppings, quantity: selection.quantity, totalAmount: calculateOrderTotal(item, toppings, selection.quantity) };
  });
  const selectedDrinks = input.drinks ?? [];
  const availableDrinks = selectedDrinks.length ? await db.menuItem.findMany({
    where: { id: { in: selectedDrinks.map((drink) => drink.menuItemId), notIn: selections.map((food) => food.menuItemId) }, category: 'DRINK', archivedAt: null, isAvailable: true },
    select: { id: true, name: true, priceInAgorot: true },
  }) : [];
  const drinks = selectedDrinks.map((selection) => {
    const drink = availableDrinks.find((entry) => entry.id === selection.menuItemId);
    if (!drink) throw new OrderRequestError('المشروب غير متوفر حالياً');
    return { ...drink, quantity: selection.quantity };
  });
  const totalAmount = foods.reduce((sum, food) => sum + food.totalAmount, 0) +
    drinks.reduce((sum, drink) => sum + calculateOrderTotal(drink, [], drink.quantity), 0);
  if (!Number.isSafeInteger(totalAmount) || totalAmount > MAX_DATABASE_AMOUNT) throw new OrderRequestError('إجمالي الطلب أكبر من المسموح');
  return { item: foods[0].item, toppings: foods[0].toppings, additionalFoods: foods.slice(1), drinks, totalAmount };
}
