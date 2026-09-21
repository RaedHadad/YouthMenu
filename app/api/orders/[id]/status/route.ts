import { prisma } from '@/lib/prisma';
import { handleOrderStatus } from '@/lib/orders/status';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handleOrderStatus(request, id, prisma);
}
