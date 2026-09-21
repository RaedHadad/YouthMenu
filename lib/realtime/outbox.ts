import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { ablyRest, realtimeConfigured } from './server';
import { KITCHEN_CHANNEL, ORDER_EVENT } from './config';

type Publisher = (id: string) => Promise<void>;
const publish: Publisher = async (id) => {
  await ablyRest().channels.get(KITCHEN_CHANNEL).publish({ id, name: ORDER_EVENT, data: { version: 1 } });
};

/** Leased, bounded, at-least-once delivery. Duplicate invalidations are harmless. */
export async function flushOutbox(db: PrismaClient, send: Publisher = publish) {
  if (send === publish && !realtimeConfigured()) return { delivered: 0, failed: 0, configured: false };
  const now = new Date();
  const due = await db.realtimeEvent.findMany({ where: { deliveredAt: null, nextAttemptAt: { lte: now },
    OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] }, orderBy: { createdAt: 'asc' }, take: 5 });
  let delivered = 0;
  let failed = 0;
  for (const event of due) {
    const leaseToken = randomUUID();
    const claimed = await db.realtimeEvent.updateMany({ where: { id: event.id, deliveredAt: null, nextAttemptAt: { lte: new Date() },
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] }, data: {
      leaseToken, leaseUntil: new Date(Date.now() + 60000), attempts: { increment: 1 },
    } });
    if (!claimed.count) continue;
    try {
      await send(event.id);
      await db.realtimeEvent.updateMany({ where: { id: event.id, leaseToken }, data: {
        deliveredAt: new Date(), leaseUntil: null, leaseToken: null,
      } });
      delivered += 1;
    } catch {
      await db.realtimeEvent.updateMany({ where: { id: event.id, leaseToken }, data: {
        leaseUntil: null, leaseToken: null,
        nextAttemptAt: new Date(Date.now() + Math.min(300000, 1000 * 2 ** Math.min(event.attempts, 8))),
      } });
      failed += 1;
    }
  }
  return { delivered, failed, configured: true };
}
