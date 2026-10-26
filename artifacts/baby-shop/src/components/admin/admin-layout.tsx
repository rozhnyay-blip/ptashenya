import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useClerk } from "@clerk/react";
import { BarChart3, Command as CmdIcon, ExternalLink, LogOut, Menu, Package, RefreshCw, Search, Settings, ShoppingCart, Sparkles, TrendingUp, X } from "lucide-react";
import { CommandPalette } from "@/components/admin/command-palette";
import { useNewOrderAlerts } from "@/components/admin/order-alerts";
import { useGetAdminSettings, getGetAdminSettingsQueryKey, useGetSyncStatus, getGetSyncStatusQueryKey, useGetMe } from "@workspace/api-client-react";
import { LogoMark } from "@/components/store/logo";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, STATUS_STYLE } from "@/lib/format";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const NAV = [
  { href: "/admin", label: "Огляд", icon: BarChart3, exact: true },
  { href: "/admin/orders", label: "Замовлення", icon: ShoppingCart },
  { href: "/admin/products", label: "Товари", icon: Package },
  { href: "/admin/prices", label: "Ціни постачальника", icon: TrendingUp },
  { href: "/admin/seo", label: "SEO", icon: Sparkles },
  { href: "/admin/sync", label: "Синхронізація", icon: RefreshCw },
  { href: "/admin/settings", label: "Налаштування", icon: Settings },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const { signOut } = useClerk();
  const { data: me } = useGetMe();
  const { data: settings } = useGetAdminSettings({ query: { queryKey: getGetAdminSettingsQueryKey() } });
  const { data: sync } = useGetSyncStatus({ query: { queryKey: getGetSyncStatusQueryKey(), refetchInterval: (q) => (q.state.data?.running ? 2000 : 30000) } });
  const [cmd, setCmd] = useState(false);
  const newOrders = useNewOrderAlerts();
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmd((v) => !v); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  const isActive = (href: string, exact?: boolean) => exact ? location === href : location.startsWith(href);
  const side = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <LogoMark className="h-8 w-8" />
        <div className="min-w-0"><div className="truncate font-display text-sm font-bold" data-testid="text-store-name">{settings?.storeName ?? "Магазин"}</div><div className="text-[10px] uppercase tracking-widest text-sidebar-foreground/50">кабінет власника</div></div>
      </div>
      <div className="px-3 pb-3">
        <button type="button" onClick={() => { setOpen(false); setCmd(true); }} data-testid="button-command-palette" className="flex w-full items-center gap-2 rounded-xl border border-sidebar-border bg-sidebar-accent/40 px-3 py-2 text-left text-xs text-sidebar-foreground/60 transition hover:bg-sidebar-accent hover:text-sidebar-foreground">
          <Search className="h-3.5 w-3.5" /><span className="flex-1">Пошук і дії</span>
          <kbd className="rounded-md border border-sidebar-border px-1.5 py-0.5 font-mono text-[10px]">{isMac ? "⌘" : "Ctrl"} K</kbd>
        </button>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} onClick={() => setOpen(false)} data-testid={`link-admin-${n.href.split("/").pop()}`} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition", isActive(n.href, n.exact) ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground")}>
            <n.icon className="h-4 w-4" />{n.label}
            {n.href === "/admin/orders" && newOrders > 0 && <span className="ml-auto min-w-[20px] rounded-full bg-primary px-1.5 text-center font-mono text-[10px] font-bold leading-5 text-primary-foreground" data-testid="badge-new-orders">{newOrders}</span>}
            {n.href === "/admin/sync" && sync?.running && <span className="ml-auto h-2 w-2 animate-pulse rounded-full bg-secondary" />}
          </Link>
        ))}
      </nav>
      <div className="space-y-1 border-t border-sidebar-border p-3">
        <a href={`${basePath}/`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-sidebar-foreground/75 hover:bg-sidebar-accent" data-testid="link-open-store"><ExternalLink className="h-4 w-4" />Відкрити магазин</a>
        <div className="truncate px-3 pt-1 text-[11px] text-sidebar-foreground/45">{me?.email}</div>
        <button type="button" onClick={() => signOut({ redirectUrl: basePath || "/" })} data-testid="button-sign-out" className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-sidebar-foreground/75 hover:bg-sidebar-accent"><LogOut className="h-4 w-4" />Вийти</button>
      </div>
    </div>
  );
  return (
    <div className="min-h-[100dvh] bg-[hsl(36_40%_95%)]">
      <aside className="fixed inset-y-0 left-0 hidden w-60 lg:block">{side}</aside>
      {open && <div className="fixed inset-0 z-50 lg:hidden"><div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} /><div className="absolute inset-y-0 left-0 w-64">{side}</div></div>}
      <CommandPalette open={cmd} onOpenChange={setCmd} />
      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
          <button type="button" onClick={() => setOpen(true)} data-testid="button-admin-menu" className="grid h-9 w-9 place-items-center rounded-lg bg-muted">{open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}</button>
          <span className="flex-1 font-display text-sm font-bold">{settings?.storeName ?? "Кабінет"}</span>
          <button type="button" onClick={() => setCmd(true)} data-testid="button-command-mobile" className="grid h-9 w-9 place-items-center rounded-lg bg-muted"><CmdIcon className="h-4 w-4" /></button>
        </header>
        <main className="mx-auto max-w-[1400px] p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

export function PageHead({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="font-display text-2xl font-bold">{title}</h1>{sub && <p className="mt-0.5 text-sm text-muted-foreground">{sub}</p>}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-card-border bg-card", className)}>
      {title && <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3"><h2 className="text-sm font-bold">{title}</h2>{action}</div>}
      {children}
    </section>
  );
}

export function StatusPill({ status }: { status: string }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold", STATUS_STYLE[status])} data-testid={`status-${status}`}>{STATUS_LABEL[status] ?? status}</span>;
}
