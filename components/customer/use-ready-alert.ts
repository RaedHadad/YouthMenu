'use client';
import { useEffect, useRef, useState } from 'react';
import type { CustomerOrder } from '@/lib/customer-types';

export function useReadyAlert(order: CustomerOrder | null) {
  const [alertMessage, setAlertMessage] = useState('');
  const audio = useRef<AudioContext | null>(null);
  const alerted = useRef(new Set<string>());
  useEffect(() => () => { void audio.current?.close().catch(() => {}); }, []);

  async function enableAlerts() {
    let sound = false;
    let notifications = false;
    try {
      if (window.AudioContext) {
        audio.current ??= new window.AudioContext();
        await audio.current.resume();
        sound = audio.current.state === 'running';
      }
    } catch { /* Visual status does not depend on browser audio support. */ }
    try {
      if ('Notification' in window) notifications = (await Notification.requestPermission()) === 'granted';
    } catch { /* Some mobile browsers do not support page notifications. */ }
    setAlertMessage(sound || notifications ? 'تم تفعيل التنبيه في هذه الصفحة. اتركها مفتوحة لمتابعة طلبك.' : 'التنبيهات غير متاحة، ويمكنك متابعة حالة الطلب هنا.');
  }

  useEffect(() => {
    if (!order || order.status !== 'READY' || alerted.current.has(order.orderId)) return;
    alerted.current.add(order.orderId);
    const key = `youthmenu_ready_alert:${order.orderId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch { /* In-memory suppression still prevents repeated polling alerts. */ }
    try {
      const context = audio.current;
      if (context?.state === 'running') {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = 880;
        gain.gain.setValueAtTime(0.05, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.25);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(); oscillator.stop(context.currentTime + 0.25);
      }
    } catch { /* Keep receipt/status functioning if playback fails. */ }
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('طلبك جاهز! 🎉', { body: 'تفضل بالاستلام', tag: `order-ready-${order.orderId}` });
      }
    } catch { /* Notifications are optional. */ }
  }, [order]);
  return { enableAlerts, alertMessage };
}
