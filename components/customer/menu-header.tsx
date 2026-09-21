import { ChefHat, Banknote, UtensilsCrossed } from 'lucide-react';

export function MenuHeader() {
  return (
    <header className="no-print">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <div className="flex items-center gap-2 text-xl font-black"><UtensilsCrossed className="size-6" aria-hidden="true" /> الأحداث<span className="hidden text-xs font-normal sm:inline">/ YouthMenu</span></div>
        <span className="flex items-center gap-2 text-xs font-bold sm:text-sm"><Banknote className="size-5" aria-hidden="true" /> نقداً عند الاستلام</span>
      </div>
      <div className="menu-hero border-y-2 border-blue bg-yellow">
        <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-6 overflow-hidden px-5 py-10 sm:px-8 sm:py-14">
          <div className="relative z-10 max-w-xl">
            <p className="mb-4 inline-flex rounded-full border-2 border-blue bg-cream px-4 py-1 text-sm font-bold">أكلة طيبة، ولمّة أحلى</p>
            <h1 className="text-5xl leading-tight font-black sm:text-7xl">القائمة<span className="text-red">.</span></h1>
            <p className="mt-4 text-lg leading-8 font-bold">اختر وجبتك، أضف لمستك، والباقي علينا!</p>
            <p className="mt-2 text-sm leading-7">اطلب باسمك، وتابع طلبك حتى يصبح جاهزاً للاستلام.</p>
          </div>
          <div aria-hidden="true" className="hidden size-44 shrink-0 -rotate-12 items-center justify-center rounded-full border-[3px] border-blue bg-cream shadow-[8px_8px_0_#EA4933] sm:flex">
            <ChefHat className="size-24" strokeWidth={1.5} />
          </div>
        </div>
      </div>
    </header>
  );
}
