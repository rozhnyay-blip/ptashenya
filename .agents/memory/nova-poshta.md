---
name: Nova Poshta delivery
description: Checkout delivery is Nova Poshta only; how the branch directory is queried
---
Checkout offers only Nova Poshta (owner decision, 2026-10-26). Server rejects other delivery methods for new orders; old enum values stay for historical orders.
**Why:** the user asked for "тільки нова пошта" and to find any branch.
**How to apply:** don't re-add Ukrposhta/courier/pickup in UI copy or checkout.

Directory: api.novaposhta.ua/v2.0/json with empty apiKey works for Address.searchSettlements and AddressGeneral.getWarehouses (use SettlementRef). FindByString accepts only one word — pick the numeric token (or longest word) and filter the rest locally; WarehouseId gives exact branch-number match.
