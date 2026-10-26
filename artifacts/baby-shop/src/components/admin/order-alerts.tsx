import { useEffect, useRef } from "react";
import { useGetAdminDashboard, getGetAdminDashboardQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

function chime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [880, 1318.5].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const t = now + i * 0.14;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.65);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {
    /* audio unavailable */
  }
}

/** Polls dashboard every 30 s; alerts on new orders. Returns current count of "new" orders. */
export function useNewOrderAlerts(): number {
  const { data } = useGetAdminDashboard({ query: { queryKey: getGetAdminDashboardQueryKey(), refetchInterval: 30_000, refetchIntervalInBackground: true } });
  const { toast } = useToast();
  const prev = useRef<number | null>(null);
  const baseTitle = useRef(document.title.replace(/^\(\d+\)\s*/, ""));
  const count = data?.statusCounts.new ?? 0;

  useEffect(() => {
    if (!data) return;
    if (prev.current !== null && count > prev.current) {
      const diff = count - prev.current;
      toast({ title: "Нове замовлення", description: diff > 1 ? `Надійшло ${diff} нових замовлень` : "Перевірте розділ «Замовлення»" });
      chime();
    }
    prev.current = count;
    document.title = count > 0 ? `(${count}) ${baseTitle.current}` : baseTitle.current;
  }, [count, data, toast]);

  useEffect(() => {
    const t = baseTitle.current;
    return () => { document.title = t; };
  }, []);

  return count;
}
