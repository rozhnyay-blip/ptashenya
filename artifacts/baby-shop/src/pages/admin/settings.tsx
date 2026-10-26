import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useGetAdminSettings, getGetAdminSettingsQueryKey, useUpdateAdminSettings, getGetSyncStatusQueryKey, type StoreSettings } from "@workspace/api-client-react";
import { PageHead, Panel } from "@/components/admin/admin-layout";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiError, uah } from "@/lib/format";

const inp = "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 border-b border-border px-4 py-4 last:border-0 sm:grid-cols-[240px_1fr] sm:items-center">
      <div><div className="text-sm font-semibold">{label}</div>{hint && <div className="text-xs text-muted-foreground">{hint}</div>}</div>
      <div>{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, isError, refetch } = useGetAdminSettings({ query: { queryKey: getGetAdminSettingsQueryKey() } });
  const upd = useUpdateAdminSettings();
  const [f, setF] = useState<StoreSettings | null>(null);
  const [freeOn, setFreeOn] = useState(false);
  const inited = useRef(false);
  useEffect(() => { if (data && !inited.current) { inited.current = true; setF(data); setFreeOn(data.freeShippingFrom !== null); } }, [data]);

  if (isError) return <Panel><div className="p-10 text-center text-sm">Не вдалося завантажити. <button onClick={() => refetch()} className="font-semibold text-primary" data-testid="button-retry-settings">Повторити</button></div></Panel>;
  if (isLoading || !f) return <div className="space-y-3"><Skeleton className="h-8 w-48" /><Skeleton className="h-96 rounded-2xl" /></div>;

  const set = <K extends keyof StoreSettings>(k: K, v: StoreSettings[K]) => setF((p) => (p ? { ...p, [k]: v } : p));
  const example = (() => { const v = 100 * (1 + (Number(f.markupPercent) || 0) / 100); return f.roundPrices ? Math.round(v) : Math.round(v * 100) / 100; })();
  const save = () => {
    if (!f.storeName.trim()) { toast({ title: "Вкажіть назву магазину", variant: "destructive" }); return; }
    upd.mutate({ data: {
      storeName: f.storeName.trim(), markupPercent: Number(f.markupPercent), roundPrices: f.roundPrices, contactPhone: f.contactPhone.trim(),
      minOrderAmount: Number(f.minOrderAmount) || 0, freeShippingFrom: freeOn ? Number(f.freeShippingFrom) || 0 : null,
      autoSyncEnabled: f.autoSyncEnabled, autoSyncHour: Number(f.autoSyncHour),
    } }, {
      onSuccess: (res) => { qc.setQueryData(getGetAdminSettingsQueryKey(), res); qc.invalidateQueries({ queryKey: getGetSyncStatusQueryKey() }); setF(res); toast({ title: "Налаштування збережено" }); },
      onError: (e) => toast({ title: "Не збережено", description: apiError(e).message, variant: "destructive" }),
    });
  };
  const dirty = data && JSON.stringify({ ...f, freeShippingFrom: freeOn ? Number(f.freeShippingFrom) || 0 : null }) !== JSON.stringify(data);

  return (
    <div className="max-w-4xl">
      <PageHead title="Налаштування" sub="Ціни, контакти та розклад синхронізації" actions={<button type="button" onClick={save} disabled={upd.isPending || !dirty} data-testid="button-save-settings" className="flex h-9 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-40">{upd.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Зберегти</button>} />
      <div className="space-y-4">
        <Panel title="Магазин">
          <Row label="Назва магазину" hint="Показується в кабінеті"><input className={inp} value={f.storeName} onChange={(e) => set("storeName", e.target.value)} data-testid="input-store-name" /></Row>
          <Row label="Контактний телефон"><input className={inp + " font-mono"} type="tel" value={f.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} placeholder="+380 67 000 00 00" data-testid="input-contact-phone" /></Row>
        </Panel>
        <Panel title="Ціноутворення">
          <Row label="Націнка, %" hint="Додається до закупівельної ціни складу">
            <div className="flex flex-wrap items-center gap-3">
              <input className={inp + " w-28 font-mono"} type="number" min={0} max={500} step="0.5" value={f.markupPercent} onChange={(e) => set("markupPercent", Number(e.target.value))} data-testid="input-markup" />
              <div className="flex items-center gap-2 rounded-xl bg-secondary/50 px-3 py-2 font-mono text-sm tabular" data-testid="text-markup-example">закупка {uah(100)} <span className="text-muted-foreground">→</span> продаж <b className="text-primary">{uah(example)}</b></div>
            </div>
          </Row>
          <Row label="Округлювати ціни" hint="До цілих гривень"><Switch checked={f.roundPrices} onCheckedChange={(v) => set("roundPrices", v)} data-testid="switch-round-prices" /></Row>
        </Panel>
        <Panel title="Замовлення">
          <Row label="Мінімальна сума замовлення, ₴" hint="0 — без обмежень"><input className={inp + " w-36 font-mono"} type="number" min={0} value={f.minOrderAmount} onChange={(e) => set("minOrderAmount", Number(e.target.value))} data-testid="input-min-order" /></Row>
          <Row label="Безкоштовна доставка" hint="Від певної суми замовлення">
            <div className="flex items-center gap-3">
              <Switch checked={freeOn} onCheckedChange={setFreeOn} data-testid="switch-free-shipping" />
              {freeOn && <input className={inp + " w-36 font-mono"} type="number" min={0} value={f.freeShippingFrom ?? 0} onChange={(e) => set("freeShippingFrom", Number(e.target.value))} data-testid="input-free-shipping" />}
            </div>
          </Row>
        </Panel>
        <Panel title="Автосинхронізація зі складом">
          <Row label="Щоденний запуск"><Switch checked={f.autoSyncEnabled} onCheckedChange={(v) => set("autoSyncEnabled", v)} data-testid="switch-settings-auto-sync" /></Row>
          <Row label="Година (за Києвом)">
            <select className={inp + " w-32 font-mono"} value={f.autoSyncHour} disabled={!f.autoSyncEnabled} onChange={(e) => set("autoSyncHour", Number(e.target.value))} data-testid="select-settings-hour">
              {Array.from({ length: 24 }).map((_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
            </select>
          </Row>
        </Panel>
      </div>
    </div>
  );
}
