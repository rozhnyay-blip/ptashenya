---
name: toysi.ua supplier scraping
description: How the catalog is sourced from toysi.ua and its non-obvious limits
---
- Guests see prices only for some items (new/promo) via hidden `.Price_min_0` blocks; most items need a wholesale login.
**Why:** discovered during first sync — 1402 of 2006 baby-care items had no price.
**How to apply:** if prices are missing, check TOYSI_PHONE/TOYSI_PASSWORD secrets and whether the logged-in listing markup differs from the guest one before changing parsing.
- Product pages: description is the `<p class="p20">Опис</p><p class="p16">…</p><br>` block (nested <p>, so regex not DOM); cut the "Переваги для магазину" wholesale pitch. Full photos at /p/{sku}.jpg, /p/2/{sku}.jpg …
- Products with `/images/no-photo.png` are stored with null image.
