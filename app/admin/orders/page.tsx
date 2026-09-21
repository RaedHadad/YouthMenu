import { prisma } from '@/lib/prisma';
import { requireAdminPage } from '@/lib/auth';

export default async function AdminOrdersPage() {
  await requireAdminPage();

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      items: { include: { toppings: true } },
    },
  });

  return (
    <section className="p-6" dir="rtl">
      <h1 className="mb-5 text-3xl font-black text-[#1E56C9]">سجل الطلبات</h1>
      <div className="space-y-4">
        {orders.map((order) => (
          <div key={order.id} className="rounded-[24px] bg-[#FFFDF0] p-4 shadow-md ring-1 ring-[#1E56C9]/10">
            <div className="flex justify-between gap-3">
              <strong className="text-[#1E56C9]">طلب #{order.orderNumber}</strong>
              <span className="rounded-full bg-[#FFD73E] px-2 py-1 text-xs font-bold text-[#1E56C9]">{order.status}</span>
            </div>
            <div className="mt-2 text-sm text-[#1E56C9]">
              <div>العميل: {order.customerName}</div>
              <div>الإجمالي: ₪{(order.totalAmount / 100).toFixed(2)}</div>
              <div>وقت الطلب: {new Date(order.createdAt).toLocaleString('ar-SA')}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
