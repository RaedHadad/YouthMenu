import type { PrismaClient } from '@prisma/client';
import { isOrderToken, verifyOrderToken } from './credentials';
import { customerOrderStatus, orderWithItems } from './serialize';

export const privateOrderHeaders = { 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer', Vary: 'Authorization' };

export async function handleOrderStatus(request: Request, id: string, db: PrismaClient) {
  const denied = () => Response.json({ message: 'تعذر الوصول إلى الطلب' }, { status: 404, headers: privateOrderHeaders });
  const token = request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!isOrderToken(token) || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return denied();
  try {
    const order = await db.order.findUnique({ where: { id }, include: orderWithItems });
    if (!order || !verifyOrderToken(token, order.customerAccessTokenHash, 'access', order.credentialVersion)) return denied();
    return Response.json(customerOrderStatus(order), { headers: privateOrderHeaders });
  } catch {
    return Response.json({ message: 'تعذر الاتصال بالخادم، حاول مرة أخرى' }, { status: 503, headers: privateOrderHeaders });
  }
}
