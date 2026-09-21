import type { CustomerMenuItem } from '@/lib/customer-types';
import { formatMoney } from '@/lib/money';

export function ToppingPicker({ item, selectedIds, onToggle, disabled }: {
  item?: CustomerMenuItem;
  selectedIds: string[];
  onToggle: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <fieldset disabled={disabled || !item?.isAvailable} className="rounded-3xl border-2 border-dashed border-blue/25 p-5 sm:p-6">
      <legend className="px-2 text-xl font-black">اختر الإضافات</legend>
      <p className="mb-4 text-sm leading-7">
        {!item ? 'اختر صنفاً أولاً لنُظهر إضافاته.' : item.toppings.length === 0
          ? 'هذا الصنف يأتي بدون إضافات.' : 'على ذوقك! يمكنك اختيار أكثر من إضافة أو المتابعة بدون إضافات.'}
      </p>
      <div className="flex flex-wrap gap-3">
        {item?.toppings.map((topping) => (
          <label key={topping.id} className={`flex min-h-12 items-center gap-2 rounded-2xl border border-blue/20 bg-white px-3 py-2 font-bold ${!topping.isAvailable ? 'text-slate-600' : 'cursor-pointer has-checked:bg-yellow'}`}>
            <input type="checkbox" checked={selectedIds.includes(topping.id)} disabled={!topping.isAvailable}
              onChange={() => onToggle(topping.id)} className="size-5 accent-blue" />
            <span>{topping.name}</span>
            <span className="text-xs">{!topping.isAvailable ? 'غير متوفر' : topping.priceInAgorot === 0
              ? 'مجاناً' : <bdi dir="ltr">+{formatMoney(topping.priceInAgorot)}</bdi>}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
