import { logger } from "./logger";

/**
 * Nova Poshta public directory (cities + branches). The address-directory
 * methods of api.novaposhta.ua work without an API key.
 */
const NP_URL = "https://api.novaposhta.ua/v2.0/json/";
const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CACHE = 2000;

export class NpUnavailableError extends Error {}

const cache = new Map<string, { at: number; value: unknown }>();

async function call<T>(modelName: string, calledMethod: string, methodProperties: Record<string, string>): Promise<T[]> {
  const key = JSON.stringify([modelName, calledMethod, methodProperties]);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T[];

  let body: { success?: boolean; data?: T[]; errors?: string[] };
  try {
    const res = await fetch(NP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: "", modelName, calledMethod, methodProperties }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    body = (await res.json()) as typeof body;
  } catch (err) {
    logger.warn({ err, calledMethod }, "Nova Poshta request failed");
    throw new NpUnavailableError("Нова Пошта не відповідає");
  }
  if (!body.success || !Array.isArray(body.data)) {
    logger.warn({ errors: body.errors, calledMethod }, "Nova Poshta returned an error");
    throw new NpUnavailableError("Нова Пошта не відповідає");
  }
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), value: body.data });
  return body.data;
}

type RawSettlement = { Ref: string; Present: string; MainDescription: string; SettlementTypeCode: string; Warehouses: number };
type RawSearch = { TotalCount: number; Addresses: RawSettlement[] };
type RawWarehouse = { Ref: string; Number: string; Description: string; ShortAddress: string; CategoryOfWarehouse: string };

export type NpCity = { ref: string; name: string; label: string; branches: number };
export type NpBranch = { ref: string; number: string; kind: "branch" | "postomat" | "point"; title: string; address: string };

export async function searchCities(q: string): Promise<NpCity[]> {
  const query = q.trim().slice(0, 60);
  if (!query) return [];
  const data = await call<RawSearch>("Address", "searchSettlements", { CityName: query, Limit: "30", Page: "1" });
  const list = data[0]?.Addresses ?? [];
  return list
    .filter((a) => Number(a.Warehouses) > 0)
    .sort((a, b) => Number(b.Warehouses) - Number(a.Warehouses))
    .slice(0, 15)
    .map((a) => ({
      ref: a.Ref,
      name: `${a.SettlementTypeCode} ${a.MainDescription}`.trim(),
      label: a.Present,
      branches: Number(a.Warehouses),
    }));
}

function toBranch(w: RawWarehouse): NpBranch {
  const kind = w.CategoryOfWarehouse === "Postomat" ? "postomat" : w.CategoryOfWarehouse === "Branch" ? "branch" : "point";
  const i = w.Description.indexOf(":");
  const head = i > 0 ? w.Description.slice(0, i).trim() : w.Description;
  const address = i > 0 ? w.Description.slice(i + 1).trim() : w.ShortAddress;
  const title = kind === "postomat" ? `Поштомат №${w.Number}` : head;
  return { ref: w.Ref, number: w.Number, kind, title, address };
}

const norm = (s: string) => s.toLowerCase().replace(/[’'`ʼ"«»]/g, "").replace(/ё/g, "е");

export async function searchBranches(settlementRef: string, q: string): Promise<NpBranch[]> {
  const base = { SettlementRef: settlementRef, Language: "UA" };
  const words = norm(q.trim().slice(0, 80)).replace(/№/g, " ").split(/[\s,.]+/).filter(Boolean);
  if (words.length === 0) {
    const first = await call<RawWarehouse>("AddressGeneral", "getWarehouses", { ...base, Limit: "40", Page: "1" });
    return first.map(toBranch);
  }

  // A number is the most selective token (branch number or house number); otherwise the longest word.
  const numeric = words.find((w) => /^\d+$/.test(w));
  const lookup = numeric ?? [...words].sort((a, b) => b.length - a.length)[0]!;
  const [exact, found] = await Promise.all([
    numeric ? call<RawWarehouse>("AddressGeneral", "getWarehouses", { ...base, WarehouseId: numeric, Limit: "5", Page: "1" }) : Promise.resolve([] as RawWarehouse[]),
    call<RawWarehouse>("AddressGeneral", "getWarehouses", { ...base, FindByString: lookup, Limit: "300", Page: "1" }),
  ]);
  const wantsPostomat = words.some((w) => w.startsWith("поштомат"));
  const rest = words.filter((w) => w !== lookup && !/^(відділення|відділ|від|поштомат|пункт|вул|вулиця|просп|проспект|нова|пошта|нп)$/.test(w));
  const seen = new Set<string>();
  const items: NpBranch[] = [];
  for (const w of [...exact, ...found]) {
    if (seen.has(w.Ref)) continue;
    seen.add(w.Ref);
    const b = toBranch(w);
    const isExact = exact.includes(w);
    if (!isExact) {
      const hay = norm(w.Description);
      if (!rest.every((r) => hay.includes(r))) continue;
      if (wantsPostomat && b.kind !== "postomat") continue;
    }
    items.push(b);
    if (items.length >= 40) break;
  }
  return items;
}
