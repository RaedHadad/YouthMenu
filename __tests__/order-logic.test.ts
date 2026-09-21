import { describe, expect, it } from 'vitest';
import { calculateOrderTotal } from '@/lib/pricing';
import { formatMoney } from '@/lib/money';
import { parseOrderInput, readOrderInput } from '@/lib/orders/input';
import { validatePickupToken, isOrderStatusTransitionAllowed } from '@/lib/business';

const valid = { menuItemId: 'dish-1', selectedToppingIds: ['sauce-1'], quantity: 2, customerName: 'أحمد' };

function request(body: string, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/orders', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body });
}

describe('integer order pricing', () => {
  it('multiplies the base price and per-item topping prices by quantity', () => {
    expect(calculateOrderTotal({ priceInAgorot: 500 }, [], 3)).toBe(1500);
    expect(calculateOrderTotal({ priceInAgorot: 500 }, [{ priceInAgorot: 50 }, { priceInAgorot: 100 }], 2)).toBe(1300);
    expect(calculateOrderTotal({ priceInAgorot: 0 }, [{ priceInAgorot: 0 }], 20)).toBe(0);
    expect(calculateOrderTotal({ priceInAgorot: 1050 }, [], 3)).toBe(3150);
  });

  it.each([0, -1, 1.5, 21, NaN, Infinity])('rejects quantity %s instead of rounding it', (quantity) => {
    expect(() => calculateOrderTotal({ priceInAgorot: 500 }, [], quantity)).toThrow(RangeError);
  });

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER])('rejects invalid database price %s', (priceInAgorot) => {
    expect(() => calculateOrderTotal({ priceInAgorot }, [], 1)).toThrow(RangeError);
    expect(() => calculateOrderTotal({ priceInAgorot: 500 }, [{ priceInAgorot }], 1)).toThrow(RangeError);
  });

  it('rejects totals that cannot fit in the PostgreSQL money column', () => {
    expect(() => calculateOrderTotal({ priceInAgorot: 2_000_000_000 }, [], 2)).toThrow(RangeError);
    expect(() => calculateOrderTotal({ priceInAgorot: 2_000_000_000 }, [{ priceInAgorot: 2_000_000_000 }], 1)).toThrow(RangeError);
  });

  it.each([[0, '₪0'], [100, '₪1'], [500, '₪5'], [1050, '₪10.50'], [101, '₪1.01']])('formats %s agorot', (amount, expected) => {
    expect(formatMoney(amount as number)).toBe(expected);
  });

  it('does not silently normalize invalid money', () => {
    for (const value of [-1, 1.5, Infinity, NaN]) expect(() => formatMoney(value)).toThrow(RangeError);
  });
});

describe('customer request validation', () => {
  it('accepts Arabic names and trims surrounding whitespace', () => {
    expect(parseOrderInput({ ...valid, customerName: '  أحمد محمد  ' }).customerName).toBe('أحمد محمد');
    expect(parseOrderInput({ ...valid, selectedToppingIds: undefined }).selectedToppingIds).toEqual([]);
  });

  it.each(['price', 'unitPrice', 'totalAmount', 'amountFromClient', 'paymentStatus', 'status'])('rejects the additional field %s', (key) => {
    expect(() => parseOrderInput({ ...valid, [key]: 1 })).toThrow('لا يمكن إرسال أسعار أو حقول إضافية مع الطلب');
  });

  it.each(['2', true, null, 0, -1, 1.2, 21])('rejects quantity %s without coercion', (quantity) => {
    expect(() => parseOrderInput({ ...valid, quantity })).toThrow();
  });

  it('rejects duplicate and excessive toppings', () => {
    expect(() => parseOrderInput({ ...valid, selectedToppingIds: ['sauce-1', 'sauce-1'] })).toThrow('لا يمكن تكرار الإضافة');
    expect(() => parseOrderInput({ ...valid, selectedToppingIds: Array.from({ length: 31 }, (_, i) => `t${i}`) })).toThrow();
  });

  it('bounds and validates identifiers and customer names', () => {
    for (const menuItemId of ['', 'a'.repeat(129), 'a b', null, 4]) {
      expect(() => parseOrderInput({ ...valid, menuItemId })).toThrow();
    }
    for (const customerName of ['', ' ', 'أ', 'أ'.repeat(81), 'أحمد\nمحمد', 'أحمد\u202E', null]) {
      expect(() => parseOrderInput({ ...valid, customerName })).toThrow();
    }
    for (const value of [null, [], 'order', 5]) expect(() => parseOrderInput(value)).toThrow();
  });

  it('reads valid UTF-8 JSON and handles a charset suffix', async () => {
    expect(await readOrderInput(request(JSON.stringify(valid), { 'content-type': 'application/json; charset=utf-8' }))).toEqual(valid);
  });

  it('returns a client error for malformed JSON and unsupported body formats', async () => {
    await expect(readOrderInput(request('{broken'))).rejects.toMatchObject({ status: 400 });
    await expect(readOrderInput(request('name=test', { 'content-type': 'text/plain' }))).rejects.toMatchObject({ status: 415 });
  });

  it('enforces actual body bytes even when Content-Length is absent or misleading', async () => {
    await expect(readOrderInput(request('a'.repeat(8193)))).rejects.toMatchObject({ status: 413 });
    await expect(readOrderInput(request('a'.repeat(8193), { 'content-length': '1' }))).rejects.toMatchObject({ status: 413 });
    await expect(readOrderInput(request('{}', { 'content-length': '8193' }))).rejects.toMatchObject({ status: 413 });
  });

  it('does not count Arabic UTF-8 bytes as single characters', async () => {
    await expect(readOrderInput(request(JSON.stringify({ ...valid, customerName: 'أ'.repeat(5000) })))).rejects.toMatchObject({ status: 413 });
  });
});

describe('existing token and status rules', () => {
  it('validates pickup token format', () => {
    expect(validatePickupToken('abc123')).toBe(false);
    expect(validatePickupToken('8f8d99f72c7e8f7f5c1940ade1119d08c4b3f4f7f9c9639a0d5f26d2ae88b7bd')).toBe(true);
  });
  it('allows only valid status transitions', () => {
    expect(isOrderStatusTransitionAllowed('PENDING', 'PREPARING')).toBe(true);
    expect(isOrderStatusTransitionAllowed('READY', 'COLLECTED')).toBe(true);
    expect(isOrderStatusTransitionAllowed('PENDING', 'COLLECTED')).toBe(false);
  });
});
