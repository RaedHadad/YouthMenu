import { Check, UtensilsCrossed } from 'lucide-react';
import type { CustomerMenuItem } from '@/lib/customer-types';
import { formatMoney } from '@/lib/money';

export function DishList({ items, selectedId, onSelect, disabled }: {
  items: CustomerMenuItem[];
  selectedId?: string;
  onSelect: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <fieldset disabled={disabled}>
      <legend className="mb-5 flex items-center gap-3 text-2xl font-black">
        <span className="step-number" aria-hidden="true">١</span> اختر الصنف
      </legend>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item, index) => (
          <label key={item.id} className={`relative block min-w-0 ${item.isAvailable ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
            <input
              className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
              type="radio"
              name="menu-item"
              value={item.id}
              checked={selectedId === item.id}
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
                  {selectedId === item.id && <Check className="size-4" aria-hidden="true" />}
                  {!item.isAvailable ? 'غير متوفر' : selectedId === item.id ? 'اختيارك' : 'متوفر'}
                </span>
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
