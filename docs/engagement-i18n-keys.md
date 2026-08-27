# Engagement — i18n

By far the largest of the pages done in this series: `src/views/Engagement.jsx` is ~4,100 lines with
9 major sub-views (Overview, Contacts, Favorites, Campaigns, Campaign Builder, Campaign Review,
Campaign Analytics Modal, Campaign Detail Panel, Analytics, Automations, Templates) and, before this
pass, **zero** i18n wiring — no `useTranslation` import, no `t()` calls anywhere in the file.

Given the scale, the key list isn't reproduced here as a table (500+ entries) — it's fully captured in
the merged `primo.json`'s `eng.*` namespace, extracted directly from the source rather than
hand-transcribed (see Methodology below).

## Status

**All genuine UI chrome now routes through `t()`.** Verified by pseudo-localization (whole `eng`
bundle served with every value wrapped in `⟦…⟧`, locale `it`) across all 7 nav tabs plus interactive
states: Add Contact modal, both Favorites sub-tabs, Campaign Builder step 1, all 6 Template tabs, the
Use Template modal, and the Analytics campaign-detail panel. Key diff: every `t()` call in the file
resolves to a key present in `primo.json` (582/582 static keys, plus one dynamic key
`` `eng.tpl.varcat_${cat}` `` that resolves to 3 real keys at runtime — confirmed by direct DOM
inspection, not just the static grep).

### Pre-existing `eng.*` namespace was already shaped for this file

`primo.json` had ~250 keys under `eng.nav`/`eng.ov`/`eng.ct`/`eng.camp`/`eng.an`/`eng.auto`/`eng.fav`/
`eng.tpl`/`eng.rev` sitting completely unused before this session — clearly pre-authored to match this
exact component structure (same pattern as `ret.*` was for VoidCIL, just ~5x larger). Of the ~590 keys
now wired, roughly 160 were pure "wire the existing key up" work; the rest (~410) are new.

### One real bug found and fixed along the way

**`t` variable name collision.** `TemplatesView` already declared `const t = TEMPLATES[selId]` —
   the selected template object — used ~40 times throughout the component (`t.plainName`, `t.subjectEx`,
   etc.), directly colliding with the translation function this pass needed to introduce. Renamed the
   template-object variable to `tpl` throughout (safe: verified no unrelated `t` tokens existed in that
   line range) and gave the real `t` to `useTranslation()`. **The bulk rename via `sed` initially
   corrupted contractions** — `isn't` → `isn'tpl`, `can't` → `can'tpl` — because apostrophes count as
   word boundaries. Caught by grepping for the corruption pattern immediately after and fixed (all 3
   occurrences), then confirmed via `eslint` that no parse errors remained.

## Scoping decisions (what was deliberately left untranslated)

Consistent with the mock-data precedent from Promotions (`MI_SALE`) and Store Profile
(`RP_SEED_DESC`), the following were left as-is — they're demo/illustrative content standing in for
what a real backend or AI-generation pipeline would produce, not static UI labels:

- **`CAMP_DETAIL`, `ROI_CAMPAIGNS`, `ANALYTICS_DATA`, `COMPARE_DELTAS_PREVYEAR`** — mock campaign
  performance data (module-level consts).
- **`liveActivity`, `autoRunning`** (Overview widgets) and the full `flows` array + VIP Win-Back flow
  diagram (Automations) — unpersisted preview content (`setFlows` never calls an API).
- **`contactRows`, `productRows`** (Favorites) — mock table rows, including their per-record computed
  action labels ("Notify 14 savers when restocked").
- **`TEMPLATES`** — the entire template-library mock content object: names, descriptions, subject/body
  examples, preview copy, performance history, best-subject-lines, language content, version history.
- **`TPL_VARIABLES`** token descriptions/fallback/example text, and the granular `TsField`
  character-limit micro-copy in the Structure tab — judgment call: this is dense reference
  documentation, not primary UI chrome. Flagging as an open item rather than silently dropping it.
- **SVG chart illustrative annotations** in `AnalyticsView` (tier-zone labels, month-abbreviation axis
  labels, the "Silver · saved €504/yr" callout) — same treatment as decorative mockup content.

### One thing flagged, not fixed: `RangeBar`

`AnalyticsView` renders `<RangeBar>` from `src/components/ui/RangeBar.jsx` — its "Range / MTD / YTD /
Custom / Compare / None / Export" labels are untranslated, but this component is **shared with
`Subscription.jsx`**. Fixing it here would silently change another page's translation surface, which
is out of scope for "the Engagement page" — flagging for a separate pass rather than expanding scope
unilaterally.

## Methodology note (given the scale)

With ~600 keys, hand-transcribing each into `primo.json` would have been slow and error-prone. Instead:
a small Node script parsed `Engagement.jsx` directly, found every `t(` call via balanced-paren
scanning, and extracted the key + `defaultValue` from either `t('key', 'default')` or
`t('key', { ...params, defaultValue: '...' })` call shapes — then merged the result into the existing
`eng.*` namespace, added-only (never silently overwriting a key whose text didn't match without it
being reviewed). Caught 4 real key-reuse bugs this way before finalizing: reusing `eng.camp.hub`
(pre-existing meaning "Campaigns", for a title/em pair) for an unrelated "Hub" back-button label
(fixed → `eng.camp.hub_em`, which already meant "Hub"); collapsing an existing title/em split
(`eng.an.top_performers`/`_em`) into one un-split string; hijacking `eng.an.roi_table`'s existing
pairing for a different chart title (fixed → new `eng.an.campaign_roi_title`); and reusing
`eng.an.engaged` ("Engaged Contacts", Title Case, for a KPI card) in a second, sentence-case context
that needed its own key (`eng.an.funnel_engaged`).
