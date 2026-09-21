import type { PrismaClient } from '@prisma/client';
import { verifyOrderToken } from './credentials';
import { privateOrderHeaders } from './status';
import { ablyRest, realtimeConfigured } from '../realtime/server';
import { orderChannel, ADMIN_REALTIME_TTL } from '../realtime/config';

export async function handleCustomerRealtime(request: Request, id: string, db: PrismaClient) {
  const reply = (body: unknown, status: number) => Response.json(body, { status, headers: privateOrderHeaders });
  const denied = () => reply({ message: 'تعذر الوصول إلى الطلب' }, 404);
  const token = request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return denied();
  try {
    const order = await db.order.findUnique({ where: { id }, select: { customerAccessTokenHash: true, credentialVersion: true } });
    if (!order || !verifyOrderToken(token, order.customerAccessTokenHash, 'access', order.credentialVersion)) return denied();
    if (!realtimeConfigured()) return reply({ message: 'التحديث الدوري متاح' }, 503);
    return reply(await ablyRest().auth.createTokenRequest({ ttl: ADMIN_REALTIME_TTL,
      capability: { [orderChannel(id)]: ['subscribe'] } }), 200);
  } catch { return reply({ message: 'تعذر الاتصال بالخادم' }, 503); }
}
