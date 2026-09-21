"use client";

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LockKeyhole } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.message ?? 'حدث خطأ، حاول مرة أخرى');
        setBusy(false);
        return;
      }
      setPassword('');
      router.replace('/admin');
      router.refresh();
    } catch {
      setMessage('تعذر الاتصال بالخادم، حاول مرة أخرى');
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FFFDF0] p-4" dir="rtl">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-[28px] bg-[#FFD73E] p-5 shadow-[0_18px_60px_rgba(30,86,201,0.18)]">
        <div className="rounded-[24px] bg-[#FFFDF0] p-6">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-3xl font-black text-[#1E56C9]">تسجيل الدخول</h1>
            <LockKeyhole className="h-8 w-8 text-[#1E56C9]" />
          </div>

          <label htmlFor="admin-email" className="mb-2 block text-lg font-bold text-[#1E56C9]">البريد الإلكتروني</label>
          <input id="admin-email" type="email" maxLength={254} disabled={busy} autoComplete="username" required dir="ltr" value={email} onChange={(event) => setEmail(event.target.value)} className="mb-4 w-full rounded-2xl border border-[#1E56C9]/20 bg-white p-3" />

          <label htmlFor="admin-password" className="mb-2 block text-lg font-bold text-[#1E56C9]">كلمة المرور</label>
          <input id="admin-password" disabled={busy} maxLength={72} autoComplete="current-password" required type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mb-4 w-full rounded-2xl border border-[#1E56C9]/20 bg-white p-3" />

          <button disabled={busy} type="submit" className="w-full rounded-2xl bg-[#1E56C9] px-5 py-3 text-xl font-black text-white">{busy ? 'جاري الدخول…' : 'دخول'}</button>

          {message && <div role="alert" className="mt-4 rounded-2xl bg-[#EA4933]/10 p-3 text-sm font-bold text-[#EA4933]">{message}</div>}
        </div>
      </form>
    </div>
  );
}
