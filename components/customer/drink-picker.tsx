import { Minus, Plus } from 'lucide-react';
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
      <span className="font-bold">{item.name} — <bdi>{formatMoney(item.priceInAgorot)}</bdi>{!item.isAvailable && ' — غير متوفر'}</span>
      <div role="group" aria-label={`كمية ${item.name}`} className="flex items-center gap-2">
        <button type="button" aria-label={`تقليل كمية ${item.name}`} disabled={!item.isAvailable || !(quantities[item.id] > 0)}
          onClick={() => onChange(item.id, Math.max(0, (quantities[item.id] ?? 0) - 1))} className="quantity-button">
          <Minus className="size-5" aria-hidden="true" />
        </button>
        <output aria-live="polite" aria-label={`الكمية المحددة من ${item.name}`} className="min-w-6 text-center font-black">{item.isAvailable ? quantities[item.id] ?? 0 : 0}</output>
        <button type="button" aria-label={`زيادة كمية ${item.name}`} disabled={!item.isAvailable || quantities[item.id] >= 20}
          onClick={() => onChange(item.id, Math.min(20, (quantities[item.id] ?? 0) + 1))} className="quantity-button">
          <Plus className="size-5" aria-hidden="true" />
        </button>
      </div>
    </div>)}
    </div>
  </fieldset>;
}
