import { useEffect, useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { Box, Loader2, MapPin, Search, Store, X } from "lucide-react";
import {
  useSearchNpCities, getSearchNpCitiesQueryKey, useSearchNpBranches, getSearchNpBranchesQueryKey,
  type NpCity, type NpBranch,
} from "@workspace/api-client-react";
import { num } from "@/lib/format";
import { cn } from "@/lib/utils";

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

const fieldCls = "flex h-12 w-full items-center gap-2 rounded-2xl border border-border bg-card px-4 transition focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15";

function Selected({ icon: Icon, title, sub, onChange, testid }: { icon: typeof MapPin; title: string; sub?: string; onChange: () => void; testid: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-primary bg-primary/5 p-3" data-testid={testid}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold leading-tight">{title}</div>
        {sub && <div className="mt-0.5 text-xs leading-snug text-muted-foreground">{sub}</div>}
      </div>
      <button type="button" onClick={onChange} className="shrink-0 rounded-full px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10" data-testid={`${testid}-change`}>Змінити</button>
    </div>
  );
}

function Status({ loading, error, empty, emptyText }: { loading: boolean; error: boolean; empty: boolean; emptyText: string }) {
  if (loading) return <div className="flex items-center gap-2 px-1 py-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Шукаємо…</div>;
  if (error) return <div className="px-1 py-3 text-sm font-semibold text-destructive">Нова Пошта зараз не відповідає. Спробуйте ще раз за хвилину.</div>;
  if (empty) return <div className="px-1 py-3 text-sm text-muted-foreground">{emptyText}</div>;
  return null;
}

export function NpCityPicker({ value, onChange, invalid }: { value: NpCity | null; onChange: (c: NpCity | null) => void; invalid?: boolean }) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const params = { q: dq };
  const { data, isFetching, isError } = useSearchNpCities(params, { query: { queryKey: getSearchNpCitiesQueryKey(params), enabled: !value && dq.length >= 2, staleTime: 5 * 60_000, placeholderData: keepPreviousData } });

  if (value) return <Selected icon={MapPin} title={value.name} sub={`${value.label} · ${num(value.branches)} відділень і поштоматів`} onChange={() => { onChange(null); setQ(""); }} testid="np-city-selected" />;
  const list = dq.length >= 2 ? data ?? [] : [];
  return (
    <div>
      <label className={cn(fieldCls, invalid && "border-destructive")}>
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input data-field="city" className="h-full min-w-0 flex-1 bg-transparent text-base outline-none" placeholder="Почніть вводити місто або село" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} data-testid="input-np-city" />
        {q && <button type="button" onClick={() => setQ("")} aria-label="Очистити" className="text-muted-foreground"><X className="h-4 w-4" /></button>}
      </label>
      {dq.length >= 2 && (
        <div className="mt-2">
          <Status loading={isFetching && !data} error={isError} empty={!isFetching && !isError && list.length === 0} emptyText="Не знайшли такого населеного пункту з відділенням Нової Пошти. Перевірте назву." />
          {list.length > 0 && (
            <ul className={cn("max-h-72 divide-y divide-border overflow-y-auto rounded-2xl border border-border", isFetching && "opacity-60")}>
              {list.map((c) => (
                <li key={c.ref}>
                  <button type="button" onClick={() => onChange(c)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/60 active:bg-muted" data-testid={`option-np-city-${c.ref}`}>
                    <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{c.name}</span><span className="block truncate text-xs text-muted-foreground">{c.label}</span></span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{num(c.branches)} від.</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

type Kind = "all" | "branch" | "postomat";
const KINDS: { v: Kind; l: string }[] = [{ v: "all", l: "Усі" }, { v: "branch", l: "Відділення" }, { v: "postomat", l: "Поштомати" }];

export function NpBranchPicker({ city, value, onChange, invalid }: { city: NpCity; value: NpBranch | null; onChange: (b: NpBranch | null) => void; invalid?: boolean }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const dq = useDebounced(q.trim());
  const params = { cityRef: city.ref, q: dq || undefined };
  const { data, isFetching, isError } = useSearchNpBranches(params, { query: { queryKey: getSearchNpBranchesQueryKey(params), enabled: !value, staleTime: 5 * 60_000, placeholderData: keepPreviousData } });

  if (value) return <Selected icon={value.kind === "postomat" ? Box : Store} title={value.title} sub={value.address} onChange={() => { onChange(null); setQ(""); }} testid="np-branch-selected" />;
  const all = data?.items ?? [];
  const list = all.filter((b) => kind === "all" || (kind === "postomat" ? b.kind === "postomat" : b.kind !== "postomat"));
  const partial = !dq && city.branches > all.length;
  return (
    <div>
      <label className={cn(fieldCls, invalid && "border-destructive")}>
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input data-field="address" className="h-full min-w-0 flex-1 bg-transparent text-base outline-none" placeholder="Номер відділення, поштомату або вулиця" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} data-testid="input-np-branch" />
        {q && <button type="button" onClick={() => setQ("")} aria-label="Очистити" className="text-muted-foreground"><X className="h-4 w-4" /></button>}
      </label>
      <div className="mt-2 flex gap-1.5">
        {KINDS.map((k) => (
          <button key={k.v} type="button" onClick={() => setKind(k.v)} className={cn("rounded-full px-3 py-1 text-xs font-semibold transition", kind === k.v ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground")} data-testid={`filter-np-${k.v}`}>{k.l}</button>
        ))}
      </div>
      <div className="mt-2">
        <Status loading={isFetching && !data} error={isError} empty={!isFetching && !isError && !!data && list.length === 0} emptyText={dq ? "Нічого не знайшли. Спробуйте лише номер (наприклад, 25) або назву вулиці." : "Немає пунктів цього типу."} />
        {list.length > 0 && (
          <ul className={cn("max-h-80 divide-y divide-border overflow-y-auto rounded-2xl border border-border", isFetching && "opacity-60")}>
            {list.map((b) => (
              <li key={b.ref}>
                <button type="button" onClick={() => onChange(b)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/60 active:bg-muted" data-testid={`option-np-branch-${b.number}`}>
                  {b.kind === "postomat" ? <Box className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> : <Store className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold leading-tight">{b.title}</span><span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{b.address}</span></span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {partial && list.length > 0 && <p className="mt-2 px-1 text-[11px] text-muted-foreground">Показано перші {all.length} з {num(city.branches)}. Введіть номер або вулицю, щоб знайти потрібне.</p>}
      </div>
    </div>
  );
}
