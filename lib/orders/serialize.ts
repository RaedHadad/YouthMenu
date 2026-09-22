import type { Prisma } from '@prisma/client';
import { getArabicStatusLabel } from '../order-utils';

export const orderWithItems = { items: { include: { toppings: true } } } as const;
export type OrderWithItems = Prisma.OrderGetPayload<{ include: typeof orderWithItems }>;

/** Explicit allowlist: no hashes, encryption payloads, or admin audit fields. */
export function customerOrderStatus(order: OrderWithItems) {
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    status: order.status,
    statusMessage: getArabicStatusLabel(order.status),
    totalAmount: order.totalAmount,
    visibleCode: order.visibleCode,
    estimatedMinutes: order.estimatedMinutes,
    items: order.items.map((item) => ({ itemName: item.itemName, quantity: item.quantity, unitPrice: item.unitPrice, toppings: item.toppings.map((topping) => topping.toppingName).join('، ') })),
    itemName: order.items[0]?.itemName ?? '',
    quantity: order.items[0]?.quantity ?? 0,
    toppings: order.items.flatMap((item) => item.toppings.map((topping) => topping.toppingName)).join('، ') || 'لا يوجد',
  };
}
