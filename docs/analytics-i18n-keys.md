# Analytics — i18n

`src/views/Analytics.jsx` (969 lines) was reported as "not at all touched in translation." That
turned out to be true visually, but not in the code.

## Root cause: catalog gap, not a code gap

The component already imports `useTranslation` and calls `t()` throughout every sub-component
(`KpiStrip`, `TrendChart`, `DiscoveryFunnel`, `GeoList`, `TrafficList`, `ProductsList`,
`LostDemandCard`, `MatrixChart`, `SavesAging`, `WalkInHeatmap`, `ReservePickupCard`, and the main
`Analytics()` component) — 86 static call sites plus dynamic-key families for KPI tiles, funnel
stages, traffic sources, matrix quadrant verdicts, saves-aging buckets, and date-range buttons.

None of these calls pass a `defaultValue`. Meanwhile `primo.json`'s `analytics` namespace held a
completely different, unrelated set of flat keys (`total_views`, `favorites`, `products: "Products"`,
`traffic: "Traffic"`, …) that a repo-wide grep confirmed **nothing in the codebase actually
references** — leftover from an earlier design that predates this component. So every real `t()`
call in the live page had no matching key, fell through, and rendered its raw dotted key
(`analytics.kpi.views`, `analytics.trend.title_pre`, etc.) — which is exactly what "not touched"
looks like on screen, even though the wiring was already done.

## Fix

Added the full set of real keys to `primo.json`'s `analytics` namespace: `range.*`, `kpi.*`,
`trend.*`, `funnel.*`, `geo.*`, `traffic.*`, `products.*`, `lost_demand.*`, `pending.*`, `matrix.*`
(incl. `verdict.*`), `aging.*`, `heatmap.*`, `reserve.*`, `footer.note`, plus the `no_*_data` /
`no_call_list` empty-state keys for each section. The two pre-existing orphaned flat keys that
collided in shape with what the code needs (`products`, `traffic` — previously plain strings, now
required to be objects) were restructured; the other unused orphaned flat keys (`total_views`,
`favorites`, `conversion_rate`, `avg_order_value`, `revenue`, `top`, `sources`, `sales`,
`by_channel`, `table`, `channels`) were left in place untouched.

**No changes to `Analytics.jsx` itself were needed** — this was purely a translation-catalog gap.

## Verification

- **Key diff**: every static `t('analytics....')` call in the file, and every dynamic-key family
  (`` `analytics.kpi.${k.key}` ``, `` `analytics.funnel.${stageKey(...)}` ``,
  `` `analytics.traffic.${tr.source}` ``, `` `analytics.matrix.verdict.${q}` ``,
  `` `analytics.aging.b${i+1}` ``, `` `analytics.range.${d}` ``), resolves against the new JSON —
  zero missing.
- **Live pseudo-localization**: dev server + mocked `/auth/boutique/translations` and
  `/boutique/analytics*` endpoints, whole `analytics` bundle wrapped in `⟦…⟧`, full-page DOM text
  sweep (including toggling the heatmap to the "App Presence" source to reach that branch). No real
  leaks from this file's own UI chrome.

## Scoping decisions (left untranslated, on purpose)

Same precedent as every other page this session — the `MOCK` object (lines 90–174) is explicitly
commented as static Sartoria Belloni sample data standing in until every backend endpoint in the
handoff spec is live: product names ("Cashmere Trench Coat", "Bordeaux Silk Dress", …), customer
names ("Sofia Marchetti", "Federica Lombardi", …), country names ("Italia", "United Kingdom", …),
and sample search terms. Real API data (`p.name`, `g.countryName`, customer names, etc.) is likewise
left as-is — it's data, not UI copy.

`WalkInHeatmap`'s day-of-week abbreviations (`Lun`/`Mar`/… vs `Mon`/`Tue`/…) are chosen directly from
the `lang` prop rather than routed through `t()` — this already renders correctly in both languages,
just via a plain JS ternary instead of the translation catalog. Not a bug; left as-is.

## Flagged, not fixed: sidebar label

`src/i18n/index.js` maintains its own small local fallback bundle (separate from the
backend-driven `primo.json` catalog) used for the sidebar. In it, `sidebar.analytics` is
`'Discovery Analytics'` in **both** the `en` and `it` locale blocks — the Italian sidebar nav label
is untranslated. This is a different file and mechanism than what this page's fix touches, and
affects only the sidebar nav item, not the Analytics page content — flagging as its own item rather
than folding it into this page's scope.
