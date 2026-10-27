import { db, settingsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { getSettings, retailPriceSql } from "./settings";
import { logger } from "./logger";

/** Placeholders an owner can use in SEO templates. */
export const SEO_PLACEHOLDERS = ["{name}", "{price}", "{category}", "{store}", "{sku}", "{article}"] as const;

export const SEO_TITLE_MAX = 70;
export const SEO_DESCRIPTION_MAX = 160;

/** Postgres expression: cut text to `max` chars on a word boundary and add an ellipsis. */
function fitSql(expr: ReturnType<typeof sql>, max: number) {
  // Prefer dropping whole trailing parts ("… | Store") over cutting a word in half.
  const head = sql`substring(left(${expr}, ${max}) from '^(.*\\S)\\s+[|—]\\s')`;
  const cut = sql`regexp_replace(regexp_replace(left(${expr}, ${max - 1}), '\\s+\\S*$', ''), '[\\s|—,.:;-]+$', '') || '…'`;
  return sql`(case when char_length(${expr}) <= ${max} then ${expr}
    when char_length(${head}) >= ${Math.floor(max * 0.6)} then ${head}
    else ${cut} end)`;
}

function templateSql(template: string, storeName: string, price: ReturnType<typeof sql>) {
  // Collapse whitespace and stray separators left by empty placeholders (e.g. no article).
  const filled = sql`replace(replace(replace(replace(replace(replace(${template}::text,
      '{name}', products.name),
      '{price}', (round(${price}, 2))::float8::text),
      '{category}', coalesce((select c.name from categories c where c.id = products.category_id), '')),
      '{store}', ${storeName}::text),
      '{sku}', products.sku),
      '{article}', coalesce(products.article, ''))`;
  const spaced = sql`regexp_replace(${filled}, '\\s+', ' ', 'g')`;
  const noRepeats = sql`regexp_replace(${spaced}, '([.,|—])(\\s*[.,|—])+', '\\1', 'g')`;
  const tight = sql`regexp_replace(${noRepeats}, '\\s+([.,])', '\\1', 'g')`;
  return sql`btrim(${tight}, ' ,|—')`;
}

/** SQL for the title/description the current templates would produce for `products` row (same as runSeo writes). */
export function expectedSeoSql(s: { seoTitleTemplate: string; seoDescriptionTemplate: string; storeName: string; markupPercent: string | number; roundPrices: boolean }) {
  const price = retailPriceSql(s as Parameters<typeof retailPriceSql>[0]);
  return {
    title: fitSql(templateSql(s.seoTitleTemplate, s.storeName, price), SEO_TITLE_MAX),
    description: fitSql(templateSql(s.seoDescriptionTemplate, s.storeName, price), SEO_DESCRIPTION_MAX),
  };
}

let running = false;

export function isSeoRunning(): boolean {
  return running;
}

/** Regenerates SEO title and description for every product from the owner's templates. */
export async function runSeo(): Promise<{ updated: number; durationMs: number; lastRunAt: Date }> {
  if (running) throw new Error("SEO вже оновлюється");
  running = true;
  const started = Date.now();
  try {
    const s = await getSettings();
    const { title, description } = expectedSeoSql(s);
    const now = new Date();
    const result = await db.execute(
      sql`update products set seo_title = ${title}, seo_description = ${description}, seo_updated_at = ${now}`,
    );
    const updated = result.rowCount ?? 0;
    await db
      .update(settingsTable)
      .set({ seoLastRunAt: now, seoLastRunCount: updated })
      .where(eq(settingsTable.id, 1));
    const durationMs = Date.now() - started;
    logger.info({ updated, durationMs }, "SEO regenerated");
    return { updated, durationMs, lastRunAt: now };
  } finally {
    running = false;
  }
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Builds sitemap.xml for every sellable product and category. `origin` like https://shop.example. */
export async function buildSitemap(origin: string): Promise<string> {
  const visible = sql`p.is_active and p.in_stock and coalesce(p.price_override, p.supplier_price, 0) > 0
    and p.source_cat_id in (select supplier_cat_id from sync_sources where enabled)`;
  const products = await db.execute<{ id: number; updated_at: Date }>(
    sql`select p.id, p.updated_at from products p where ${visible} order by p.id`,
  );
  const categories = await db.execute<{ id: number }>(
    sql`select distinct c.id from categories c
        where exists (select 1 from products p where ${visible}
          and (p.category_id = c.id or p.category_id in (select id from categories ch where ch.parent_id = c.id)))
        order by c.id`,
  );
  const base = origin.replace(/\/$/, "");
  const urls: string[] = [
    `<url><loc>${xmlEscape(base)}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    `<url><loc>${xmlEscape(base)}/catalog</loc><changefreq>daily</changefreq><priority>0.9</priority></url>`,
  ];
  for (const c of categories.rows) {
    urls.push(`<url><loc>${xmlEscape(base)}/catalog/${c.id}</loc><changefreq>daily</changefreq><priority>0.7</priority></url>`);
  }
  for (const p of products.rows) {
    const lastmod = new Date(p.updated_at).toISOString().slice(0, 10);
    urls.push(`<url><loc>${xmlEscape(base)}/product/${p.id}</loc><lastmod>${lastmod}</lastmod><priority>0.6</priority></url>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}
