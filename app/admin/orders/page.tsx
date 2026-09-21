import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireAdminPage } from '@/lib/auth';
import { orderHistory } from '@/lib/admin/history';
import { formatMoney } from '@/lib/money';
import { getArabicStatusLabel } from '@/lib/order-utils';
const statuses = ['PENDING', 'PREPARING', 'READY', 'COLLECTED', 'CANCELLED'];
const time = (date: Date | null) => date ? date.toLocaleString('ar', { timeZone: 'Asia/Jerusalem' }) : '—';
export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminPage();
  const { orders, total, page, query, status, date } = await orderHistory(prisma, await searchParams);
  const href = (next: number) => `/admin/orders?${new URLSearchParams({ q: query, status, date, page: String(next) })}`;
  return <section className="space-y-5 p-5" dir="rtl">
    <h1 className="text-3xl font-black">سجل الطلبات</h1>
    <form className="flex flex-wrap items-end gap-4 rounded-2xl bg-yellow p-4">
      <label>الاسم أو رقم الطلب<input name="q" defaultValue={query} maxLength={80} className="block max-w-full rounded-lg bg-white p-3" /></label>
      <label>الحالة<select name="status" defaultValue={status} className="block rounded-lg bg-white p-3"><option value="">الكل</option>{statuses.map((s) => <option value={s} key={s}>{getArabicStatusLabel(s)}</option>)}</select></label>
      <label>تاريخ الطلب (UTC)<input type="date" name="date" defaultValue={date} className="block rounded-lg bg-white p-3" /></label>
      <button className="min-h-12 rounded-xl bg-blue px-5 text-white">بحث</button>
    </form>
    <p role="status">عدد النتائج: {total}</p>
    {!orders.length && <p>لا توجد طلبات مطابقة</p>}
    <div className="grid gap-4 md:grid-cols-2">{orders.map((order) => <article key={order.id} className="space-y-2 rounded-2xl border border-blue/25 p-4 [overflow-wrap:anywhere]">
      <h2 className="text-xl font-bold">طلب #{order.orderNumber} — {order.customerName}</h2>
      <p>{getArabicStatusLabel(order.status)}</p>
      {order.items.map((item, index) => <div key={index}><p>{item.quantity} × {item.itemName} — {formatMoney(item.unitPrice)} للصنف الواحد</p><p>الإضافات: {item.toppings.map((t) => `${t.toppingName} (${formatMoney(t.toppingPrice)})`).join('، ') || 'لا يوجد'}</p></div>)}
      <p className="font-bold">الإجمالي: <bdi>{formatMoney(order.totalAmount)}</bdi> — {order.paymentStatus === 'PAID' ? 'مدفوع نقداً' : 'غير مدفوع'}</p>
      <p>وقت الطلب: {time(order.createdAt)}</p><p>وقت الجاهزية: {time(order.readyAt)}</p><p>وقت الاستلام: {time(order.collectedAt)}</p>
    </article>)}</div>
    <nav aria-label="صفحات السجل" className="flex gap-5">
      {page > 1 && <Link href={href(page - 1)}>السابق</Link>}<span>صفحة {page}</span>{page * 25 < total && <Link href={href(page + 1)}>التالي</Link>}
    </nav>
  </section>;
}
