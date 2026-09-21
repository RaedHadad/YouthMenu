import { PrismaClient } from '@prisma/client';
import { flushOutbox } from '../lib/realtime/outbox';
const db = new PrismaClient();
flushOutbox(db).then((result) => {
  console.log(result);
  if (!result.configured || result.failed) process.exitCode = 1;
}).catch(() => { console.error('Outbox delivery failed; pending events are preserved.'); process.exitCode = 1; })
  .finally(() => db.$disconnect());
