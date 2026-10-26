---
name: toysi.ua supplier scraping
description: How the catalog is sourced from toysi.ua and its non-obvious limits
---
- Items without a price on toysi.ua are out of stock (confirmed with wholesale login: they show "0 шт."). Category listings include them, so "missing price" ≠ "hidden price".
**Why:** first guest sync wrongly showed 1240 sold-out items as in stock; logged-in sync corrected it.
**How to apply:** availability comes from the stock count when logged in; never treat a priceless item as sellable.
- Product pages: description is the `<p class="p20">Опис</p><p class="p16">…</p><br>` block (nested <p>, so regex not DOM); cut the "Переваги для магазину" wholesale pitch. Full photos at /p/{sku}.jpg, /p/2/{sku}.jpg …
- Products with `/images/no-photo.png` are stored with null image.
- Stock labels are NOT exact above small counts: listings show "N шт." (small), "5...10", "10...50", "50...100", "понад 100". The product page often hides the exact count in an HTML comment (`<!-- 206 шт.-->`): almost always for "понад 100", ~75% for "50...100", ~25% for "10...50", ~8% for "5...10". We store min + max (null = unknown).
- Owner decision (2026-10-26): admin stock money has a toggle «По 1 шт.» (default) / «Усі штуки». "All units" = exact count, or the range minimum, as ONE number with a note on how many are approximate. Showing "від…до" ranges and counting exact-only were both rejected earlier.
**Why:** the user wanted to count each product once, then also all units, and to switch between the two.
**Why:** first version took the first number, so stock money was silently understated and items at "5...10" showed "Лишилось 5 шт.".
**How to apply:** never present a single stock number as exact unless min == max.
