import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'الأحداث | القائمة', template: '%s | الأحداث' },
  description: 'اختر وجبتك وإضافاتك، تابع طلبك، وادفع نقداً عند الاستلام.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen bg-cream text-blue antialiased">
        <a href="#main-content" className="skip-link no-print">انتقل إلى المحتوى</a>
        <main id="main-content" tabIndex={-1}>{children}</main>
      </body>
    </html>
  );
}
