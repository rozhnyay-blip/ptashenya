import { useMemo, useState } from "react";
import { useSearch } from "wouter";
import { Loader2, Search } from "lucide-react";
import { useLookupOrder, getLookupOrderQueryKey, type LookupOrderParams } from "@workspace/api-client-react";
import { OrderSummary } from "@/components/store/order-view";
import { apiError, formatPhoneMask, phoneDigits } from "@/lib/format";

export default function TrackPage() {
  const search = useSearch();
  const initial = useMemo(() => new URLSearchParams(search).get("number") ?? "", [search]);
  const [number, setNumber] = useState(initial);
  const [phone, setPhone] = useState("+380");
  const [params, setParams] = useState<LookupOrderParams | null>(null);
  const q = useLookupOrder(params ?? { number: "", phone: "" }, { query: { enabled: !!params, retry: false, queryKey: getLookupOrderQueryKey(params ?? undefined) } });
  const err = q.isError ? apiError(q.error) : null;
  return (
    <div className="mx-auto max-w-2xl px-4 pt-10">
      <div className="text-center">
        <div className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">статус посилки</div>
        <h1 className="font-display text-3xl font-bold sm:text-5xl">Де моє замовлення?</h1>
        <p className="mt-2 text-muted-foreground">Номер замовлення і телефон, вказаний при оформленні.</p>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (number.trim() && phoneDigits(phone).length >= 10) setParams({ number: number.trim(), phone: "+" + phoneDigits(phone) }); }} className="mt-8 grid gap-3 rounded-[1.6rem] border border-card-border bg-card p-4 sm:grid-cols-[1fr_1fr_auto]">
        <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Номер замовлення" data-testid="input-track-number" className="h-12 rounded-2xl border border-border bg-background px-4 outline-none focus:border-primary" />
        <input value={phone} onChange={(e) => setPhone(formatPhoneMask(e.target.value))} type="tel" inputMode="tel" data-testid="input-track-phone" className="h-12 rounded-2xl border border-border bg-background px-4 outline-none tabular focus:border-primary" />
        <button type="submit" data-testid="button-track" className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-6 font-bold text-primary-foreground">{q.isFetching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}Знайти</button>
      </form>
      <div className="mt-6">
        {q.isFetching && !q.data && <div className="h-64 animate-pulse rounded-[1.6rem] bg-muted" />}
        {err && <div className="rounded-[1.6rem] bg-primary/10 p-6 text-center" data-testid="text-track-error"><div className="font-display text-lg font-bold">Не знайшли такого замовлення</div><p className="mt-1 text-sm text-muted-foreground">{err.status === 404 ? "Перевірте номер і телефон — вони мають збігатися з тими, що в замовленні." : err.message}</p></div>}
        {q.data && <div className="rounded-[1.6rem] border border-card-border bg-card p-5 sm:p-6"><div className="mb-4 font-display text-xl font-bold">№ {q.data.number}</div><OrderSummary order={q.data} /></div>}
      </div>
    </div>
  );
}
