import { Check, UtensilsCrossed, Minus, Plus } from 'lucide-react';
import type { CustomerMenuItem } from '@/lib/customer-types';
import { ToppingPicker } from './topping-picker';
import { formatMoney } from '@/lib/money';

export function DishList({ items, selections, onSelect, onQuantityChange, onToppingToggle, disabled }: {
  items: CustomerMenuItem[];
  selections: Record<string, { quantity: number; toppingIds: string[] }>;
  onQuantityChange: (id: string, quantity: number) => void;
  onToppingToggle: (id: string, toppingId: string) => void;
  onSelect: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <fieldset disabled={disabled}>
      <legend className="mb-5 flex items-center gap-3 text-2xl font-black">
        <span className="step-number" aria-hidden="true">١</span> اختر الأصناف
      </legend>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item, index) => (
          <article key={item.id} aria-label={item.name}><label className={`relative block min-w-0 ${item.isAvailable ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
            <input
              className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
              type="checkbox"
              name="menu-item" data-food-choice="true"
              value={item.id}
              checked={!!selections[item.id]}
              disabled={!item.isAvailable}
              onChange={() => onSelect(item.id)}
              aria-label={`${item.name}، ${formatMoney(item.priceInAgorot)}${item.isAvailable ? '' : '، غير متوفر'}`}
            />
            <span className="dish-card block h-full rounded-3xl border-2 border-blue/20 bg-white p-5 transition peer-checked:border-blue peer-checked:bg-yellow peer-focus-visible:outline-3 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-blue peer-disabled:bg-stone-100 peer-disabled:text-slate-600">
              <span className="mb-7 flex items-center justify-between gap-3" aria-hidden="true">
                <span className="flex size-12 items-center justify-center rounded-2xl border border-current/15"><UtensilsCrossed className="size-6" /></span>
                <span className="text-sm font-bold tracking-widest" dir="ltr">{String(index + 1).padStart(2, '0')}</span>
              </span>
              <span className="block break-words text-2xl font-black">{item.name}</span>
              <span className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <bdi dir="ltr" className="text-2xl font-black">{formatMoney(item.priceInAgorot)}</bdi>
                <span className="flex items-center gap-1.5 rounded-full border border-current/20 px-3 py-1 text-xs font-bold">
                  {!!selections[item.id] && <Check className="size-4" aria-hidden="true" />}
                  {!item.isAvailable ? 'غير متوفر' : !!selections[item.id] ? 'اختيارك' : 'متوفر'}
                </span>
              </span>
            </span>
          </label>
          {selections[item.id] && item.isAvailable && <div className="mt-3 space-y-3 rounded-3xl border-2 border-blue/20 bg-cream p-3">
            <div role="group" aria-label={`كمية ${item.name}`} className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-bold">الكمية</span>
              <div className="flex items-center gap-2">
                <button type="button" aria-label="تقليل الكمية" disabled={selections[item.id].quantity <= 1} onClick={() => onQuantityChange(item.id, selections[item.id].quantity - 1)} className="quantity-button"><Minus className="size-5" aria-hidden="true" /></button>
                <output aria-live="polite" className="min-w-6 text-center font-black">{selections[item.id].quantity}</output>
                <button type="button" aria-label="زيادة الكمية" disabled={selections[item.id].quantity >= 20} onClick={() => onQuantityChange(item.id, selections[item.id].quantity + 1)} className="quantity-button"><Plus className="size-5" aria-hidden="true" /></button>
              </div>
            </div>
            <ToppingPicker item={item} selectedIds={selections[item.id].toppingIds} onToggle={(toppingId) => onToppingToggle(item.id, toppingId)} disabled={disabled} />
          </div>}
          </article>
        ))}
      </div>
    </fieldset>
  );
}
