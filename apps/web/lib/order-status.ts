import type { OrderStatus, PaymentStatus } from "@catafy/types";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export const ORDER_STATUS_CLASS: Record<OrderStatus, string> = {
  PENDING: "bg-amber-100 text-amber-900",
  CONFIRMED: "bg-sky-100 text-sky-900",
  PACKED: "bg-indigo-100 text-indigo-900",
  SHIPPED: "bg-violet-100 text-violet-900",
  DELIVERED: "bg-emerald-100 text-emerald-900",
  CANCELLED: "bg-muted text-muted-foreground line-through",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  UNPAID: "Unpaid",
  PARTIAL: "Part paid",
  PAID: "Paid",
};

export const PAYMENT_STATUS_CLASS: Record<PaymentStatus, string> = {
  UNPAID: "border-destructive/40 text-destructive",
  PARTIAL: "border-amber-400 text-amber-900",
  PAID: "border-emerald-400 text-emerald-900",
};

const dateTime = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});
const date = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
export const formatDate = (iso: string) => date.format(new Date(iso));
