# Promotions — new i18n keys

All `t('key')` calls used by `src/views/Promotions.jsx` (Your Sale / Seasonal Saldi / Mi Italia Sale
tabs). English defaults below are **authored for this doc**, not copied from the code — unlike the
Returns Policy keys, none of these `t()` calls carry a `defaultValue` second argument, so there is no
in-code fallback text to read from. Everything here is a draft, matched to this app's tone (formal
but plain, no marketing fluff) and **not native-reviewed**. No Italian column yet — see "Two issues"
below for why that matters more here than it did for Returns Policy.

## Status

**All user-visible strings on this page now route through `t()`.** Verified by pseudo-localization:
the whole `promotions` bundle was served with every value wrapped in `⟦…⟧` markers and all three tabs
were driven through their states (item selected, AI Suggest run, all six Mi Italia demo states, and a
`Veneto` region switch to trigger the blocked/unverified compliance path). Everything rendering
without markers was product data (names, SKUs, categories), prices, or numbers — no hardcoded UI text
remained.

### One thing still to flag

**No `defaultValue` anywhere in this file.** Every `t()` call is `t('promotions.xxx')` with no second
argument. Until the backend's `/auth/boutique/translations` response includes a `promotions` bundle,
every label on this page renders as its raw dotted key — there is no English fallback to catch it in
the interim, unlike Returns Policy. Getting this key set into the backend catalog is **required for
the page to be usable**, not just a polish step.

### Code changes made to reach that state

These touched `src/views/Promotions.jsx` render/logic code, not just the key list:

- `checkCompliance()` and `aiSuggestLine()` now take `t` and return localized `msg` / reason strings;
  callers pass `t` and include it in their `useMemo` deps so findings re-render on language change.
- **Findings now carry a stable `code`.** `miLegal` previously derived legality via
  `f.msg.includes('bans promotions')` — a string match against English message text that would have
  silently broken the moment the message was translated, wrongly reporting a promotion as lawful. It
  now matches `f.code === 'presale_ban'`.
- `MI_STATE_META` entries changed from `label: 'Opted in'` to `labelKey: 'promotions.mi.state.opted_in'`;
  both render sites call `t(...)`.
- `fmtDate()` reads the active locale via `useLangStore.getState().lang` (same pattern `lib/api.js`
  already uses) so month names follow the UI language — previously hardcoded to `'en-GB'`, which
  rendered "4 Jul 2026" even in Italian.
- The `MI_SALE` constant (`'The Autumn Edit'`, tier `'Maison'`, category `'Outerwear'`) is left
  untranslated on purpose — it is mock data standing in for backend content, which will arrive
  already localized.

---

## `promotions.region.*`

| Key | English default |
|---|---|
| `promotions.region.label` | Region |
| `promotions.region.unverified` | (rules unverified) |
| `promotions.region.note` | Sets the saldi calendar and promotion rules that apply below. |

## `promotions.tabs.*`

| Key | English default |
|---|---|
| `promotions.tabs.your_sale` | Your Sale |
| `promotions.tabs.seasonal_saldi` | Seasonal Saldi |
| `promotions.tabs.mi_italia_sale` | Mi Italia Sale |

## `promotions.compliance.*`

The `msg` strings below are emitted by `checkCompliance()`. Each finding also carries a stable `code`
(`no_rules`, `unverified_region`, `presale_ban`, `no_items`, `item_not_below_ref`, `item_below_cost`,
`show_original`) — **branch on the code, never on the message text**, which changes per locale.

| Key | English default |
|---|---|
| `promotions.compliance.ok` | Compliant |
| `promotions.compliance.blocked` | Blocked |
| `promotions.compliance.no_rules` | No saldi rules on file for {{region}}. |
| `promotions.compliance.unverified_region` | Saldi rules for {{region}} are not yet confirmed by a regional trade association — start is blocked until verified. |
| `promotions.compliance.presale_ban` | {{region}} bans promotions in the {{days}} days before {{season}} saldi ({{from}} – {{to}}). Adjust the window. |
| `promotions.compliance.no_items` | No items selected. |
| `promotions.compliance.item_not_below_ref` | {{name}}: sale price is not below the reference price ({{ref}}) — not a lawful discount. |
| `promotions.compliance.item_below_cost` | {{name}}: selling below cost ({{cost}}). |
| `promotions.compliance.show_original` | Show the original price and discount % next to each item at the point of sale. |

## `promotions.ai.*`

Reason fragments joined with ` · ` into the AI suggestion line.

| Key | English default |
|---|---|
| `promotions.ai.stock_180` | in stock over 180 days |
| `promotions.ai.stock_90` | in stock over 90 days |
| `promotions.ai.thin_margin` | thin margin, discount capped |
| `promotions.ai.healthy_margin` | healthy margin |
| `promotions.ai.floored_cost` | floored at cost |

## `promotions.items.*`

Shared by the item table on both the Your Sale and Seasonal Saldi tabs.

| Key | English default |
|---|---|
| `promotions.items.empty` | No products found. |
| `promotions.items.loading` | Loading products… |
| `promotions.items.ai_prefix` | AI: |
| `promotions.items.days_short` | {{days}} d |
| `promotions.items.qty` | Qty |
| `promotions.items.aging` | Aging |
| `promotions.items.current` | Current |
| `promotions.items.ref_30d` | 30-day ref. price |
| `promotions.items.cost` | Cost |
| `promotions.items.gm_label` | Margin |
| `promotions.items.discount_pct` | Discount % |
| `promotions.items.sale_price` | Sale price |
| `promotions.items.final` | Final price |
| `promotions.items.edited` | Edited |
| `promotions.items.reset` | Reset |
| `promotions.items.not_below_ref` | Sale price is not below the reference price — not a lawful discount. |
| `promotions.items.below_cost` | Selling below cost. |

## `promotions.self.*` (Your Sale tab)

| Key | English default |
|---|---|
| `promotions.self.card_title` | Your |
| `promotions.self.card_title_em` | Sale |
| `promotions.self.default_name` | New sale campaign |
| `promotions.self.name_label` | Sale Name |
| `promotions.self.discount_label` | Discount % |
| `promotions.self.start_label` | Start Date |
| `promotions.self.end_label` | End Date |
| `promotions.self.items_title` | Select |
| `promotions.self.items_title_em` | Items |
| `promotions.self.suggest_btn` | AI Suggest |
| `promotions.self.ref_note` | Reference price is today's retail price — a 30-day price history feed isn't wired in yet. |
| `promotions.self.start_btn` | Start Sale |
| `promotions.self.toast_started` | {{name}} started with {{count}} items. |

## `promotions.saldi.*` (Seasonal Saldi tab)

`saldi` (the legal Italian seasonal-sale term) is left untranslated/hardcoded in the JSX itself
(`<em>saldi</em>`) — not a key here, flagging only so it isn't duplicated by mistake.

| Key | English default |
|---|---|
| `promotions.saldi.banner_tag` | Seasonal Saldi |
| `promotions.saldi.summer_title` | Summer |
| `promotions.saldi.winter_title` | Winter |
| `promotions.saldi.run_from` | {{season}} saldi run in {{region}} from {{date}} for {{days}} days. |
| `promotions.saldi.card_title` | Saldi |
| `promotions.saldi.card_title_em` | Settings |
| `promotions.saldi.info_alert` | Saldi dates and duration are fixed by regional law — you can only choose which products participate and at what discount. |
| `promotions.saldi.season_label` | Season |
| `promotions.saldi.season_summer` | Summer |
| `promotions.saldi.season_winter` | Winter |
| `promotions.saldi.discount_label` | Discount % |
| `promotions.saldi.start_fixed` | Start Date (fixed by law) |
| `promotions.saldi.end_by` | Must End By |
| `promotions.saldi.items_title` | Select |
| `promotions.saldi.items_title_em` | Items |
| `promotions.saldi.suggest_btn` | AI Suggest |
| `promotions.saldi.start_btn` | Start Saldi |
| `promotions.saldi.toast_started` | Saldi started with {{count}} items. |

## `promotions.mi.*` (Mi Italia Sale tab)

| Key | English default |
|---|---|
| `promotions.mi.demo_label` | Demo state: |
| `promotions.mi.backend_note` | Platform-sale invitations aren't wired to a live backend yet — this previews how an invitation from Mi Italia will look and behave once it is. |
| `promotions.mi.state.pending` | Awaiting your decision |
| `promotions.mi.state.opted_in` | Opted in |
| `promotions.mi.state.opted_out` | Opted out |
| `promotions.mi.state.missed` | Deadline missed |
| `promotions.mi.state.live` | Live now |
| `promotions.mi.state.ended` | Ended |
| `promotions.mi.eyebrow` | Mi Italia Invitation |
| `promotions.mi.title_pre` | Join the |
| `promotions.mi.title_suffix` | sale |
| `promotions.mi.sale_window` | Sale window |
| `promotions.mi.suggested_depth` | Suggested depth |
| `promotions.mi.legal_yes` | Yes |
| `promotions.mi.legal_check` | Check dates |
| `promotions.mi.legal_label` | Lawful in your region |
| `promotions.mi.invited_because` | You've been invited because: |
| `promotions.mi.tag_region` | Region: {{region}} |
| `promotions.mi.tag_tier` | Tier: {{tier}} |
| `promotions.mi.tag_category` | Category: {{category}} |
| `promotions.mi.respond_by` | Respond by {{date}} ({{days}} days left) |
| `promotions.mi.missed_msg` | The deadline to respond has passed. |
| `promotions.mi.description` | {{name}} is a platform-wide sale curated by Mi Italia. Opt in to have your selected items featured to shoppers during the sale window. |
| `promotions.mi.opt_in` | Join this sale |
| `promotions.mi.opt_in_sub` | Your selected items will be discounted and featured during the sale window. |
| `promotions.mi.select_items` | Select items to include |
| `promotions.mi.col_item` | Item |
| `promotions.mi.col_retail` | Retail |
| `promotions.mi.col_sale` | Sale (-{{depth}}%) |
| `promotions.mi.confirm_btn` | Confirm Participation |
| `promotions.mi.surfaces_label` | Where this will appear |
| `promotions.mi.surf_dashboard` | Dashboard |
| `promotions.mi.surf_email` | Email |
| `promotions.mi.dash_invitation` | Respond by {{date}} |
| `promotions.mi.dash_cta` | Review invitation |
| `promotions.mi.email_from` | Mi Italia Partnerships |
| `promotions.mi.email_subj` | You're invited: {{name}} sale |
| `promotions.mi.email_body` | Your boutique has been selected for our next platform sale. Opt in from your Primo dashboard to participate. |
| `promotions.mi.email_cta` | Open Primo |
| `promotions.mi.surf_note` | Mockup for preview only — live invitations will be delivered through these same surfaces once wired to the backend. |
| `promotions.mi.toast_joined` | Joined {{name}} with {{count}} items. |
