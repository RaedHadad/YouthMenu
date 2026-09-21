'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export function AdminNavigation() {
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (pathname === '/admin/login') return null;
  async function logout() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/logout', { method: 'POST' });
      if (!response.ok) throw new Error();
      // Full navigation clears protected client/router state after session revocation.
      window.location.replace('/admin/login');
    } catch { setError('تعذر تسجيل الخروج، حاول مرة أخرى'); setBusy(false); }
  }
  return <div className="no-print border-b border-blue/20 p-4">
    <nav aria-label="إدارة المطعم" className="flex flex-wrap items-center gap-4 font-bold">
      <Link href="/admin">الطلبات المباشرة</Link>
      <Link href="/admin/menu">إدارة القائمة</Link>
      <Link href="/admin/orders">سجل الطلبات</Link>
      <Link href="/admin/scanner">امسح رمز QR</Link>
      <button type="button" onClick={logout} disabled={busy} className="min-h-11 rounded-xl bg-blue px-4 text-white disabled:opacity-50">{busy ? 'جاري الخروج…' : 'تسجيل الخروج'}</button>
    </nav>
    {error && <p role="alert" className="mt-3">{error}</p>}
  </div>;
}
