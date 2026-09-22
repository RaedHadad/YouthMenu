import { z } from 'zod';
import { createOrderSchema, type CreateOrderInput } from './validation';

export const PENDING_ORDER_STORAGE = 'youthmenu_pending_order';
export const CURRENT_ORDER_STORAGE = 'youthmenu_current_order';
const token = z.string().regex(/^[a-f0-9]{64}$/);
const referenceSchema = z.object({
  orderId: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
  customerAccessToken: token,
  pickupToken: token,
});
export const customerStatusSchema = z.object({
  orderId: referenceSchema.shape.orderId,
  orderNumber: z.number().int().positive(),
  customerName: z.string(),
  status: z.enum(['PENDING', 'PREPARING', 'READY', 'COLLECTED', 'CANCELLED']),
  statusMessage: z.string(),
  totalAmount: z.number().int().nonnegative(),
  visibleCode: z.string(),
  estimatedMinutes: z.number().int().positive().nullable(),
  items: z.array(z.object({ itemName: z.string(), quantity: z.number().int().positive(), unitPrice: z.number().int().nonnegative(), toppings: z.string() })).optional(),
  itemName: z.string(),
  quantity: z.number().int().positive(),
  toppings: z.string(),
});
export const customerOrderSchema = customerStatusSchema.extend({ pickupToken: token, customerAccessToken: token });
const pendingSchema = z.object({ key: token, input: createOrderSchema });
export type PendingOrder = z.infer<typeof pendingSchema>;
export type SavedOrder = z.infer<typeof customerOrderSchema>;

export class SubmissionError extends Error {
  constructor(message: string, public readonly definitive = false) { super(message); }
}

export function readSavedOrder(storage: Storage) {
  const pending = storage.getItem(PENDING_ORDER_STORAGE);
  const current = storage.getItem(CURRENT_ORDER_STORAGE);
  return {
    pending: pending ? pendingSchema.parse(JSON.parse(pending)) : null,
    current: current ? referenceSchema.passthrough().parse(JSON.parse(current)) : null,
  };
}

export function preparePendingOrder(input: CreateOrderInput, storage: Storage): PendingOrder {
  const existing = storage.getItem(PENDING_ORDER_STORAGE);
  if (existing) return pendingSchema.parse(JSON.parse(existing));
  const key = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const pending = pendingSchema.parse({ key, input });
  storage.setItem(PENDING_ORDER_STORAGE, JSON.stringify(pending));
  return pending;
}

export async function submitPendingOrder(pending: PendingOrder, signal?: AbortSignal): Promise<SavedOrder> {
  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': pending.key },
    body: JSON.stringify(pending.input), signal,
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    const message = data && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
      ? data.message : 'تعذر إرسال الطلب';
    throw new SubmissionError(message, [400, 413, 415].includes(response.status));
  }
  return customerOrderSchema.parse(data);
}

export async function fetchOrderStatus(reference: { orderId: string; customerAccessToken: string }, signal?: AbortSignal) {
  const response = await fetch(`/api/orders/${encodeURIComponent(reference.orderId)}/status`, {
    headers: { Authorization: `Bearer ${reference.customerAccessToken}` },
    cache: 'no-store', signal,
  });
  if (!response.ok) throw new Error('تعذر تحديث حالة الطلب، حاول مرة أخرى');
  return customerStatusSchema.parse(await response.json());
}

export function persistCompletedOrder(order: SavedOrder, storage: Storage) {
  // If this write fails, retain the pending key for safe recovery on the next visit.
  storage.setItem(CURRENT_ORDER_STORAGE, JSON.stringify(order));
  storage.removeItem(PENDING_ORDER_STORAGE);
}
