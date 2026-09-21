import { prisma } from '@/lib/prisma';
import { requireAdminPage } from '@/lib/auth';
import { activeOrders } from '@/lib/admin/orders';
import AdminDashboard from '@/components/admin-dashboard';

export default async function AdminPage() {
  await requireAdminPage();
  const orders = await activeOrders(prisma);
  return <AdminDashboard initialOrders={orders.map((order) => ({ ...order, createdAt: order.createdAt.toISOString() }))} />;
}
