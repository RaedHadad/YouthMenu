import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { seedMenu } from '../prisma/seed-menu';
import { BinaryBitmap, HybridBinarizer, RGBLuminanceSource, QRCodeReader } from '@zxing/library';

const schema = process.env.YOUTHMENU_BROWSER_TEST;
if (!schema || !/^ym_browser_[a-f0-9]{24}$/.test(schema) || new URL(process.env.DATABASE_URL!).searchParams.get('schema') !== schema) {
  throw new Error('Run browser tests through npm run test:browser, which creates an isolated schema.');
}
const db = new PrismaClient();

test.beforeEach(async () => {
  // This database schema belongs only to this browser test run.
  await db.realtimeEvent.deleteMany();
  await db.adminSession.deleteMany();
  await db.adminLoginLimit.deleteMany();
  await db.orderItemTopping.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.admin.deleteMany();
  await db.menuItem.deleteMany();
  await db.topping.deleteMany();
  await db.seedRun.deleteMany();
  await seedMenu(db);
});
test.afterAll(async () => { await db.$disconnect(); });

test('uses explicit accessible selection and only the selected dish toppings', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('radio')).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'أرسل الطلب' })).toBeDisabled();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await page.getByRole('radio', { name: /^توست/ }).check();
  await expect(page.getByRole('checkbox')).toHaveCount(3);
  await page.getByRole('checkbox', { name: /كاتشب/ }).check();
  await expect(page.getByRole('checkbox', { name: /كاتشب/ })).toBeChecked();
  await page.getByRole('radio', { name: /^تروبيت/ }).check();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByText('هذا الصنف يأتي بدون إضافات.')).toBeVisible();
  await page.getByRole('radio', { name: /^توست/ }).check();
  await expect(page.getByRole('checkbox', { name: /كاتشب/ })).not.toBeChecked();
});

test('database prices and availability appear without source changes', async ({ page }) => {
  await db.menuItem.update({ where: { name: 'مقرونه' }, data: { isAvailable: false } });
  await db.menuItem.update({ where: { name: 'توست' }, data: { priceInAgorot: 750 } });
  await db.topping.update({ where: { name: 'خردل' }, data: { isAvailable: false } });
  await db.topping.update({ where: { name: 'طحينة' }, data: { archivedAt: new Date() } });
  await page.goto('/');
  await expect(page.getByRole('radio', { name: /^مقرونه،/ })).toBeDisabled();
  await expect(page.getByRole('radio', { name: 'توست، ₪7.50' })).toBeEnabled();
  await page.getByRole('radio', { name: /^توست/ }).check();
  await expect(page.getByRole('checkbox', { name: /خردل/ })).toBeDisabled();
  await expect(page.getByRole('checkbox', { name: /طحينة/ })).toHaveCount(0);
  await expect(page.getByRole('status', { name: 'الإجمالي', exact: true })).toHaveText('₪7.50');
  await db.menuItem.update({ where: { name: 'توست' }, data: { isAvailable: false } });
  await page.getByRole('button', { name: 'تحديث القائمة' }).click();
  await expect(page.getByRole('button', { name: 'أرسل الطلب' })).toBeDisabled();
  await expect(page.getByText('الصنف الذي اخترته لم يعد متوفراً. اختر صنفاً آخر.')).toBeVisible();
});

test('handles an empty menu and a sold-out menu', async ({ page }) => {
  await db.menuItem.updateMany({ data: { isAvailable: false } });
  await page.goto('/');
  await expect(page.getByText('الأصناف غير متوفرة حالياً. ننتظرك قريباً!')).toBeVisible();
  await expect(page.getByRole('button', { name: 'أرسل الطلب' })).toBeDisabled();
  await db.menuItem.updateMany({ data: { archivedAt: new Date() } });
  await page.getByRole('button', { name: 'تحديث القائمة' }).click();
  await expect(page.getByRole('heading', { name: 'القائمة تُحضّر على نار هادئة!' })).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'أرسل الطلب' })).toHaveCount(0);
});

test('submits identifiers and quantity with no browser-supplied price', async ({ page }) => {
  const topping = await db.topping.update({ where: { name: 'كاتشب' }, data: { priceInAgorot: 200 } });
  const item = await db.menuItem.findUniqueOrThrow({ where: { name: 'توست' } });
  let body: unknown;
  await page.route('**/api/orders', async (route) => {
    body = route.request().postDataJSON();
    await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'رسالة اختبار' }) });
  });
  await page.goto('/');
  await page.getByRole('radio', { name: /^توست/ }).check();
  await page.getByRole('checkbox', { name: /كاتشب/ }).check();
  await page.getByRole('button', { name: 'زيادة الكمية' }).click();
  await expect(page.getByRole('status', { name: 'الإجمالي', exact: true })).toHaveText('₪14');
  await page.getByRole('textbox', { name: 'الاسم', exact: true }).fill('أحمد');
  await page.getByRole('button', { name: 'أرسل الطلب' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'رسالة اختبار' })).toBeVisible();
  expect(body).toEqual({ menuItemId: item.id, selectedToppingIds: [topping.id], quantity: 2, customerName: 'أحمد' });
});

test('supports keyboard dish and topping selection', async ({ page }) => {
  await page.goto('/');
  const dish = page.getByRole('radio', { name: /^توست/ });
  await dish.focus();
  await page.keyboard.press('Space');
  await expect(dish).toBeChecked();
  const topping = page.getByRole('checkbox', { name: /كاتشب/ });
  await topping.focus();
  await page.keyboard.press('Space');
  await expect(topping).toBeChecked();
  await expect(topping).toBeFocused();
});

for (const width of [360, 768, 1440]) {
  test(`has no horizontal overflow at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.getByRole('radio', { name: /^توست/ }).check();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole('textbox', { name: 'الاسم', exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`menu-${width}.png`), fullPage: true });
  });
}

test('recovers a committed order after a lost response and browser refresh', async ({ page }) => {
  const keys: string[] = [];
  let firstResponse: { orderId: string; pickupToken: string; customerAccessToken: string } | undefined;
  await page.route('**/api/orders', async (route) => {
    keys.push(route.request().headers()['idempotency-key']);
    if (keys.length === 1) {
      const committed = await route.fetch();
      expect(committed.status()).toBe(201);
      firstResponse = await committed.json();
      await route.abort('failed');
    } else await route.continue();
  });
  await page.goto('/');
  await page.getByRole('radio', { name: /^توست/ }).check();
  await page.getByRole('textbox', { name: 'الاسم', exact: true }).fill('أحمد');
  await page.getByRole('button', { name: 'أرسل الطلب' }).click();
  await expect(page.getByRole('heading', { name: 'طلبك بانتظار التأكيد' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'إعادة المحاولة' })).toBeEnabled();
  expect(await db.order.count()).toBe(1);
  await page.reload();
  await page.getByRole('button', { name: 'إعادة المحاولة' }).click();
  await expect(page.getByRole('button', { name: 'طباعة البون' })).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toMatch(/^[a-f0-9]{64}$/);
  expect(keys[1]).toBe(keys[0]);
  expect(await db.order.count()).toBe(1);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('youthmenu_current_order')!));
  expect(saved).toMatchObject({ orderId: firstResponse!.orderId, pickupToken: firstResponse!.pickupToken,
    customerAccessToken: firstResponse!.customerAccessToken });
  expect(await page.evaluate(() => localStorage.getItem('youthmenu_pending_order'))).toBeNull();
});

test('restores an order with a header token and no credential in the URL', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('radio', { name: /^توست/ }).check();
  await page.getByRole('textbox', { name: 'الاسم', exact: true }).fill('سارة');
  await page.getByRole('button', { name: 'أرسل الطلب' }).click();
  await expect(page.getByRole('button', { name: 'طباعة البون' })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('youthmenu_current_order')!));
  const request = page.waitForRequest((request) => request.url().includes('/status'));
  await page.reload();
  const statusRequest = await request;
  expect(new URL(statusRequest.url()).search).toBe('');
  expect(statusRequest.headers()['authorization']).toBe(`Bearer ${saved.customerAccessToken}`);
  await expect(page.getByRole('button', { name: 'طباعة البون' })).toBeVisible();
  await expect(page.getByText('سارة', { exact: true })).toBeVisible();
  expect(await db.order.count()).toBe(1);
});

test('does not send an order if the pending attempt cannot be saved', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Storage blocked', 'QuotaExceededError'); };
  });
  let sent = 0;
  page.on('request', (request) => { if (request.url().endsWith('/api/orders')) sent += 1; });
  await page.goto('/');
  await page.getByRole('radio', { name: /^توست/ }).check();
  await page.getByRole('textbox', { name: 'الاسم', exact: true }).fill('أحمد');
  await page.getByRole('button', { name: 'أرسل الطلب' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'تعذر حفظ محاولة الطلب' })).toBeVisible();
  expect(sent).toBe(0);
  expect(await db.order.count()).toBe(0);
});

// Decode the rendered pixels, rather than inspecting a React prop or token attribute.
async function decodeReceiptQr(page: import('@playwright/test').Page) {
  const pixels = await page.getByRole('img', { name: 'رمز QR الآمن لاستلام الطلب' }).evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const rgba = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    const luminance = [];
    for (let i = 0; i < rgba.length; i += 4) luminance.push((rgba[i] + 2 * rgba[i + 1] + rgba[i + 2]) / 4);
    return { luminance, width: canvas.width, height: canvas.height };
  });
  return new QRCodeReader().decode(new BinaryBitmap(new HybridBinarizer(
    new RGBLuminanceSource(Uint8ClampedArray.from(pixels.luminance), pixels.width, pixels.height),
  ))).getText();
}

test('receipt shows server snapshots and a decodable pickup credential after refresh', async ({ page }) => {
  await db.topping.update({ where: { name: 'كاتشب' }, data: { priceInAgorot: 125 } });
  await page.goto('/');
  await page.getByRole('radio', { name: /^توست/ }).check();
  await page.getByRole('checkbox', { name: /كاتشب/ }).check();
  await page.getByRole('button', { name: 'زيادة الكمية' }).click();
  await page.getByRole('textbox', { name: 'الاسم', exact: true }).fill('أحمد');
  await page.getByRole('button', { name: 'أرسل الطلب' }).click();
  await expect(page.getByRole('heading', { name: /بون الطلب/ })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('youthmenu_current_order')!));
  expect(await decodeReceiptQr(page)).toBe(saved.pickupToken);
  expect(saved.pickupToken).not.toBe(saved.customerAccessToken);
  expect(saved.pickupToken).not.toBe(saved.visibleCode);
  await expect(page.getByText('₪12.50', { exact: true })).toBeVisible();
  await expect(page.getByText('بانتظار تحديد الوقت من المطبخ')).toBeVisible();
  await db.menuItem.update({ where: { name: 'توست' }, data: { name: 'توست جديد', priceInAgorot: 900 } });
  await db.order.update({ where: { id: saved.orderId }, data: { status: 'PREPARING', estimatedMinutes: 15 } });
  await page.reload();
  await expect(page.getByText('طلبك قيد التحضير...', { exact: true })).toBeVisible();
  await expect(page.getByText('الوقت المقدر: ~15 دقيقة')).toBeVisible();
  await expect(page.getByText('توست', { exact: true })).toBeVisible();
  await expect(page.getByText('₪12.50', { exact: true })).toBeVisible();
  expect(await decodeReceiptQr(page)).toBe(saved.pickupToken);
  await expect(page.getByRole('article')).not.toContainText(saved.customerAccessToken);
});

for (const width of [320, 768, 1440]) {
  test(`receipt handles long Arabic details and printing at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.getByRole('radio', { name: /^توست/ }).check();
    await page.getByRole('textbox', { name: 'الاسم', exact: true }).fill('أحمد'.repeat(20));
    await page.getByRole('button', { name: 'أرسل الطلب' }).click();
    await expect(page.getByRole('heading', { name: /بون الطلب/ })).toBeVisible();
    await expect(page.getByText('لا يوجد', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`receipt-${width}.png`), fullPage: true });
    await page.evaluate(() => {
      window.print = () => { document.documentElement.dataset.printCalled = 'yes'; };
      const unrelated = document.createElement('aside');
      unrelated.id = 'unrelated-print-content';
      unrelated.textContent = 'Unrelated application content';
      unrelated.style.height = '3000px';
      document.body.append(unrelated);
    });
    await page.getByRole('button', { name: 'طباعة البون' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-print-called', 'yes');
    const pickup = await decodeReceiptQr(page);
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('#unrelated-print-content')).toBeHidden();
    await expect(page.getByRole('button', { name: 'طباعة البون' })).toBeHidden();
    await expect(page.locator('.skip-link')).toBeHidden();
    await expect(page.getByRole('heading', { name: /بون الطلب/ })).toBeVisible();
    await expect(page.getByText('الدفع نقداً عند الاستلام', { exact: true })).toBeVisible();
    expect(await decodeReceiptQr(page)).toBe(pickup);
    const bounds = await page.getByRole('article').boundingBox();
    expect(bounds!.width).toBeLessThanOrEqual(303); // 80mm at 96 CSS pixels/inch.
    await page.screenshot({ path: testInfo.outputPath(`receipt-print-${width}.png`), fullPage: true });
    await page.pdf({ path: testInfo.outputPath(`receipt-${width}.pdf`), format: 'A4', printBackground: false });
    await page.emulateMedia({ media: 'screen' });
    await expect(page.getByRole('button', { name: 'طباعة البون' })).toBeVisible();
  });
}

test('protects every admin page and API from missing and forged cookies', async ({ page, context }) => {
  for (const cookie of ['', 'forged', 'a'.repeat(64)]) {
    await context.clearCookies();
    if (cookie) await context.addCookies([{ name: 'admin_session', value: cookie, url: 'http://127.0.0.1:3107' }]);
    for (const path of ['/admin', '/admin/menu', '/admin/orders', '/admin/scanner']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/login$/);
    }
    for (const [path, method] of [['menu', 'GET'], ['menu', 'POST'], ['menu', 'PATCH'], ['orders', 'GET'], ['orders', 'PATCH'], ['realtime-token', 'POST']]) {
      const response = await context.request.fetch(`/api/admin/${path}`, { method, data: {} });
      expect(response.status()).toBe(401);
      expect(response.headers()['cache-control']).toContain('no-store');
    }
  }
});

test('admin login uses private cookies, rotates sessions and logout revokes access', async ({ page, context }) => {
  const password = 'Test-only-password-2026!';
  await db.admin.create({ data: { email: 'admin@example.com', passwordHash: await hash(password, 12) } });
  await page.goto('/admin/login');
  await page.getByLabel('البريد الإلكتروني').fill('ADMIN@example.com');
  await page.getByLabel('كلمة المرور').fill(password);
  await page.getByRole('button', { name: 'دخول', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  const first = (await context.cookies()).find((cookie) => cookie.name === 'admin_session')!;
  expect(first.value).toMatch(/^[a-f0-9]{64}$/);
  expect(first.httpOnly).toBe(true);
  expect(first.sameSite).toBe('Strict');
  expect(await page.evaluate(() => document.cookie)).not.toContain('admin_session');
  expect((await context.request.get('/api/admin/orders')).status()).toBe(200);
  for (const path of ['menu', 'orders']) {
    expect((await context.request.patch(`/api/admin/${path}`, { headers: { Origin: 'https://evil.example' }, data: {} })).status()).toBe(403);
  }
  expect((await context.request.post('/api/admin/logout', { headers: { Origin: 'https://evil.example' } })).status()).toBe(403);
  const loggedInAgain = await context.request.post('/api/admin/login', {
    headers: { Origin: 'http://127.0.0.1:3107' }, data: { email: 'admin@example.com', password },
  });
  expect(loggedInAgain.status()).toBe(200);
  expect(await db.adminSession.count()).toBe(1);
  expect((await context.cookies()).find((cookie) => cookie.name === 'admin_session')!.value).not.toBe(first.value);
  expect((await context.request.get('/api/admin/orders', { headers: { Cookie: `admin_session=${first.value}` } })).status()).toBe(401);
  await page.getByRole('button', { name: 'تسجيل الخروج' }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  expect(await db.adminSession.count()).toBe(0);
  expect((await context.request.get('/api/admin/orders')).status()).toBe(401);
});

test('login rejects cross-origin, malformed and oversized requests and limits repeated failures', async ({ context }) => {
  const endpoint = '/api/admin/login';
  const headers = { Origin: 'http://127.0.0.1:3107', 'Content-Type': 'application/json' };
  expect((await context.request.post(endpoint, { data: {} })).status()).toBe(403);
  expect((await context.request.post(endpoint, { headers, data: '{' })).status()).toBe(400);
  expect((await context.request.post(endpoint, { headers, data: 'x'.repeat(8193) })).status()).toBe(413);
  await db.admin.create({ data: { email: 'admin@example.com', passwordHash: await hash('Test-only-password-2026!', 12) } });
  const wrong = await context.request.post(endpoint, { headers, data: { email: 'admin@example.com', password: 'incorrect' } });
  const unknown = await context.request.post(endpoint, { headers, data: { email: 'unknown@example.com', password: 'incorrect' } });
  expect(wrong.status()).toBe(401);
  expect(unknown.status()).toBe(401);
  expect(await wrong.json()).toEqual(await unknown.json());
  for (let i = 0; i < 9; i++) {
    expect((await context.request.post(endpoint, { headers, data: { email: 'unknown@example.com', password: 'incorrect' } })).status()).toBe(401);
  }
  const limited = await context.request.post(endpoint, { headers, data: { email: 'unknown@example.com', password: 'incorrect' } });
  expect(limited.status()).toBe(429);
  expect(limited.headers()['retry-after']).toBe('900');
  expect(await db.adminSession.count()).toBe(0);
});

test('kitchen receives orders through fallback and moves them safely between columns', async ({ page, context }) => {
  const password = 'Test-only-password-2026!';
  await db.admin.create({ data: { email: 'kitchen@example.com', passwordHash: await hash(password, 12) } });
  await context.request.post('/api/admin/login', { headers: { Origin: 'http://127.0.0.1:3107' }, data: { email: 'kitchen@example.com', password } });
  await page.goto('/admin');
  await expect(page.getByText('تحديث تلقائي كل 8 ثوانٍ')).toBeVisible();
  const dish = await db.menuItem.findUniqueOrThrow({ where: { name: 'توست' } });
  const response = await context.request.post('/api/orders', { headers: { 'Idempotency-Key': 'f'.repeat(64) },
    data: { menuItemId: dish.id, quantity: 1, customerName: 'طلب مباشر', selectedToppingIds: [] } });
  expect(response.status()).toBe(201);
  const created = await response.json();
  await expect(page.getByText('طلب مباشر', { exact: true })).toBeVisible({ timeout: 12000 });
  await expect(page.getByText('وصل 1 طلب جديد')).toBeVisible();
  await page.getByRole('button', { name: 'بدء التحضير', exact: true }).click();
  await expect(page.getByRole('button', { name: 'جاهز للاستلام', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'جاهز للاستلام', exact: true }).click();
  await expect(page.getByRole('button', { name: 'جاهز للاستلام', exact: true })).toHaveCount(0);
  expect((await db.order.findUniqueOrThrow({ where: { id: created.orderId } })).status).toBe('READY');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'إلغاء الطلب' }).click();
  expect((await db.order.findUniqueOrThrow({ where: { id: created.orderId } })).status).toBe('READY');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'إلغاء الطلب' }).click();
  await expect(page.getByText('طلب مباشر', { exact: true })).toHaveCount(0);
  expect((await db.order.findUniqueOrThrow({ where: { id: created.orderId } })).status).toBe('CANCELLED');
  expect(await db.realtimeEvent.count({ where: { orderId: created.orderId } })).toBe(4);
  expect((await context.request.get('/api/internal/realtime')).status()).toBe(401);
});
