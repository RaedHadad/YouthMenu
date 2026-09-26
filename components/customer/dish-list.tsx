'use client';
import { useState } from 'react';
import { Plus, UtensilsCrossed } from 'lucide-react';
import type { CustomerMenuItem } from '@/lib/customer-types';
import { ToppingPicker } from './topping-picker';
import { formatMoney } from '@/lib/money';

export function DishList({ items, selections, onAdd, disabled }: {
  items: CustomerMenuItem[];
  selections: Record<string, { quantity: number; toppingIds: string[] }[]>;
  onAdd: (id: string, toppingIds: string[]) => void;
  disabled: boolean;
}) {
  const [drafts, setDrafts] = useState<Record<string, string[]>>({});
  return <fieldset disabled={disabled}>
    <legend className="mb-5 flex items-center gap-3 text-2xl font-black"><span className="step-number" aria-hidden="true">١</span> اختر الأصناف</legend>
    <p className="mb-4 text-sm">اختر الإضافات ثم اضغط + لإضافة قطعة إلى السلة.</p>
    <div className="grid gap-4 sm:grid-cols-2">{items.map((item) => {
      const toppingIds = (drafts[item.id] ?? []).filter((id) => item.toppings.some((topping) => topping.id === id && topping.isAvailable));
      const count = (selections[item.id] ?? []).reduce((sum, variant) => sum + variant.quantity, 0);
      const existing = selections[item.id]?.some((variant) => [...variant.toppingIds].sort().join(',') === [...toppingIds].sort().join(','));
      const full = count >= 20 || (!existing && Object.values(selections).flat().length >= 20);
      return <article key={item.id} aria-label={item.name} className={`min-w-0 space-y-4 rounded-3xl border-2 p-4 ${count ? 'border-blue bg-yellow/30' : 'border-blue/20 bg-white'}`}>
        <div className="flex items-center justify-between gap-3"><h3 className="break-words text-2xl font-black">{item.name}</h3><UtensilsCrossed className="size-6 shrink-0" aria-hidden="true" /></div>
        <p className="text-xl font-black"><bdi>{formatMoney(item.priceInAgorot)}</bdi></p>
        {!item.isAvailable && <p className="font-bold">غير متوفر</p>}
        <ToppingPicker item={item} selectedIds={toppingIds} disabled={disabled} onToggle={(id) => setDrafts((previous) => ({ ...previous, [item.id]: toppingIds.includes(id) ? toppingIds.filter((value) => value !== id) : [...toppingIds, id] }))} />
        <button type="button" aria-label={`إضافة ${item.name} للطلب`} disabled={!item.isAvailable || full} onClick={() => { onAdd(item.id, toppingIds); setDrafts((previous) => ({ ...previous, [item.id]: [] })); }} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue px-3 py-3 font-bold text-white disabled:opacity-50"><Plus className="size-6" aria-hidden="true" /> إضافة للطلب</button>
        <p role="status" className="text-center text-sm font-bold">في السلة: {count}{full ? ' — وصلت للحد المسموح' : ''}</p>
      </article>;
    })}</div>
  </fieldset>;
}
