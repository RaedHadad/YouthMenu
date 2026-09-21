'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { formatMoney } from '@/lib/money';

export type AdminMenuItem = {
  id: string;
  name: string;
  priceInAgorot: number;
  isAvailable: boolean;
};

export type AdminTopping = {
  id: string;
  name: string;
  priceInAgorot: number;
  isAvailable: boolean;
};

export default function AdminMenuManager({
  menuItems,
  toppings,
}: {
  menuItems: AdminMenuItem[];
  toppings: AdminTopping[];
}) {
  const [menu, setMenu] = useState(menuItems);
  const [toppingList, setToppingList] = useState(toppings);
  const [menuForm, setMenuForm] = useState({ name: '', priceInAgorot: '500', isAvailable: true });
  const [toppingForm, setToppingForm] = useState({ name: '', priceInAgorot: '0', isAvailable: true });

  const createMenuItem = async () => {
    const response = await fetch('/api/admin/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity: 'item', ...menuForm, priceInAgorot: Number(menuForm.priceInAgorot) }),
    });
    if (response.ok) {
      const data = await response.json();
      setMenu((current) => [...current, data.item]);
      setMenuForm({ name: '', priceInAgorot: '500', isAvailable: true });
    }
  };

  const createTopping = async () => {
    const response = await fetch('/api/admin/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity: 'topping', ...toppingForm, priceInAgorot: Number(toppingForm.priceInAgorot) }),
    });
    if (response.ok) {
      const data = await response.json();
      setToppingList((current) => [...current, data.topping]);
      setToppingForm({ name: '', priceInAgorot: '0', isAvailable: true });
    }
  };

  const toggleMenuAvailability = async (id: string, isAvailable: boolean) => {
    await fetch('/api/admin/menu', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, entity: 'item', isAvailable }),
    });
    setMenu((current) => current.map((item) => item.id === id ? { ...item, isAvailable } : item));
  };

  const toggleToppingAvailability = async (id: string, isAvailable: boolean) => {
    await fetch('/api/admin/menu', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, entity: 'topping', isAvailable }),
    });
    setToppingList((current) => current.map((topping) => topping.id === id ? { ...topping, isAvailable } : topping));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2" dir="rtl">
      <div className="rounded-[28px] bg-[#FFFDF0] p-5 shadow-md ring-1 ring-[#1E56C9]/10">
        <h2 className="mb-4 text-2xl font-black text-[#1E56C9]">إدارة القائمة</h2>
        <div className="space-y-3">
          <input value={menuForm.name} onChange={(event) => setMenuForm({ ...menuForm, name: event.target.value })} className="w-full rounded-2xl border p-3" placeholder="اسم الصنف" />
          <input type="number" value={menuForm.priceInAgorot} onChange={(event) => setMenuForm({ ...menuForm, priceInAgorot: event.target.value })} className="w-full rounded-2xl border p-3" placeholder="السعر بالاغورة" />
          <label className="flex items-center gap-2 text-[#1E56C9] font-bold"><input type="checkbox" checked={menuForm.isAvailable} onChange={(event) => setMenuForm({ ...menuForm, isAvailable: event.target.checked })} /> متوفر</label>
          <button onClick={createMenuItem} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1E56C9] px-4 py-3 text-lg font-bold text-white"><Plus className="h-5 w-5" /> إضافة صنف</button>
        </div>

        <div className="mt-6 space-y-3">
          {menu.map((item) => (
            <div key={item.id} className="rounded-2xl border border-[#1E56C9]/10 bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-black text-[#1E56C9]">{item.name}</div>
                  <div className="text-sm text-[#EA4933]">{formatMoney(item.priceInAgorot)}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => toggleMenuAvailability(item.id, !item.isAvailable)} className="rounded-full bg-[#FFD73E] px-3 py-1 text-xs font-bold text-[#1E56C9]">{item.isAvailable ? 'تعطيل' : 'تفعيل'}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[28px] bg-[#FFFDF0] p-5 shadow-md ring-1 ring-[#1E56C9]/10">
        <h2 className="mb-4 text-2xl font-black text-[#1E56C9]">إدارة الإضافات</h2>
        <div className="space-y-3">
          <input value={toppingForm.name} onChange={(event) => setToppingForm({ ...toppingForm, name: event.target.value })} className="w-full rounded-2xl border p-3" placeholder="اسم الإضافة" />
          <input type="number" value={toppingForm.priceInAgorot} onChange={(event) => setToppingForm({ ...toppingForm, priceInAgorot: event.target.value })} className="w-full rounded-2xl border p-3" placeholder="سعر الإضافة" />
          <label className="flex items-center gap-2 text-[#1E56C9] font-bold"><input type="checkbox" checked={toppingForm.isAvailable} onChange={(event) => setToppingForm({ ...toppingForm, isAvailable: event.target.checked })} /> متوفر</label>
          <button onClick={createTopping} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#EA4933] px-4 py-3 text-lg font-bold text-white"><Plus className="h-5 w-5" /> إضافة إضافة</button>
        </div>

        <div className="mt-6 space-y-3">
          {toppingList.map((topping) => (
            <div key={topping.id} className="rounded-2xl border border-[#1E56C9]/10 bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-black text-[#1E56C9]">{topping.name}</div>
                  <div className="text-sm text-[#EA4933]">{formatMoney(topping.priceInAgorot)}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => toggleToppingAvailability(topping.id, !topping.isAvailable)} className="rounded-full bg-[#FFD73E] px-3 py-1 text-xs font-bold text-[#1E56C9]">{topping.isAvailable ? 'تعطيل' : 'تفعيل'}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
