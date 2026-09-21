import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-5 py-20 text-center">
      <p className="text-6xl font-black" aria-hidden="true">٤٠٤</p>
      <h1 className="my-5 text-3xl font-black">الصفحة غير موجودة</h1>
      <Link href="/" className="inline-block rounded-2xl bg-blue px-6 py-3 font-bold text-white">
        العودة إلى القائمة
      </Link>
    </div>
  );
}
