import { prisma } from '@/lib/prisma';
import { requireAdminPage } from '@/lib/auth';
import AdminMenuManager from '@/components/admin-menu-manager';

export default async function AdminMenuPage() {
  await requireAdminPage();

  const menuItems = await prisma.menuItem.findMany({ orderBy: { createdAt: 'asc' } });
  const toppings = await prisma.topping.findMany({ orderBy: { createdAt: 'asc' } });

  return <AdminMenuManager menuItems={menuItems} toppings={toppings} />;
}
