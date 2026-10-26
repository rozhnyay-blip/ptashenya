import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { Home, LayoutGrid, Search, ShoppingBag, Truck, Phone } from "lucide-react";
import { useCart } from "@/lib/cart";
import { Logo } from "./logo";
import { CartDrawer } from "./cart-drawer";
import { BRAND } from "@/lib/format";
import { cn } from "@/lib/utils";

function CartButton({ className }: { className?: string }) {
  const { count, bump, setOpen } = useCart();
  const controls = useAnimationControls();
  useEffect(() => { if (bump) controls.start({ scale: [1, 1.35, 0.9, 1.1, 1], rotate: [0, -12, 10, -4, 0], transition: { duration: 0.6, delay: 0.6 } }); }, [bump, controls]);
  return (
    <button type="button" onClick={() => setOpen(true)} data-testid="button-open-cart" aria-label="Кошик" className={cn("relative grid h-11 w-11 place-items-center rounded-full bg-foreground text-background transition active:scale-90", className)}>
      <motion.span animate={controls} data-cart-target className="grid place-items-center"><ShoppingBag className="h-5 w-5" /></motion.span>
      <AnimatePresence>
        {count > 0 && (
          <motion.span key={count} initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 500, damping: 15 }}
            className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground ring-2 ring-background tabular" data-testid="badge-cart-count">{count > 99 ? "99+" : count}</motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

function HeaderSearch() {
  const [, setLocation] = useLocation();
  const [q, setQ] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); setLocation(q.trim() ? `/catalog?search=${encodeURIComponent(q.trim())}` : "/catalog"); }} className="relative w-full">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="Пляшечка, горщик, ванночка..." data-testid="input-header-search"
        className="h-11 w-full rounded-full border border-border bg-card pl-11 pr-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15" />
    </form>
  );
}

export function StoreLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { setOpen, count } = useCart();
  useEffect(() => { window.scrollTo({ top: 0 }); }, [location]);
  const navCls = (active: boolean) => cn("rounded-full px-4 py-2 text-sm font-semibold transition", active ? "bg-foreground text-background" : "hover:bg-muted");
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <div className="bg-foreground text-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2 text-[12px] font-medium">
          <span className="flex items-center gap-2"><Truck className="h-3.5 w-3.5 text-secondary" />Відправляємо щодня Новою Поштою та Укрпоштою</span>
          <Link href="/track" className="hidden underline-offset-4 hover:underline sm:inline" data-testid="link-topbar-track">Де моє замовлення?</Link>
        </div>
      </div>
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 md:gap-6">
          <Link href="/" data-testid="link-home" className="shrink-0"><Logo /></Link>
          <nav className="hidden items-center gap-1 md:flex">
            <Link href="/catalog" className={navCls(location.startsWith("/catalog"))} data-testid="link-nav-catalog">Каталог</Link>
            <Link href="/catalog?onlyNew=1" className={navCls(false)} data-testid="link-nav-new">Новинки</Link>
            <Link href="/track" className={navCls(location === "/track")} data-testid="link-nav-track">Відстежити</Link>
          </nav>
          <div className="hidden flex-1 md:block"><HeaderSearch /></div>
          <div className="ml-auto md:ml-0"><CartButton /></div>
        </div>
        <div className="px-4 pb-3 md:hidden"><HeaderSearch /></div>
      </header>
      <AnimatePresence mode="wait">
        <motion.main key={location} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="flex-1 pb-24 md:pb-0">
          {children}
        </motion.main>
      </AnimatePresence>
      <footer className="mt-16 bg-foreground text-background">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="space-y-4">
            <Logo light />
            <p className="max-w-sm text-sm text-background/70">Усе для перших років — від пляшечки до першої ланчбокс-коробки. Тисячі товарів зі складу, свіжі залишки щодня.</p>
          </div>
          <div className="space-y-3 text-sm">
            <div className="font-display text-xs uppercase tracking-widest text-secondary">Покупцям</div>
            <Link href="/catalog" className="block text-background/80 hover:text-background">Каталог</Link>
            <Link href="/cart" className="block text-background/80 hover:text-background">Кошик</Link>
            <Link href="/track" className="block text-background/80 hover:text-background">Відстежити замовлення</Link>
          </div>
          <div className="space-y-3 text-sm">
            <div className="font-display text-xs uppercase tracking-widest text-secondary">Доставка й оплата</div>
            <p className="text-background/80">Нова Пошта, Укрпошта, кур'єр або самовивіз. Оплата при отриманні чи на карту.</p>
            <p className="flex items-center gap-2 text-background/80"><Phone className="h-4 w-4" />Передзвонимо після замовлення</p>
          </div>
        </div>
        <div className="border-t border-background/10">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 text-xs text-background/50">
            <span>© {new Date().getFullYear()} {BRAND}</span>
            <Link href="/admin" className="opacity-60 hover:opacity-100" data-testid="link-footer-admin">для власника</Link>
          </div>
        </div>
      </footer>
      {/* Mobile tab bar */}
      <nav className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex items-center justify-around rounded-full border border-border bg-card/95 p-1.5 shadow-[0_12px_40px_-12px_hsl(285_40%_20%/0.4)] backdrop-blur-xl md:hidden">
        {[{ href: "/", icon: Home, label: "Головна", on: location === "/" }, { href: "/catalog", icon: LayoutGrid, label: "Каталог", on: location.startsWith("/catalog") }, { href: "/track", icon: Truck, label: "Замовлення", on: location === "/track" }].map((t) => (
          <Link key={t.href} href={t.href} data-testid={`tab-${t.label}`} className={cn("flex flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 text-[10px] font-semibold transition", t.on ? "bg-foreground text-background" : "text-muted-foreground")}>
            <t.icon className="h-5 w-5" />{t.label}
          </Link>
        ))}
        <button type="button" onClick={() => setOpen(true)} data-testid="tab-cart" className="relative flex flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 text-[10px] font-semibold text-primary">
          <span data-cart-target><ShoppingBag className="h-5 w-5" /></span>Кошик
          {count > 0 && <span className="absolute right-[22%] top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] text-primary-foreground tabular">{count}</span>}
        </button>
      </nav>
      <CartDrawer />
    </div>
  );
}

export function StateBlock({ title, text, action, image = true }: { title: string; text: string; action?: ReactNode; image?: boolean }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      {image && <img src={`${import.meta.env.BASE_URL}chick.png`} alt="" className="h-40 w-40 animate-floaty object-contain" />}
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      <p className="text-muted-foreground">{text}</p>
      {action}
    </div>
  );
}
