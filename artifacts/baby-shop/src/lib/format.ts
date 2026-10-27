export const BRAND = "Пташеня";
export function uah(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const rounded = Math.round(n * 100) / 100;
  const hasCents = Math.abs(rounded % 1) > 0.001;
  const s = rounded.toLocaleString("uk-UA", { minimumFractionDigits: hasCents ? 2 : 0, maximumFractionDigits: 2 }).replace(/\u00a0|\u202f/g, " ");
  return s + " ₴";
}
/** Short money for big figures: "940,9 млн ₴", "1,2 млрд ₴"; below a million — full amount. */
export function uahShort(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const a = Math.abs(n);
  const fmt = (v: number) => v.toLocaleString("uk-UA", { maximumFractionDigits: 1 }).replace(/\u00a0|\u202f/g, " ");
  if (a >= 1e9) return `${fmt(n / 1e9)} млрд ₴`;
  if (a >= 1e6) return `${fmt(n / 1e6)} млн ₴`;
  return uah(Math.round(n));
}
export function num(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("uk-UA").replace(/\u00a0|\u202f/g, " ");
}
export function dateTime(s?: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleString("uk-UA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Kyiv" });
}
export function dateShort(s?: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Kyiv" });
}
export function relTime(s?: string | null): string {
  if (!s) return "ніколи";
  const diff = (Date.now() - new Date(s).getTime()) / 1000;
  if (diff < 60) return "щойно";
  if (diff < 3600) return Math.floor(diff / 60) + " хв тому";
  if (diff < 86400) return Math.floor(diff / 3600) + " год тому";
  const d = Math.floor(diff / 86400);
  return d === 1 ? "вчора" : d + " дн тому";
}
export function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
export const STATUS_LABEL: Record<string, string> = { new: "Нове", confirmed: "Підтверджене", shipped: "Відправлене", delivered: "Доставлене", cancelled: "Скасоване" };
export const STATUS_STYLE: Record<string, string> = {
  new: "bg-primary/12 text-primary border-primary/25",
  confirmed: "bg-secondary/50 text-[hsl(36_80%_28%)] border-secondary",
  shipped: "bg-accent text-accent-foreground border-[hsl(262_50%_82%)]",
  delivered: "bg-[hsl(160_45%_90%)] text-[hsl(165_55%_24%)] border-[hsl(160_40%_78%)]",
  cancelled: "bg-muted text-muted-foreground border-border line-through decoration-1",
};
export const DELIVERY_LABEL: Record<string, string> = { nova_poshta: "Нова Пошта", ukrposhta: "Укрпошта", courier: "Кур'єр", pickup: "Самовивіз" };
export const PAYMENT_LABEL: Record<string, string> = { cod: "Накладений платіж", card_transfer: "Оплата на карту" };
export function apiError(e: unknown): { status?: number; message: string } {
  const err = e as { status?: number; data?: { error?: string; message?: string } | null; message?: string } | null;
  const msg = err?.data?.error || err?.data?.message || err?.message || "Щось пішло не так";
  return { status: err?.status, message: msg };
}
export function phoneDigits(p: string) { return p.replace(/\D/g, ""); }
export function formatPhoneMask(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("380")) d = d.slice(3);
  else if (d.startsWith("80")) d = d.slice(2);
  else if (d.startsWith("0")) d = d.slice(1);
  d = d.slice(0, 9);
  let out = "+380";
  if (d.length) out += " " + d.slice(0, 2);
  if (d.length > 2) out += " " + d.slice(2, 5);
  if (d.length > 5) out += " " + d.slice(5, 7);
  if (d.length > 7) out += " " + d.slice(7, 9);
  return out;
}
export function uahCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const a = Math.abs(n);
  const f = (v: number, u: string) => v.toLocaleString("uk-UA", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).replace(/\u00a0|\u202f/g, " ") + " " + u + " ₴";
  if (a >= 1e9) return f(n / 1e9, "млрд");
  if (a >= 1e6) return f(n / 1e6, "млн");
  if (a >= 1e4) return f(n / 1e3, "тис");
  return uah(Math.round(n));
}
export function pct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("uk-UA", { minimumFractionDigits: digits, maximumFractionDigits: digits }) + "%";
}
