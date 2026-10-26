import { Link } from "wouter";
import { AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useCart } from "@/lib/cart";
import { CartLine } from "@/components/store/cart-drawer";
import { StateBlock } from "@/components/store/store-layout";
import { plural, uah } from "@/lib/format";

export default function CartPage() {
  const { items, total, count, clear } = useCart();
  if (items.length === 0) return <StateBlock title="Кошик порожній" text="Тут з'являться товари, які ви оберете. Почнімо з каталогу?" action={<Link href="/catalog" className="rounded-full bg-primary px-7 py-3.5 font-bold text-primary-foreground" data-testid="link-empty-catalog">До каталогу</Link>} />;
  return (
    <div className="mx-auto max-w-5xl px-4 pt-8">
      <div className="mb-6 flex items-end justify-between">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Кошик</h1>
        <button type="button" onClick={clear} className="text-sm font-semibold text-muted-foreground hover:text-destructive" data-testid="button-clear-cart">Очистити</button>
      </div>
      <div className="grid gap-6 md:grid-cols-[1fr_340px]">
        <ul className="divide-y divide-border rounded-[1.6rem] border border-card-border bg-card px-4 sm:px-6"><AnimatePresence initial={false}>{items.map((i) => <CartLine key={i.productId} item={i} />)}</AnimatePresence></ul>
        <div className="md:sticky md:top-24 md:self-start">
          <div className="space-y-4 rounded-[1.6rem] bg-foreground p-6 text-background">
            <div className="flex justify-between text-sm text-background/70"><span>{count} {plural(count, "товар", "товари", "товарів")}</span><span className="tabular">{uah(total)}</span></div>
            <div className="flex justify-between text-sm text-background/70"><span>Доставка</span><span>за тарифами перевізника</span></div>
            <div className="flex items-baseline justify-between border-t border-background/15 pt-4"><span>Разом</span><span className="font-display text-3xl font-bold tabular" data-testid="text-cart-total">{uah(total)}</span></div>
            <Link href="/checkout" className="flex h-14 items-center justify-center gap-2 rounded-full bg-primary font-bold text-primary-foreground" data-testid="link-checkout">Оформити <ArrowRight className="h-5 w-5" /></Link>
          </div>
          <Link href="/catalog" className="mt-3 block text-center text-sm font-semibold text-muted-foreground hover:text-foreground">Продовжити покупки</Link>
        </div>
      </div>
    </div>
  );
}
