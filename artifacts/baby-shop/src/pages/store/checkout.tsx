import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Building2, Home, Loader2, Lock, Mailbox, Truck, Wallet, CreditCard } from "lucide-react";
import { useCreateOrder, getGetStorefrontHighlightsQueryKey, type DeliveryMethod, type PaymentMethod } from "@workspace/api-client-react";
import { useCart } from "@/lib/cart";
import { ProductImage } from "@/components/store/product-image";
import { StateBlock } from "@/components/store/store-layout";
import { apiError, formatPhoneMask, phoneDigits, uah } from "@/lib/format";
import { cn } from "@/lib/utils";

const DELIVERY: { v: DeliveryMethod; l: string; d: string; icon: typeof Truck; addr: string }[] = [
  { v: "nova_poshta", l: "Нова Пошта", d: "1–2 дні", icon: Truck, addr: "Номер відділення або поштомату" },
  { v: "ukrposhta", l: "Укрпошта", d: "3–5 днів, дешевше", icon: Mailbox, addr: "Індекс і адреса відділення" },
  { v: "courier", l: "Кур'єр", d: "До дверей", icon: Home, addr: "Вулиця, будинок, квартира" },
  { v: "pickup", l: "Самовивіз", d: "Безкоштовно", icon: Building2, addr: "" },
];
const PAYMENT: { v: PaymentMethod; l: string; d: string; icon: typeof Wallet }[] = [
  { v: "cod", l: "Накладений платіж", d: "Оплата при отриманні", icon: Wallet },
  { v: "card_transfer", l: "Оплата на карту", d: "Реквізити надішлемо після дзвінка", icon: CreditCard },
];

const inputCls = "h-12 w-full rounded-2xl border border-border bg-card px-4 text-base outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15";

export default function CheckoutPage() {
  const { items, total, clear } = useCart();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const create = useCreateOrder();
  const [f, setF] = useState({ name: "", phone: "+380", email: "", city: "", delivery: "nova_poshta" as DeliveryMethod, address: "", payment: "cod" as PaymentMethod, comment: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f, v: string) => { setF((p) => ({ ...p, [k]: v })); setErrors((e) => ({ ...e, [k]: "" })); };

  if (items.length === 0 && !create.isSuccess) return <StateBlock title="Кошик порожній" text="Спершу оберіть щось у каталозі." action={<Link href="/catalog" className="rounded-full bg-primary px-7 py-3.5 font-bold text-primary-foreground">До каталогу</Link>} />;

  const deliv = DELIVERY.find((d) => d.v === f.delivery)!;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (f.name.trim().length < 2) er.name = "Вкажіть ім'я та прізвище";
    if (phoneDigits(f.phone).length !== 12) er.phone = "Номер у форматі +380 XX XXX XX XX";
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) er.email = "Перевірте email";
    if (f.city.trim().length < 2) er.city = "Вкажіть місто";
    if (f.delivery !== "pickup" && !f.address.trim()) er.address = "Вкажіть, куди доставити";
    setErrors(er);
    if (Object.keys(er).length) { document.querySelector<HTMLElement>(`[data-field="${Object.keys(er)[0]}"]`)?.focus(); return; }
    create.mutate({ data: {
      customerName: f.name.trim(), phone: "+" + phoneDigits(f.phone), email: f.email.trim() || undefined, city: f.city.trim(),
      deliveryMethod: f.delivery, deliveryAddress: f.address.trim() || undefined, paymentMethod: f.payment, comment: f.comment.trim() || undefined,
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    } }, {
      onSuccess: (order) => {
        sessionStorage.setItem("order:" + order.number, JSON.stringify(order));
        clear();
        qc.invalidateQueries({ queryKey: getGetStorefrontHighlightsQueryKey() });
        setLocation(`/order/${encodeURIComponent(order.number)}`);
      },
    });
  };

  const Err = ({ k }: { k: string }) => errors[k] ? <p className="mt-1 text-xs font-semibold text-destructive">{errors[k]}</p> : null;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Оформлення</h1>
      <p className="mt-1 text-sm text-muted-foreground">Без реєстрації. Ми зателефонуємо, щоб підтвердити.</p>
      <form onSubmit={submit} noValidate className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="rounded-[1.6rem] border border-card-border bg-card p-5 sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold"><span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs text-primary-foreground">1</span>Отримувач</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><input data-field="name" className={cn(inputCls, errors.name && "border-destructive")} placeholder="Ім'я та прізвище" autoComplete="name" value={f.name} onChange={(e) => set("name", e.target.value)} data-testid="input-name" /><Err k="name" /></div>
              <div><input data-field="phone" className={cn(inputCls, "tabular", errors.phone && "border-destructive")} type="tel" inputMode="tel" autoComplete="tel" value={f.phone} onChange={(e) => set("phone", formatPhoneMask(e.target.value))} onFocus={(e) => { if (!e.target.value) set("phone", "+380"); }} data-testid="input-phone" /><Err k="phone" /></div>
              <div><input data-field="email" className={cn(inputCls, errors.email && "border-destructive")} type="email" placeholder="Email (необов'язково)" autoComplete="email" value={f.email} onChange={(e) => set("email", e.target.value)} data-testid="input-email" /><Err k="email" /></div>
            </div>
          </section>
          <section className="rounded-[1.6rem] border border-card-border bg-card p-5 sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold"><span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs text-primary-foreground">2</span>Доставка</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DELIVERY.map((d) => (
                <button key={d.v} type="button" onClick={() => set("delivery", d.v)} data-testid={`option-delivery-${d.v}`} className={cn("flex flex-col items-start gap-1 rounded-2xl border-2 p-3 text-left transition active:scale-[.97]", f.delivery === d.v ? "border-primary bg-primary/5" : "border-border hover:border-foreground/30")}>
                  <d.icon className={cn("h-5 w-5", f.delivery === d.v ? "text-primary" : "text-muted-foreground")} />
                  <span className="text-sm font-bold">{d.l}</span><span className="text-[11px] text-muted-foreground">{d.d}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div><input data-field="city" className={cn(inputCls, errors.city && "border-destructive")} placeholder="Місто" autoComplete="address-level2" value={f.city} onChange={(e) => set("city", e.target.value)} data-testid="input-city" /><Err k="city" /></div>
              {f.delivery !== "pickup" ? <div><input data-field="address" className={cn(inputCls, errors.address && "border-destructive")} placeholder={deliv.addr} value={f.address} onChange={(e) => set("address", e.target.value)} data-testid="input-address" /><Err k="address" /></div>
                : <div className="flex items-center rounded-2xl bg-secondary/40 px-4 text-sm">Адресу самовивозу повідомимо під час дзвінка</div>}
            </div>
          </section>
          <section className="rounded-[1.6rem] border border-card-border bg-card p-5 sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold"><span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs text-primary-foreground">3</span>Оплата</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {PAYMENT.map((p) => (
                <button key={p.v} type="button" onClick={() => set("payment", p.v)} data-testid={`option-payment-${p.v}`} className={cn("flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition", f.payment === p.v ? "border-primary bg-primary/5" : "border-border hover:border-foreground/30")}>
                  <p.icon className={cn("h-6 w-6 shrink-0", f.payment === p.v ? "text-primary" : "text-muted-foreground")} />
                  <span><span className="block text-sm font-bold">{p.l}</span><span className="text-xs text-muted-foreground">{p.d}</span></span>
                </button>
              ))}
            </div>
            <textarea className="mt-3 min-h-24 w-full rounded-2xl border border-border bg-card p-4 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/15" placeholder="Коментар (наприклад, зручний час для дзвінка)" value={f.comment} onChange={(e) => set("comment", e.target.value)} data-testid="input-comment" />
          </section>
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[1.6rem] bg-foreground p-5 text-background sm:p-6">
            <h2 className="mb-3 font-display text-lg font-bold">Ваше замовлення</h2>
            <ul className="max-h-72 space-y-3 overflow-y-auto pr-1">
              {items.map((i) => (
                <li key={i.productId} className="flex gap-3">
                  <ProductImage src={i.imageUrl} alt={i.name} className="h-14 w-14 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1"><div className="line-clamp-2 text-xs font-medium">{i.name}</div><div className="text-[11px] text-background/60 tabular">{i.quantity} × {uah(i.price)}</div></div>
                  <div className="text-sm font-bold tabular">{uah(i.price * i.quantity)}</div>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-baseline justify-between border-t border-background/15 pt-4"><span>До сплати</span><span className="font-display text-3xl font-bold tabular" data-testid="text-checkout-total">{uah(total)}</span></div>
            {create.isError && (
              <div className="mt-4 flex gap-2 rounded-2xl bg-primary/20 p-3 text-sm" data-testid="text-order-error"><AlertCircle className="h-5 w-5 shrink-0 text-secondary" /><span>{apiError(create.error).message}</span></div>
            )}
            <button type="submit" disabled={create.isPending} data-testid="button-place-order" className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary text-base font-bold text-primary-foreground transition active:scale-[.98] disabled:opacity-70">
              {create.isPending ? <><Loader2 className="h-5 w-5 animate-spin" />Надсилаємо...</> : "Підтвердити замовлення"}
            </button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-background/60"><Lock className="h-3 w-3" />Дані потрібні лише для доставки</p>
          </div>
        </aside>
      </form>
    </div>
  );
}
