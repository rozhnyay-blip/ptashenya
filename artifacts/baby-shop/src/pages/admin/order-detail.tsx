import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, ExternalLink, Loader2, Phone } from "lucide-react";
import { useGetAdminOrder, getGetAdminOrderQueryKey, useUpdateAdminOrder, getListAdminOrdersQueryKey, getGetAdminDashboardQueryKey, getGetAdminActivityQueryKey, type OrderStatus } from "@workspace/api-client-react";
import { PageHead, Panel, StatusPill } from "@/components/admin/admin-layout";
import { ProductImage } from "@/components/store/product-image";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { DELIVERY_LABEL, PAYMENT_LABEL, STATUS_LABEL, apiError, dateTime, uah, ON_ORDER_TERM, isOnOrder } from "@/lib/format";
import { cn } from "@/lib/utils";

const FLOW: OrderStatus[] = ["new", "confirmed", "shipped", "delivered", "cancelled"];

export default function OrderDetailPage() {
  const { id: idStr } = useParams<{ id: string }>();
  const id = Number(idStr);
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: o, isLoading, isError, refetch } = useGetAdminOrder(id, { query: { enabled: !!id, queryKey: getGetAdminOrderQueryKey(id) } });
  const update = useUpdateAdminOrder();
  const [note, setNote] = useState("");
  const inited = useRef<number | null>(null);
  useEffect(() => { if (o && inited.current !== o.id) { inited.current = o.id; setNote(o.adminNote ?? ""); } }, [o]);

  const save = (data: { status?: OrderStatus; adminNote?: string }, msg: string) => update.mutate({ id, data }, {
    onSuccess: (res) => {
      qc.setQueryData(getGetAdminOrderQueryKey(id), res);
      qc.invalidateQueries({ queryKey: getListAdminOrdersQueryKey() });
      qc.invalidateQueries({ queryKey: getGetAdminDashboardQueryKey() });
      qc.invalidateQueries({ queryKey: getGetAdminActivityQueryKey() });
      toast({ title: msg });
    },
    onError: (e) => toast({ title: "Не збережено", description: apiError(e).message, variant: "destructive" }),
  });
  const copy = (t: string, label: string) => { navigator.clipboard?.writeText(t); toast({ title: `${label} скопійовано` }); };

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-8 w-60" /><Skeleton className="h-64 rounded-2xl" /></div>;
  if (isError || !o) return <Panel><div className="p-10 text-center"><p className="font-semibold">Замовлення не знайдено</p><div className="mt-3 flex justify-center gap-2"><button onClick={() => refetch()} className="rounded-lg border border-border px-4 py-2 text-sm" data-testid="button-retry-order">Повторити</button><Link href="/admin/orders" className="rounded-lg bg-foreground px-4 py-2 text-sm text-background">До списку</Link></div></div></Panel>;

  const deliveryText = [o.customerName, o.phone, `${DELIVERY_LABEL[o.deliveryMethod]}, ${o.city}`, o.deliveryAddress].filter(Boolean).join("\n");
  const cost = o.items.reduce((s, i) => s + (i.supplierPrice ?? 0) * i.quantity, 0);

  return (
    <div>
      <Link href="/admin/orders" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" data-testid="link-back-orders"><ArrowLeft className="h-4 w-4" />Усі замовлення</Link>
      <PageHead title={`Замовлення № ${o.number}`} sub={<span className="flex items-center gap-2">{dateTime(o.createdAt)} <StatusPill status={o.status} /></span>} />
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Panel title={`Товари · ${o.itemsCount}`} action={o.items.some((i) => isOnOrder(i.deliveryDays)) ? <span className="rounded-full bg-[hsl(40_90%_90%)] px-2.5 py-1 text-[11px] font-semibold text-[hsl(30_70%_28%)]" data-testid="badge-order-slow">Є товари під замовлення · {ON_ORDER_TERM}</span> : undefined}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead><tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground"><th className="px-4 py-2">Товар</th><th className="px-2 text-right">Ціна</th><th className="px-2 text-right">Закупка</th><th className="px-2 text-right">К-сть</th><th className="px-4 text-right">Сума</th></tr></thead>
                <tbody>{o.items.map((i) => (
                  <tr key={i.id} className="border-b border-border/70">
                    <td className="px-4 py-2.5"><div className="flex items-center gap-3"><ProductImage src={i.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg" imgClassName="p-0.5" /><div className="min-w-0"><div className="line-clamp-2 text-xs font-medium">{i.productId ? <Link href={`/admin/products?q=${encodeURIComponent(i.sku)}`} className="hover:text-primary">{i.name}</Link> : i.name}</div><div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">{i.sku}{isOnOrder(i.deliveryDays) && <span className="rounded bg-[hsl(40_90%_90%)] px-1.5 py-0.5 font-sans text-[10px] font-semibold text-[hsl(30_70%_28%)]" title="Постачальник везе з іншого складу">під замовлення · {ON_ORDER_TERM}</span>}</div></div></div></td>
                    <td className="px-2 text-right font-mono tabular">{uah(i.price)}</td>
                    <td className="px-2 text-right font-mono text-xs tabular text-muted-foreground">{i.supplierPrice != null ? uah(i.supplierPrice) : "—"}</td>
                    <td className="px-2 text-right font-mono tabular">{i.quantity}</td>
                    <td className="px-4 text-right font-mono font-semibold tabular">{uah(i.lineTotal)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="grid grid-cols-3 gap-px border-t border-border bg-border text-center">
              <div className="bg-card p-3"><div className="text-[11px] text-muted-foreground">Сума</div><div className="font-mono font-semibold tabular">{uah(o.total)}</div></div>
              <div className="bg-card p-3"><div className="text-[11px] text-muted-foreground">Закупка</div><div className="font-mono tabular">{uah(cost)}</div></div>
              <div className="bg-card p-3"><div className="text-[11px] text-muted-foreground">Прибуток</div><div className="font-mono font-semibold tabular text-[hsl(165_55%_30%)]" data-testid="text-order-profit">{o.profit != null ? uah(o.profit) : "—"}</div></div>
            </div>
          </Panel>
          {o.comment && <Panel title="Коментар клієнта"><p className="whitespace-pre-line p-4 text-sm">{o.comment}</p></Panel>}
          <Panel title="Нотатка для себе">
            <div className="p-4">
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="ТТН, домовленості, нагадування..." data-testid="input-admin-note" className="min-h-24 w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary" />
              <button type="button" disabled={update.isPending || note === (o.adminNote ?? "")} onClick={() => save({ adminNote: note }, "Нотатку збережено")} data-testid="button-save-note" className="mt-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-40">Зберегти нотатку</button>
            </div>
          </Panel>
        </div>
        <div className="space-y-4">
          <Panel title="Статус">
            <div className="grid gap-1.5 p-3">
              {FLOW.map((s) => (
                <button key={s} type="button" disabled={update.isPending || o.status === s} onClick={() => save({ status: s }, `Статус: ${STATUS_LABEL[s]}`)} data-testid={`button-status-${s}`}
                  className={cn("flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-semibold transition", o.status === s ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground/40", s === "cancelled" && o.status !== s && "text-destructive")}>
                  {STATUS_LABEL[s]}{update.isPending && update.variables?.data.status === s && <Loader2 className="h-4 w-4 animate-spin" />}{o.status === s && <span className="text-[10px] uppercase tracking-wider opacity-70">поточний</span>}
                </button>
              ))}
            </div>
          </Panel>
          <Panel title="Клієнт" action={<button type="button" onClick={() => copy(deliveryText, "Дані доставки")} className="flex items-center gap-1 text-xs font-semibold text-primary" data-testid="button-copy-delivery"><Copy className="h-3 w-3" />Копіювати все</button>}>
            <dl className="space-y-3 p-4 text-sm">
              <div><dt className="text-[11px] text-muted-foreground">Ім'я</dt><dd className="font-semibold">{o.customerName}</dd></div>
              <div><dt className="text-[11px] text-muted-foreground">Телефон</dt><dd className="flex items-center gap-2"><a href={`tel:${o.phone}`} className="font-mono font-semibold text-primary" data-testid="link-call">{o.phone}</a><a href={`tel:${o.phone}`} className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-primary-foreground" aria-label="Подзвонити"><Phone className="h-3.5 w-3.5" /></a><button type="button" onClick={() => copy(o.phone, "Телефон")} className="grid h-7 w-7 place-items-center rounded-lg bg-muted" data-testid="button-copy-phone" aria-label="Копіювати"><Copy className="h-3.5 w-3.5" /></button></dd></div>
              {o.email && <div><dt className="text-[11px] text-muted-foreground">Email</dt><dd><a href={`mailto:${o.email}`} className="hover:text-primary">{o.email}</a></dd></div>}
              <div><dt className="text-[11px] text-muted-foreground">Доставка</dt><dd className="font-semibold">{DELIVERY_LABEL[o.deliveryMethod]}</dd><dd>{o.city}{o.deliveryAddress && <>, {o.deliveryAddress}</>}</dd></div>
              <div><dt className="text-[11px] text-muted-foreground">Оплата</dt><dd>{PAYMENT_LABEL[o.paymentMethod]}</dd></div>
              {o.deliveryMethod === "nova_poshta" && <a href="https://novaposhta.ua/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-primary">Кабінет Нової Пошти <ExternalLink className="h-3 w-3" /></a>}
            </dl>
          </Panel>
          {o.updatedAt && <p className="px-1 text-[11px] text-muted-foreground">Оновлено {dateTime(o.updatedAt)}</p>}
        </div>
      </div>
    </div>
  );
}
