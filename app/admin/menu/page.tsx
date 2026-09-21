import { prisma } from '@/lib/prisma';
import { requireAdminPage } from '@/lib/auth';
import { getAdminMenu } from '@/lib/admin/menu';
import AdminMenuManager from '@/components/admin-menu-manager';
export default async function AdminMenuPage() {
  await requireAdminPage();
  return <AdminMenuManager {...await getAdminMenu(prisma)} />;
}
