import { prisma } from '@/lib/prisma';
import { getCustomerMenu } from '@/lib/customer-menu-query';
import CustomerMenu from '@/components/customer-menu';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  return <CustomerMenu menuItems={await getCustomerMenu(prisma)} />;
}
