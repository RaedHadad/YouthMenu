'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, UtensilsCrossed } from 'lucide-react';
import type { CustomerMenuItem } from '@/lib/customer-types';
import { useCustomerOrder } from '@/components/customer/use-customer-order';
import { DishList } from '@/components/customer/dish-list';
import { OrderForm } from '@/components/customer/order-form';
import { useReadyAlert } from '@/components/customer/use-ready-alert';
import { OrderReceipt } from '@/components/customer/order-receipt';
import { DrinkPicker } from '@/components/customer/drink-picker';
import { MenuHeader } from '@/components/customer/menu-header';

export default function CustomerMenu({ menuItems }: { menuItems: CustomerMenuItem[] }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [selections, setSelections] = useState<Record<string, { quantity: number; toppingIds: string[] }>>({});
  const [drinkQuantities, setDrinkQuantities] = useState<Record<string, number>>({});
  const [customerName, setCustomerName] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const { order: currentOrder, pending, restoring, blocked, submitting: isSubmitting, error, live, submit, startNewOrder } = useCustomerOrder();
  const foodItems = menuItems.filter((item) => item.category !== 'DRINK');
  const drinkItems = menuItems.filter((item) => item.category === 'DRINK');
  const selectedDrinks = drinkItems.filter((item) => item.isAvailable && drinkQuantities[item.id] > 0).map((item) => ({ ...item, quantity: drinkQuantities[item.id] }));
  const selectedFoods = foodItems.filter((item) => item.isAvailable && selections[item.id]).map((item) => ({
    ...item, quantity: selections[item.id].quantity,
    toppings: item.toppings.filter((topping) => topping.isAvailable && selections[item.id].toppingIds.includes(topping.id)),
  }));
  const missingFood = Object.keys(selections).some((id) => !selectedFoods.some((food) => food.id === id));
  const total = selectedFoods.length ? selectedFoods.reduce((sum, food) => sum + (food.priceInAgorot + food.toppings.reduce((price, topping) => price + topping.priceInAgorot, 0)) * food.quantity, 0) + selectedDrinks.reduce((sum, drink) => sum + drink.priceInAgorot * drink.quantity, 0) : 0;
  const refreshMenu = () => startRefresh(() => router.refresh());

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!selectedFoods.length || missingFood) {
      setStatusMessage('يرجى اختيار صنف');
      return;
    }
    if (!customerName.trim()) {
      setStatusMessage('يرجى إدخال الاسم');
      return;
    }

    setStatusMessage('');
    const foods = selectedFoods.map((food) => ({ menuItemId: food.id, quantity: food.quantity, selectedToppingIds: food.toppings.map((topping) => topping.id) }));
    await submit({ ...foods[0], ...(foods.length > 1 ? { additionalFoods: foods.slice(1) } : {}), drinks: selectedDrinks.map((drink) => ({ menuItemId: drink.id, quantity: drink.quantity })), customerName: customerName.trim() });
  };

  const { enableAlerts, alertMessage } = useReadyAlert(currentOrder);

  if (restoring) return <p role="status" className="p-12 text-center font-bold">جاري التحقق من طلبك المحفوظ…</p>;
  if (currentOrder) return <>
    {error && <p role="status" className="no-print mx-auto max-w-xl p-4 text-center">{error}</p>}
    <p role="status" className="no-print pt-4 text-center text-sm">{live ? 'متصل مباشرة' : 'تُحدّث حالة طلبك تلقائياً'}</p>
    {alertMessage && <p role="status" className="no-print p-3 text-center">{alertMessage}</p>}
    <OrderReceipt order={currentOrder} onRequestNotification={enableAlerts} onNewOrder={() => {
      if (!startNewOrder()) return;
      setSelections({});
      setDrinkQuantities({});
      setCustomerName('');
      setStatusMessage('');
      refreshMenu();
    }} />
  </>;
  if (pending || blocked) return (
    <section className="mx-auto max-w-lg px-5 py-12 text-center">
      <h1 className="text-3xl font-black">{pending ? 'طلبك بانتظار التأكيد' : 'تعذر استعادة الطلب'}</h1>
      <p className="my-5 leading-8">{pending ? 'لدينا محاولة طلب محفوظة. أعد المحاولة للتحقق منها واستعادة البون.' : 'يرجى إعادة المحاولة للوصول إلى طلبك المحفوظ.'}</p>
      {error && <p role="alert" className="mb-5">{error}</p>}
      <button disabled={isSubmitting} onClick={() => pending ? void submit() : window.location.reload()}
        className="min-h-12 rounded-2xl bg-blue px-6 py-3 font-bold text-white disabled:opacity-50">
        {isSubmitting ? 'جاري التحقق…' : 'إعادة المحاولة'}
      </button>
    </section>
  );

  return (
    <>
      <MenuHeader />
      <section aria-label="قائمة الطعام والطلب" className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="font-bold">اختيارك اليوم، على ذوقك</p>
          <button onClick={refreshMenu} disabled={refreshing || isSubmitting} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-blue/25 bg-white px-4 font-bold disabled:opacity-50">
            <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            {refreshing ? 'جاري التحديث…' : 'تحديث القائمة'}
          </button>
        </div>
        {menuItems.length === 0 ? (
          <div role="status" className="rounded-3xl border-2 border-dashed border-blue/30 bg-white px-6 py-16 text-center">
            <UtensilsCrossed className="mx-auto mb-5 size-10" aria-hidden="true" />
            <h2 className="text-2xl font-black">القائمة تُحضّر على نار هادئة!</h2>
            <p className="mt-3 leading-8">لا توجد أصناف حالياً. عد قريباً أو جرّب تحديث القائمة.</p>
          </div>
        ) : (
          <>
            {!foodItems.some((item) => item.isAvailable) && <p role="status" className="mb-6 rounded-2xl border-2 border-blue bg-yellow p-4 font-bold">الأصناف غير متوفرة حالياً. ننتظرك قريباً!</p>}
            {missingFood && <p role="status" className="mb-6 rounded-2xl bg-yellow p-4 font-bold">الصنف الذي اخترته لم يعد متوفراً. أزل الصنف غير المتوفر أو حدّث القائمة.</p>}
            <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
              <div className="min-w-0 space-y-8">
                <DishList items={foodItems} selections={selections} disabled={isSubmitting}
                  onSelect={(id) => { setSelections((previous) => { const next = { ...previous }; if (next[id]) delete next[id]; else if (Object.keys(next).length < 20) next[id] = { quantity: 1, toppingIds: [] }; return next; }); setStatusMessage(''); }}
                  onQuantityChange={(id, quantity) => setSelections((previous) => ({ ...previous, [id]: { ...previous[id], quantity } }))}
                  onToppingToggle={(id, toppingId) => setSelections((previous) => ({ ...previous, [id]: { ...previous[id], toppingIds: previous[id].toppingIds.includes(toppingId) ? previous[id].toppingIds.filter((value) => value !== toppingId) : [...previous[id].toppingIds, toppingId] } }))} />
                {missingFood && <button type="button" onClick={() => setSelections((previous) => Object.fromEntries(Object.entries(previous).filter(([id]) => selectedFoods.some((food) => food.id === id))))} className="min-h-11 rounded-xl border-2 border-blue px-4 font-bold">إزالة الأصناف غير المتوفرة</button>}
                <DrinkPicker items={drinkItems} quantities={drinkQuantities} disabled={isSubmitting || !selectedFoods.length} onChange={(id, amount) => setDrinkQuantities((previous) => ({ ...previous, [id]: amount }))} />
              </div>
              <OrderForm drinks={selectedDrinks} foods={selectedFoods} blocked={missingFood}
                name={customerName} onNameChange={setCustomerName} total={total} submitting={isSubmitting}
                message={statusMessage || error} onSubmit={handleSubmit} />
            </div>
          </>
        )}
      </section>
      <footer className="no-print mx-auto max-w-6xl px-5 pb-8 text-center text-sm leading-7 sm:px-8">صحتين وعافية! <span aria-hidden="true">✦</span> الدفع نقداً عند الاستلام</footer>
    </>
  );
}
