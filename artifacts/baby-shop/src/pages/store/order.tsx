import { useMemo } from "react";
import { Link, useParams } from "wouter";
import { motion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import type { OrderDetail } from "@workspace/api-client-react";
import { OrderSummary } from "@/components/store/order-view";
import { useToast } from "@/hooks/use-toast";

export default function OrderPage() {
  const { number } = useParams<{ number: string }>();
  const num = decodeURIComponent(number ?? "");
  const { toast } = useToast();
  const order = useMemo<OrderDetail | null>(() => { try { return JSON.parse(sessionStorage.getItem("order:" + num) || "null"); } catch { return null; } }, [num]);
  return (
    <div className="mx-auto max-w-2xl px-4 pt-10">
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16 }} className="relative mx-auto mb-6 grid h-24 w-24 place-items-center rounded-full bg-primary text-primary-foreground">
        <Check className="h-12 w-12" strokeWidth={3} />
        {Array.from({ length: 10 }).map((_, i) => (
          <motion.span key={i} initial={{ x: 0, y: 0, opacity: 1 }} animate={{ x: Math.cos((i / 10) * Math.PI * 2) * 80, y: Math.sin((i / 10) * Math.PI * 2) * 80, opacity: 0 }} transition={{ duration: 0.9, delay: 0.15 }}
            className={"absolute h-3 w-3 rounded-full " + (i % 2 ? "bg-secondary" : "bg-accent-foreground")} />
        ))}
      </motion.div>
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Дякуємо! Замовлення прийнято</h1>
        <p className="mt-2 text-muted-foreground">Ми зателефонуємо найближчим часом, щоб усе підтвердити.</p>
        <button type="button" onClick={() => { navigator.clipboard?.writeText(num); toast({ title: "Номер скопійовано" }); }} data-testid="button-copy-order-number" className="mt-5 inline-flex items-center gap-2 rounded-full border-2 border-dashed border-primary px-5 py-2.5 font-display text-xl font-bold tabular">
          № {num} <Copy className="h-4 w-4 text-primary" />
        </button>
        <p className="mt-2 text-xs text-muted-foreground">Збережіть номер — за ним і телефоном можна відстежити замовлення</p>
      </div>
      {order ? (
        <div className="mt-8 rounded-[1.6rem] border border-card-border bg-card p-5 sm:p-6"><OrderSummary order={order} /></div>
      ) : (
        <div className="mt-8 rounded-[1.6rem] bg-muted/60 p-6 text-center text-sm">Деталі замовлення можна переглянути на сторінці відстеження.</div>
      )}
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Link href={`/track?number=${encodeURIComponent(num)}`} className="flex h-12 items-center justify-center rounded-full border-2 border-foreground px-6 font-bold" data-testid="link-track-order">Відстежити</Link>
        <Link href="/catalog" className="flex h-12 items-center justify-center rounded-full bg-foreground px-6 font-bold text-background" data-testid="link-continue">Продовжити покупки</Link>
      </div>
    </div>
  );
}
