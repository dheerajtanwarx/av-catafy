export const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ["UNPAID", "PARTIAL", "PAID"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const ANALYTICS_EVENT_TYPES = [
  "catalogue_view",
  "product_view",
  "add_to_cart",
  "checkout_started",
  "order_placed",
] as const;
export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

export const DEVICE_TYPES = ["mobile", "tablet", "desktop"] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];
