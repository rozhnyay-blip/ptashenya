import { useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { useStartSync, getGetSyncStatusQueryKey, getListSyncRunsQueryKey, getGetAdminDashboardQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { apiError } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SyncButton({ running, size = "md", className, label = "Синхронізувати зараз" }: { running?: boolean; size?: "md" | "lg"; className?: string; label?: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const start = useStartSync({ mutation: {
    onSuccess: () => { toast({ title: "Синхронізацію запущено", description: "Слідкуйте за прогресом на сторінці синхронізації." }); },
    onError: (e) => {
      const err = apiError(e);
      if (err.status === 409) toast({ title: "Вже працює", description: "Синхронізація триває — дочекайтесь завершення." });
      else toast({ title: "Не вдалося запустити", description: err.message, variant: "destructive" });
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: getGetSyncStatusQueryKey() }); qc.invalidateQueries({ queryKey: getListSyncRunsQueryKey() }); qc.invalidateQueries({ queryKey: getGetAdminDashboardQueryKey() }); },
  } });
  const busy = running || start.isPending;
  return (
    <button type="button" disabled={busy} onClick={() => start.mutate()} data-testid="button-start-sync"
      className={cn("inline-flex items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground transition hover:bg-primary/90 active:scale-[.98] disabled:opacity-70", size === "lg" ? "h-14 px-8 text-base" : "h-9 px-4 text-sm", className)}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      {running ? "Оновлюється..." : label}
    </button>
  );
}
