import { Link } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useCart, type CartItem } from "@/lib/cart";
import { ON_ORDER_TERM, isOnOrder, uah, plural } from "@/lib/format";
import { ProductImage } from "./product-image";

export function QtyStepper({ value, onChange, size = "sm" }: { value: number; onChange: (n: number) => void; size?: "sm" | "lg" }) {
  const h = size === "lg" ? "h-12" : "h-9";
  return (
    <div className={`inline-flex items-center rounded-full border border-border bg-card ${h}`}>
      <button type="button" aria-label="Менше" data-testid="button-qty-minus" onClick={() => onChange(value - 1)} disabled={value <= 1} className="grid h-full aspect-square place-items-center rounded-full transition hover:bg-muted active:scale-90 disabled:opacity-30"><Minus className="h-3.5 w-3.5" /></button>
      <span className="min-w-8 text-center text-sm font-bold tabular" data-testid="text-qty">{value}</span>
      <button type="button" aria-label="Більше" data-testid="button-qty-plus" onClick={() => onChange(value + 1)} className="grid h-full aspect-square place-items-center rounded-full transition hover:bg-muted active:scale-90"><Plus className="h-3.5 w-3.5" /></button>
    </div>
  );
}

export function CartLine({ item, onNavigate }: { item: CartItem; onNavigate?: () => void }) {
  const { setQty, remove } = useCart();
  return (
    <motion.li layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30, height: 0 }} className="flex gap-3 py-3" data-testid={`row-cart-${item.productId}`}>
      <Link href={`/product/${item.productId}`} onClick={onNavigate} className="shrink-0"><ProductImage src={item.imageUrl} alt={item.name} className="h-20 w-20 rounded-2xl" /></Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <Link href={`/product/${item.productId}`} onClick={onNavigate} className="line-clamp-2 text-sm font-semibold leading-snug hover:text-primary">{item.name}</Link>
        <span className="text-[11px] text-muted-foreground">Код {item.sku}</span>
        {isOnOrder(item.deliveryDays) && <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[hsl(30_70%_32%)]" data-testid={`text-cart-on-order-${item.productId}`}><Clock className="h-3 w-3" />Під замовлення · доставка {ON_ORDER_TERM}</span>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <QtyStepper value={item.quantity} onChange={(n) => setQty(item.productId, n)} />
          <div className="text-right">
            <div className="font-display text-sm font-bold tabular">{uah(item.price * item.quantity)}</div>
            <button type="button" onClick={() => remove(item.productId)} data-testid={`button-remove-${item.productId}`} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" />прибрати</button>
          </div>
        </div>
      </div>
    </motion.li>
  );
}

export function CartDrawer() {
  const { items, open, setOpen, total, count } = useCart();
  const close = () => setOpen(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 border-l-0 bg-background p-0 sm:max-w-md [&>button]:hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <SheetTitle className="font-display text-xl">Кошик</SheetTitle>
            <SheetDescription className="text-xs">{count} {plural(count, "товар", "товари", "товарів")}</SheetDescription>
          </div>
          <button type="button" onClick={close} data-testid="button-close-cart" className="grid h-10 w-10 place-items-center rounded-full bg-muted hover:bg-border"><X className="h-4 w-4" /></button>
        </div>
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <img src={`${import.meta.env.BASE_URL}chick.png`} alt="" className="h-36 w-36 animate-floaty object-contain" />
            <p className="font-display text-lg font-semibold">Тут поки тихо</p>
            <p className="text-sm text-muted-foreground">Додайте щось корисне для малечі — кошик збережеться, навіть якщо закриєте вкладку.</p>
            <Link href="/catalog" onClick={close} className="rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background" data-testid="link-drawer-catalog">До каталогу</Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-border overflow-y-auto px-5"><AnimatePresence initial={false}>{items.map((i) => <CartLine key={i.productId} item={i} onNavigate={close} />)}</AnimatePresence></ul>
            <div className="space-y-3 border-t border-border bg-card px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
              <div className="flex items-baseline justify-between"><span className="text-sm text-muted-foreground">Разом</span><span className="font-display text-2xl font-bold tabular" data-testid="text-drawer-total">{uah(total)}</span></div>
              <Link href="/checkout" onClick={close} data-testid="link-drawer-checkout" className="flex h-14 items-center justify-center gap-2 rounded-full bg-primary text-base font-bold text-primary-foreground transition active:scale-[.98]"><ShoppingBag className="h-5 w-5" />Оформити замовлення</Link>
              <Link href="/cart" onClick={close} className="block text-center text-sm font-semibold text-muted-foreground underline-offset-4 hover:underline" data-testid="link-drawer-cart">Переглянути кошик</Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
