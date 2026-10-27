import { logger } from "./logger";

export type ParcelStage = "created" | "in_transit" | "arrived" | "received" | "problem" | "unknown";

export interface ParcelStatus {
  ttn: string;
  stage: ParcelStage;
  status: string;
  statusCode: string;
  city: string | null;
  warehouse: string | null;
  scheduledDelivery: string | null;
  receivedAt: string | null;
  checkedAt: string;
  trackingUrl: string;
}

/** Nova Poshta status codes → simple stage the customer understands. */
function stageOf(code: string): ParcelStage {
  const c = Number(code);
  if (c === 1) return "created";
  if ([4, 41, 5, 6, 101, 104, 112].includes(c)) return "in_transit";
  if ([7, 8].includes(c)) return "arrived";
  if ([9, 10, 11, 106].includes(c)) return "received";
  if ([102, 103, 105, 108, 111].includes(c)) return "problem";
  return "unknown";
}

export const normalizeTtn = (v: string) => v.replace(/\D/g, "");
export const trackingUrl = (ttn: string) => `https://novaposhta.ua/tracking/?cargo_number=${ttn}`;

const CACHE_MS = 10 * 60_000;
const cache = new Map<string, { value: ParcelStatus; expires: number }>();

/** Live statuses for many waybills in one Nova Poshta call (keyless API). Never throws; failures are just missing. */
export async function parcelStatuses(docs: { ttn: string; phone: string }[]): Promise<Map<string, ParcelStatus>> {
  const out = new Map<string, ParcelStatus>();
  const todo: { ttn: string; phone: string }[] = [];
  for (const d of docs) {
    const ttn = normalizeTtn(d.ttn);
    if (!ttn) continue;
    const hit = cache.get(ttn);
    if (hit && hit.expires > Date.now()) out.set(ttn, hit.value);
    else if (!todo.some((t) => t.ttn === ttn)) todo.push({ ttn, phone: d.phone.replace(/\D/g, "") });
  }
  for (let i = 0; i < todo.length; i += 100) {
    const batch = todo.slice(i, i + 100);
    try {
      const r = await fetch("https://api.novaposhta.ua/v2.0/json/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({
          apiKey: "",
          modelName: "TrackingDocument",
          calledMethod: "getStatusDocuments",
          methodProperties: { Documents: batch.map((b) => ({ DocumentNumber: b.ttn, Phone: b.phone })) },
        }),
      });
      const j = (await r.json()) as { success?: boolean; data?: Record<string, unknown>[] };
      const now = new Date().toISOString();
      for (const d of j.data ?? []) {
        const ttn = String(d.Number ?? "");
        if (!ttn) continue;
        const str = (k: string) => (typeof d[k] === "string" && (d[k] as string).trim() ? (d[k] as string).trim() : null);
        const code = String(d.StatusCode ?? "");
        const value: ParcelStatus = {
          ttn,
          stage: stageOf(code),
          status: str("Status") ?? "Статус невідомий",
          statusCode: code,
          city: str("CityRecipient"),
          warehouse: str("WarehouseRecipient"),
          scheduledDelivery: str("ScheduledDeliveryDate"),
          receivedAt: str("RecipientDateTime"),
          checkedAt: now,
          trackingUrl: trackingUrl(ttn),
        };
        cache.set(ttn, { value, expires: Date.now() + CACHE_MS });
        out.set(ttn, value);
      }
    } catch (err) {
      logger.warn({ err }, "Nova Poshta tracking failed");
    }
  }
  return out;
}

export function forgetParcel(ttn: string) {
  cache.delete(normalizeTtn(ttn));
}
