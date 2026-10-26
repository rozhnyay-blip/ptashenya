---
name: toysi.ua supplier scraping
description: How the catalog is sourced from toysi.ua and its non-obvious limits
---
- Items without a price on toysi.ua are out of stock (confirmed with wholesale login: they show "0 шт."). Category listings include them, so "missing price" ≠ "hidden price".
**Why:** first guest sync wrongly showed 1240 sold-out items as in stock; logged-in sync corrected it.
**How to apply:** availability comes from the stock count when logged in; never treat a priceless item as sellable.
- Product pages: description is the `<p class="p20">Опис</p><p class="p16">…</p><br>` block (nested <p>, so regex not DOM); cut the "Переваги для магазину" wholesale pitch. Full photos at /p/{sku}.jpg, /p/2/{sku}.jpg …
- Products with `/images/no-photo.png` are stored with null image.
