# Пташеня — магазин дитячих товарів

Online baby-goods store (Ukrainian UI) that resells the warehouse stock of supplier toysi.ua with a markup, plus an owner-only admin panel.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, Clerk keys (managed). Optional: `ADMIN_EMAIL` (default rozhnyay@gmail.com), `TOYSI_PHONE` + `TOYSI_PASSWORD` (supplier wholesale login — unlocks prices)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- Frontend: `artifacts/baby-shop` (store pages in `src/pages/store`, admin in `src/pages/admin`)
- API: `artifacts/api-server/src/routes` (catalog, orders, admin); supplier scraper `src/lib/supplier.ts`; sync engine + daily scheduler `src/lib/sync.ts`
- DB schema: `lib/db/src/schema`; API contract: `lib/api-spec/openapi.yaml`

## Architecture decisions

- Admin = signed-in Clerk user whose VERIFIED email equals ADMIN_EMAIL; checked server-side on every /api/admin route. No roles table.
- Customers can also sign in (same Clerk app; header «Увійти» → /account «Мій кабінет»). Checkout stays possible without an account. A customer's orders = orders.user_id (set when ordering while signed in, or via "claim" by number+phone) OR order email matching one of their verified emails (`/api/me/orders`). Phone sign-in isn't available in Replit-managed Clerk, so email/Google only.
- Multilingual search (owner request 2026-10-29): storefront search understands Russian and Transcarpathian/western words via the synonym groups in `api-server/src/lib/search-synonyms.ts` (every query word must match; dictionary stems match at word start; falls back to "any word" when nothing matches all). The same list is served at `/api/search/aliases` and shown on pages for Google (home block «Пишіть, як звикли», «Також шукають» on category/product pages, extra words in meta descriptions). Add new words there — nowhere else. Chosen over a separate Russian site version.
- Parcel tracking: owner enters the Nova Poshta ТТН on the admin order page (auto-moves new/confirmed → shipped); customers see live NP status (keyless TrackingDocument.getStatusDocuments, cached 10 min, `src/lib/parcel.ts`) in the account, on /track and on the order.
- Catalog comes from scraping toysi.ua HTML listings (52/page, `/offsetN/` pagination). Products of fully scanned categories not seen in a run become out of stock; failed categories are left untouched.
- Retail price = supplier price × (1 + markup%) (ceil if rounding) unless the owner sets a price override. Products with no known price are hidden from the store.
- Product images are hotlinked from toysi.ua; descriptions/extra photos are fetched lazily on first product view.
- SEO: per-product seo_title/seo_description are generated in ONE SQL UPDATE from owner templates (settings) — `src/lib/seo.ts`; run from admin SEO page and automatically after each sync (toggle). Sitemap served at `/api/sitemap.xml` (origin taken from request host). Storefront sets title/meta/OG/canonical/JSON-LD client-side via `useSeo`. Admin SEO center adds an audit (score + issue metrics) and a browsable list of every sitemap link with per-link tools (`/admin/seo/audit`, `/admin/seo/links`, `/api/admin/export/seo-links.csv`) — `src/lib/seo-audit.ts`; its static-page/category titles mirror the storefront's hard-coded ones, keep them in sync.
- Supplier purchase price changes are recorded in `price_changes` during sync (shown in admin "Ціни постачальника").
- Admin money figures (stock value, revenue, profit) and the admin "in stock" filter/KPI count only products ready to ship within 3 days — on the supplier's own warehouse; "під замовлення" items (delivery_days, partner warehouse, up to 7 days) are excluded by default and listed under their own filter (owner decision 2026-10-26); the dashboard stock overview shows ready / on-order / total side by side with both "per 1 unit" and "all units" money (owner request 2026-10-27). The storefront still sells on-order items but labels each one "доставка 7–10 днів" everywhere a customer sees it (owner decision 2026-10-27). By default they count ONE unit of every such product that is sellable in the store (in stock, visible, priced, enabled category), at exact store prices, shown in full hryvnias with an "as of <last sync>" banner + refresh button. A «По 1 шт. / Усі штуки» toggle (remembered in the browser) switches to every unit in stock: exact supplier count, or the range minimum when only a range is known, with a note on how many products are approximate (owner's choice, 2026-10-26). Supplier quantities (min/max ranges) are still stored and shown per product.
- CSV exports (`/api/admin/export/*.csv`) are plain links authenticated by the Clerk session cookie; semicolon + BOM for Ukrainian Excel. Not in OpenAPI.
- Only supplier categories enabled in admin (sync_sources) are imported and shown. All 20 are enabled: full sync ≈ 1400 listing pages, ~62k products (~24k in stock), ~15 min.

## Product

- Storefront: catalog with search/filters, product pages, cart, checkout without account (Nova Poshta only — owner decision; city + any branch/parcel locker picked from the live Nova Poshta directory via /api/delivery/np/*, no API key needed; COD or card transfer), order tracking by number+phone, customer account with order history and live Nova Poshta parcel status.
- Admin (/admin): dashboard KPIs, charts, warehouse value/profit by category; orders workflow + Excel export; products with profit columns, money summary per filter, what-if markup calculator, bulk actions, Excel export; SEO center; supplier price changes; settings; supplier sync (manual + daily); Ctrl+K command palette; new-order alerts.

## User preferences

- Owner speaks Ukrainian and is non-technical; reply in Ukrainian, plain language.
- Admin access must be restricted to rozhnyay@gmail.com only.

## Gotchas

- toysi.ua "-sklad" category listings include out-of-stock items. Logged in (TOYSI_PHONE/TOYSI_PASSWORD), each card shows exact stock ("На складі : N шт.") and price in `.price-sale`; out-of-stock items have no price. As a guest, "no price" is used as the out-of-stock signal. Login is POST /auth/ (enter=1, user_login as +38(0XX)XXX-XX-XX, user_pw).
- Guest and logged-in listing markup differ (`div.product.product-req` vs `div.product`); the parser handles both.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
