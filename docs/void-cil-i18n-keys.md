# Void / CIL (Returns) — i18n fixes

Unlike the previous three pages, this one mostly needed **wiring**, not new keys — the `ret.*`
namespace in `primo.json` already had almost everything this page needs; the code just wasn't
calling `t()` for most of it.

## Status

**Every user-visible string in `src/views/VoidCIL.jsx` now routes through `t()`.** Verified by
pseudo-localization (whole `ret` bundle served with every value wrapped in `⟦…⟧`, locale `it`)
across all four tabs, both in-progress sub-steps (Mark Item as Received → Issue Refund via Stripe),
and the completed/rejected banners. Zero unmarked strings — the only untranslated text left is
`MOCK_RETURNS` seed data (customer names, order IDs, product names, reason-detail sentences), which
stands in for backend/customer content, same treatment as `MI_SALE` in Promotions and `RP_SEED_DESC`
in Store Profile.

### Wired up (key already existed in `primo.json`, code just wasn't calling it)

| Where | Was | Now |
|---|---|---|
| Empty results | `No {statusLabel(...).toLowerCase()} returns.` | `t('ret.empty_list', { status })` |
| Table headers | `<th>Return ID</th>` etc., hardcoded | `t('ret.table.id')`, `.customer`, `.item`, `.reason`, `.opened`, `.status` |
| No selection | `Select a return to view details.` | `t('ret.empty_detail')` |
| Detail title | `Return #{id}` | `{t('ret.detail.return')} #{id}` |
| Detail subtitle | `Order #{id} · Opened {date}` | `{t('ret.detail.order')} #{id} · {t('ret.opened')} {date}` |
| Pipeline header | `Return Pipeline` | `t('ret.detail.pipeline')` |
| Step-3 action | `Mark Item as Received` | `t('ret.actions.mark_received')` |
| Step-4 action | `Issue Refund via Stripe` | `t('ret.actions.issue_refund')` |
| WhatsApp button | `WhatsApp {customer.split(' ')[0]} {...slice(1).join(' ')}` | `t('ret.actions.whatsapp', { name: customer })` — also drops a pointless split/rejoin that reconstructed the exact same string |

### New keys added

| Key | English default |
|---|---|
| `ret.item_meta` | Size {{size}} · {{colour}} · SKU: {{sku}} |
| `ret.item_qty_suffix` | · Qty {{qty}} |

## Pre-existing duplicate/orphan keys, not touched

`primo.json`'s `ret.*` namespace has several keys that duplicate ones this page actually uses, left
over from before this session — flagging for awareness, not removing (didn't want to delete anything
another consumer might already reference):

- `ret.title` / `ret.title_em` ("Returns &" / "Refunds") — this page's title comes from `Header.jsx`'s
  route→key map (`sidebar.void_cil`) instead, a different mechanism entirely; these two are unused.
- `ret.refund.*` (nested: `item_total`, `shipping`, `shipping_val`, `restock`, `total`) duplicates the
  flat `ret.item_total` / `ret.dhl_shipping` / `ret.prepaid` / `ret.restocking_fee` / `ret.refund_total`
  that the code actually uses.
- `ret.pipeline.step1_title`/`step1_sub` … `step5_title`/`step5_sub` duplicate `ret.pipeline.requested`/
  `requested_sub` … `refunded`/`refunded_sub`, which the code uses.
- `ret.tabs.*` duplicates `ret.tabs_labels.*` (code uses the latter).
- `ret.table.value` duplicates the top-level `ret.value` (code uses the latter, consistent with how
  it already used top-level `ret.opened`/`ret.reason_label`/`ret.refund_breakdown` elsewhere).
- `ret.detail.opened`, `ret.detail.reason`, `ret.detail.refund_breakdown`, `ret.actions.dhl` — same
  story, top-level equivalents already in use.
