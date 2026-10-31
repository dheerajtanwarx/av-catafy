import { formatPaise, type OrderConfirmation } from "@catafy/types";

export function variantLabel(size: string, colour: string): string {
  return [size, colour].filter((x) => x && x !== "Default").join(" / ");
}

/** Pre-filled WhatsApp message the buyer sends to the store after ordering. */
export function orderWhatsappMessage(
  order: OrderConfirmation,
  storeName: string,
  currency: string,
): string {
  const c = order.customer;
  const money = (p: number) => formatPaise(p, currency);
  return [
    `Hi ${storeName}! I've placed an order.`,
    ``,
    `*Order ${order.orderNumber}*`,
    ...order.items.map((i, n) => {
      const v = variantLabel(i.size, i.colour);
      return `${n + 1}. ${i.title}${v ? ` (${v})` : ""} × ${i.quantity} – ${money(i.lineTotal)}`;
    }),
    `*Total: ${money(order.total)}*`,
    ``,
    `Name: ${c.name}`,
    `Phone: ${c.phone}`,
    `Address: ${c.line1}, ${c.city}${c.state ? `, ${c.state}` : ""} - ${c.pincode}`,
    ...(order.note ? [`Note: ${order.note}`] : []),
  ].join("\n");
}
