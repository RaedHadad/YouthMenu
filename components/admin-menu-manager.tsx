'use client';
import { useRef, useState } from 'react';
import { formatMoney } from '@/lib/money';

type Entry = { category?: 'FOOD' | 'DRINK'; id: string; name: string; priceInAgorot: number; isAvailable: boolean; archivedAt: string | null; toppingIds?: string[] };
type Menu = { menuItems: Entry[]; toppings: Entry[] };
export default function AdminMenuManager(initial: Menu) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<{ entity: 'item' | 'topping'; entry?: Entry } | null>(null);
  async function save(body: object, create = false) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/menu', { method: create ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (response.status === 401) { window.location.replace('/admin/login'); return; }
      const result = await response.json();
      if (!response.ok) { setMessage(result.message ?? 'تعذر الحفظ'); return; }
      setEditing(null);
      const refreshed = await fetch('/api/admin/menu', { cache: 'no-store' });
      if (!refreshed.ok) throw new Error();
      setData(await refreshed.json()); setMessage('تم حفظ التغييرات');
    } catch { setMessage('تعذر تأكيد التغييرات، حدّث الصفحة للتحقق قبل إعادة المحاولة'); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <section className="space-y-6 p-5" dir="rtl">
    <h1 className="text-3xl font-black">إدارة القائمة والإضافات</h1>
    {message && <p role="status" className="rounded-xl bg-yellow p-4">{message}</p>}
    {editing && <Editor key={`${editing.entity}:${editing.entry?.id ?? 'new'}`} {...editing} toppings={data.toppings}
      busy={busy} onCancel={() => setEditing(null)} onSave={save} />}
    <fieldset disabled={busy} className="grid gap-6 disabled:opacity-60 lg:grid-cols-2">
      {(['item', 'topping'] as const).map((entity) => <section key={entity} className="min-w-0 rounded-3xl border border-blue/20 bg-white p-5">
        <h2 className="mb-4 text-2xl font-black">{entity === 'item' ? 'الأصناف' : 'الإضافات'}</h2>
        <button onClick={() => setEditing({ entity })} className="mb-4 min-h-11 rounded-xl bg-blue px-4 text-white">{entity === 'item' ? 'إضافة صنف' : 'إضافة جديدة'}</button>
        <div className="space-y-3">{(entity === 'item' ? data.menuItems : data.toppings).map((entry) => <article key={entry.id} aria-label={entry.name} className="rounded-xl border border-blue/20 p-4">
          <h3 className="break-words font-bold">{entry.name} — <bdi>{formatMoney(entry.priceInAgorot)}</bdi></h3>
          {entity === 'item' && <p className="mt-2 text-sm font-bold">{entry.category === 'DRINK' ? 'مشروب' : 'طعام'}</p>}
          <p className="my-2 text-sm">{entry.archivedAt ? 'مؤرشف' : entry.isAvailable ? 'متوفر' : 'غير متوفر'}</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setEditing({ entity, entry })} className="min-h-11 rounded-lg bg-yellow px-3">تعديل</button>
            {!entry.archivedAt && <button onClick={() => void save({ entity, id: entry.id, isAvailable: !entry.isAvailable })} className="min-h-11 rounded-lg border px-3">{entry.isAvailable ? 'تعطيل' : 'تفعيل'}</button>}
            <button onClick={() => {
              if (entry.archivedAt || window.confirm('أرشفة هذا العنصر وإخفاؤه من قائمة العملاء؟')) void save({ entity, id: entry.id, archived: !entry.archivedAt });
            }} className="min-h-11 rounded-lg border px-3">{entry.archivedAt ? 'استعادة' : 'أرشفة'}</button>
          </div>
        </article>)}</div>
      </section>)}
    </fieldset>
  </section>;
}
function Editor({ entity, entry, toppings, busy, onCancel, onSave }: {
  entity: 'item' | 'topping'; entry?: Entry; toppings: Entry[]; busy: boolean;
  onCancel: () => void; onSave: (body: object, create: boolean) => Promise<void>;
}) {
  const [category, setCategory] = useState<'FOOD' | 'DRINK'>(entry?.category ?? 'FOOD');
  const [name, setName] = useState(entry?.name ?? '');
  const [price, setPrice] = useState(entry ? (entry.priceInAgorot / 100).toFixed(2) : '0');
  const [available, setAvailable] = useState(entry?.isAvailable ?? true);
  const [ids, setIds] = useState(entry?.toppingIds?.filter((id) => toppings.some((topping) => topping.id === id && !topping.archivedAt)) ?? []);
  return <form onSubmit={(event) => {
    event.preventDefault();
    if (!/^\d+(\.\d{1,2})?$/.test(price)) return;
    const [whole, fraction = ''] = price.split('.');
    void onSave({ entity, ...(entry ? { id: entry.id } : {}), name, priceInAgorot: Number(whole) * 100 + Number(fraction.padEnd(2, '0')),
      isAvailable: available, ...(entity === 'item' ? { category, toppingIds: category === 'FOOD' ? ids : [] } : {}) }, !entry);
  }} className="rounded-3xl border-2 border-blue bg-cream p-5">
    <fieldset disabled={busy} className="space-y-4">
      <legend className="mb-3 text-xl font-bold">{entry ? 'تعديل العنصر' : 'عنصر جديد'}</legend>
      {entity === 'item' && <label className="block">نوع الصنف<select value={category} onChange={(event) => setCategory(event.target.value as 'FOOD' | 'DRINK')} className="mt-1 block min-h-11 w-full rounded-lg border bg-white p-3"><option value="FOOD">طعام</option><option value="DRINK">مشروب</option></select></label>}
      <label className="block">الاسم<input required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border bg-white p-3" /></label>
      <label className="block">السعر بالشيكل<input required inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" value={price} onChange={(event) => setPrice(event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border bg-white p-3" /></label>
      <label className="flex gap-3"><input type="checkbox" checked={available} onChange={(event) => setAvailable(event.target.checked)} />متوفر</label>
      {entity === 'item' && category === 'FOOD' && <fieldset className="flex flex-wrap gap-4"><legend className="mb-2 font-bold">الإضافات المسموحة</legend>
        {toppings.filter((topping) => !topping.archivedAt).map((topping) => <label className="flex min-h-11 items-center gap-2" key={topping.id}>
          <input type="checkbox" checked={ids.includes(topping.id)} onChange={() => setIds((old) => old.includes(topping.id) ? old.filter((id) => id !== topping.id) : [...old, topping.id])} />{topping.name}
        </label>)}
      </fieldset>}
      <div className="flex gap-3"><button className="min-h-11 rounded-xl bg-blue px-5 text-white">{busy ? 'جاري الحفظ…' : 'حفظ'}</button>
        <button type="button" onClick={onCancel} className="min-h-11 rounded-xl border px-5">إلغاء</button></div>
    </fieldset>
  </form>;
}
