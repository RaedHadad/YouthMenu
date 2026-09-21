'use client';

import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { Camera, RefreshCcw } from 'lucide-react';

export default function QRScannerPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [result, setResult] = useState<string>('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let controls: IScannerControls | undefined;
    let disposed = false;
    let scanned = false;
    const controller = new AbortController();

    async function lookup(pickupToken: string) {
      setResult(pickupToken);
      setLoading(true);
      setMessage('تم اكتشاف الرمز بنجاح');
      try {
        const response = await fetch('/api/admin/scanner', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pickupToken }),
          signal: controller.signal,
        });
        const payload = await response.json();
        if (disposed) return;
        setMessage(response.ok
          ? `تم العثور على الطلب: #${payload.order.orderNumber}`
          : payload.message ?? 'رمز QR غير صالح');
      } catch {
        if (!disposed) setMessage('تعذر الاتصال بالخادم');
      }
    }

    async function startScan() {
      try {
        if (!videoRef.current) return;
        const reader = new BrowserMultiFormatReader();
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: 'environment' }, audio: false },
          videoRef.current,
          (decoded, _error, scannerControls) => {
            if (!decoded || scanned || disposed) return;
            scanned = true;
            scannerControls.stop();
            void lookup(decoded.getText());
          },
        );
        if (disposed || scanned) controls.stop();
      } catch {
        if (!disposed) {
          setMessage('تعذر الوصول إلى الكاميرا');
          setLoading(true);
        }
      }
    }

    void startScan();
    return () => {
      disposed = true;
      controller.abort();
      controls?.stop();
    };
  }, []);

  return (
    <div className="mx-auto max-w-lg p-4 text-right" dir="rtl">
      <div className="rounded-[28px] bg-[#FFD73E] p-4 shadow-lg">
        <div className="rounded-[22px] bg-[#FFFDF0] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h1 className="text-3xl font-black text-[#1E56C9]">مسح QR</h1>
            <Camera className="h-8 w-8 text-[#1E56C9]" />
          </div>
          <video ref={videoRef} className="aspect-video w-full rounded-2xl bg-black" playsInline muted />
          <div className="mt-4 rounded-2xl bg-[#1E56C9] p-3 text-white font-bold text-center">
            {message || 'امسح QR الخاص بالطلب'}
          </div>
          {result && (
            <div className="mt-4 rounded-2xl border border-[#1E56C9]/20 bg-white p-3">
              <div className="text-sm text-[#1E56C9]">الرمز المقروء:</div>
              <div className="font-black text-[#EA4933] break-all">{result}</div>
            </div>
          )}
          {loading && (
            <button onClick={() => window.location.reload()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#EA4933] px-4 py-3 text-lg font-bold text-white">
              <RefreshCcw className="h-5 w-5" /> إعادة المحاولة
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
