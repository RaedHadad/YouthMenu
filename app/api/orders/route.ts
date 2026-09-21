import { takeQuota } from '@/lib/rate-limit';
import { scheduleOutbox } from '@/lib/realtime/schedule';
import { prisma } from '@/lib/prisma';
import { handleCreateOrder } from '@/lib/orders/http';

export async function POST(request: Request) {
  try {
    if (!await takeQuota(prisma, 'public-orders', 120)) return Response.json({ message: 'طلبات كثيرة، حاول بعد دقيقة' }, { status: 429, headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ message: 'تعذر إرسال الطلب، حاول مرة أخرى' }, { status: 503 }); }
  const response = await handleCreateOrder(request, prisma);
  if (response.ok) scheduleOutbox();
  return response;
}
