import { db } from "@workspace/db";
import { sql, type SQL } from "drizzle-orm";
import { getSettings } from "./settings";
import { expectedSeoSql } from "./seo";
import { sellableSql } from "./admin-filters";

export const SEO_ISSUES = [
  "no_seo",
  "outdated",
  "duplicate_title",
  "truncated_title",
  "no_image",
  "short_title",
  "short_description",
] as const;
export type SeoIssue = (typeof SEO_ISSUES)[number];

const SHORT_TITLE = 30;
const SHORT_DESCRIPTION = 70;

// Must match the storefront's static page / category SEO (index.html, src/lib/seo.ts, pages/store/catalog.tsx).
const HOME_TITLE = "Пташеня — товари для дітей з доставкою по Україні";
const HOME_DESCRIPTION =
  "Іграшки, конструктори, книги, товари для догляду за малюком та творчості. Понад 20 000 товарів у наявності, щоденне оновлення складу, доставка Новою Поштою.";
const CATALOG_TITLE = "Каталог товарів для дітей — Пташеня";

/**
 * Every sellable product with its SEO issue flags. Same product set as sitemap.xml.
 * Columns: id, name, sku, image_url, sales_count, title, description, + one boolean per issue.
 */
let outdatedCache: { key: string; ids: string; expires: number } | null = null;

/**
 * Comma-separated ids of products whose stored SEO differs from what the current templates would produce
 * (price/name changed since the last run). Expensive (~2 s), so cached briefly per settings state.
 */
async function outdatedIds(): Promise<string> {
  const s = await getSettings();
  const key = JSON.stringify([s.seoTitleTemplate, s.seoDescriptionTemplate, s.storeName, s.markupPercent, s.roundPrices, s.seoLastRunAt]);
  if (outdatedCache && outdatedCache.key === key && outdatedCache.expires > Date.now()) return outdatedCache.ids;
  const expected = expectedSeoSql(s);
  const r = await db.execute<{ ids: string | null }>(sql`select string_agg(products.id::text, ',') as ids from products
    where ${sellableSql} and products.seo_title is not null
      and (products.seo_title is distinct from ${expected.title} or products.seo_description is distinct from ${expected.description})`);
  const ids = r.rows[0]?.ids ?? "";
  outdatedCache = { key, ids, expires: Date.now() + 120_000 };
  return ids;
}

async function productRowsSql(): Promise<{ cte: SQL }> {
  const ids = await outdatedIds();
  const cte = sql`
    base as (
      select products.id, products.name, products.sku, products.image_url, products.sales_count,
        products.seo_title, products.seo_description,
        (products.id = any(string_to_array(${ids}, ',')::int[])) as changed,
        count(*) over (partition by products.seo_title) as same_title
      from products where ${sellableSql}
    ),
    prod as (
      select id, name, sku, image_url, sales_count,
        coalesce(seo_title, name) as title, coalesce(seo_description, '') as description,
        (seo_title is null) as no_seo,
        (seo_title is not null and changed) as outdated,
        (seo_title is not null and same_title > 1) as duplicate_title,
        (seo_title like '%…') as truncated_title,
        (image_url is null) as no_image,
        (seo_title is not null and char_length(seo_title) < ${SHORT_TITLE}) as short_title,
        (seo_title is not null and char_length(coalesce(seo_description, '')) < ${SHORT_DESCRIPTION}) as short_description
      from base
    )`;
  return { cte };
}

/** Categories that appear in sitemap.xml with their sellable product count (own + direct children). */
const categoryCte = sql`
  catcnt as (select products.category_id, count(*) as n from products where ${sellableSql} group by 1),
  cats as (
    select c.id, c.name,
      (coalesce(own.n, 0) + coalesce((select sum(cc.n) from catcnt cc join categories ch on ch.id = cc.category_id where ch.parent_id = c.id), 0))::int as cnt
    from categories c left join catcnt own on own.category_id = c.id
  )`;

export async function seoAudit() {
  const { cte } = await productRowsSql();
  const issueCols = SEO_ISSUES.map((i) => sql`(count(*) filter (where ${sql.raw(i)}))::int as ${sql.raw(i)}`);
  const [[agg], [catAgg], [dup]] = await Promise.all([
    db.execute<Record<string, number>>(sql`with ${cte}
      select count(*)::int as products, ${sql.join(issueCols, sql`, `)},
        (count(*) filter (where not (${sql.raw(SEO_ISSUES.join(" or "))})))::int as clean,
        coalesce(round(avg(char_length(title)) filter (where not no_seo)), 0)::int as avg_title,
        coalesce(round(avg(char_length(description)) filter (where not no_seo)), 0)::int as avg_desc,
        (count(*) filter (where not no_seo and char_length(title) < 30))::int as t1,
        (count(*) filter (where not no_seo and char_length(title) between 30 and 49))::int as t2,
        (count(*) filter (where not no_seo and char_length(title) between 50 and 70))::int as t3,
        (count(*) filter (where not no_seo and char_length(title) > 70))::int as t4,
        (count(*) filter (where not no_seo and char_length(description) < 70))::int as d1,
        (count(*) filter (where not no_seo and char_length(description) between 70 and 119))::int as d2,
        (count(*) filter (where not no_seo and char_length(description) between 120 and 160))::int as d3,
        (count(*) filter (where not no_seo and char_length(description) > 160))::int as d4,
        (select count(*) from products where ${sellableSql} and products.delivery_days > 3)::int as on_order
      from prod`).then((r) => r.rows),
    db.execute<{ n: number }>(sql`with ${categoryCte} select (count(*) filter (where cnt > 0))::int as n from cats`).then((r) => r.rows),
    db.execute<{ n: number }>(sql`with ${cte} select count(distinct title)::int as n from prod where duplicate_title`).then((r) => r.rows),
  ]);
  const a = agg ?? {};
  const products = a.products ?? 0;
  const categoryPages = catAgg?.n ?? 0;
  const staticPages = 2;
  // Weighted penalty: share of product pages with each issue × importance.
  const weights: Record<SeoIssue, number> = {
    no_seo: 45,
    outdated: 20,
    duplicate_title: 12,
    no_image: 10,
    truncated_title: 6,
    short_title: 4,
    short_description: 3,
  };
  const penalty = products
    ? SEO_ISSUES.reduce((sum, i) => sum + weights[i] * ((a[i] ?? 0) / products), 0)
    : 100;
  return {
    score: Math.max(0, Math.min(100, Math.round(100 - penalty))),
    totalUrls: staticPages + categoryPages + products,
    staticPages,
    categoryPages,
    productPages: products,
    cleanProducts: a.clean ?? 0,
    onOrderProducts: a.on_order ?? 0,
    issues: SEO_ISSUES.map((i) => ({ issue: i, count: a[i] ?? 0, groups: i === "duplicate_title" ? (dup?.n ?? 0) : null })),
    avgTitleLength: a.avg_title ?? 0,
    avgDescriptionLength: a.avg_desc ?? 0,
    titleBuckets: [
      { label: "до 30", count: a.t1 ?? 0, good: false },
      { label: "30–49", count: a.t2 ?? 0, good: true },
      { label: "50–70", count: a.t3 ?? 0, good: true },
      { label: "понад 70", count: a.t4 ?? 0, good: false },
    ],
    descriptionBuckets: [
      { label: "до 70", count: a.d1 ?? 0, good: false },
      { label: "70–119", count: a.d2 ?? 0, good: true },
      { label: "120–160", count: a.d3 ?? 0, good: true },
      { label: "понад 160", count: a.d4 ?? 0, good: false },
    ],
  };
}

export interface SeoLinkQuery {
  kind?: "all" | "page" | "category" | "product";
  issue?: SeoIssue;
  q?: string;
  page?: number;
  limit?: number;
}

export interface SeoLinkRow {
  kind: "page" | "category" | "product";
  id: number | null;
  path: string;
  title: string;
  description: string;
  imageUrl: string | null;
  sku: string | null;
  titleLength: number;
  descriptionLength: number;
  issues: SeoIssue[];
}

/** All public links (static pages, categories, products) with SEO and issues; paginated unless limit is 0. */
export async function seoLinks(query: SeoLinkQuery): Promise<{ items: SeoLinkRow[]; total: number }> {
  const { cte } = await productRowsSql();
  const kind = query.kind ?? "all";
  const issueFlags = SEO_ISSUES.map((i) => sql`case when ${sql.raw(i)} then ${i}::text end`);
  const parts: SQL[] = [];
  if ((kind === "all" || kind === "page") && !query.issue) {
    parts.push(sql`select 'page' as kind, null::int as id, '/' as path, ${HOME_TITLE}::text as title, ${HOME_DESCRIPTION}::text as description,
      null::text as image_url, null::text as sku, '{}'::text[] as issues, 0 as ord, 0::bigint as sort1, 0 as sort2`);
    parts.push(sql`select 'page', null, '/catalog', ${CATALOG_TITLE}::text, ${HOME_DESCRIPTION}::text, null, null, '{}'::text[], 0, 0, 1`);
  }
  if ((kind === "all" || kind === "category") && !query.issue) {
    parts.push(sql`select 'category', id, '/catalog/' || id, name || ' — купити в інтернет-магазині Пташеня',
      name || ': ' || cnt || ' товарів у наявності за доступними цінами. Щоденне оновлення складу, доставка Новою Поштою по всій Україні.',
      null, null, '{}'::text[], 1, -cnt::bigint, id from cats where cnt > 0`);
  }
  if (kind === "all" || kind === "product") {
    const where = query.issue ? sql`where ${sql.raw(query.issue)}` : sql``;
    parts.push(sql`select 'product', id, '/product/' || id, title, description, image_url, sku,
      array_remove(array[${sql.join(issueFlags, sql`, `)}]::text[], null), 2, -sales_count::bigint, id from prod ${where}`);
  }
  if (!parts.length) return { items: [], total: 0 };
  const q = query.q?.trim();
  const search = q
    ? sql`where (title ilike ${"%" + q + "%"} or path ilike ${"%" + q + "%"} or sku ilike ${"%" + q + "%"} or description ilike ${"%" + q + "%"})`
    : sql``;
  const limit = query.limit ?? 50;
  const offset = ((query.page ?? 1) - 1) * limit;
  const page = limit > 0 ? sql`limit ${limit} offset ${offset}` : sql``;
  const rows = await db.execute<{
    kind: SeoLinkRow["kind"];
    id: number | null;
    path: string;
    title: string;
    description: string;
    image_url: string | null;
    sku: string | null;
    issues: SeoIssue[];
    total: number;
  }>(sql`with ${cte}, ${categoryCte}, links(kind, id, path, title, description, image_url, sku, issues, ord, sort1, sort2) as (${sql.join(parts, sql` union all `)})
    select *, (count(*) over ())::int as total from links ${search}
    order by ord, sort1, sort2 ${page}`);
  let total = rows.rows[0]?.total ?? 0;
  if (!rows.rows.length && offset > 0) {
    const c = await db.execute<{ n: number }>(
      sql`with ${cte}, ${categoryCte}, links(kind, id, path, title, description, image_url, sku, issues, ord, sort1, sort2) as (${sql.join(parts, sql` union all `)}) select count(*)::int as n from links ${search}`,
    );
    total = c.rows[0]?.n ?? 0;
  }
  return {
    total,
    items: rows.rows.map((r) => ({
      kind: r.kind,
      id: r.id,
      path: r.path,
      title: r.title,
      description: r.description,
      imageUrl: r.image_url,
      sku: r.sku,
      titleLength: r.title.length,
      descriptionLength: r.description.length,
      issues: r.issues ?? [],
    })),
  };
}
