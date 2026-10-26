import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, ExternalLink, Package, RefreshCw, Search, Settings, ShoppingCart, Sparkles, TrendingUp } from "lucide-react";
import {
  useListAdminProducts, getListAdminProductsQueryKey, useListAdminOrders, getListAdminOrdersQueryKey,
  useStartSync, useRunAdminSeo, getGetSyncStatusQueryKey, getGetAdminSeoQueryKey,
} from "@workspace/api-client-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiError, num, uah } from "@/lib/format";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
export const PAGES = [
  { href: "/admin", label: "Огляд", icon: BarChart3 },
  { href: "/admin/orders", label: "Замовлення", icon: ShoppingCart },
  { href: "/admin/products", label: "Товари", icon: Package },
  { href: "/admin/prices", label: "Ціни постачальника", icon: TrendingUp },
  { href: "/admin/seo", label: "SEO", icon: Sparkles },
  { href: "/admin/sync", label: "Синхронізація", icon: RefreshCw },
  { href: "/admin/settings", label: "Налаштування", icon: Settings },
];

function useDebounced(v: string, ms = 250) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [, setLocation] = useLocation();
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const qc = useQueryClient();
  const { toast } = useToast();
  const enabled = open && dq.length >= 2;
  const pp = { search: dq, limit: 6 };
  const op = { search: dq, limit: 6 };
  const products = useListAdminProducts(pp, { query: { queryKey: getListAdminProductsQueryKey(pp), enabled } });
  const orders = useListAdminOrders(op, { query: { queryKey: getListAdminOrdersQueryKey(op), enabled } });
  const sync = useStartSync({ mutation: {
    onSuccess: () => toast({ title: "Синхронізацію запущено" }),
    onError: (e) => { const er = apiError(e); toast({ title: er.status === 409 ? "Синхронізація вже триває" : "Не вдалося запустити", description: er.status === 409 ? undefined : er.message, variant: er.status === 409 ? undefined : "destructive" }); },
    onSettled: () => qc.invalidateQueries({ queryKey: getGetSyncStatusQueryKey() }),
  } });
  const seo = useRunAdminSeo({ mutation: {
    onSuccess: (r) => toast({ title: "SEO оновлено", description: `${num(r.updated)} товарів за ${(r.durationMs / 1000).toFixed(1)} с` }),
    onError: (e) => { const er = apiError(e); toast({ title: er.status === 409 ? "Оновлення SEO вже триває" : "Помилка SEO", description: er.status === 409 ? undefined : er.message, variant: er.status === 409 ? undefined : "destructive" }); },
    onSettled: () => qc.invalidateQueries({ queryKey: getGetAdminSeoQueryKey() }),
  } });

  useEffect(() => { if (!open) setQ(""); }, [open]);
  const run = (fn: () => void) => { onOpenChange(false); fn(); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-xl [&>button]:hidden">
        <DialogTitle className="sr-only">Командна панель</DialogTitle>
        <Command shouldFilter={!enabled} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-item]]:py-2">
          <CommandInput value={q} onValueChange={setQ} placeholder="Сторінка, дія, товар або № замовлення…" data-testid="input-command" />
          <CommandList className="max-h-[60vh]">
            <CommandEmpty>{enabled && (products.isFetching || orders.isFetching) ? "Шукаю…" : "Нічого не знайдено"}</CommandEmpty>
            {enabled && (products.data?.items.length ?? 0) > 0 && (
              <CommandGroup heading="Товари">
                {products.data!.items.map((p) => (
                  <CommandItem key={p.id} value={`p-${p.id}-${p.sku}`} onSelect={() => run(() => setLocation(`/admin/products?q=${encodeURIComponent(p.sku)}`))} data-testid={`command-product-${p.id}`}>
                    <Package className="h-4 w-4 opacity-60" />
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{p.sku} · {uah(p.price)}</span>
                  </CommandItem>
                ))}
                <CommandItem value={`all-products-${dq}`} onSelect={() => run(() => setLocation(`/admin/products?q=${encodeURIComponent(dq)}`))} data-testid="command-products-all">
                  <Search className="h-4 w-4 opacity-60" />Усі товари за запитом «{dq}» <CommandShortcut>{num(products.data!.total)}</CommandShortcut>
                </CommandItem>
              </CommandGroup>
            )}
            {enabled && (orders.data?.items.length ?? 0) > 0 && (
              <CommandGroup heading="Замовлення">
                {orders.data!.items.map((o) => (
                  <CommandItem key={o.id} value={`o-${o.id}-${o.number}`} onSelect={() => run(() => setLocation(`/admin/orders/${o.id}`))} data-testid={`command-order-${o.id}`}>
                    <ShoppingCart className="h-4 w-4 opacity-60" />
                    <span className="font-mono font-semibold">{o.number}</span>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{o.customerName}</span>
                    <span className="font-mono text-[11px]">{uah(o.total)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandGroup heading="Перейти">
              {PAGES.map((p) => (
                <CommandItem key={p.href} value={`nav ${p.label}`} onSelect={() => run(() => setLocation(p.href))} data-testid={`command-nav-${p.href.split("/").pop()}`}>
                  <p.icon className="h-4 w-4 opacity-60" />{p.label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Дії">
              <CommandItem value="дія запустити синхронізацію склад" onSelect={() => run(() => sync.mutate())} data-testid="command-sync"><RefreshCw className="h-4 w-4 opacity-60" />Запустити синхронізацію складу</CommandItem>
              <CommandItem value="дія оновити seo для всіх" onSelect={() => run(() => { toast({ title: "Оновлюю SEO…", description: "Це займе 5–10 секунд" }); seo.mutate(); })} data-testid="command-seo"><Sparkles className="h-4 w-4 opacity-60" />Оновити SEO для всіх товарів</CommandItem>
              <CommandItem value="дія відкрити магазин" onSelect={() => run(() => window.open(`${basePath}/`, "_blank"))} data-testid="command-open-store"><ExternalLink className="h-4 w-4 opacity-60" />Відкрити магазин</CommandItem>
            </CommandGroup>
          </CommandList>
          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[10px] text-muted-foreground"><span>Введіть 2+ символи для пошуку товарів і замовлень</span><span className="font-mono">Esc — закрити</span></div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
