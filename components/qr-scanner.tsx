'use client';
import { useEffect, useRef, useState } from 'react';
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
import type { AdminOrderItem } from './admin-dashboard';
import { formatMoney } from '@/lib/money';

export default function QRScannerPage() {
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<IScannerControls | null>(null);
  const request = useRef(false);
  const [scanning, setScanning] = useState(false);
  const [token, setToken] = useState('');
  const [order, setOrder] = useState<AdminOrderItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!scanning) return;
    let disposed = false;
    let found = false;
    const reader = new BrowserQRCodeReader();
    void reader.decodeFromConstraints({ video: { facingMode: 'environment' }, audio: false }, video.current!, (result, _error, scanner) => {
      if (!result || found || disposed) return;
      found = true; scanner.stop(); setScanning(false);
      setToken(result.getText()); void lookup(result.getText());
    }).then((scanner) => { controls.current = scanner; if (disposed || found) scanner.stop(); })
      .catch(() => { if (!disposed) { setMessage('تعذر الوصول إلى الكاميرا. اسمح باستخدامها ثم حاول مجدداً.'); setScanning(false); } });
    return () => { disposed = true; controls.current?.stop(); };
  }, [scanning]);
  async function lookup(value: string, confirm = false) {
    if (request.current) return;
    request.current = true; setBusy(true); setMessage('');
    if (!confirm) setOrder(null);
    try {
      const response = await fetch('/api/admin/scanner', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pickupToken: value, confirm }) });
      if (response.status === 401) { window.location.replace('/admin/login'); return; }
      const data = await response.json();
      if (!response.ok) { setOrder(null); setMessage(data.message ?? 'تعذر التحقق من الطلب'); return; }
      setOrder(data.collected ? null : data.order);
      if (data.collected) { setToken(''); setMessage('تم تسليم الطلب بنجاح ✓'); }
    } catch { setMessage('تعذر تأكيد النتيجة. أعد التحقق من الرمز قبل إعادة المحاولة.'); }
    finally { request.current = false; setBusy(false); }
  }
  return <section className="mx-auto max-w-lg space-y-5 p-4" dir="rtl">
    <h1 className="text-3xl font-black">امسح رمز QR</h1>
    <video ref={video} className={`${scanning ? '' : 'hidden'} aspect-video w-full rounded-2xl bg-black`} playsInline muted />
    <button disabled={busy} onClick={() => { setOrder(null); setMessage(''); setScanning(!scanning); }} className="min-h-12 w-full rounded-xl bg-blue p-3 font-bold text-white">{scanning ? 'إيقاف الكاميرا' : 'تشغيل الكاميرا'}</button>
    <form onSubmit={(event) => { event.preventDefault(); void lookup(token); }} className="space-y-3">
      <label className="block">إدخال رمز QR يدوياً<input autoComplete="off" value={token} onChange={(event) => { setToken(event.target.value.trim()); setOrder(null); }} disabled={busy || scanning} required maxLength={64} dir="ltr" className="mt-2 w-full rounded-xl border p-3" /></label>
      <button disabled={busy || scanning} className="min-h-11 rounded-xl border border-blue px-4">التحقق من الطلب</button>
    </form>
    {message && <p role="status" className="rounded-xl bg-yellow p-4">{message}</p>}
    {order && <article className="space-y-3 rounded-2xl border-2 border-blue bg-cream p-5">
      <h2 className="text-2xl font-black">طلب #{order.orderNumber}</h2>
      <p>الاسم: {order.customerName}</p>
      {order.items.map((item, index) => <div key={index}><p>{item.quantity} × {item.itemName}</p><p>الإضافات: {item.toppings.map((t) => t.toppingName).join('، ') || 'لا يوجد'}</p></div>)}
      <p className="text-2xl font-bold">الإجمالي: <bdi>{formatMoney(order.totalAmount)}</bdi></p>
      <p>جاهز للاستلام — الدفع نقداً عند الاستلام</p>
      <p>استلم المبلغ نقداً قبل التأكيد.</p>
      <button disabled={busy} onClick={() => void lookup(token, true)} className="min-h-14 w-full rounded-xl bg-blue p-4 text-lg font-bold text-white">تأكيد الاستلام والدفع</button>
    </article>}
  </section>;
}
