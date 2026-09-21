import { QRCodeCanvas } from 'qrcode.react';
import { Printer, Bell, Clock3 } from 'lucide-react';
import { formatMoney } from '@/lib/money';
import { getArabicStatusLabel } from '@/lib/order-utils';
import type { CustomerOrder } from '@/lib/customer-types';

export function OrderReceipt({ order, onRequestNotification }: {
  order: CustomerOrder;
  onRequestNotification: () => Promise<void>;
}) {
  const details = [
    ['الاسم', order.customerName || 'ضيف'],
    ['الصنف', order.itemName || '—'],
    ['الكمية', order.quantity ?? '—'],
    ['الإضافات', order.toppings || 'بدون إضافات'],
  ];

  return (
    <section className="receipt-shell mx-auto max-w-xl px-4 py-8 text-right sm:py-12" dir="rtl" aria-labelledby="receipt-title">
      <article className="receipt-print overflow-hidden rounded-[28px] border-2 border-blue bg-cream text-blue shadow-[0_18px_60px_rgba(30,86,201,0.18)]">
        <header className="receipt-heading border-b-2 border-dashed border-blue bg-yellow px-5 py-6 text-center">
          <p className="text-lg font-black">الأحداث <span aria-hidden="true">✦</span> ORDER TICKET</p>
          <h1 id="receipt-title" className="mt-3 text-3xl font-black">بون الطلب <bdi dir="ltr">#{order.orderNumber ?? '—'}</bdi></h1>
          <p className="mt-2 text-sm font-bold">وجبتك على ذوقك، وصحتين وعافية!</p>
        </header>
        <div className="receipt-body p-5 sm:p-7">
          <dl className="receipt-details space-y-4">
            {details.map(([label, value]) => (
              <div key={label} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3">
                <dt>{label}</dt>
                <dd className="min-w-0 font-bold [overflow-wrap:anywhere]">{value}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 border-y-2 border-dashed border-blue/40 py-4">
              <dt className="font-bold">السعر الإجمالي</dt>
              <dd className="text-3xl font-black"><bdi dir="ltr">{formatMoney(order.totalAmount)}</bdi></dd>
            </div>
          </dl>
          <div className="receipt-status mt-5 rounded-2xl border border-blue/20 bg-yellow/40 p-4 text-center" role="status" aria-live="polite" aria-atomic="true">
            <p className={`text-lg font-black ${order.status === 'READY' ? 'rounded-xl bg-green-800 p-3 text-white' : ''}`}>
              {getArabicStatusLabel(order.status)}
            </p>
            <p className="mt-3 flex items-center justify-center gap-2 text-sm font-bold">
              <Clock3 className="size-5 shrink-0" aria-hidden="true" />
              <span>{order.estimatedMinutes == null ? 'بانتظار تحديد الوقت من المطبخ' : `الوقت المقدر: ~${order.estimatedMinutes} دقيقة`}</span>
            </p>
          </div>
          <figure className="receipt-pickup mt-6 flex flex-col items-center gap-3 text-center">
            <p className="text-sm font-bold">رمز الاستلام</p>
            <p className="rounded-xl border-2 border-blue bg-white px-4 py-2 text-2xl font-black tracking-[0.2em]" dir="ltr">{order.visibleCode}</p>
            <QRCodeCanvas value={order.pickupToken} size={180} marginSize={4} level="M"
              bgColor="#FFFFFF" fgColor="#000000" role="img" aria-label="رمز QR الآمن لاستلام الطلب" />
            <figcaption className="text-sm font-bold">امسح الـ QR عند الاستلام</figcaption>
            <p className="rounded-full border-2 border-red px-4 py-2 font-bold">الدفع نقداً عند الاستلام</p>
          </figure>
          <div className="no-print mt-6 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={() => window.print()}
              className="min-h-12 flex-1 rounded-2xl bg-blue px-4 py-3 text-lg font-bold text-white">
              <span className="inline-flex items-center gap-2"><Printer className="size-5" aria-hidden="true" /> طباعة البون</span>
            </button>
            {order.status === 'READY' && (
              <button type="button" onClick={onRequestNotification}
                className="min-h-12 flex-1 rounded-2xl border-2 border-blue px-4 py-3 font-bold">
                <span className="inline-flex items-center gap-2"><Bell className="size-5" aria-hidden="true" /> تنبيه</span>
              </button>
            )}
          </div>
        </div>
      </article>
    </section>
  );
}
