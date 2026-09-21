import { scheduleOutbox } from '@/lib/realtime/schedule';
import { prisma } from '@/lib/prisma';
import { handleCreateOrder } from '@/lib/orders/http';

export async function POST(request: Request) {
  const response = await handleCreateOrder(request, prisma);
  if (response.ok) scheduleOutbox();
  return response;
}
