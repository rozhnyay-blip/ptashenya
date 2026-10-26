import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, PackageCheck, RefreshCw, ShieldCheck, Truck } from "lucide-react";
import { useGetStorefrontHighlights, useListCategories, type Product } from "@workspace/api-client-react";
import { ProductCard, ProductCardSkeleton } from "@/components/store/product-card";
import { StateBlock } from "@/components/store/store-layout";
import { num, relTime } from "@/lib/format";
import { siteJsonLd, useSeo } from "@/lib/seo";

const TILE_COLORS = ["bg-secondary", "bg-accent", "bg-[hsl(160_45%_88%)]", "bg-[hsl(14_90%_90%)]", "bg-[hsl(200_60%_90%)]", "bg-muted"];

function Shelf({ title, kicker, items, href, loading }: { title: string; kicker: string; items?: Product[]; href: string; loading: boolean }) {
  if (!loading && (!items || items.length === 0)) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 pt-14">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-primary">{kicker}</div>
          <h2 className="font-display text-2xl font-bold sm:text-3xl">{title}</h2>
        </div>
        <Link href={href} className="group flex shrink-0 items-center gap-1 text-sm font-semibold" data-testid={`link-shelf-${kicker}`}>Усі <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></Link>
      </div>
      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible lg:grid-cols-5">
        {loading ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="w-[46%] shrink-0 sm:w-auto"><ProductCardSkeleton /></div>)
          : items!.slice(0, 10).map((p, i) => <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-auto"><ProductCard product={p} index={i} /></div>)}
      </div>
    </section>
  );
}

export default function HomePage() {
  const { data, isLoading, isError, refetch } = useGetStorefrontHighlights();
  const { data: cats } = useListCategories();
  useSeo({ path: "/", jsonLd: siteJsonLd() });
  const top = (data?.topCategories?.length ? data.topCategories : (cats ?? []).filter((c) => c.parentId === null)).slice(0, 8);
  const empty = !isLoading && data && data.stats.totalProducts === 0;
  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl items-center gap-6 px-4 pb-6 pt-8 md:grid-cols-[1.1fr_1fr] md:pt-14">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-primary" /></span>
              {data?.stats.lastSyncAt ? <>Залишки оновлено {relTime(data.stats.lastSyncAt)}</> : <>Склад на зв'язку щодня</>}
            </div>
            <h1 className="font-display text-[2.6rem] font-extrabold leading-[0.95] sm:text-6xl lg:text-7xl">
              Для малечі.<br /><span className="text-primary">Без зайвих</span><br />кліків.
            </h1>
            <p className="mt-5 max-w-md text-base text-muted-foreground sm:text-lg">Пляшечки, горщики, ванночки, слинявчики та іграшки — {data ? num(data.stats.totalProducts) : "тисячі"} товарів, що реально є на складі. Замовлення за хвилину, навіть однією рукою.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/catalog" className="group inline-flex h-14 items-center gap-2 rounded-full bg-primary px-7 text-base font-bold text-primary-foreground shadow-[0_14px_30px_-12px_hsl(14_88%_45%/.6)] transition active:scale-95" data-testid="link-hero-catalog">До каталогу <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" /></Link>
              <Link href="/catalog?onlyNew=1" className="inline-flex h-14 items-center rounded-full border-2 border-foreground px-7 text-base font-bold transition hover:bg-foreground hover:text-background" data-testid="link-hero-new">Новинки</Link>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.1 }} className="relative mx-auto aspect-square w-full max-w-[520px]">
            <div className="blob absolute inset-[6%] bg-secondary" />
            <div className="blob absolute inset-[18%] rotate-45 bg-primary/90" />
            <img src={`${import.meta.env.BASE_URL}hero.png`} alt="Пляшечка, брязкальце та іграшки" className="animate-floaty relative h-full w-full object-contain drop-shadow-[0_30px_30px_hsl(285_40%_20%/.25)]" />
            <div className="absolute bottom-[8%] left-0 rotate-[-6deg] rounded-2xl bg-foreground px-4 py-3 text-background shadow-xl">
              {data && data.stats.ordersDelivered >= 10 ? (
                <>
                  <div className="font-display text-2xl font-bold tabular">{num(data.stats.ordersDelivered)}</div>
                  <div className="text-[11px] text-background/70">замовлень уже вдома</div>
                </>
              ) : (
                <>
                  <div className="font-display text-2xl font-bold tabular">{data ? num(data.stats.totalProducts) : "—"}</div>
                  <div className="text-[11px] text-background/70">товарів чекають на складі</div>
                </>
              )}
            </div>
          </motion.div>
        </div>
        <div className="overflow-hidden border-y border-border bg-card py-3">
          <div className="animate-marquee flex w-max gap-10 whitespace-nowrap font-display text-sm font-semibold uppercase tracking-wider">
            {Array.from({ length: 2 }).flatMap((_, k) => ["пляшечки", "горщики", "ванночки", "слинявчики", "зубні щітки", "ланчбокси", "гігієна", "іграшки", "соски", "посуд"].map((w, i) => (
              <span key={k + "-" + i} className="flex items-center gap-10">{w}<span className="h-2 w-2 rounded-full bg-primary" /></span>
            )))}
          </div>
        </div>
      </section>

      {isError && <StateBlock title="Не вдалося завантажити" text="Перевірте з'єднання — і спробуємо ще раз." action={<button onClick={() => refetch()} className="rounded-full bg-foreground px-6 py-3 font-semibold text-background" data-testid="button-retry-home">Спробувати знову</button>} />}
      {empty && <StateBlock title="Каталог оновлюється" text="Саме зараз ми завантажуємо товари зі складу. Загляньте трохи згодом — тут буде тисяча дрібниць для малечі." />}

      {/* CATEGORIES */}
      {(isLoading || top.length > 0) && (
        <section className="mx-auto max-w-7xl px-4 pt-12">
          <div className="mb-5 flex items-end justify-between">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Що шукаємо сьогодні?</h2>
            <Link href="/catalog" className="text-sm font-semibold underline-offset-4 hover:underline" data-testid="link-all-categories">Усі категорії</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {isLoading ? Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-[1.4rem] bg-muted sm:h-40" />)
              : top.map((c, i) => (
                <motion.div key={c.id} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} className={i === 0 ? "col-span-2 row-span-2" : ""}>
                  <Link href={`/catalog/${c.id}`} data-testid={`link-category-${c.id}`} className={`group relative flex h-full min-h-32 flex-col justify-between overflow-hidden rounded-[1.4rem] p-4 transition hover:-translate-y-1 sm:min-h-40 ${TILE_COLORS[i % TILE_COLORS.length]}`}>
                    <div className="relative z-10">
                      <div className={`font-display font-bold leading-tight ${i === 0 ? "text-2xl sm:text-3xl" : "text-sm sm:text-base"} line-clamp-2`}>{c.name}</div>
                      <div className="mt-1 text-xs font-semibold opacity-60 tabular">{num(c.productCount)} товарів</div>
                    </div>
                    {c.imageUrl && <img src={c.imageUrl} alt="" loading="lazy" className={`absolute bottom-0 right-0 object-contain mix-blend-multiply transition duration-500 group-hover:scale-110 group-hover:-rotate-3 ${i === 0 ? "h-2/3 w-2/3" : "h-20 w-20 sm:h-24 sm:w-24"}`} />}
                    <ArrowUpRight className="relative z-10 h-5 w-5 opacity-50 transition group-hover:opacity-100" />
                  </Link>
                </motion.div>
              ))}
          </div>
        </section>
      )}

      <Shelf kicker="щойно зі складу" title="Новинки" items={data?.newArrivals} href="/catalog?sort=newest" loading={isLoading} />
      <Shelf kicker="батьки обирають" title="Хіти продажу" items={data?.bestsellers} href="/catalog?sort=popular" loading={isLoading} />

      {/* Promises */}
      <section className="mx-auto max-w-7xl px-4 pt-16">
        <div className="grid gap-3 rounded-[2rem] bg-foreground p-6 text-background sm:p-10 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
          <div>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Як у сусідній крамниці, тільки з величезним складом</h2>
          </div>
          {[{ i: RefreshCw, t: "Живі залишки", d: "Щодня звіряємось зі складом. Немає в наявності — не продаємо." }, { i: Truck, t: "Швидка відправка", d: "Нова Пошта, Укрпошта, кур'єр або самовивіз." }, { i: ShieldCheck, t: "Оплата при отриманні", d: "Огляньте посилку, а тоді платіть." }].map((x) => (
            <div key={x.t} className="rounded-2xl bg-background/5 p-5">
              <x.i className="mb-3 h-6 w-6 text-secondary" />
              <div className="font-display text-base font-semibold">{x.t}</div>
              <p className="mt-1 text-sm text-background/70">{x.d}</p>
            </div>
          ))}
        </div>
      </section>

      <Shelf kicker="ми радимо" title="Обране для вас" items={data?.featured} href="/catalog" loading={isLoading} />

      {/* Stats */}
      {data && data.stats.totalProducts > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-16">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[{ v: num(data.stats.totalProducts), l: "товарів у каталозі" }, { v: num(data.stats.totalCategories), l: "категорій" }, data.stats.ordersDelivered >= 10 ? { v: num(data.stats.ordersDelivered), l: "доставлених замовлень" } : { v: "щодня", l: "оновлюємо залишки" }, { v: relTime(data.stats.lastSyncAt), l: "останнє оновлення складу" }].map((s, i) => (
              <motion.div key={s.l} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="rounded-[1.4rem] border border-border bg-card p-5">
                <div className="font-display text-2xl font-bold text-primary tabular sm:text-4xl">{s.v}</div>
                <div className="mt-1 text-sm text-muted-foreground">{s.l}</div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 pt-16">
        <div className="relative overflow-hidden rounded-[2rem] bg-secondary p-8 sm:p-12">
          <img src={`${import.meta.env.BASE_URL}chick.png`} alt="" className="absolute -bottom-6 right-0 h-44 w-44 object-contain sm:h-64 sm:w-64" />
          <div className="relative max-w-lg">
            <PackageCheck className="mb-3 h-8 w-8" />
            <h2 className="font-display text-2xl font-bold sm:text-4xl">Вже замовили? Подивіться, де посилка</h2>
            <p className="mt-2 text-sm sm:text-base">Номер замовлення і телефон — і ми покажемо статус.</p>
            <Link href="/track" className="mt-5 inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-6 font-bold text-background" data-testid="link-home-track">Відстежити <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>
    </div>
  );
}
