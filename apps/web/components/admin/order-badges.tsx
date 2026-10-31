import type { OrderStatus, PaymentStatus } from "@catafy/types";
import { Badge } from "@/components/ui/badge";
import {
  ORDER_STATUS_CLASS,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_CLASS,
  PAYMENT_STATUS_LABEL,
} from "@/lib/order-status";
import { cn } from "@/lib/utils";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge className={ORDER_STATUS_CLASS[status]}>{ORDER_STATUS_LABEL[status]}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <Badge variant="outline" className={cn(PAYMENT_STATUS_CLASS[status])}>
      {PAYMENT_STATUS_LABEL[status]}
    </Badge>
  );
}
