export type CustomerTopping = {
  id: string;
  name: string;
  priceInAgorot: number;
  isAvailable: boolean;
};

export type CustomerMenuItem = {
  id: string;
  name: string;
  priceInAgorot: number;
  isAvailable: boolean;
  toppings: CustomerTopping[];
};

export type CustomerOrder = {
  orderId: string;
  customerAccessToken: string;
  pickupToken: string;
  visibleCode: string;
  status: string;
  totalAmount: number;
  statusMessage?: string;
  customerName?: string;
  orderNumber?: number;
  itemName?: string;
  quantity?: number;
  toppings?: string;
  estimatedMinutes?: number | null;
};
