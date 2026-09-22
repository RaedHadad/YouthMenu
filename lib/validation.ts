import { z } from 'zod';
import { MAX_ORDER_QUANTITY, MAX_ORDER_TOPPINGS } from './order-limits';

export const adminLoginSchema = z.strictObject({
  email: z.string().trim().toLowerCase().max(254).email('يرجى إدخال بريد إلكتروني صحيح'),
  password: z.string().min(1).max(72).refine((password) => new TextEncoder().encode(password).length <= 72),
});

const orderIdSchema = z.string({ error: 'معرّف الصنف أو الإضافة غير صالح' })
  .min(1, 'يرجى اختيار صنف').max(128, 'معرّف الصنف أو الإضافة غير صالح')
  .regex(/^[a-zA-Z0-9_-]+$/, 'معرّف الصنف أو الإضافة غير صالح');

export const createOrderSchema = z.strictObject({
  menuItemId: orderIdSchema,
  drinks: z.array(z.strictObject({ menuItemId: orderIdSchema, quantity: z.number().int().min(1).max(MAX_ORDER_QUANTITY) }))
    .max(20).refine((drinks) => new Set(drinks.map((drink) => drink.menuItemId)).size === drinks.length, 'لا يمكن تكرار المشروب').optional(),
  selectedToppingIds: z.array(orderIdSchema, { error: 'الإضافات غير صالحة' })
    .max(MAX_ORDER_TOPPINGS, 'عدد الإضافات أكبر من المسموح')
    .refine((ids) => new Set(ids).size === ids.length, 'لا يمكن تكرار الإضافة')
    .default([]),
  quantity: z.number({ error: 'يرجى اختيار كمية صحيحة' })
    .int('يرجى اختيار كمية صحيحة').min(1, 'الكمية يجب أن تكون بين 1 و20')
    .max(MAX_ORDER_QUANTITY, 'الكمية يجب أن تكون بين 1 و20'),
  customerName: z.string({ error: 'يرجى إدخال الاسم' }).trim()
    .min(2, 'يرجى إدخال اسم من حرفين على الأقل').max(80, 'الاسم أطول من المسموح')
    .refine((name) => !/[\p{Cc}\u202A-\u202E\u2066-\u2069]/u.test(name), 'الاسم يحتوي على رموز غير صالحة'),
}, { error: 'بيانات الطلب غير صالحة' });

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const updateOrderStatusSchema = z.object({
  status: z.enum(['PENDING', 'PREPARING', 'READY', 'COLLECTED', 'CANCELLED']),
  estimatedMinutes: z.coerce.number().int().min(1).max(180).optional(),
});

export const menuItemSchema = z.object({
  name: z.string().trim().min(2).max(80),
  priceInAgorot: z.coerce.number().int().min(0).max(50000),
  isAvailable: z.boolean().optional(),
});

export const toppingSchema = z.object({
  name: z.string().trim().min(2).max(60),
  priceInAgorot: z.coerce.number().int().min(0).max(20000),
  isAvailable: z.boolean().optional(),
});

export const menuAdminMutationSchema = z.object({
  entity: z.enum(['item', 'topping']),
  id: z.string().optional(),
  name: z.string().trim().min(2).max(80),
  priceInAgorot: z.coerce.number().int().min(0).max(50000),
  isAvailable: z.boolean().optional(),
});
