import { isOrderToken } from './orders/credentials';

export function validatePickupToken(token: string) {
  return isOrderToken(token);
}

export function isOrderStatusTransitionAllowed(current: string, next: string) {
  const allowedTransitions: Record<string, string[]> = {
    PENDING: ['PREPARING', 'CANCELLED'],
    PREPARING: ['READY', 'CANCELLED'],
    READY: ['COLLECTED', 'CANCELLED'],
    COLLECTED: [],
    CANCELLED: [],
  };

  return (allowedTransitions[current] ?? []).includes(next);
}
