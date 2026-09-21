import type { PrismaClient } from '@prisma/client';
import { readOrderInput } from './input';
import { createPricedOrder } from './create';
import { OrderRequestError } from './errors';
import { CredentialConfigurationError, isOrderToken } from './credentials';

export async function handleCreateOrder(request: Request, db: PrismaClient) {
  const headers = { 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer', Vary: 'Idempotency-Key' };
  try {
    const origin = request.headers.get('origin');
    // Next.js/reverse proxies may construct an internal request URL with another host.
    // Trust the configured public origin, never a client-supplied forwarded host.
    const expectedOrigin = new URL(process.env.NEXT_PUBLIC_APP_URL || request.url).origin;
    if ((origin && origin !== expectedOrigin) || request.headers.get('sec-fetch-site') === 'cross-site') {
      throw new OrderRequestError('مصدر الطلب غير مسموح', 403);
    }
    const input = await readOrderInput(request);
    const key = request.headers.get('idempotency-key');
    if (!isOrderToken(key)) throw new OrderRequestError('تعذر التحقق من محاولة الطلب');
    return Response.json(await createPricedOrder(db, input, key), { status: 201, headers });
  } catch (error) {
    return Response.json({
      message: error instanceof OrderRequestError ? error.message : 'تعذر إرسال الطلب، حاول مرة أخرى',
    }, { status: error instanceof OrderRequestError ? error.status : error instanceof CredentialConfigurationError ? 503 : 500, headers });
  }
}
