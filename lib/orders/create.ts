import { Prisma, type PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import type { CreateOrderInput } from '../validation';
import { quoteOrder } from './quote';
import { OrderRequestError } from './errors';
import { assertCredentialConfiguration, generateOrderCredentials, generateVisibleCode, hashOrderToken, isOrderToken, openCredentials, sealCredentials, verifyOrderToken } from './credentials';
import { customerOrderStatus, orderWithItems, type OrderWithItems } from './serialize';

export async function createPricedOrder(db: PrismaClient, input: CreateOrderInput, creationKey: string) {
  if (!isOrderToken(creationKey)) throw new OrderRequestError('تعذر التحقق من محاولة الطلب');
  assertCredentialConfiguration();
  const creationKeyHash = hashOrderToken(creationKey, 'creation');
  const creationRequestHash = createHash('sha256').update(JSON.stringify({
    menuItemId: input.menuItemId,
    selectedToppingIds: [...input.selectedToppingIds].sort(),
    quantity: input.quantity,
    customerName: input.customerName,
  })).digest('hex');

  function responseFor(order: OrderWithItems) {
    if (order.creationRequestHash !== creationRequestHash) {
      throw new OrderRequestError('هذه المحاولة مرتبطة بطلب مختلف', 409);
    }
    if (!order.encryptedCredentials) throw new Error('Missing replay credentials');
    const credentials = openCredentials(order.encryptedCredentials, creationKeyHash);
    if (!verifyOrderToken(credentials.pickupToken, order.pickupTokenHash, 'pickup', order.credentialVersion) ||
        !verifyOrderToken(credentials.customerAccessToken, order.customerAccessTokenHash, 'access', order.credentialVersion)) {
      throw new Error('Credential integrity failure');
    }
    return { success: true, ...customerOrderStatus(order), ...credentials };
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const credentials = generateOrderCredentials();
      const order = await db.$transaction(async (tx) => {
        const existing = await tx.order.findUnique({ where: { creationKeyHash }, include: orderWithItems });
        if (existing) return existing;
        const { item, toppings, totalAmount } = await quoteOrder(tx, input);
        const created = await tx.order.create({
          data: {
            customerName: input.customerName,
            totalAmount,
            visibleCode: generateVisibleCode(),
            credentialVersion: 2,
            creationKeyHash,
            creationRequestHash,
            encryptedCredentials: sealCredentials(credentials, creationKeyHash),
            pickupTokenHash: hashOrderToken(credentials.pickupToken, 'pickup'),
            customerAccessTokenHash: hashOrderToken(credentials.customerAccessToken, 'access'),
            items: { create: {
              menuItemId: item.id,
              itemName: item.name,
              unitPrice: item.priceInAgorot,
              quantity: input.quantity,
              toppings: { create: toppings.map((topping) => ({
                toppingId: topping.id,
                toppingName: topping.name,
                toppingPrice: topping.priceInAgorot,
              })) },
            } },
          },
          include: orderWithItems,
        });
        await tx.realtimeEvent.create({ data: { orderId: created.id } });
        return created;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      return responseFor(order);
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError)) throw error;
      if (error.code === 'P2002') {
        // The transaction rolled back. A concurrent request may already have committed this key.
        const existing = await db.order.findUnique({ where: { creationKeyHash }, include: orderWithItems });
        if (existing) return responseFor(existing);
        const target = error.meta?.target;
        const fields = Array.isArray(target) ? target : [target];
        if (!fields.some((field) => ['visibleCode', 'pickupTokenHash', 'customerAccessTokenHash'].includes(String(field)))) throw error;
        if (attempt === 2) throw new OrderRequestError('تعذر إنشاء رمز الطلب، حاول مرة أخرى', 503);
        continue;
      }
      if (error.code !== 'P2034') throw error;
      // Retry only rolled-back serialization conflicts, never an uncertain commit.
      if (attempt === 2) throw new OrderRequestError('تغيّرت القائمة أثناء الطلب، حاول مرة أخرى', 409);
    }
  }
  throw new Error('Unreachable transaction retry state');
}
