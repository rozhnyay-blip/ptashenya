import { db, settingsTable, type SettingsRow } from "@workspace/db";
import { eq, sql, type SQL } from "drizzle-orm";

export async function getSettings(): Promise<SettingsRow> {
  const rows = await db.select().from(settingsTable).where(eq(settingsTable.id, 1));
  if (rows[0]) return rows[0];
  const inserted = await db
    .insert(settingsTable)
    .values({ id: 1 })
    .onConflictDoNothing()
    .returning();
  if (inserted[0]) return inserted[0];
  const again = await db.select().from(settingsTable).where(eq(settingsTable.id, 1));
  return again[0]!;
}

export function retailPrice(
  supplierPrice: number | null,
  priceOverride: number | null,
  s: Pick<SettingsRow, "markupPercent" | "roundPrices">,
): number {
  if (priceOverride !== null && priceOverride !== undefined) return Number(priceOverride);
  if (supplierPrice === null || supplierPrice === undefined) return 0;
  const raw = Number(supplierPrice) * (1 + Number(s.markupPercent) / 100);
  return s.roundPrices ? Math.ceil(raw) : Math.round(raw * 100) / 100;
}

/** SQL expression computing the retail price, matching retailPrice(). */
export function retailPriceSql(s: Pick<SettingsRow, "markupPercent" | "roundPrices">): SQL<number> {
  const factor = 1 + Number(s.markupPercent) / 100;
  return s.roundPrices
    ? sql<number>`coalesce(products.price_override, ceil(coalesce(products.supplier_price, 0) * ${factor}::numeric))`
    : sql<number>`coalesce(products.price_override, round(coalesce(products.supplier_price, 0) * ${factor}::numeric, 2))`;
}

/** Current hour and date (YYYY-MM-DD) in Kyiv time. */
export function kyivNow(date = new Date()): { hour: number; day: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { hour: Number(get("hour")), day: `${get("year")}-${get("month")}-${get("day")}` };
}
