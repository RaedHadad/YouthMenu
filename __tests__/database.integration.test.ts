import { flushOutbox } from '@/lib/realtime/outbox';
import { activeOrders, updateKitchenOrder } from '@/lib/admin/orders';
import { createAdminSession, findAdminSession, revokeAdminSession, sessionHash } from '@/lib/admin/session';
import { consumeLoginAttempt } from '@/lib/admin/login';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { seedMenu } from '@/prisma/seed-menu';
import { getCustomerMenu } from '@/lib/customer-menu-query';
import { handleCreateOrder } from '@/lib/orders/http';
import { handleOrderStatus } from '@/lib/orders/status';
import * as credentials from '@/lib/orders/credentials';

const connection = process.env.TEST_DATABASE_URL;
if (!connection) throw new Error('Set TEST_DATABASE_URL to a disposable local PostgreSQL database.');
const baseUrl = new URL(connection);
if (!['localhost', '127.0.0.1', '[::1]'].includes(baseUrl.hostname) || !baseUrl.pathname.includes('test')) {
  throw new Error('Database tests require localhost and a database name containing "test".');
}

const bootstrap = new PrismaClient({ datasources: { db: { url: connection } } });
const schemas: string[] = [];
const clients: PrismaClient[] = [];
const tokenHash = () => randomBytes(32).toString('hex');

function runPrisma(url: string, args: string[]) {
  const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', ...args], {
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    encoding: 'utf8',
    timeout: 45_000,
  });
  // Do not include command output: it can contain connection credentials.
  if (result.status !== 0) throw new Error(`Prisma ${args[0]} ${args[1]} failed (exit ${result.status}).`);
}

async function createDatabase(legacy = false) {
  const schema = `ym_test_${randomBytes(12).toString('hex')}`;
  const url = new URL(baseUrl);
  url.searchParams.set('schema', schema);
  // Identifier is generated locally from hex bytes, never user input.
  await bootstrap.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  schemas.push(schema);
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  clients.push(db);

  if (legacy) {
    runPrisma(url.toString(), ['db', 'execute', '--file', 'prisma/migrations/202609200001_initial/migration.sql', '--schema', 'prisma/schema.prisma']);
    await db.$executeRaw`
      INSERT INTO "Order" ("id", "orderNumber", "customerName", "totalAmount", "visibleCode", "pickupTokenHash", "updatedAt")
      VALUES ('legacy-order', 104, 'أحمد', 500, 'LEGACY', ${tokenHash()}, NOW())
    `;
    runPrisma(url.toString(), ['migrate', 'resolve', '--applied', '202609200001_initial']);
  }
  runPrisma(url.toString(), ['migrate', 'deploy']);
  return { db, url: url.toString() };
}

function orderData() {
  return {
    customerName: 'أحمد',
    totalAmount: 1000,
    visibleCode: randomBytes(6).toString('hex').toUpperCase(),
    pickupTokenHash: tokenHash(),
    customerAccessTokenHash: tokenHash(),
  };
}

function orderRequest(input: unknown, key = tokenHash()) {
  return new Request('http://localhost/api/orders', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(input),
  });
}

async function orderFixture(db: PrismaClient) {
  const suffix = randomBytes(6).toString('hex');
  const topping = await db.topping.create({ data: { name: `إضافة ${suffix}`, priceInAgorot: 125 } });
  const dish = await db.menuItem.create({ data: {
    name: `وجبة ${suffix}`, priceInAgorot: 1050,
    toppings: { create: { toppingId: topping.id } },
  } });
  const input = { menuItemId: dish.id, selectedToppingIds: [topping.id], quantity: 3, customerName: '  أحمد محمد  ' };
  return { dish, topping, input };
}

describe('PostgreSQL migrations and relational invariants', () => {
  let db: PrismaClient;
  let url: string;

  beforeAll(async () => {
    vi.stubEnv('ORDER_TOKEN_ENCRYPTION_KEY', tokenHash());
    ({ db, url } = await createDatabase());
  });

  afterAll(async () => {
    for (const client of clients) await client.$disconnect();
    for (const schema of schemas) {
      // Drop only the random schema created by this test run, never public data.
      await bootstrap.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    }
    await bootstrap.$disconnect();
    vi.unstubAllEnvs();
  });

  it('applies all migrations and allows an empty repeat deployment', async () => {
    runPrisma(url, ['migrate', 'deploy']);
    const applied = await db.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY migration_name
    `;
    expect(applied.map((row) => row.migration_name)).toEqual([
      '202609200001_initial', '202609200002_database_integrity',
      '202609210001_secure_order_creation',
      '202609210002_admin_login_limits',
      '202609210003_realtime_outbox',
    ]);
    runPrisma(url, ['migrate', 'diff', '--from-schema-datasource', 'prisma/schema.prisma',
      '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code']);
  });

  it('seeds Arabic dishes and assigned toppings exactly once under concurrency', async () => {
    const results = await Promise.all([seedMenu(db), seedMenu(db)]);
    expect(results.filter((result) => result.applied)).toHaveLength(1);
    const items = await db.menuItem.findMany({ include: { toppings: true } });
    expect(items.map(({ name, priceInAgorot }) => ({ name, priceInAgorot }))).toEqual(expect.arrayContaining([
      { name: 'مقرونه', priceInAgorot: 500 },
      { name: 'توست', priceInAgorot: 500 },
      { name: 'مقرونه بيتسا', priceInAgorot: 500 },
      { name: 'تروبيت', priceInAgorot: 100 },
    ]));
    expect(items).toHaveLength(4);
    expect(items.find((item) => item.name === 'تروبيت')?.toppings).toHaveLength(0);
    expect(await db.menuItemTopping.count()).toBe(9);
    expect(await db.topping.count()).toBe(3);
    expect(await db.admin.count()).toBe(0);
  });

  it('does not restore renamed, repriced, archived or unassigned menu data', async () => {
    const item = await db.menuItem.findUniqueOrThrow({ where: { name: 'توست' } });
    const topping = await db.topping.findUniqueOrThrow({ where: { name: 'خردل' } });
    await db.menuItem.update({ where: { id: item.id }, data: {
      name: 'توست خاص', priceInAgorot: 700, isAvailable: false, archivedAt: new Date(),
    } });
    await db.menuItemTopping.deleteMany({ where: { menuItemId: item.id } });
    await db.topping.update({ where: { id: topping.id }, data: { name: 'خردل خاص', priceInAgorot: 200, isAvailable: false } });
    expect(await seedMenu(db)).toEqual({ applied: false });
    expect(await db.menuItem.findUnique({ where: { id: item.id } })).toMatchObject({
      name: 'توست خاص', priceInAgorot: 700, isAvailable: false, archivedAt: expect.any(Date),
    });
    expect(await db.menuItemTopping.count({ where: { menuItemId: item.id } })).toBe(0);
    expect(await db.topping.findUnique({ where: { id: topping.id } })).toMatchObject({ name: 'خردل خاص', priceInAgorot: 200 });
    expect(await db.menuItem.count()).toBe(4);
    expect(await db.topping.count()).toBe(3);
  });

  it('allocates unique order numbers during simultaneous inserts', async () => {
    const orders = await Promise.all(Array.from({ length: 16 }, () => db.order.create({ data: orderData() })));
    expect(new Set(orders.map((order) => order.orderNumber)).size).toBe(16);
    expect(orders.every((order) => order.orderNumber > 0 && order.estimatedMinutes === null)).toBe(true);
  });

  it('upgrades legacy orders without resetting numbers or exposing missing tokens', async () => {
    const { db: legacyDb } = await createDatabase(true);
    const oldOrder = await legacyDb.order.findUniqueOrThrow({ where: { id: 'legacy-order' } });
    expect(oldOrder.customerName).toBe('أحمد');
    expect(oldOrder.orderNumber).toBe(104);
    expect(oldOrder.credentialVersion).toBe(1);
    expect(oldOrder.customerAccessTokenHash).toMatch(/^[a-f0-9]{64}$/);
    const next = await legacyDb.order.create({ data: orderData() });
    expect(next.orderNumber).toBe(105);
  });

  it('preserves pre-existing menu prices and assignments on the first seed', async () => {
    const { db: existingDb } = await createDatabase();
    await existingDb.menuItem.create({ data: { name: 'توست', priceInAgorot: 900, isAvailable: false } });
    await seedMenu(existingDb);
    const item = await existingDb.menuItem.findUniqueOrThrow({ where: { name: 'توست' }, include: { toppings: true } });
    expect(item.priceInAgorot).toBe(900);
    expect(item.isAvailable).toBe(false);
    expect(item.toppings).toHaveLength(0);
  });

  it('rejects negative prices at the database boundary', async () => {
    await expect(db.menuItem.create({ data: { name: 'سعر سالب', priceInAgorot: -1 } })).rejects.toThrow();
    await expect(db.topping.create({ data: { name: 'إضافة سالبة', priceInAgorot: -1 } })).rejects.toThrow();
    await expect(db.order.create({ data: { ...orderData(), totalAmount: -1 } })).rejects.toThrow();
  });

  it('rejects invalid quantities and negative snapshot prices', async () => {
    for (const quantity of [0, 21]) {
      await expect(db.order.create({ data: { ...orderData(), items: { create: { itemName: 'مقرونه', unitPrice: 500, quantity } } } })).rejects.toThrow();
    }
    await expect(db.order.create({ data: { ...orderData(), items: { create: { itemName: 'مقرونه', unitPrice: -1, quantity: 1 } } } })).rejects.toThrow();
  });

  it('rejects invalid estimates and malformed or reused credentials', async () => {
    await expect(db.order.create({ data: { ...orderData(), estimatedMinutes: 0 } })).rejects.toThrow();
    await expect(db.order.create({ data: { ...orderData(), pickupTokenHash: 'short-code' } })).rejects.toThrow();
    const data = orderData();
    await db.order.create({ data });
    await expect(db.order.create({ data: { ...orderData(), customerAccessTokenHash: data.customerAccessTokenHash } })).rejects.toThrow();
  });

  it('requires complete payment and admin audit information for collected orders', async () => {
    await expect(db.order.create({ data: { ...orderData(), status: 'COLLECTED' } })).rejects.toThrow();
    await expect(db.order.create({ data: { ...orderData(), paymentStatus: 'PAID' } })).rejects.toThrow();
  });

  it('preserves order snapshots when source menu data is changed and deleted', async () => {
    const item = await db.menuItem.create({ data: { name: 'وجبة تاريخية', priceInAgorot: 500 } });
    const topping = await db.topping.create({ data: { name: 'إضافة تاريخية', priceInAgorot: 100 } });
    const order = await db.order.create({ data: {
      ...orderData(), totalAmount: 1200,
      items: { create: { menuItemId: item.id, itemName: item.name, unitPrice: 500, quantity: 2,
        toppings: { create: { toppingId: topping.id, toppingName: topping.name, toppingPrice: 100 } },
      } },
    } });
    await db.menuItem.update({ where: { id: item.id }, data: { name: 'اسم جديد', priceInAgorot: 700 } });
    await db.topping.update({ where: { id: topping.id }, data: { priceInAgorot: 300 } });
    await db.menuItem.delete({ where: { id: item.id } });
    await db.topping.delete({ where: { id: topping.id } });
    const saved = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: { include: { toppings: true } } } });
    expect(saved.totalAmount).toBe(1200);
    expect(saved.items[0]).toMatchObject({ itemName: 'وجبة تاريخية', unitPrice: 500, quantity: 2, menuItemId: null });
    expect(saved.items[0].toppings[0]).toMatchObject({ toppingName: 'إضافة تاريخية', toppingPrice: 100, toppingId: null });
    await expect(db.order.delete({ where: { id: order.id } })).rejects.toThrow();
    await expect(db.orderItem.delete({ where: { id: saved.items[0].id } })).rejects.toThrow();
  });

  it('enforces unique dish assignments and valid foreign keys', async () => {
    const link = await db.menuItemTopping.findFirstOrThrow();
    await expect(db.menuItemTopping.create({ data: { menuItemId: link.menuItemId, toppingId: link.toppingId } })).rejects.toThrow();
    await expect(db.menuItemTopping.create({ data: { menuItemId: 'missing', toppingId: link.toppingId } })).rejects.toThrow();
  });

  it('stores expiring hashed sessions and removes them with their admin', async () => {
    const admin = await db.admin.create({ data: { email: 'sessions@example.test', passwordHash: 'test-only' } });
    await expect(db.adminSession.create({ data: { adminId: admin.id, tokenHash: tokenHash(), expiresAt: new Date(0) } })).rejects.toThrow();
    await db.adminSession.create({ data: { adminId: admin.id, tokenHash: tokenHash(), expiresAt: new Date(Date.now() + 60_000) } });
    await db.admin.delete({ where: { id: admin.id } });
    expect(await db.adminSession.count({ where: { adminId: admin.id } })).toBe(0);
  });

  it('returns only public, unarchived menu data with the correct dish toppings', async () => {
    const available = await db.topping.create({ data: { name: 'إضافة معروضة', priceInAgorot: 150 } });
    const unavailable = await db.topping.create({ data: { name: 'إضافة غير متوفرة', priceInAgorot: 100, isAvailable: false } });
    const archived = await db.topping.create({ data: { name: 'إضافة مؤرشفة', priceInAgorot: 100, archivedAt: new Date() } });
    const dish = await db.menuItem.create({ data: {
      name: 'صنف للعرض', priceInAgorot: 750, isAvailable: false,
      toppings: { create: [available, unavailable, archived].map((topping) => ({ toppingId: topping.id })) },
    } });
    const hidden = await db.menuItem.create({ data: { name: 'صنف مؤرشف', priceInAgorot: 500, archivedAt: new Date() } });
    const menu = await getCustomerMenu(db);
    expect(menu.find((item) => item.id === hidden.id)).toBeUndefined();
    const result = menu.find((item) => item.id === dish.id)!;
    expect(result).toMatchObject({ name: 'صنف للعرض', priceInAgorot: 750, isAvailable: false });
    expect(Object.keys(result).sort()).toEqual(['id', 'isAvailable', 'name', 'priceInAgorot', 'toppings']);
    expect(result.toppings.map((topping) => topping.id).sort()).toEqual([available.id, unavailable.id].sort());
    expect(Object.keys(result.toppings[0]).sort()).toEqual(['id', 'isAvailable', 'name', 'priceInAgorot']);
  });

  it('creates an order through the HTTP handler with authoritative integer snapshots', async () => {
    const { dish, topping, input } = await orderFixture(db);
    const response = await handleCreateOrder(orderRequest(input), db);
    expect(response.status).toBe(201);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    const result = await response.json();
    expect(result).toMatchObject({ totalAmount: 3525, quantity: 3, customerName: 'أحمد محمد', itemName: dish.name });
    const stored = await db.order.findUniqueOrThrow({ where: { id: result.orderId }, include: { items: { include: { toppings: true } } } });
    expect(stored).toMatchObject({ totalAmount: 3525, status: 'PENDING', paymentStatus: 'UNPAID', paymentMethod: 'CASH', estimatedMinutes: null });
    expect(stored.items[0]).toMatchObject({ itemName: dish.name, unitPrice: 1050, quantity: 3 });
    expect(stored.items[0].toppings[0]).toMatchObject({ toppingName: topping.name, toppingPrice: 125 });
    expect(result).not.toHaveProperty('pickupTokenHash');
    expect(result).not.toHaveProperty('customerAccessTokenHash');
    await db.menuItem.update({ where: { id: dish.id }, data: { priceInAgorot: 2000 } });
    expect((await db.order.findUniqueOrThrow({ where: { id: result.orderId } })).totalAmount).toBe(3525);
  });

  it('uses current database prices instead of a previously loaded menu price', async () => {
    const { dish, topping, input } = await orderFixture(db);
    const previousMenu = await getCustomerMenu(db);
    expect(previousMenu.find((item) => item.id === dish.id)?.priceInAgorot).toBe(1050);
    await db.menuItem.update({ where: { id: dish.id }, data: { priceInAgorot: 700 } });
    await db.topping.update({ where: { id: topping.id }, data: { priceInAgorot: 200 } });
    const response = await handleCreateOrder(orderRequest({ ...input, quantity: 2 }), db);
    expect(response.status).toBe(201);
    expect((await response.json()).totalAmount).toBe(1800);
  });

  it.each(['missing-dish', 'unavailable-dish', 'archived-dish', 'missing-topping', 'unavailable-topping', 'archived-topping', 'unassigned-topping'])
    ('rejects %s without writing an order', async (scenario) => {
      const { dish, topping, input } = await orderFixture(db);
      if (scenario === 'missing-dish') input.menuItemId = 'missing';
      if (scenario === 'unavailable-dish') await db.menuItem.update({ where: { id: dish.id }, data: { isAvailable: false } });
      if (scenario === 'archived-dish') await db.menuItem.update({ where: { id: dish.id }, data: { archivedAt: new Date() } });
      if (scenario === 'missing-topping') input.selectedToppingIds = ['missing'];
      if (scenario === 'unavailable-topping') await db.topping.update({ where: { id: topping.id }, data: { isAvailable: false } });
      if (scenario === 'archived-topping') await db.topping.update({ where: { id: topping.id }, data: { archivedAt: new Date() } });
      if (scenario === 'unassigned-topping') await db.menuItemTopping.deleteMany({ where: { menuItemId: dish.id } });
      const count = await db.order.count();
      const response = await handleCreateOrder(orderRequest(input), db);
      expect(response.status).toBe(400);
      expect((await response.json()).message).toMatch(/[\u0600-\u06ff]/);
      expect(await db.order.count()).toBe(count);
    });

  it('rejects tampered requests through the real HTTP handler before persistence', async () => {
    const { input } = await orderFixture(db);
    const count = await db.order.count();
    for (const body of [
      { ...input, quantity: '2' }, { ...input, quantity: 1.5 }, { ...input, quantity: 0 },
      { ...input, totalAmount: 1 }, { ...input, price: 1 }, { ...input, paymentStatus: 'PAID' },
      { ...input, selectedToppingIds: [...input.selectedToppingIds, ...input.selectedToppingIds] },
    ]) {
      const response = await handleCreateOrder(orderRequest(body), db);
      expect(response.status).toBe(400);
    }
    expect(await db.order.count()).toBe(count);
  });

  it('maps malformed and oversized bodies to safe client errors', async () => {
    const count = await db.order.count();
    for (const [body, contentType, status] of [
      ['{broken', 'application/json', 400],
      ['a'.repeat(8193), 'application/json', 413],
      ['name=أحمد', 'application/x-www-form-urlencoded', 415],
    ] as const) {
      const response = await handleCreateOrder(new Request('http://localhost/api/orders', {
        method: 'POST', headers: { 'content-type': contentType }, body,
      }), db);
      expect(response.status).toBe(status);
      expect(Object.keys(await response.json())).toEqual(['message']);
    }
    expect(await db.order.count()).toBe(count);
  });

  it('rolls back an unrepresentable total without exposing internal details', async () => {
    const { dish, input } = await orderFixture(db);
    await db.menuItem.update({ where: { id: dish.id }, data: { priceInAgorot: 2_000_000_000 } });
    const count = await db.order.count();
    const response = await handleCreateOrder(orderRequest(input), db);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ message: 'تعذر إرسال الطلب، حاول مرة أخرى' });
    expect(await db.order.count()).toBe(count);
  });

  it('returns the original order and credentials when a response is retried', async () => {
    const { dish, input } = await orderFixture(db);
    const key = tokenHash();
    const first = await handleCreateOrder(orderRequest(input, key), db);
    const original = await first.json();
    expect(first.status).toBe(201);
    const count = await db.order.count();
    // A committed retry must not be repriced or rejected because today's menu changed.
    await db.menuItem.update({ where: { id: dish.id }, data: { priceInAgorot: 1700, isAvailable: false } });
    await db.order.update({ where: { id: original.orderId }, data: { status: 'PREPARING', estimatedMinutes: 10 } });
    const replay = await handleCreateOrder(orderRequest(input, key), db);
    expect(replay.status).toBe(201);
    expect(await replay.json()).toMatchObject({
      orderId: original.orderId, totalAmount: original.totalAmount,
      pickupToken: original.pickupToken, customerAccessToken: original.customerAccessToken,
      status: 'PREPARING', estimatedMinutes: 10,
    });
    expect(await db.order.count()).toBe(count);
    const stored = await db.order.findUniqueOrThrow({ where: { id: original.orderId } });
    expect(stored.creationKeyHash).toBe(credentials.hashOrderToken(key, 'creation'));
    expect(stored.pickupTokenHash).toBe(credentials.hashOrderToken(original.pickupToken, 'pickup'));
    expect(stored.customerAccessTokenHash).toBe(credentials.hashOrderToken(original.customerAccessToken, 'access'));
    expect(JSON.stringify(stored)).not.toContain(original.pickupToken);
    expect(JSON.stringify(stored)).not.toContain(original.customerAccessToken);
    expect(JSON.stringify(stored)).not.toContain(key);
  });

  it('creates exactly one order for simultaneous requests with the same retry key', async () => {
    const { input } = await orderFixture(db);
    const key = tokenHash();
    const count = await db.order.count();
    const responses = await Promise.all(Array.from({ length: 8 }, () => handleCreateOrder(orderRequest(input, key), db)));
    expect(responses.every((response) => response.status === 201)).toBe(true);
    const bodies = await Promise.all(responses.map((response) => response.json()));
    expect(new Set(bodies.map((body) => body.orderId)).size).toBe(1);
    expect(new Set(bodies.map((body) => body.pickupToken)).size).toBe(1);
    expect(new Set(bodies.map((body) => body.customerAccessToken)).size).toBe(1);
    expect(await db.order.count()).toBe(count + 1);
  });

  it('refuses a changed payload for an existing retry key without leaking its credentials', async () => {
    const { input } = await orderFixture(db);
    const key = tokenHash();
    const original = await (await handleCreateOrder(orderRequest(input, key), db)).json();
    const count = await db.order.count();
    const response = await handleCreateOrder(orderRequest({ ...input, quantity: 1 }, key), db);
    expect(response.status).toBe(409);
    expect(Object.keys(await response.json())).toEqual(['message']);
    expect(await db.order.count()).toBe(count);
    expect((await db.order.findUniqueOrThrow({ where: { id: original.orderId } })).totalAmount).toBe(original.totalAmount);
  });

  it('resolves simultaneous different payloads under one key to one winner', async () => {
    const { input } = await orderFixture(db);
    const key = tokenHash();
    const count = await db.order.count();
    const responses = await Promise.all([
      handleCreateOrder(orderRequest(input, key), db),
      handleCreateOrder(orderRequest({ ...input, quantity: 1 }, key), db),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(await db.order.count()).toBe(count + 1);
  });

  it('regenerates a visible pickup code after a database uniqueness collision', async () => {
    const { input } = await orderFixture(db);
    const original = await (await handleCreateOrder(orderRequest(input), db)).json();
    const code = vi.spyOn(credentials, 'generateVisibleCode').mockReturnValueOnce(original.visibleCode);
    try {
      const response = await handleCreateOrder(orderRequest(input), db);
      expect(response.status).toBe(201);
      const second = await response.json();
      expect(second.visibleCode).not.toBe(original.visibleCode);
      expect(second.pickupToken).not.toBe(original.pickupToken);
      expect(second.customerAccessToken).not.toBe(original.customerAccessToken);
      expect(code).toHaveBeenCalledTimes(2);
    } finally { code.mockRestore(); }
  });

  it('allows customer status with its access token and exposes only receipt fields', async () => {
    const { input } = await orderFixture(db);
    const original = await (await handleCreateOrder(orderRequest(input), db)).json();
    const response = await handleOrderStatus(new Request('http://localhost/status', {
      headers: { Authorization: `Bearer ${original.customerAccessToken}` },
    }), original.orderId, db);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(response.headers.get('Vary')).toBe('Authorization');
    const body = await response.json();
    expect(body).toMatchObject({ orderId: original.orderId, customerName: 'أحمد محمد' });
    for (const field of ['pickupToken', 'customerAccessToken', 'pickupTokenHash', 'customerAccessTokenHash', 'encryptedCredentials', 'creationKeyHash', 'creationRequestHash']) {
      expect(body).not.toHaveProperty(field);
    }
  });

  it('does not distinguish wrong tokens, other orders, short codes, pickup tokens or missing orders', async () => {
    const { input } = await orderFixture(db);
    const one = await (await handleCreateOrder(orderRequest(input), db)).json();
    const two = await (await handleCreateOrder(orderRequest(input), db)).json();
    for (const [id, token] of [
      [one.orderId, tokenHash()], [one.orderId, two.customerAccessToken],
      [one.orderId, one.pickupToken], [one.orderId, one.visibleCode],
      ['missing', one.customerAccessToken], [one.orderId, ''],
    ]) {
      const response = await handleOrderStatus(new Request('http://localhost/status', {
        headers: { Authorization: `Bearer ${token}` },
      }), id, db);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ message: 'تعذر الوصول إلى الطلب' });
    }
    const queryOnly = await handleOrderStatus(new Request(`http://localhost/status?token=${one.customerAccessToken}`), one.orderId, db);
    expect(queryOnly.status).toBe(404);
  });

  it('fails closed without an encryption key and leaves no partial order', async () => {
    const { input } = await orderFixture(db);
    const savedKey = process.env.ORDER_TOKEN_ENCRYPTION_KEY!;
    const count = await db.order.count();
    vi.stubEnv('ORDER_TOKEN_ENCRYPTION_KEY', '');
    try {
      const response = await handleCreateOrder(orderRequest(input), db);
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ message: 'تعذر إرسال الطلب، حاول مرة أخرى' });
      expect(await db.order.count()).toBe(count);
    } finally { vi.stubEnv('ORDER_TOKEN_ENCRYPTION_KEY', savedKey); }
  });

  it('requires a well-formed retry key and rejects cross-origin creation', async () => {
    const { input } = await orderFixture(db);
    const count = await db.order.count();
    for (const key of ['', 'short', 'a'.repeat(65)]) {
      expect((await handleCreateOrder(orderRequest(input, key), db)).status).toBe(400);
    }
    const crossOrigin = orderRequest(input);
    crossOrigin.headers.set('origin', 'https://unrelated.example');
    expect((await handleCreateOrder(crossOrigin, db)).status).toBe(403);
    expect(await db.order.count()).toBe(count);
  });

  it('checks the configured browser origin when the internal proxy URL differs', async () => {
    const { input } = await orderFixture(db);
    const previous = process.env.NEXT_PUBLIC_APP_URL;
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://menu.example');
    try {
      const request = orderRequest(input);
      request.headers.set('origin', 'https://menu.example');
      expect((await handleCreateOrder(request, db)).status).toBe(201);
      const forged = orderRequest(input);
      forged.headers.set('origin', 'https://attacker.example');
      forged.headers.set('x-forwarded-host', 'attacker.example');
      expect((await handleCreateOrder(forged, db)).status).toBe(403);
    } finally { vi.stubEnv('NEXT_PUBLIC_APP_URL', previous); }
  });
  it('stores hashed admin sessions, rotates, expires, revokes and rejects forged credentials', async () => {
    const admin = await db.admin.create({ data: { email: 'session-test@example.com', passwordHash: 'unused' } });
    const token = await createAdminSession(db, admin.id);
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(await findAdminSession(db, token)).toEqual({ id: admin.id, email: admin.email });
    const stored = await db.adminSession.findUniqueOrThrow({ where: { tokenHash: sessionHash(token) } });
    expect(JSON.stringify(stored)).not.toContain(token);
    expect(stored.expiresAt.getTime() - Date.now()).toBeGreaterThan(7.9 * 3600000);
    for (const forged of [undefined, 'forged', tokenHash(), token + '.extra']) {
      expect(await findAdminSession(db, forged)).toBeNull();
    }
    const rotated = await createAdminSession(db, admin.id, token);
    expect(rotated).not.toBe(token);
    expect(await findAdminSession(db, token)).toBeNull();
    await db.adminSession.update({ where: { tokenHash: sessionHash(rotated) }, data: {
      createdAt: new Date(Date.now() - 9 * 3600000), expiresAt: new Date(Date.now() - 3600000),
    } });
    expect(await findAdminSession(db, rotated)).toBeNull();
    const revoked = await createAdminSession(db, admin.id);
    await revokeAdminSession(db, revoked);
    expect(await findAdminSession(db, revoked)).toBeNull();
    const deleted = await createAdminSession(db, admin.id);
    await db.admin.delete({ where: { id: admin.id } });
    expect(await findAdminSession(db, deleted)).toBeNull();
  });

  it('atomically limits concurrent logins and renews expired windows', async () => {
    await db.adminLoginLimit.deleteMany();
    const attempts = await Promise.allSettled(Array.from({ length: 16 }, () => consumeLoginAttempt(db, 'limited@example.com')));
    expect(attempts.filter((result) => result.status === 'fulfilled')).toHaveLength(10);
    expect(attempts.filter((result) => result.status === 'rejected')).toHaveLength(6);
    expect(JSON.stringify(await db.adminLoginLimit.findMany())).not.toContain('limited@example.com');
    await db.adminLoginLimit.updateMany({ data: { windowStartedAt: new Date(0) } });
    await expect(consumeLoginAttempt(db, 'limited@example.com')).resolves.toBeUndefined();
    await db.adminLoginLimit.update({ where: { key: 'global' }, data: { attempts: 100 } });
    await expect(consumeLoginAttempt(db, 'another@example.com')).rejects.toMatchObject({ status: 429 });
    expect(await db.adminLoginLimit.count()).toBe(2);
  });

  it('commits one outbox event with each new order and none on an idempotent replay', async () => {
    const { input } = await orderFixture(db);
    const key = tokenHash();
    const response = await handleCreateOrder(orderRequest(input, key), db);
    expect(response.status).toBe(201);
    const { orderId } = await response.json();
    expect(await db.realtimeEvent.count({ where: { orderId } })).toBe(1);
    expect((await handleCreateOrder(orderRequest(input, key), db)).status).toBe(201);
    expect(await db.realtimeEvent.count({ where: { orderId } })).toBe(1);
  });

  it('conditionally transitions orders, rejects stale/invalid actions and keeps cancelled history', async () => {
    const order = await db.order.create({ data: orderData() });
    const input = { id: order.id, expectedStatus: 'PENDING', status: 'PREPARING', estimatedMinutes: 10 };
    const results = await Promise.allSettled([updateKitchenOrder(db, input), updateKitchenOrder(db, input)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await db.realtimeEvent.count({ where: { orderId: order.id } })).toBe(1);
    for (const status of ['PENDING', 'COLLECTED', 'INVALID']) {
      await expect(updateKitchenOrder(db, { id: order.id, expectedStatus: 'PREPARING', status })).rejects.toMatchObject({ status: 400 });
    }
    await updateKitchenOrder(db, { id: order.id, expectedStatus: 'PREPARING', status: 'READY' });
    expect(await db.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({ status: 'READY', estimatedMinutes: 10, readyAt: expect.any(Date) });
    await updateKitchenOrder(db, { id: order.id, expectedStatus: 'READY', status: 'CANCELLED' });
    expect((await activeOrders(db)).some((row) => row.id === order.id)).toBe(false);
    expect(await db.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({ status: 'CANCELLED', paymentStatus: 'UNPAID' });
    expect(await db.realtimeEvent.count({ where: { orderId: order.id } })).toBe(3);
  });

  it('leases outbox work under concurrency and retries provider failures without losing events', async () => {
    await db.realtimeEvent.deleteMany();
    const event = await db.realtimeEvent.create({ data: { orderId: 'test-order' } });
    const publish = vi.fn(async () => {});
    await Promise.all([flushOutbox(db, publish), flushOutbox(db, publish)]);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(event.id);
    const failed = await db.realtimeEvent.create({ data: { orderId: 'test-order-2' } });
    expect(await flushOutbox(db, async () => { throw new Error('Provider offline'); })).toMatchObject({ failed: 1 });
    expect(await db.realtimeEvent.findUniqueOrThrow({ where: { id: failed.id } })).toMatchObject({ deliveredAt: null, attempts: 1, leaseToken: null });
    await db.realtimeEvent.update({ where: { id: failed.id }, data: { nextAttemptAt: new Date(0), leaseUntil: new Date(0), leaseToken: 'abandoned' } });
    expect(await flushOutbox(db, publish)).toMatchObject({ delivered: 1 });
    expect(await db.realtimeEvent.findUniqueOrThrow({ where: { id: failed.id } })).toMatchObject({ deliveredAt: expect.any(Date), attempts: 2 });
  });

});
