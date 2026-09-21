import { MAX_DATABASE_AMOUNT, MAX_ORDER_QUANTITY } from './order-limits';

type Priced = { priceInAgorot: number };

function assertAmount(amount: number) {
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > MAX_DATABASE_AMOUNT) {
    throw new RangeError('Invalid integer agorot amount');
  }
}

/** Toppings are charged per item. No rounding, coercion or floating-point money. */
export function calculateOrderTotal(item: Priced, toppings: readonly Priced[], quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_ORDER_QUANTITY) {
    throw new RangeError('Invalid order quantity');
  }
  assertAmount(item.priceInAgorot);
  let unitTotal = item.priceInAgorot;
  for (const topping of toppings) {
    assertAmount(topping.priceInAgorot);
    unitTotal += topping.priceInAgorot;
    assertAmount(unitTotal);
  }
  const total = unitTotal * quantity;
  assertAmount(total);
  return total;
}
