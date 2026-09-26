import { Banknote, ArrowLeft, Minus } from 'lucide-react';
import type { CustomerMenuItem } from '@/lib/customer-types';
import { formatMoney } from '@/lib/money';

export function OrderForm({ foods, onRemoveFood, onRemoveDrink, blocked, drinks = [], name, onNameChange, total, submitting, message, onSubmit }: {
  foods: Array<CustomerMenuItem & { quantity: number; variantIndex: number }>;
  onRemoveFood: (id: string, index: number) => void;
  onRemoveDrink: (id: string) => void;
  blocked: boolean;
  drinks?: Array<CustomerMenuItem & { quantity: number }>;
  name: string;
  onNameChange: (name: string) => void;
  total: number;
  submitting: boolean;
  message: string;
  onSubmit: () => Promise<void>;
}) {
  return (
    <form onSubmit={(event) => { event.preventDefault(); void onSubmit(); }} className="self-start rounded-[2rem] bg-blue p-3 shadow-[8px_8px_0_#FFD73E] lg:sticky lg:top-6">
      <div className="rounded-3xl bg-cream p-5 sm:p-6">
        <h2 className="mb-6 flex items-center gap-3 text-2xl font-black"><span className="step-number" aria-hidden="true">٢</span> السلة / تفاصيل الطلب</h2>
        <div className="mb-6 border-y-2 border-dashed border-blue/20 py-5">
          {(!foods.length && !drinks.length) && <p className="font-bold">اختر صنفاً أو أكثر من القائمة لتبدأ طلبك.</p>}
          {foods.map((food, index) => <div key={`${food.id}:${index}`} aria-label={`في السلة: ${food.name} ${index + 1}`} className="mb-3 rounded-xl border border-blue/20 p-3">
            <div className="flex items-center justify-between gap-3"><p className="break-words text-xl font-black">{food.quantity} × {food.name}</p><button type="button" aria-label={`إزالة قطعة من ${food.name}`} disabled={submitting} onClick={() => onRemoveFood(food.id, food.variantIndex)} className="quantity-button shrink-0"><Minus className="size-5" aria-hidden="true" /></button></div>
            <p className="mt-2 text-sm leading-7">{food.toppings.map((topping) => topping.name).join('، ') || 'بدون إضافات'}</p>
          </div>)}
          {drinks.map((drink) => <div key={drink.id} className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-blue/20 p-3"><p className="text-sm font-bold">{drink.quantity} × {drink.name} — <bdi>{formatMoney(drink.priceInAgorot * drink.quantity)}</bdi></p><button type="button" aria-label={`إزالة قطعة من ${drink.name}`} disabled={submitting} onClick={() => onRemoveDrink(drink.id)} className="quantity-button shrink-0"><Minus className="size-5" aria-hidden="true" /></button></div>)}
        </div>
        <fieldset disabled={(!foods.length && !drinks.length) || blocked || submitting} className="space-y-5 disabled:opacity-60">
          <div>
            <label htmlFor="customer-name" className="mb-2 block font-bold">الاسم</label>
            <input id="customer-name" name="customerName" autoComplete="name" value={name} required minLength={2} maxLength={80}
              onChange={(event) => onNameChange(event.target.value)} placeholder="بأي اسم نناديك؟"
              className="min-h-12 w-full min-w-0 rounded-2xl border-2 border-blue/20 bg-white px-4 py-3" />
          </div>

        </fieldset>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t-2 border-dashed border-blue/20 pt-5 font-black">
          <span>الإجمالي</span><output aria-label="الإجمالي" aria-live="polite" dir="ltr" className="text-3xl">{formatMoney(total)}</output>
        </div>
        {message && <p role="alert" className="mt-4 rounded-xl border border-red bg-red/10 p-3 text-sm font-bold text-[#982719]">{message}</p>}
        <button type="submit" disabled={submitting || (!foods.length && !drinks.length) || blocked} className="mt-6 flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-blue px-4 py-3 text-lg font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
          {submitting ? 'جاري الإرسال…' : 'أرسل الطلب'}<ArrowLeft className="size-5" aria-hidden="true" />
        </button>
        <p className="mt-4 flex items-center justify-center gap-2 text-center text-sm font-bold leading-6"><Banknote className="size-5 shrink-0" aria-hidden="true" />الدفع نقداً عند الاستلام</p>
      </div>
    </form>
  );
}
