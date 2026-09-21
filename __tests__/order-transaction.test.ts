import { Prisma, PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPricedOrder } from '@/lib/orders/create';
import { generateOrderCredentials, hashOrderToken, sealCredentials } from '@/lib/orders/credentials';

const db = new PrismaClient();
const input = { menuItemId: 'dish', selectedToppingIds: [], quantity: 1, customerName: 'أحمد' };
const key = randomBytes(32).toString('hex');
const conflict = () => new Prisma.PrismaClientKnownRequestError('Serialization conflict', {
  code: 'P2034', clientVersion: Prisma.prismaVersion.client,
});

beforeEach(() => vi.stubEnv('ORDER_TOKEN_ENCRYPTION_KEY', randomBytes(32).toString('hex')));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe('order transaction failure handling', () => {
  it('retries a rolled-back serialization conflict and returns the committed snapshot', async () => {
    const credentials = generateOrderCredentials();
    const transaction = vi.spyOn(db, '$transaction')
      .mockRejectedValueOnce(conflict())
      .mockResolvedValueOnce({
        id: 'order', orderNumber: 104, customerName: 'أحمد', visibleCode: 'ABC123', totalAmount: 500,
        credentialVersion: 2, status: 'PENDING', estimatedMinutes: null,
        creationRequestHash: createHash('sha256').update(JSON.stringify(input)).digest('hex'),
        encryptedCredentials: sealCredentials(credentials, hashOrderToken(key, 'creation')),
        pickupTokenHash: hashOrderToken(credentials.pickupToken, 'pickup'),
        customerAccessTokenHash: hashOrderToken(credentials.customerAccessToken, 'access'),
        items: [{ itemName: 'توست', quantity: 1, toppings: [] }],
      });
    const result = await createPricedOrder(db, input, key);
    expect(result).toMatchObject({ orderId: 'order', totalAmount: 500, itemName: 'توست' });
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(transaction.mock.calls[0][1]).toMatchObject({ isolationLevel: 'Serializable' });
  });

  it('limits conflict retries and returns a recoverable error', async () => {
    const transaction = vi.spyOn(db, '$transaction').mockRejectedValue(conflict());
    await expect(createPricedOrder(db, input, key)).rejects.toMatchObject({ status: 409 });
    expect(transaction).toHaveBeenCalledTimes(3);
  });

  it('does not retry a connection failure with an uncertain commit outcome', async () => {
    const error = new Error('Connection lost');
    const transaction = vi.spyOn(db, '$transaction').mockRejectedValue(error);
    await expect(createPricedOrder(db, input, key)).rejects.toBe(error);
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
