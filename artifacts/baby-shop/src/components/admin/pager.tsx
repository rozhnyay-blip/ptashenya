import { ChevronLeft, ChevronRight } from "lucide-react";
export function Pager({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (p: number) => void }) {
  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
      <span className="font-mono tabular">Всього: {total.toLocaleString("uk-UA")}</span>
      <div className="flex items-center gap-1">
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} data-testid="button-admin-prev" className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-card disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
        <span className="px-2 font-mono tabular">{page} / {Math.max(1, pages)}</span>
        <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} data-testid="button-admin-next" className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-card disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
