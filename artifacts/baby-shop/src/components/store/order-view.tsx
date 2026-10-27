import { useState } from "react";
import { AlertTriangle, Check, Copy, ExternalLink, MapPin, Package, PackageCheck, Truck, Warehouse } from "lucide-react";
import type { OrderDetail, ParcelStage } from "@workspace/api-client-react";
import { ProductImage } from "./product-image";
import { DELIVERY_LABEL, PAYMENT_LABEL, STATUS_LABEL, dateTime, uah, ON_ORDER_TERM, isOnOrder } from "@/lib/format";
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

const PARCEL_STEPS: { stage: ParcelStage; label: string; icon: typeof Package }[] = [
  { stage: "created", label: "Створено", icon: Package },
  { stage: "in_transit", label: "В дорозі", icon: Truck },
  { stage: "arrived", label: "У відділенні", icon: Warehouse },
  { stage: "received", label: "Отримано", icon: PackageCheck },
];

const npTracking = (ttn: string) => `https://novaposhta.ua/tracking/?cargo_number=${ttn}`;

/** Where the parcel is right now: Nova Poshta waybill + live status. */
export function ParcelCard({ order }: { order: OrderDetail }) {
  const [copied, setCopied] = useState(false);
  if (!order.ttn) {
    if (order.status === "cancelled" || order.status === "delivered") return null;
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-dashed border-border p-4 text-sm" data-testid="parcel-pending">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted"><Package className="h-4 w-4 text-muted-foreground" /></span>
        <div><div className="font-semibold">Посилку ще не відправили</div><div className="text-xs text-muted-foreground">Щойно відправимо, тут з'явиться номер ТТН Нової Пошти і де зараз посилка.</div></div>
      </div>
    );
  }
  const p = order.parcel;
  const idx = p ? PARCEL_STEPS.findIndex((x) => x.stage === p.stage) : -1;
  const problem = p?.stage === "problem";
  return (
    <div className="overflow-hidden rounded-2xl border border-[hsl(4_75%_88%)] bg-card" data-testid="parcel-card">
      <div className="flex flex-wrap items-center gap-3 bg-[hsl(4_80%_97%)] p-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#DA291C] text-white"><Truck className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[hsl(4_60%_40%)]">Нова Пошта · ТТН</div>
          <button type="button" onClick={() => { navigator.clipboard?.writeText(order.ttn!); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="inline-flex items-center gap-1.5 font-mono text-lg font-bold tabular" data-testid="button-copy-ttn">
            {order.ttn}{copied ? <Check className="h-4 w-4 text-[hsl(152_55%_35%)]" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
        </div>
        <a href={p?.trackingUrl ?? npTracking(order.ttn)} target="_blank" rel="noreferrer" data-testid="link-np-tracking" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-foreground px-4 text-xs font-bold text-background">На сайті НП<ExternalLink className="h-3.5 w-3.5" /></a>
      </div>
      <div className="space-y-4 p-4">
        {p ? (
          <>
            {!problem && idx >= 0 && (
              <div className="flex items-start">
                {PARCEL_STEPS.map((st, i) => (
                  <div key={st.stage} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className="flex w-full items-center">
                      <div className={cn("h-1 flex-1 rounded-full", i === 0 ? "opacity-0" : i <= idx ? "bg-[#DA291C]" : "bg-border")} />
                      <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", i <= idx ? "bg-[#DA291C] text-white" : "bg-muted text-muted-foreground", i === idx && "ring-4 ring-[#DA291C]/20")}><st.icon className="h-4 w-4" /></div>
                      <div className={cn("h-1 flex-1 rounded-full", i === PARCEL_STEPS.length - 1 ? "opacity-0" : i < idx ? "bg-[#DA291C]" : "bg-border")} />
                    </div>
                    <span className={cn("text-center text-[11px] font-semibold", i <= idx ? "" : "text-muted-foreground")}>{st.label}</span>
                  </div>
                ))}
              </div>
            )}
            <div className={cn("flex gap-2 rounded-xl p-3 text-sm", problem ? "bg-destructive/10 text-destructive" : "bg-muted/60")} data-testid="text-parcel-status">
              {problem ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#DA291C]" />}
              <div className="min-w-0">
                <div className="font-semibold">{p.status}</div>
                {p.warehouse && <div className="text-xs text-muted-foreground">{p.city ? `${p.city}, ` : ""}{p.warehouse}</div>}
                {p.stage === "received" && p.receivedAt ? <div className="text-xs text-muted-foreground">Отримано {p.receivedAt}</div>
                  : p.scheduledDelivery && p.stage !== "arrived" ? <div className="text-xs text-muted-foreground">Орієнтовно прибуде: <b>{p.scheduledDelivery}</b></div> : null}
                {p.stage === "arrived" && <div className="text-xs font-semibold text-[hsl(152_55%_30%)]">Можна забирати — візьміть паспорт або покажіть код у застосунку НП</div>}
              </div>
            </div>
          </>
        ) : <p className="text-sm text-muted-foreground">Статус від Нової Пошти тимчасово недоступний — натисніть «На сайті НП», щоб перевірити.</p>}
      </div>
    </div>
  );
}

export function OrderSummary({ order }: { order: OrderDetail }) {
  return (
    <div className="space-y-5">
      <OrderTimeline status={order.status} />
      <ParcelCard order={order} />
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-2xl bg-muted/60 p-4"><div className="text-xs text-muted-foreground">Отримувач</div><div className="font-semibold">{order.customerName}</div><div className="tabular">{order.phone}</div></div>
        <div className="rounded-2xl bg-muted/60 p-4"><div className="text-xs text-muted-foreground">Доставка · {PAYMENT_LABEL[order.paymentMethod]}</div><div className="font-semibold">{DELIVERY_LABEL[order.deliveryMethod]}, {order.city}</div>{order.deliveryAddress && <div>{order.deliveryAddress}</div>}</div>
      </div>
      <ul className="divide-y divide-border">
        {order.items.map((i) => (
          <li key={i.id} className="flex items-center gap-3 py-3">
            <ProductImage src={i.imageUrl} alt={i.name} className="h-14 w-14 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1"><div className="line-clamp-2 text-sm font-medium">{i.name}</div><div className="text-xs text-muted-foreground tabular">{i.quantity} × {uah(i.price)}</div>{isOnOrder(i.deliveryDays) && <div className="text-xs font-semibold text-[hsl(30_70%_32%)]">Під замовлення · доставка {ON_ORDER_TERM}</div>}</div>
            <div className="font-bold tabular">{uah(i.lineTotal)}</div>
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between border-t border-border pt-4"><span className="text-sm text-muted-foreground">Оформлено {dateTime(order.createdAt)}</span><span className="font-display text-2xl font-bold tabular">{uah(order.total)}</span></div>
    </div>
  );
}
