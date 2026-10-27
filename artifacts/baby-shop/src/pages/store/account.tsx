import { useState } from "react";
import { Link } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Loader2, LogOut, PackagePlus, RefreshCw, Settings2, UserRound } from "lucide-react";
import {
  useClaimMyOrder,
  useGetMe,
  useListMyOrders,
  getListMyOrdersQueryKey,
  type OrderDetail,
} from "@workspace/api-client-react";
import { OrderSummary, ParcelCard } from "@/components/store/order-view";
import { ProductImage } from "@/components/store/product-image";
import { StateBlock } from "@/components/store/store-layout";
import { STATUS_LABEL, STATUS_STYLE, apiError, dateShort, formatPhoneMask, phoneDigits, uah } from "@/lib/format";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const isActive = (o: OrderDetail) => o.status !== "delivered" && o.status !== "cancelled";

function OrderCard({ order, defaultOpen }: { order: OrderDetail; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-[1.6rem] border border-card-border bg-card" data-testid={`card-my-order-${order.number}`}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 p-4 text-left sm:p-5" data-testid={`button-toggle-order-${order.number}`}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-lg font-bold tabular">№ {order.number}</span>
            <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold", STATUS_STYLE[order.status])}>{STATUS_LABEL[order.status]}</span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">{dateShort(order.createdAt)} · {order.itemsCount} шт. · <b className="text-foreground tabular">{uah(order.total)}</b></div>
        </div>
        {!open && (
          <div className="hidden -space-x-3 sm:flex">
            {order.items.slice(0, 3).map((i) => <ProductImage key={i.id} src={i.imageUrl} alt={i.name} className="h-10 w-10 rounded-xl ring-2 ring-card" />)}
          </div>
        )}
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted-foreground transition", open && "rotate-180")} />
      </button>
      <div className="px-4 pb-4 sm:px-5 sm:pb-5">
        {open ? <OrderSummary order={order} /> : isActive(order) && <ParcelCard order={order} />}
      </div>
    </div>
  );
}

function ClaimForm() {
  const qc = useQueryClient();
  const claim = useClaimMyOrder();
  const [number, setNumber] = useState("");
  const [phone, setPhone] = useState("+380");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!number.trim() || phoneDigits(phone).length < 10) { setMsg({ ok: false, text: "Вкажіть номер замовлення і телефон повністю" }); return; }
        setMsg(null);
        claim.mutate({ data: { number: number.trim(), phone: "+" + phoneDigits(phone) } }, {
          onSuccess: (o) => { setMsg({ ok: true, text: `Замовлення № ${o.number} додано` }); setNumber(""); qc.invalidateQueries({ queryKey: getListMyOrdersQueryKey() }); },
          onError: (err) => setMsg({ ok: false, text: apiError(err).message }),
        });
      }}
      className="rounded-[1.6rem] border border-dashed border-border p-4 sm:p-5"
    >
      <div className="flex items-center gap-2 font-display font-bold"><PackagePlus className="h-5 w-5 text-primary" />Не бачите своє замовлення?</div>
      <p className="mt-1 text-sm text-muted-foreground">Якщо ви оформлювали його без входу — додайте за номером і телефоном.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Номер замовлення" inputMode="numeric" data-testid="input-claim-number" className="h-11 rounded-2xl border border-border bg-background px-4 outline-none focus:border-primary" />
        <input value={phone} onChange={(e) => setPhone(formatPhoneMask(e.target.value))} type="tel" inputMode="tel" data-testid="input-claim-phone" className="h-11 rounded-2xl border border-border bg-background px-4 outline-none tabular focus:border-primary" />
        <button type="submit" disabled={claim.isPending} data-testid="button-claim" className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-foreground px-5 font-bold text-background disabled:opacity-60">{claim.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Додати</button>
      </div>
      {msg && <p className={cn("mt-2 text-sm font-semibold", msg.ok ? "text-[hsl(152_55%_30%)]" : "text-destructive")} data-testid="text-claim-result">{msg.text}</p>}
    </form>
  );
}

export default function AccountPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const me = useGetMe();
  const orders = useListMyOrders({ query: { enabled: !!isSignedIn, queryKey: getListMyOrdersQueryKey() } });

  if (!isLoaded) return <div className="mx-auto max-w-3xl px-4 pt-10"><div className="h-40 animate-pulse rounded-[1.6rem] bg-muted" /></div>;

  if (!isSignedIn) return (
    <div className="mx-auto max-w-md px-4 pt-12 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary text-primary-foreground"><UserRound className="h-8 w-8" /></div>
      <h1 className="mt-4 font-display text-3xl font-bold">Мій кабінет</h1>
      <p className="mt-2 text-muted-foreground">Увійдіть, щоб бачити всі свої замовлення і де зараз посилка.</p>
      <Link href={`/sign-in?redirect_url=${encodeURIComponent(window.location.href)}`} className="mt-6 flex h-12 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground" data-testid="link-account-sign-in">Увійти</Link>
      <Link href="/sign-up" className="mt-2 flex h-12 items-center justify-center rounded-full border-2 border-foreground font-bold" data-testid="link-account-sign-up">Створити акаунт</Link>
      <p className="mt-6 text-sm text-muted-foreground">Не хочете реєструватись? <Link href="/track" className="font-semibold text-primary underline-offset-4 hover:underline">Знайдіть замовлення за номером</Link></p>
    </div>
  );

  const name = user.firstName || user.fullName || "";
  const list = orders.data ?? [];
  const active = list.filter(isActive);
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8">
      <div className="flex flex-wrap items-center gap-4">
        {user.hasImage
          ? <img src={user.imageUrl} alt="" className="h-14 w-14 rounded-2xl object-cover" />
          : <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary font-display text-2xl text-primary-foreground">{(name[0] || user.primaryEmailAddress?.emailAddress[0] || "?").toUpperCase()}</span>}
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{name ? `Привіт, ${name}!` : "Мій кабінет"}</h1>
          <div className="truncate text-sm text-muted-foreground" data-testid="text-account-email">{user.primaryEmailAddress?.emailAddress}</div>
        </div>
        <div className="flex gap-2">
          {me.data?.isAdmin && <Link href="/admin" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-foreground px-4 text-sm font-bold text-background" data-testid="link-account-admin"><Settings2 className="h-4 w-4" />Кабінет власника</Link>}
          <button type="button" onClick={() => signOut({ redirectUrl: basePath || "/" })} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-semibold hover:bg-muted" data-testid="button-sign-out"><LogOut className="h-4 w-4" />Вийти</button>
        </div>
      </div>

      <div className="mt-8 flex items-end justify-between gap-3">
        <h2 className="font-display text-xl font-bold">Мої замовлення</h2>
        {list.length > 0 && <button type="button" onClick={() => orders.refetch()} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground" data-testid="button-refresh-orders"><RefreshCw className={cn("h-4 w-4", orders.isFetching && "animate-spin")} />Оновити</button>}
      </div>

      <div className="mt-4 space-y-4">
        {orders.isLoading && [0, 1].map((i) => <div key={i} className="h-36 animate-pulse rounded-[1.6rem] bg-muted" />)}
        {orders.isError && <div className="rounded-[1.6rem] bg-destructive/10 p-5 text-center text-sm"><b>Не вдалося завантажити замовлення.</b> <button type="button" onClick={() => orders.refetch()} className="font-semibold underline">Спробувати ще</button></div>}
        {orders.isSuccess && list.length === 0 && (
          <StateBlock title="Тут поки порожньо" text="Замовлення, оформлені після входу, з'являться тут автоматично." action={<Link href="/catalog" className="rounded-full bg-primary px-7 py-3.5 font-bold text-primary-foreground">До каталогу</Link>} />
        )}
        {list.map((o) => <OrderCard key={o.id} order={o} defaultOpen={active.length > 0 ? o.id === active[0]!.id : false} />)}
        {orders.isSuccess && <ClaimForm />}
      </div>
    </div>
  );
}
