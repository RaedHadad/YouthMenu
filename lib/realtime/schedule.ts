import { after } from 'next/server';
import { prisma } from '../prisma';
import { flushOutbox } from './outbox';

export function scheduleOutbox() {
  after(async () => {
    try { await flushOutbox(prisma); }
    catch { console.warn('Realtime delivery deferred; pending events remain in the outbox.'); }
  });
}
