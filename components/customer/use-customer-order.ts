'use client';

import { useEffect, useRef, useState } from 'react';
import type { CreateOrderInput } from '@/lib/validation';
import { customerOrderSchema, fetchOrderStatus, PENDING_ORDER_STORAGE, persistCompletedOrder, preparePendingOrder, readSavedOrder, SubmissionError, submitPendingOrder, type PendingOrder, type SavedOrder } from '@/lib/client-order';

export function useCustomerOrder() {
  const [order, setOrder] = useState<SavedOrder | null>(null);
  const [pending, setPending] = useState<PendingOrder | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const orderId = order?.orderId;
  const accessToken = order?.customerAccessToken;

  useEffect(() => {
    const controller = new AbortController();
    async function restore() {
      const saved = readSavedOrder(localStorage);
      if (saved.pending) return { pending: saved.pending, order: null, error: '' };
      if (!saved.current) return { pending: null, order: null, error: '' };
      try {
        const status = await fetchOrderStatus(saved.current, controller.signal);
        return { pending: null, order: customerOrderSchema.parse({ ...saved.current, ...status }), error: '' };
      } catch {
        const cached = customerOrderSchema.safeParse(saved.current);
        if (cached.success) return { pending: null, order: cached.data, error: 'تعذر تحديث الحالة، البون المحفوظ ما زال متاحاً.' };
        throw new Error('تعذر استعادة الطلب');
      }
    }
    void restore().then((saved) => {
      if (controller.signal.aborted) return;
      setOrder(saved.order);
      setPending(saved.pending);
      setError(saved.error);
      setRestoring(false);
    }).catch(() => {
      if (controller.signal.aborted) return;
      setError('تعذر قراءة الطلب المحفوظ على هذا الجهاز. يرجى إعادة المحاولة.');
      setBlocked(true);
      setRestoring(false);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!orderId || !accessToken) return;
    const controller = new AbortController();
    const reference = { orderId, customerAccessToken: accessToken };
    async function refresh() {
      try {
        const status = await fetchOrderStatus(reference, controller.signal);
        if (!controller.signal.aborted) {
          setOrder((previous) => previous ? { ...previous, ...status } : previous);
          setError('');
        }
      } catch {
        if (!controller.signal.aborted) setError('تعذر تحديث حالة الطلب، سنحاول مجدداً.');
      }
    }
    void refresh();
    const timer = setInterval(refresh, 8000);
    return () => { controller.abort(); clearInterval(timer); };
  // Only resubscribe when the access reference changes, not each status update.
  }, [orderId, accessToken]);

  async function send(attempt: PendingOrder) {
    setPending(attempt);
    try {
      const created = await submitPendingOrder(attempt);
      setOrder(created);
      setPending(null);
      try { persistCompletedOrder(created, localStorage); }
      catch { setError('تعذر حفظ البون. احتفظ بهذه الصفحة؛ يمكنك استعادة الطلب عند إعادة المحاولة.'); }
    } catch (failure) {
      setError(failure instanceof SubmissionError ? failure.message : 'تعذر تأكيد الطلب. أعد المحاولة لاستعادة نفس الطلب.');
      if (failure instanceof SubmissionError && failure.definitive) {
        try { localStorage.removeItem(PENDING_ORDER_STORAGE); setPending(null); }
        catch { setBlocked(true); }
      }
    }
  }

  async function submit(input?: CreateOrderInput) {
    if (inFlight.current || restoring || blocked || order) return;
    inFlight.current = true;
    setSubmitting(true);
    setError('');
    try {
      const attempt = pending ?? (input ? preparePendingOrder(input, localStorage) : null);
      if (attempt) await send(attempt);
    } catch {
      setError('تعذر حفظ محاولة الطلب على هذا الجهاز. يرجى السماح بالتخزين وإعادة المحاولة.');
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return { order, pending, restoring, blocked, submitting, error, submit };
}
