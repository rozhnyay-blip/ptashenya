import type { OrderDetail } from "@workspace/api-client-react";
import { ProductImage } from "./product-image";
import { DELIVERY_LABEL, PAYMENT_LABEL, STATUS_LABEL, dateTime, uah } from "@/lib/format";
import { cn } from "@/lib/utils";

const STEPS = ["new", "confirmed", "shipped", "delivered"];

export function OrderTimeline({ status }: { status: string }) {
  if (status === "cancelled") return <div className="rounded-2xl bg-muted p-4 text-center text-sm font-semibold" data-testid="status-order">Замовлення скасовано</div>;
  const idx = STEPS.indexOf(status);
  return (
    <div className="flex items-start" data-testid="status-order">
      {STEPS.map((s, i) => (
        <div key={s} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex w-full items-center">
            <div className={cn("h-1 flex-1 rounded-full", i === 0 ? "opacity-0" : i <= idx ? "bg-primary" : "bg-border")} />
            <div className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold", i <= idx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground", i === idx && "ring-4 ring-primary/20")}>{i + 1}</div>
            <div className={cn("h-1 flex-1 rounded-full", i === STEPS.length - 1 ? "opacity-0" : i < idx ? "bg-primary" : "bg-border")} />
          </div>
          <span className={cn("text-center text-[11px] font-semibold", i <= idx ? "" : "text-muted-foreground")}>{STATUS_LABEL[s]}</span>
        </div>
      ))}
    </div>
  );
}

export function OrderSummary({ order }: { order: OrderDetail }) {
  return (
    <div className="space-y-5">
      <OrderTimeline status={order.status} />
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-2xl bg-muted/60 p-4"><div className="text-xs text-muted-foreground">Отримувач</div><div className="font-semibold">{order.customerName}</div><div className="tabular">{order.phone}</div></div>
        <div className="rounded-2xl bg-muted/60 p-4"><div className="text-xs text-muted-foreground">Доставка · {PAYMENT_LABEL[order.paymentMethod]}</div><div className="font-semibold">{DELIVERY_LABEL[order.deliveryMethod]}, {order.city}</div>{order.deliveryAddress && <div>{order.deliveryAddress}</div>}</div>
      </div>
      <ul className="divide-y divide-border">
        {order.items.map((i) => (
          <li key={i.id} className="flex items-center gap-3 py-3">
            <ProductImage src={i.imageUrl} alt={i.name} className="h-14 w-14 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1"><div className="line-clamp-2 text-sm font-medium">{i.name}</div><div className="text-xs text-muted-foreground tabular">{i.quantity} × {uah(i.price)}</div></div>
            <div className="font-bold tabular">{uah(i.lineTotal)}</div>
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between border-t border-border pt-4"><span className="text-sm text-muted-foreground">Оформлено {dateTime(order.createdAt)}</span><span className="font-display text-2xl font-bold tabular">{uah(order.total)}</span></div>
    </div>
  );
}
