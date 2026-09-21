import { prisma } from '@/lib/prisma';
import { handleCustomerRealtime } from '@/lib/orders/realtime';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleCustomerRealtime(request, (await params).id, prisma);
}
