export function getArabicStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: 'تم استلام طلبك',
    PREPARING: 'طلبك قيد التحضير...',
    READY: 'طلبك جاهز! تفضل بالاستلام 🎉',
    COLLECTED: 'تم استلام الطلب، بالهناء!',
    CANCELLED: 'تم إلغاء الطلب',
  };

  return labels[status] ?? 'قيد المراجعة';
}
