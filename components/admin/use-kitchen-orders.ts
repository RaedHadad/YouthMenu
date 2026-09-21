'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AdminOrderItem } from '@/components/admin-dashboard';
import { connectKitchen } from '@/lib/realtime/client';

export function useKitchenOrders(initialOrders: AdminOrderItem[]) {
  const [orders, setOrders] = useState(initialOrders);
  const [live, setLive] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const refreshRef = useRef<() => void>(() => {});
  const busyRef = useRef(false);

  useEffect(() => {
    let disposed = false;
    let running = false;
    let queued = false;
    let controller: AbortController | undefined;
    let lastIds = new Set(initialOrders.map((order) => order.id));
    const unauthorized = () => { if (!disposed) window.location.replace('/admin/login'); };
    async function refresh() {
      if (disposed) return;
      if (running) { queued = true; return; }
      running = true;
      controller = new AbortController();
      try {
        const response = await fetch('/api/admin/orders', { cache: 'no-store', signal: controller.signal });
        if (response.status === 401) { unauthorized(); return; }
        if (!response.ok) throw new Error();
        const data = await response.json() as { orders: AdminOrderItem[] };
        if (!Array.isArray(data.orders)) throw new Error();
        if (disposed) return;
        const additions = data.orders.filter((order) => !lastIds.has(order.id));
        if (additions.length) setNotice(`وصل ${additions.length} طلب جديد`);
        lastIds = new Set(data.orders.map((order) => order.id));
        setOrders(data.orders);
        setError('');
      } catch {
        if (!disposed) setError('تعذر تحديث الطلبات. نحاول الاتصال مجدداً.');
      } finally {
        running = false;
        if (queued && !disposed) { queued = false; void refresh(); }
      }
    }
    refreshRef.current = () => { void refresh(); };
    const disconnect = connectKitchen(() => { void refresh(); }, (value) => { if (!disposed) setLive(value); }, unauthorized);
    // Poll even while connected: catches a failed publisher and rechecks session revocation.
    const interval = setInterval(() => { void refresh(); }, 8000);
    const recover = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('online', recover);
    document.addEventListener('visibilitychange', recover);
    void refresh();
    return () => {
      disposed = true;
      controller?.abort();
      clearInterval(interval);
      disconnect();
      window.removeEventListener('online', recover);
      document.removeEventListener('visibilitychange', recover);
    };
  }, [initialOrders]);

  const updateStatus = useCallback(async (id: string, status: string, estimatedMinutes?: number) => {
    if (busyRef.current) return;
    const current = orders.find((order) => order.id === id);
    if (!current) return;
    busyRef.current = true;
    setBusy(id);
    setActionError('');
    try {
      const response = await fetch('/api/admin/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, expectedStatus: current.status, status, estimatedMinutes }) });
      if (response.status === 401) { window.location.replace('/admin/login'); return; }
      if (!response.ok) {
        const data = await response.json();
        setActionError(data.message ?? 'تعذر تحديث الطلب، حاول مرة أخرى');
      }
      refreshRef.current();
    } catch { setActionError('تعذر الاتصال بالخادم، تحقق من حالة الطلب قبل المحاولة مجدداً'); }
    finally { busyRef.current = false; setBusy(null); }
  }, [orders]);
  return { orders, live, error: actionError || error, notice, busy, updateStatus, refresh: () => refreshRef.current() };
}
