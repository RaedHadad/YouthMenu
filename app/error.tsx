'use client';

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-lg px-5 py-20 text-center">
      <div className="rounded-3xl border-2 border-blue bg-cream p-8 shadow-lg">
        <h1 className="text-3xl font-black">تعذر تحميل الصفحة</h1>
        <p className="my-5">حدث خطأ، حاول مرة أخرى.</p>
        <button onClick={reset} className="rounded-2xl bg-blue px-6 py-3 font-bold text-white">
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}
