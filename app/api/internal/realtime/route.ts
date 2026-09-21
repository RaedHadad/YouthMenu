import { timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { flushOutbox } from '@/lib/realtime/outbox';
import { adminJson, adminError } from '@/lib/admin/http';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || secret.length < 32 || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return adminJson({ message: 'غير مصرح' }, 401);
  }
  try { return adminJson(await flushOutbox(prisma)); }
  catch (error) { return adminError(error); }
}
