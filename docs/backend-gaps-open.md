# Backend gaps — currently open

Everything here needs sir: a new field, a changed query, or a confirmation.
Items fixable on the frontend are not listed — those get fixed, not tracked.

`docs/primo-bugs.md` is the historical log (all rows Fixed).
`docs/engagement-backend-gaps.md` is the Engagement-specific list, still open.

Last reviewed: 2026-09-10

---

## Blocking / demo-visible

### 1. POS orders display as "Guest"
**Endpoints:** `GET /boutique/orders`, `GET /boutique/orders/:id`
POS sales save `customer_id` correctly, but `name` / `email` / `phone` come back
`null` because they are joined from `user_id` only — a POS sale has no `user_id`.
Confirmed live on order `ed322bcf-392c-4c93-acb8-449bf95e8a5d`.
**Ask:** fall back to `customer_id` when `user_id` is null, on both the list and
the detail endpoint.
**Workaround in place:** `Orders.jsx` `fetchDetail` looks the customer up via
`GET /boutique/customers/:id` when `name` is null. Detail panel only — the list
still shows "Guest". Remove the workaround once fixed.

### 2. `days_in_stock` counts from `created_at`, not stock arrival
**Endpoint:** `GET /boutique/products`
`first_received_at` is `null` on every product, so `days_in_stock` appears to
count from when the product was typed into Primo. A boutique entering existing
stock has everything read "Fresh · 3d" and it never ages — which disables the
whole Aging & Markdowns engine for them.
**Ask:** should `first_received_at` be settable, or default to the first stock
movement?

### 3. Brand catalogue is empty
**Endpoint:** `GET /boutique/brands` → `{ own: [], global: [] }`
No global brand catalogue on dev, so every product saves as Own Label and the
Brand column is blank throughout the portal.
**Ask:** is `global` meant to be seeded?

---

## Confirmation needed (low risk, unverified)

### 4. `PATCH /boutique/markdowns/rules` — merge or replace?
We send only the changed field (e.g. just `apply_mode`). If the handler replaces
the whole rule, changing the dropdown silently wipes `discount_pct`.

### 5. `/markdowns/approvals` returns decimals as strings
`"88.00"`, `"35.00"`, `"-602.99"` — while `/markdowns/preview` returns real
numbers for the same data. Handled on our side; worth aligning.

### 6. Markdowns: no reason flag when cost is missing
A product with `cost_price: null` gets `margin_pct: null` and is forced to
approval. The portal can only show a blank margin.
**Ask:** a `reason: "no_cost"` on the preview row so we can say "add a cost price".

### 7. Inventory list pagination
Unconfirmed whether `GET /boutique/inventory` pages. `Products.jsx` loads every
page explicitly because the products endpoint caps at 20; Inventory assumes one
response.

---

## Presence / geofencing

### 8. No geofence field anywhere in the portal
`GET /boutiques/geofences` returns a boundary per boutique, but there is no
latitude / longitude / radius field in Store Profile, Locations or Add Location.
**Ask:** where is it set? If a boutique's geofence is missing, presence data
never arrives and the merchant sees a permanently locked heatmap with no reason.

### 9. Who reports presence opt-ins?
`POST /presence/coverage` is unassigned in every handoff — sir's own collection
notes say the step was never specified. Until someone calls it, `opted_in` stays
0 and the App Presence heatmap cannot unlock.

---

## Missing fields (cosmetic)

| # | Endpoint | Field | Effect |
|---|---|---|---|
| 10 | `GET /boutique/dashboard/stats` | `pickupRateChangePts` is null | pickup-rate tile shows no trend arrow |
| 11 | `GET /boutique/dashboard/stats` | no `expiringSoon` | derived from the capped reservation lists instead |
| 12 | reservations `activeReservations[]` | no `status` | Dashboard fetches pending + confirmed separately to compensate |
| 13 | `GET /boutique/products` | `product_limit` / `max_products` absent | falls back to `VITE_MAX_PRODUCTS`, so the plan cap may be wrong |
| 14 | products + inventory lists | `category_path` missing on one of them | category filter has to work off the loaded array |
| 15 | `GET /boutique/products` | `variant_count` is the string `"3"` | needs coercion if ever displayed |

---

## Translations

### 16. Reload `primo5.json` and bump `translationsVersion`
4,787 keys as of 2026-09-10. The portal caches the bundle keyed on the version
string, so browsers keep serving the old one until it is bumped.

### 17. 764 unused keys in the bundle
Including the whole `marketing.*` section (44 keys) — that screen was replaced
by Engagement. Not worth translating. A removal list follows once every tab has
been reviewed; deleting now risks breaking something unverified.

---

## Parked by the user (not to chase)

- **Data-translation bug** — customer and product names run through the
  `Accept-Language` pipeline and come back translated ("Strom Jacket" etc.).
- **Wrong Italian words** in sir's bundle — "Coerenza" for Brand, "Candidati"
  for Apply, "Chiaro" for Clear.
- **Inventory 52-vs-28** stats mismatch.
- **Printed output language** — packing slip (22 strings) and price tags (4).
