'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, UtensilsCrossed } from 'lucide-react';
import type { CustomerMenuItem } from '@/lib/customer-types';
import { useCustomerOrder } from '@/components/customer/use-customer-order';
import { DishList } from '@/components/customer/dish-list';
import { ToppingPicker } from '@/components/customer/topping-picker';
import { OrderForm } from '@/components/customer/order-form';
import { useReadyAlert } from '@/components/customer/use-ready-alert';
import { OrderReceipt } from '@/components/customer/order-receipt';
import { DrinkPicker } from '@/components/customer/drink-picker';
import { MenuHeader } from '@/components/customer/menu-header';

export default function CustomerMenu({ menuItems }: { menuItems: CustomerMenuItem[] }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedToppingIds, setSelectedToppingIds] = useState<string[]>([]);
  const [drinkQuantities, setDrinkQuantities] = useState<Record<string, number>>({});
  const [quantity, setQuantity] = useState(1);
  const [customerName, setCustomerName] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const { order: currentOrder, pending, restoring, blocked, submitting: isSubmitting, error, live, submit, startNewOrder } = useCustomerOrder();
  const foodItems = menuItems.filter((item) => item.category !== 'DRINK');
  const drinkItems = menuItems.filter((item) => item.category === 'DRINK');
  const selectedDrinks = drinkItems.filter((item) => item.isAvailable && drinkQuantities[item.id] > 0).map((item) => ({ ...item, quantity: drinkQuantities[item.id] }));
  const selectedItem = foodItems.find((item) => item.id === selectedItemId && item.isAvailable);
  const selectedToppings = selectedItem?.toppings.filter((topping) => topping.isAvailable && selectedToppingIds.includes(topping.id)) ?? [];
  const total = selectedItem ? (selectedItem.priceInAgorot + selectedToppings.reduce((sum, topping) => sum + topping.priceInAgorot, 0)) * quantity + selectedDrinks.reduce((sum, drink) => sum + drink.priceInAgorot * drink.quantity, 0) : 0;
  const refreshMenu = () => startRefresh(() => router.refresh());

  const toggleTopping = (id: string) => {
    setSelectedToppingIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!selectedItem?.isAvailable) {
      setStatusMessage('يرجى اختيار صنف');
      return;
    }
    if (!customerName.trim()) {
      setStatusMessage('يرجى إدخال الاسم');
      return;
    }

    setStatusMessage('');
    await submit({ drinks: selectedDrinks.map((drink) => ({ menuItemId: drink.id, quantity: drink.quantity })), menuItemId: selectedItem.id, selectedToppingIds: selectedToppings.map((topping) => topping.id), quantity, customerName: customerName.trim() });
  };

  const { enableAlerts, alertMessage } = useReadyAlert(currentOrder);

  if (restoring) return <p role="status" className="p-12 text-center font-bold">جاري التحقق من طلبك المحفوظ…</p>;
  if (currentOrder) return <>
    {error && <p role="status" className="no-print mx-auto max-w-xl p-4 text-center">{error}</p>}
    <p role="status" className="no-print pt-4 text-center text-sm">{live ? 'متصل مباشرة' : 'تُحدّث حالة طلبك تلقائياً'}</p>
    {alertMessage && <p role="status" className="no-print p-3 text-center">{alertMessage}</p>}
    <OrderReceipt order={currentOrder} onRequestNotification={enableAlerts} onNewOrder={() => {
      if (!startNewOrder()) return;
      setSelectedItemId('');
      setSelectedToppingIds([]);
      setDrinkQuantities({});
      setQuantity(1);
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
            {selectedItemId && !selectedItem && <p role="status" className="mb-6 rounded-2xl bg-yellow p-4 font-bold">الصنف الذي اخترته لم يعد متوفراً. اختر صنفاً آخر.</p>}
            <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
              <div className="min-w-0 space-y-8">
                <DishList items={foodItems} selectedId={selectedItem?.id} disabled={isSubmitting}
                  onSelect={(id) => { setSelectedItemId(id); setSelectedToppingIds([]); setStatusMessage(''); }} />
                <DrinkPicker items={drinkItems} quantities={drinkQuantities} disabled={isSubmitting || !selectedItem} onChange={(id, amount) => setDrinkQuantities((previous) => ({ ...previous, [id]: amount }))} />
                <ToppingPicker item={selectedItem} selectedIds={selectedToppings.map((topping) => topping.id)} onToggle={toggleTopping} disabled={isSubmitting} />
              </div>
              <OrderForm drinks={selectedDrinks} item={selectedItem} toppings={selectedToppings} quantity={quantity} onQuantityChange={setQuantity}
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
