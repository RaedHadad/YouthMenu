import type { CustomerMenuItem } from '@/lib/customer-types';
import { formatMoney } from '@/lib/money';

export function DrinkPicker({ items, quantities, disabled, onChange }: {
  items: CustomerMenuItem[];
  quantities: Record<string, number>;
  disabled: boolean;
  onChange: (id: string, quantity: number) => void;
}) {
  if (!items.length) return null;
  return <fieldset disabled={disabled} className="rounded-3xl border-2 border-blue/20 bg-white p-5 disabled:opacity-60">
    <legend className="px-2 text-2xl font-black">المشروبات</legend>
    <p className="mb-4 text-sm">أضف مشروباً إلى وجبتك (اختياري).</p>
    <div className="space-y-4">{items.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3">
      <label htmlFor={`drink-${item.id}`} className="font-bold">{item.name} — <bdi>{formatMoney(item.priceInAgorot)}</bdi>{!item.isAvailable && ' — غير متوفر'}</label>
      <input id={`drink-${item.id}`} aria-label={`كمية ${item.name}`} type="number" inputMode="numeric" min={0} max={20} step={1}
        disabled={!item.isAvailable} value={item.isAvailable ? quantities[item.id] ?? 0 : 0}
        onChange={(event) => { const value = Number(event.target.value); if (Number.isInteger(value) && value >= 0 && value <= 20) onChange(item.id, value); }}
        className="min-h-12 w-20 rounded-xl border-2 border-blue/20 px-3 text-center font-bold disabled:opacity-50" />
    </div>)}
    </div>
  </fieldset>;
}
