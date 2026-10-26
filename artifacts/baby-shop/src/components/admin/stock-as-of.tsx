import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import {
  useGetSyncStatus, getGetSyncStatusQueryKey, getGetAdminProductsSummaryQueryKey, getGetAdminInventoryQueryKey,
  getListAdminProductsQueryKey, getGetAdminDashboardQueryKey,
} from "@workspace/api-client-react";
import { SyncButton } from "@/components/admin/sync-button";
import { cn } from "@/lib/utils";

const kyivDay = (d: Date) => d.toLocaleDateString("uk-UA", { timeZone: "Europe/Kyiv" });
const asOfText = (s: string) =>
  new Date(s).toLocaleString("uk-UA", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Kyiv" });

/** "Станом на 26 жовтня, 18:01" + one-click warehouse refresh; refreshes stock money when a sync finishes. */
export function StockAsOf({ className }: { className?: string }) {
  const qc = useQueryClient();
  const { data: sync } = useGetSyncStatus({ query: { queryKey: getGetSyncStatusQueryKey(), refetchInterval: (q) => (q.state.data?.running ? 3000 : 30000) } });
  const wasRunning = useRef(false);
  useEffect(() => {
    if (!sync) return;
    if (wasRunning.current && !sync.running) {
      [getGetAdminProductsSummaryQueryKey(), getGetAdminInventoryQueryKey(), getListAdminProductsQueryKey(), getGetAdminDashboardQueryKey()].forEach((k) => qc.invalidateQueries({ queryKey: k }));
    }
    wasRunning.current = sync.running;
  }, [sync, qc]);

  const last = sync?.lastRun;
  const at = last?.finishedAt ?? null;
  const today = at ? kyivDay(new Date(at)) === kyivDay(new Date()) : false;
  const failed = last?.status === "failed";
  const running = !!sync?.running;

  const tone = running ? "info" : today && !failed ? "ok" : "warn";
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-3 py-2 text-xs",
      tone === "ok" ? "bg-[hsl(160_45%_93%)] text-[hsl(165_55%_22%)]" : tone === "warn" ? "bg-[hsl(40_90%_92%)] text-[hsl(30_70%_25%)]" : "bg-muted", className)} data-testid="status-stock-as-of">
      {running ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : tone === "ok" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
      <div className="min-w-0 flex-1 leading-snug">
        {running ? <><b>Наявність оновлюється зараз</b> — {sync?.current?.currentStep ?? "зачекайте"}. Цифри оновляться самі після завершення.</>
          : !at ? <><b>Склад ще не завантажено.</b> Натисніть «Оновити наявність».</>
          : failed ? <><b>Останнє оновлення не вдалося</b> ({asOfText(at)}). Спробуйте ще раз.</>
          : today ? <><b>Актуально: станом на {asOfText(at)}</b> — дані зі складу постачальника за сьогодні.</>
          : <><b>Дані застарілі: станом на {asOfText(at)}</b>. Оновіть, щоб побачити наявність на сьогодні.</>}
      </div>
      <SyncButton running={running} label="Оновити наявність" className="h-8 px-3 text-xs" />
    </div>
  );
}
