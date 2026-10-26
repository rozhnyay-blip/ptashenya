import { parse, type HTMLElement } from "node-html-parser";

export const SUPPLIER_ORIGIN = "https://toysi.ua";
export const SUPPLIER_ROOT_PATH = "/ua/optom-ukhod-za-rebenkom-sklad";
export const DEFAULT_SOURCE_CAT_ID = "99104";

/** Top-level supplier groups that are virtual filters, not real product categories. */
const VIRTUAL_GROUPS = new Set([
  "66666", // Новинки
  "55555", // Акція
  "33333", // Очікується
  "44444", // ТОП відвантажень
  "77777", // Бренди
  "11111", // Бонусні товари
  "51995", // Уцінка
  "101", // Вибране
]);

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export interface SupplierCategory {
  supplierCatId: string;
  name: string;
  path: string;
}

export interface SupplierGroup extends SupplierCategory {
  children: SupplierCategory[];
}

export interface ListedProduct {
  sku: string;
  supplierProductId: string | null;
  name: string;
  path: string;
  imageUrl: string | null;
  image2Url: string | null;
  price: number | null;
  /** Crossed-out regular price when the supplier runs a sale. */
  oldPrice: number | null;
  /** Guaranteed units on the supplier warehouse; null when not visible (guest session). */
  stockQty: number | null;
  /** Upper bound of the shown range; equals stockQty when exact; null when unknown ("понад 100"). */
  stockQtyMax: number | null;
  article: string | null;
  isNew: boolean;
}

export interface ListingPage {
  products: ListedProduct[];
  maxOffset: number;
}

export interface ProductDetails {
  article: string | null;
  description: string | null;
  images: string[];
}

export function absUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SUPPLIER_ORIGIN}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Session cookies for the optional wholesale account (unlocks prices hidden from guests). */
const cookieJar = new Map<string, string>();
let loggedIn = false;

function cookieHeader(): string {
  return [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(res: Response) {
  for (const line of res.headers.getSetCookie()) {
    const [pair] = line.split(";");
    const eq = pair?.indexOf("=") ?? -1;
    if (!pair || eq <= 0) continue;
    cookieJar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

export function hasSupplierCredentials(): boolean {
  return !!(process.env.TOYSI_PHONE && process.env.TOYSI_PASSWORD);
}

export function isSupplierLoggedIn(): boolean {
  return loggedIn;
}

/** Formats any Ukrainian phone into the supplier login format +38(0XX)XXX-XX-XX. */
function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(-10).padStart(10, "0");
  return `+38(${d.slice(0, 3)})${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8, 10)}`;
}

/** Logs into the supplier wholesale account if credentials are configured. Returns success. */
export async function supplierLogin(): Promise<boolean> {
  loggedIn = false;
  cookieJar.clear();
  if (!hasSupplierCredentials()) return false;
  const headers = { "User-Agent": USER_AGENT, "Accept-Language": "uk-UA,uk;q=0.9" };
  const first = await fetch(absUrl("/auth/"), { headers });
  storeCookies(first);
  await first.text();
  const body = new URLSearchParams({
    GEO_REGION: "",
    GEO_CITY: "",
    GEO_ISP: "",
    enter: "1",
    user_login: formatPhone(process.env.TOYSI_PHONE!),
    user_pw: process.env.TOYSI_PASSWORD!,
    tsRememberPass: "1",
  });
  const res = await fetch(absUrl("/auth/"), {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieHeader(),
    },
    body,
    redirect: "manual",
  });
  storeCookies(res);
  await res.text();
  // A guest listing contains "register to see price" buttons; a logged-in one does not.
  const check = await fetchHtml(SUPPLIER_ROOT_PATH, 25000, 1);
  loggedIn = !check.includes("/register/?back_product=");
  return loggedIn;
}

export async function fetchHtml(path: string, timeoutMs = 25000, retries = 2): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = {
        "User-Agent": USER_AGENT,
        "Accept-Language": "uk-UA,uk;q=0.9",
      };
      if (cookieJar.size > 0) headers["Cookie"] = cookieHeader();
      const res = await fetch(absUrl(path), { headers, signal: controller.signal, redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

function clean(text: string | undefined | null): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

/** Supplier sometimes names groups like "NEW: ПОБУТОВА ХІМІЯ"; shoppers should see "Побутова хімія". */
function categoryName(text: string | undefined | null): string {
  const name = clean(text).replace(/^NEW:\s*/i, "");
  if (name === name.toUpperCase() && /[A-ZА-ЯІЇЄҐ]/.test(name)) {
    const lower = name.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }
  return name;
}

export function parseCategoryTree(html: string): SupplierGroup[] {
  const root = parse(html);
  const groups: SupplierGroup[] = [];
  const seen = new Set<string>();
  for (const li of root.querySelectorAll("li.toysi-group")) {
    const id = li.getAttribute("data-cat");
    if (!id || seen.has(id) || VIRTUAL_GROUPS.has(id)) continue;
    const link = li.childNodes.find(
      (n): n is HTMLElement => (n as HTMLElement).tagName === "A",
    );
    if (!link) continue;
    const href = link.getAttribute("href");
    if (!href) continue;
    seen.add(id);
    const children: SupplierCategory[] = [];
    const sub = li.querySelector("ul.cat-sub");
    if (sub) {
      for (const subLi of sub.querySelectorAll("li")) {
        const subId = subLi.getAttribute("data-cat");
        const a = subLi.querySelector("a");
        const subHref = a?.getAttribute("href");
        if (!subId || !a || !subHref) continue;
        children.push({ supplierCatId: subId, name: categoryName(a.text), path: subHref });
      }
    }
    groups.push({ supplierCatId: id, name: categoryName(link.text), path: href, children });
  }
  return groups;
}

function parseMoney(text: string | undefined | null): number | null {
  if (!text) return null;
  const m = text.replace(/\s/g, "").match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]!.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseListing(html: string): ListingPage {
  const root = parse(html);
  const products: ListedProduct[] = [];
  for (const el of root.querySelectorAll("div.product")) {
    const link = el.querySelector(".product-container > a");
    const path = link?.getAttribute("href");
    const descText = el.querySelector(".description")?.text ?? "";
    const skuMatch = descText.match(/Код товару:\s*(\d{3,})/);
    if (!path || !skuMatch) continue;
    const img = el.querySelector("img.product-photo");
    const imgSrc = img?.getAttribute("src") ?? null;
    const imgId = img?.getAttribute("id")?.replace(/^img/, "") ?? null;
    const photo2 = el.getAttribute("data-photo2")?.trim() || null;

    // Logged-in wholesale view: explicit price block. Guest view: hidden discount table.
    let price = parseMoney(el.querySelector(".price .price-sale")?.text);
    if (price === null) {
      const guest = el.querySelector(".Price_min_0 b")?.text.split("=")[1];
      price = parseMoney(guest);
    }
    const oldPrice = parseMoney(el.querySelector(".price .price-regular del")?.text);

    const stockEl = el.querySelector(".product-stock .stock");
    const stock = stockEl ? parseStock(stockEl.innerHTML) : { min: null, max: null };
    const articleMatch = descText.match(/Артикул:\s*([^\n\r]+)/);

    products.push({
      sku: skuMatch[1]!,
      supplierProductId: imgId,
      name: clean(el.querySelector("h3")?.text),
      path,
      imageUrl: imgSrc && !imgSrc.includes("no-photo") ? absUrl(imgSrc) : null,
      image2Url: photo2 && !photo2.includes("no-photo") ? absUrl(photo2) : null,
      price,
      oldPrice: oldPrice !== null && price !== null && oldPrice > price ? oldPrice : null,
      stockQty: stock.min,
      stockQtyMax: stock.max,
      article: articleMatch ? clean(articleMatch[1]) || null : null,
      isNew: !!el.querySelector(".corner.color_newitem"),
    });
  }
  let maxOffset = 0;
  for (const m of html.matchAll(/\/offset(\d+)\//g)) {
    maxOffset = Math.max(maxOffset, Number(m[1]));
  }
  return { products, maxOffset };
}

export function listingPagePath(categoryPath: string, offset: number): string {
  const base = categoryPath.replace(/\/$/, "");
  return offset === 0 ? base : `${base}/offset${offset}/`;
}

/**
 * Supplier stock label → guaranteed (min) and upper (max) units.
 * Formats: "3 шт." (exact), "10...50 шт." (range), "понад 100 шт." (open range; product pages also carry
 * the exact count in an HTML comment: "<!-- 206 шт.--> понад 100 шт.").
 */
export function parseStock(raw: string): { min: number; max: number | null } {
  const hidden = raw.match(/<!--\s*(\d+)\s*шт/);
  if (hidden) {
    const n = Number(hidden[1]);
    return { min: n, max: n };
  }
  const t = raw.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, " ").replace(/&gt;/g, ">");
  const range = t.match(/(\d+)\s*\.{2,}\s*(\d+)/);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  const over = t.match(/(?:понад|більше|>)\s*(\d+)/i);
  if (over) return { min: Number(over[1]), max: null };
  const n = t.match(/(\d+)/);
  const v = n ? Number(n[1]) : 0;
  return { min: v, max: v };
}

/** Exact stock from a product page (only the product page reveals counts above 100). */
export function parseProductStock(html: string): { min: number; max: number | null } | null {
  const m = html.match(/<span class="stock">([\s\S]*?)<\/span>/);
  return m ? parseStock(m[1]!) : null;
}

export function parseProductDetails(html: string, sku: string): ProductDetails {
  const root = parse(html);
  const articleText = root.querySelector(".sku-article")?.text ?? "";
  const article = clean(articleText.replace(/Артикул:?/i, "")) || null;
  const description = extractDescription(html);
  const images = new Set<string>();
  const re = new RegExp(`/p/(?:\\d+/)?(?:enl_)?${sku}\\.(?:jpg|jpeg|png|webp)`, "gi");
  for (const m of html.matchAll(re)) {
    images.add(absUrl(m[0]));
  }
  return { article, description, images: [...images].slice(0, 10) };
}

/** Pulls the "Опис" block as plain text paragraphs, dropping the wholesale-only sales pitch. */
function extractDescription(html: string): string | null {
  const m = html.match(/<p class="p20">\s*Опис\s*<\/p>\s*<p class="p16">([\s\S]*?)<\/p>\s*<br>/);
  if (!m) return null;
  let body = m[1]!;
  const cut = body.search(/Переваги для магазину/i);
  if (cut >= 0) body = body.slice(0, cut);
  const text = body
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(p|li|ul|div)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n\n");
  return text || null;
}
