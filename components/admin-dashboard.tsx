'use client';

import { EstimatedTimePicker } from '@/components/admin/estimated-time-picker';
import { useMemo } from 'react';
import { useKitchenOrders } from '@/components/admin/use-kitchen-orders';
import { getArabicStatusLabel } from '@/lib/order-utils';
import { Clock3, Sparkles, Trash2 } from 'lucide-react';
import { formatMoney } from '@/lib/money';

export type AdminOrderItem = {
  id: string;
  orderNumber: number;
  customerName: string;
  status: 'PENDING' | 'PREPARING' | 'READY' | 'COLLECTED' | 'CANCELLED';
  totalAmount: number;
  visibleCode: string;
  estimatedMinutes: number | null;
  createdAt: string;
  items: Array<{ itemName: string; quantity: number; unitPrice: number; toppings: Array<{ toppingName: string; toppingPrice: number }> }>;
};

const statusOrder = ['PENDING', 'PREPARING', 'READY'];

export default function AdminDashboard({ initialOrders }: { initialOrders: AdminOrderItem[] }) {
  const { orders, live, error, notice, busy, updateStatus, refresh } = useKitchenOrders(initialOrders);

  const grouped = useMemo(() => {
    const groupedData = {
      PENDING: [] as AdminOrderItem[],
      PREPARING: [] as AdminOrderItem[],
      READY: [] as AdminOrderItem[],
    } as const;

    for (const order of orders) {
      if (groupedData[order.status as keyof typeof groupedData]) {
        groupedData[order.status as keyof typeof groupedData].push(order);
      }
    }
    return groupedData;
  }, [orders]);

  const cancelOrder = async (id: string) => {
    const confirmed = window.confirm('هل أنت متأكد من إلغاء الطلب؟');
    if (!confirmed) return;
    await updateStatus(id, 'CANCELLED');
  };

  const boardTitle: Record<string, string> = {
    PENDING: 'طلبات جديدة',
    PREPARING: 'قيد التحضير',
    READY: 'جاهز للاستلام',
  };

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center justify-between rounded-[28px] bg-[#1E56C9] p-5 text-white">
        <div>
          <p className="text-sm text-white/80">لوحة التحكم</p>
          <h1 className="text-3xl font-black">الطلبات المباشرة</h1>
        </div>
        <Sparkles className="h-8 w-8" />
      </div>

      <div className="flex flex-wrap items-center gap-4 px-4">
        <p role="status">{live ? 'متصل مباشرة' : 'تحديث تلقائي كل 8 ثوانٍ'}</p>
        <button type="button" onClick={refresh} className="min-h-11 rounded-xl border border-blue px-4">تحديث الطلبات</button>
        {notice && <p role="status" className="rounded-xl bg-yellow p-3 font-bold">{notice}</p>}
      </div>
      {error && <p role="alert" className="rounded-xl border border-red p-4">{error}</p>}
      {(
        <div className="grid gap-5 xl:grid-cols-3">
          {statusOrder.map((status) => (
            <div key={status} className="rounded-[28px] bg-[#FFFDF0] p-4 shadow-md ring-1 ring-[#1E56C9]/10">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-black text-[#1E56C9]">{boardTitle[status]}</h2>
                <span className="rounded-full bg-[#FFD73E] px-2.5 py-1 text-sm font-bold text-[#1E56C9]">{grouped[status as keyof typeof grouped].length}</span>
              </div>

              <div className="space-y-4">
                {grouped[status as keyof typeof grouped].length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#1E56C9]/30 bg-white p-4 text-center text-[#1E56C9]">لا توجد طلبات</div>
                ) : (
                  grouped[status as keyof typeof grouped].map((order) => (
                    <div key={order.id} className="rounded-[22px] border border-[#1E56C9]/10 bg-white p-4 shadow-sm">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-lg font-black text-[#1E56C9]">طلب #{order.orderNumber}</span>
                        <span className="rounded-full bg-[#EA4933] px-2 py-1 text-xs font-bold text-white">{getArabicStatusLabel(order.status)}</span>
                      </div>

                      <div className="space-y-2 text-sm text-[#1E56C9]">
                        <div>الاسم: <strong>{order.customerName}</strong></div>
                        <div>الصنف: {order.items.map((item) => `${item.quantity} × ${item.itemName}`).join(', ')}</div>
                        <div>الإضافات: {order.items.flatMap((item) => item.toppings.map((topping) => topping.toppingName)).join(', ') || 'لا يوجد'}</div>
                        <div>السعر: <strong>{formatMoney(order.totalAmount)}</strong></div>
                        <div>وقت الطلب: {new Date(order.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</div>
                        <div className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4" /> الوقت المقدر: {order.estimatedMinutes == null ? 'لم يحدد بعد' : `${order.estimatedMinutes} دقيقة`}</div>
                      </div>

                      <fieldset disabled={busy !== null} className="mt-4 flex flex-col gap-2 disabled:opacity-60">
                        {status === 'PENDING' && (
                          <>
                            <button onClick={() => updateStatus(order.id, 'PREPARING')} className="rounded-2xl bg-[#1E56C9] px-4 py-2 text-sm font-bold text-white">
                              بدء التحضير
                            </button>
                          </>
                        )}

                        {['PENDING', 'PREPARING'].includes(status) && <EstimatedTimePicker key={`${order.id}:${order.estimatedMinutes}`}
                          initial={order.estimatedMinutes} onSave={(minutes) => { void updateStatus(order.id, order.status, minutes); }} />}
                        {status === 'PREPARING' && (
                          <button onClick={() => updateStatus(order.id, 'READY')} className="rounded-2xl bg-[#EA4933] px-4 py-2 text-sm font-bold text-white">
                            جاهز للاستلام
                          </button>
                        )}

                        <button onClick={() => cancelOrder(order.id)} className="flex items-center justify-center gap-2 rounded-2xl border border-[#EA4933] bg-white px-4 py-2 text-sm font-bold text-[#EA4933]">
                          <Trash2 className="h-4 w-4" /> إلغاء الطلب
                        </button>
                      </fieldset>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
