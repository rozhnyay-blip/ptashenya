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
- Catalog comes from scraping toysi.ua HTML listings (52/page, `/offsetN/` pagination). Products of fully scanned categories not seen in a run become out of stock; failed categories are left untouched.
- Retail price = supplier price × (1 + markup%) (ceil if rounding) unless the owner sets a price override. Products with no known price are hidden from the store.
- Product images are hotlinked from toysi.ua; descriptions/extra photos are fetched lazily on first product view.
- Only supplier categories enabled in admin (sync_sources) are imported and shown.

## Product

- Storefront: catalog with search/filters, product pages, cart, checkout without account (Nova Poshta/Ukrposhta/courier/pickup, COD or card transfer), order tracking by number+phone.
- Admin (/admin): dashboard KPIs and charts, orders workflow, product visibility/featured/price override, settings (markup, min order), supplier sync (manual + daily at chosen Kyiv hour).

## User preferences

- Owner speaks Ukrainian and is non-technical; reply in Ukrainian, plain language.
- Admin access must be restricted to rozhnyay@gmail.com only.

## Gotchas

- toysi.ua shows most wholesale prices only to logged-in clients; as a guest only ~30% of items have a price. Login is POST /auth/ (enter=1, user_login in +38(0XX)XXX-XX-XX format, user_pw).
- The price regex for logged-in listings is unverified until real credentials are added — check `products.supplier_price` fill rate after the first logged-in sync.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
