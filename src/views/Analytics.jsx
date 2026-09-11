import { useState, useEffect, useMemo, Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'
import { isWhatsappEnabled } from '../lib/auth'

const API = import.meta.env.VITE_API_URL

/* ── formatting helpers (per-view convention — see POS.jsx, Discounts.jsx) ── */
function fmtNum(n, loc) { return Number(n ?? 0).toLocaleString(loc) }
function fmtEUR(n, loc) { return n != null ? `€${Number(n).toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true })}` : '—' }
function fmtDateShort(iso, loc) { return iso ? new Date(iso).toLocaleDateString(loc, { day: 'numeric', month: 'short' }) : '' }
function fmtDateLong(iso, loc) { return iso ? new Date(iso).toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' }) : '' }
function median(arr) {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
// (countryFlag removed — the geo endpoint reports cities, not countries, and
//  deriving a flag from the first two letters of a city name produced the
//  Romanian flag for "Roma".)

/* ── CSV export helpers (ported from Reports.jsx) ── */
function csvEscape(v) {
  if (v == null) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
function csvRow(cells) { return cells.map(csvEscape).join(',') }
function triggerDownload(text, filename) {
  const blob = new Blob(['﻿', text], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const TRAFFIC_ICON  = { app: 'smartphone', web: 'language', search: 'search', referral: 'share', social: 'favorite', external: 'public', direct: 'arrow_forward' }
const CHANNEL_ICON  = { email: 'mail', whatsapp: 'chat' }
const KPI_ICONS      = { views: 'visibility', visitors: 'group', saves: 'bookmark', discovery_reserve: 'event_available' }
const QUADRANT_META = {
  reorder:  { color: 'var(--green)' },
  fix:      { color: 'var(--gold-dk)' },
  expose:   { color: 'var(--porpora)' },
  markdown: { color: 'var(--red)' },
  early:    { color: 'var(--mist)', dashed: true },
}
// Aliases for raw API quadrant names (defensive — adapter maps them, but
// if a value leaks through unmapped, the chart/legend still renders)
QUADRANT_META.star               = QUADRANT_META.reorder
QUADRANT_META.browsed_not_bought = QUADRANT_META.fix
QUADRANT_META.hidden_gem         = QUADRANT_META.expose
QUADRANT_META.dead_stock         = QUADRANT_META.markdown
QUADRANT_META.unclassified       = QUADRANT_META.early


/* ── API response adapters ─────────────────────────────────────────────
   The backend response shapes differ from what the components consume.
   These lightweight mappers bridge the gap so the rendering code stays
   clean and we don't litter adapters throughout the JSX. ── */

// Funnel: API → {key, label, count, ofPrevious, ofTop}  →  {stage, count, pct}
function adaptFunnel(apiFunnel) {
  if (!apiFunnel?.length) return apiFunnel
  // Each backend key maps to its own stage — the old mapping shifted `reserves`
  // into a fabricated "product clicks" stage (the API sends no click data at
  // all) and pushed `orders` into the reserve row, so both read as the wrong
  // metric on screen.
  const KEY_TO_STAGE = { visits: 'views', productViews: 'deepViews', saves: 'saves', reserves: 'reserveRequests', orders: 'orders' }
  const top = apiFunnel[0]?.count || 1
  return apiFunnel.map(f => ({
    stage: KEY_TO_STAGE[f.key] ?? f.key,
    // The API labels each stage itself ("Boutique visits", "Reservations", …) —
    // prefer that over our own mapping so the row can never say the wrong metric.
    label: f.label ?? null,
    count: f.count,
    pct:   f.ofTop ?? Math.round((f.count / top) * 1000) / 10,
  }))
}

// Geo: API → {city, cityKey, visitors, reserves, orders, revenue}
//          →  {cityKey, cityName, unknown, views, pct}
//
// This endpoint reports CITIES, not countries. The old adapter took the first
// two letters of the city as a country code and the list rendered it as a
// flag emoji, so "Roma" showed the Romanian flag and the "unknown" bucket
// showed the United Nations flag. There is no country in this payload at all,
// so no flag is derived any more.
function adaptGeo(apiGeo) {
  if (!apiGeo?.length) return apiGeo
  const total = g => (g.visitors || 0) + (g.reserves || 0) + (g.orders || 0)
  const maxViews = Math.max(...apiGeo.map(total), 1)
  return apiGeo.map((g, i) => {
    const views = total(g)
    const raw = (g.city ?? '').trim()
    return {
      // cityKey is the API's own stable id; fall back to the index so two
      // cities can never collide on a React key.
      cityKey:  g.cityKey ?? raw.toLowerCase() ?? `geo${i}`,
      // The API sends the literal string "unknown" for untracked visitors —
      // flagged here so the row can show a translated label instead.
      unknown:  !raw || raw.toLowerCase() === 'unknown',
      cityName: raw,
      views,
      pct: Math.round(views / maxViews * 100),
    }
  })
}

// Traffic: API → {source, views, visitors, share}  →  {source, views, pct}
function adaptTraffic(apiTraffic) {
  if (!apiTraffic?.length) return apiTraffic
  const maxViews = Math.max(...apiTraffic.map(t => t.views || 0), 1)
  // Pass the source through as-is. It used to rename `external` → `app` and
  // `direct` → `search`, which mislabelled the row: the API currently returns a
  // single `external` bucket covering all outside traffic (app, website and
  // search together), so calling it "App" made app traffic look double-counted
  // and search look like it was never recorded.
  return apiTraffic.map(t => ({
    source: t.source,
    views:  t.views,
    pct:    t.share ?? Math.round((t.views || 0) / maxViews * 100),
  }))
}

// Lost demand OOS: API → [{productId, name, categoryPath, views, viewers, lastViewedAt, stockNow, restocked}]
//                    →  {total, items: [{productName, variant, views}]}
function adaptLostDemand(apiLD) {
  if (!apiLD) return apiLD
  // `outOfStockViews` is the per-product detail list and can be empty even when
  // the API has counted OOS views — the headline number lives in
  // `summary.outOfStockViews`, so trust that first and only fall back to summing
  // the list when no summary is present.
  const oosItems = Array.isArray(apiLD.outOfStockViews) ? apiLD.outOfStockViews : []
  const summaryTotal = apiLD.summary?.outOfStockViews
  return {
    // Searches come back keyed on `searches`, not `count`.
    unstockedSearches: (apiLD.unstockedSearches ?? []).map(s => ({
      ...s,
      count: s.searches ?? s.count ?? 0,
    })),
    outOfStockViews: {
      total: summaryTotal ?? oosItems.reduce((s, o) => s + (o.views || 0), 0),
      items: oosItems.map(o => ({
        productName: o.name ?? o.productName ?? '—',
        variant:     o.variant ?? '',
        views:       o.views ?? 0,
      })),
    },
    sizeMisses: apiLD.sizeMisses ?? { status: 'pending' },
  }
}

// Matrix: API → {items, thresholds, quadrantCounts, quadrantLegend}
// Quadrant mapping: star→reorder, browsed_not_bought→fix, hidden_gem→expose, dead_stock→markdown
function adaptMatrix(apiMatrix) {
  if (!Array.isArray(apiMatrix?.items)) return []
  const Q_MAP = { star: 'reorder', browsed_not_bought: 'fix', hidden_gem: 'expose', dead_stock: 'markdown', unclassified: 'early' }
  return apiMatrix.items.map(m => ({
    ...m,
    quadrant: Q_MAP[m.quadrant] ?? m.quadrant,
  }))
}

// Saves aging: API → buckets[].saves → buckets[].count + hot flag (buckets 3,4 are hot)
function adaptSavesAging(apiSA) {
  if (!apiSA) return apiSA
  return {
    ...apiSA,
    buckets: (apiSA.buckets ?? []).map((b, i) => ({
      key:   b.key ?? b.label ?? `b${i}`,
      label: b.label ?? null,
      count: b.saves ?? b.count ?? 0,
      hot:   i >= 2,
    })),
  }
}

// Reserve: API → {total, collectionRate, reservedValue} → {requests, pickupRatePct, reservedValue}
function adaptReserve(apiReserve) {
  if (!apiReserve) return apiReserve
  return {
    requests:       apiReserve.total ?? apiReserve.requests ?? 0,
    reservedValue:  apiReserve.reservedValue ?? 0,
    pickupRatePct:  apiReserve.collectionRate ?? apiReserve.pickupRatePct ?? 0,
  }
}

// Presence: API → {unlocked, coverage: number, grid, k_floor} → {unlocked, coverage: {opted_in, identified_base}, grid, k_floor}
function adaptPresence(apiP) {
  if (!apiP) return apiP
  return {
    ...apiP,
    coverage: typeof apiP.coverage === 'object' ? apiP.coverage : { opted_in: apiP.coverage ?? 0, identified_base: 0 },
  }
}

/* ── Sub-components ── */

function DeltaBadge({ delta }) {
  if (!delta || delta.changePct == null) return null
  const up = delta.direction === 'up'
  return (
    <span className={`an-delta ${up ? 'an-delta-up' : 'an-delta-down'}`}>
      <span className="material-symbols-outlined">{up ? 'trending_up' : 'trending_down'}</span>
      {Math.abs(delta.changePct).toFixed(1)}%
    </span>
  )
}

function EmptyState({ icon, children }) {
  return (
    <div className="an-empty">
      <span className="material-symbols-outlined">{icon}</span>
      {children}
    </div>
  )
}

function PendingBanner({ children }) {
  return (
    <div className="an-pending">
      <span className="material-symbols-outlined">construction</span>
      <div>{children}</div>
    </div>
  )
}

function CardHead({ icon, title, sub }) {
  return (
    <div className="card-hdr">
      <div className="an-card-hdr-l">
        <span className="material-symbols-outlined an-card-icon">{icon}</span>
        <div>
          <div className="card-title">{title}</div>
          {sub && <div className="an-card-sub">{sub}</div>}
        </div>
      </div>
    </div>
  )
}

/* ── KPI strip ── */
const KPI_LABELS = { views: 'Views', visitors: 'Visitors', saves: 'Saves', discovery_reserve: 'Discovery Reserve Rate' }
function KpiStrip({ stats, deltas, loading, loc, t }) {
  const tiles = [
    { key: 'views',              val: stats.totalViews,           delta: deltas.totalViews,              pct: false },
    { key: 'visitors',           val: stats.uniqueVisitors,        delta: deltas.uniqueVisitors,           pct: false },
    { key: 'saves',              val: stats.favorites,             delta: deltas.favorites,                pct: false },
    { key: 'discovery_reserve',  val: stats.discoveryReserveRate,   delta: deltas.discoveryReserveRate,     pct: true },
  ]
  return (
    <div className="stat-row">
      {tiles.map(k => (
        <div className="stat-card" key={k.key}>
          <div className="stat-lbl stat-lbl-icon">
            <span className="material-symbols-outlined an-card-icon">{KPI_ICONS[k.key]}</span>
            {t(`analytics.kpi.${k.key}`, KPI_LABELS[k.key])}
          </div>
          <div className="stat-val">
            {loading ? '—' : k.val == null ? '—' : k.pct ? `${k.val}%` : fmtNum(k.val, loc)}
          </div>
          <DeltaBadge delta={k.delta} />
        </div>
      ))}
    </div>
  )
}

/* ── Daily discovery trend (dual-line SVG; each series scaled to its own max,
   matching the design source exactly) ── */
function TrendChart({ trend, loading, t, loc }) {
  if (!loading && (!trend || trend.length === 0)) {
    return <EmptyState icon="show_chart">{t('analytics.no_trend_data', 'No trend data available yet.')}</EmptyState>
  }
  if (loading || !trend) return null

  const W = 1000, H = 280, padL = 44, padR = 20, padT = 16, padB = 28
  const iw = W - padL - padR, ih = H - padT - padB
  const n = trend.length
  const views = trend.map(d => Number(d.views) || 0)
  const saves = trend.map(d => Number(d.saves) || 0)
  const maxV = Math.max(...views, 1)
  const maxS = Math.max(...saves, 1)
  const xAt = i => padL + iw * i / Math.max(n - 1, 1)
  const yV = v => padT + ih - ih * v / maxV
  const yS = v => padT + ih - ih * v / maxS
  const ptsFor  = (arr, yf) => arr.map((v, i) => `${xAt(i).toFixed(1)},${yf(v).toFixed(1)}`).join(' ')
  const areaFor = (arr, yf) => `${padL},${padT + ih} ${ptsFor(arr, yf)} ${padL + iw},${padT + ih}`
  const step = Math.max(Math.ceil(n / 8), 1)

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="an-gv" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--gold)" stopOpacity="0.18" /><stop offset="1" stopColor="var(--gold)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="an-gs" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--porpora)" stopOpacity="0.16" /><stop offset="1" stopColor="var(--porpora)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map(g => {
          const y = padT + ih * g / 4
          return <line key={g} className="an-gridline" x1={padL} y1={y} x2={padL + iw} y2={y} />
        })}
        {[0, 1, 2, 3, 4].map(g => {
          const val = Math.round(maxV * (4 - g) / 4)
          return <text key={g} className="an-axis-lbl" x={padL - 8} y={padT + ih * g / 4 + 3} textAnchor="end">{val}</text>
        })}
        {trend.map((d, i) => i % step === 0 && (
          <text key={i} className="an-axis-lbl" x={xAt(i)} y={H - 8} textAnchor="middle">{fmtDateShort(d.day, loc)}</text>
        ))}
        <polygon points={areaFor(views, yV)} fill="url(#an-gv)" />
        <polygon points={areaFor(saves, yS)} fill="url(#an-gs)" />
        <polyline points={ptsFor(views, yV)} fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinejoin="round" />
        <polyline points={ptsFor(saves, yS)} fill="none" stroke="var(--porpora)" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

/* ── Discovery funnel ── */
const FUNNEL_STAGE_LABELS = { views: 'Views', deep_views: 'Product Views', saves: 'Saves', reserves: 'Reserve Requests', orders: 'Orders' }
function funnelLabel(f, t) {
  return f.label ?? t(`analytics.funnel.${stageKey(f.stage)}`, FUNNEL_STAGE_LABELS[stageKey(f.stage)] ?? f.stage)
}
function DiscoveryFunnel({ funnel, loading, t, loc }) {
  if (!loading && (!funnel || funnel.length === 0)) {
    return <EmptyState icon="filter_alt">{t('analytics.no_funnel_data', 'No funnel data available yet.')}</EmptyState>
  }
  if (loading || !funnel) return null
  let biggestDrop = null
  for (let i = 1; i < funnel.length; i++) {
    const drop = (funnel[i - 1].pct ?? 0) - (funnel[i].pct ?? 0)
    if (!biggestDrop || drop > biggestDrop.drop) biggestDrop = { from: funnel[i - 1], to: funnel[i], drop }
  }
  return (
    <>
      <div className="an-df-list">
        {funnel.map((f, i) => (
          <div className="an-df-row" key={f.stage}>
            <div className="an-df-name">{funnelLabel(f, t)}</div>
            <div className="an-df-bar-track">
              <div className={`an-df-bar${i === funnel.length - 1 ? ' last' : ''}`} style={{ width: `${Math.max(f.pct ?? 0, 4)}%` }} />
            </div>
            <div className="an-df-val"><b>{fmtNum(f.count, loc)}</b> <span>{f.pct}%</span></div>
          </div>
        ))}
      </div>
      {biggestDrop && (
        <div className="an-df-note">
          {t('analytics.funnel.drop_note', {
            from: funnelLabel(biggestDrop.from, t),
            to: funnelLabel(biggestDrop.to, t),
            pct: biggestDrop.to.pct,
            defaultValue: 'Biggest drop-off: {{from}} → {{to}} ({{pct}}% continue)',
          })}
        </div>
      )}
    </>
  )
}
function stageKey(stage) {
  return { views: 'views', deepViews: 'deep_views', saves: 'saves', reserveRequests: 'reserves', orders: 'orders' }[stage] ?? stage
}

/* ── Geography + traffic (shared row-list layout) ── */
function GeoList({ geo, loading, t, loc }) {
  if (!loading && (!geo || geo.length === 0)) return <EmptyState icon="public">{t('analytics.no_geo_data', 'No geography data available yet.')}</EmptyState>
  if (loading || !geo) return null
  return (
    <div className="an-rl-list">
      {geo.map(g => {
        return (
          <div className="an-rl-row" key={g.cityKey}>
            <span className="material-symbols-outlined an-card-icon">
              {g.unknown ? 'help' : 'location_on'}
            </span>
            <div>
              <div className="an-rl-name">
                {g.unknown ? t('analytics.geo.unknown_city', 'Unknown location') : g.cityName}
              </div>
              <div className="an-rl-track"><div className="an-rl-fill" style={{ width: `${g.pct}%` }} /></div>
            </div>
            <div className="an-rl-val">{fmtNum(g.views, loc)}</div>
          </div>
        )
      })}
    </div>
  )
}
const TRAFFIC_SOURCE_LABELS = { app: 'App', web: 'Web', search: 'Search', referral: 'Referral', social: 'Social', external: 'App & Web', direct: 'Direct' }
function TrafficList({ traffic, loading, t, loc }) {
  if (!loading && (!traffic || traffic.length === 0)) return <EmptyState icon="alt_route">{t('analytics.no_traffic_data', 'No traffic data available yet.')}</EmptyState>
  if (loading || !traffic) return null
  return (
    <div className="an-rl-list">
      {traffic.map(tr => (
        <div className="an-rl-row" key={tr.source}>
          <span className="an-rl-ico"><span className="material-symbols-outlined">{TRAFFIC_ICON[tr.source] ?? 'link'}</span></span>
          <div>
            <div className="an-rl-name">{t(`analytics.traffic.${tr.source}`, TRAFFIC_SOURCE_LABELS[tr.source])}</div>
            <div className="an-rl-track"><div className="an-rl-fill" style={{ width: `${tr.pct}%` }} /></div>
          </div>
          <div className="an-rl-val">{fmtNum(tr.views, loc)}</div>
        </div>
      ))}
    </div>
  )
}

/* ── Most-viewed pieces ── */
function ProductsList({ products, loading, t, loc }) {
  if (!loading && (!products || products.length === 0)) return <EmptyState icon="visibility">{t('analytics.no_product_data', 'No product data available yet.')}</EmptyState>
  if (loading || !products) return null
  return (
    <div>
      {products.map((p, i) => (
        <div className="an-prod-row" key={i}>
          <div className="an-prod-thumb"><span className="material-symbols-outlined">inventory_2</span></div>
          <div>
            <div className="an-prod-name">{p.name}</div>
            <div className="an-prod-meta">{p.category ?? '—'}</div>
          </div>
          <div className="an-prod-stat"><div className="an-prod-stat-v">{fmtNum(p.views, loc)}</div><div className="an-prod-stat-l">{t('analytics.products.views', 'Views')}</div></div>
          <div className="an-prod-stat"><div className="an-prod-stat-v res">{p.reserves ?? '—'}</div><div className="an-prod-stat-l">{t('analytics.products.reserves', 'Reserves')}</div></div>
        </div>
      ))}
    </div>
  )
}

/* ── Lost demand ── */
function LostDemandCard({ lostDemand, matrixReorder, days, loc, t }) {
  const searches   = lostDemand?.unstockedSearches ?? []
  const oos        = lostDemand?.outOfStockViews ?? null
  const sizeMisses = lostDemand?.sizeMisses ?? null
  const sizePending = !sizeMisses || sizeMisses.status === 'pending'

  function downloadBuySheet() {
    const rows = { }
    function addSignal(key, name, category, size, signal, count, action) {
      if (!rows[key]) rows[key] = { name, categories: new Set(), sizes: new Set(), signals: [], actions: new Set() }
      const r = rows[key]
      if (category) r.categories.add(category)
      if (size) r.sizes.add(size)
      r.signals.push(`${signal}: ${count}`)
      r.actions.add(action)
    }
    searches.forEach(s => addSignal(`search:${s.term}`, s.term, 'Unstocked search', '', 'Local searches', s.count, 'Evaluate for next buy'))
    if (!sizePending) (sizeMisses ?? []).forEach(z => addSignal(z.piece, z.piece, 'Size miss', z.size, 'Right-size views, size unstocked', z.missed, 'Add size to reorder'))
    ;(oos?.items ?? []).forEach(o => addSignal(o.productName, o.productName, 'Out-of-stock views', o.variant ?? '', 'Views while sold out', o.views, 'Restock or notify savers'))
    ;(matrixReorder ?? []).forEach(m => addSignal(m.name, m.name, 'Reorder', '', 'High views + high sell-through', `${m.viewsNormalized} views, ${m.sellThroughPct}%`, 'Reorder'))

    const meta = [
      ['Period', `Last ${days} days · generated ${new Date().toISOString().slice(0, 10)}`],
      [],
      ['Category', 'Piece / Term', 'Sizes', 'Evidence', 'Suggested action'],
    ]
    const body = Object.values(rows).map(r => [[...r.categories].join(' + '), r.name, [...r.sizes].join(', '), r.signals.join(' · '), [...r.actions].join(' · ')])
    const csv = [...meta, ...body].map(csvRow).join('\n')
    triggerDownload(csv, `discovery-buy-sheet-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  return (
    <div className="card">
      <div className="card-hdr">
        <div className="an-card-hdr-l">
          <span className="material-symbols-outlined an-card-icon">search_off</span>
          <div>
            <div className="card-title">{t('analytics.lost_demand.title_pre', 'Lost')} <em>{t('analytics.lost_demand.title_em', 'Demand')}</em></div>
            <div className="an-card-sub">{t('analytics.lost_demand.sub', "What customers wanted but couldn't get.")}</div>
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={downloadBuySheet}>
          <span className="material-symbols-outlined">download</span>{t('analytics.lost_demand.buy_sheet', 'Download Buy Sheet')}
        </button>
      </div>

      <div className="an-ld-grid3">
        <div>
          <div className="an-ld-sublabel">{t('analytics.lost_demand.searches', 'Unstocked Searches')}</div>
          {searches.length === 0 ? <EmptyState icon="search_off">{t('analytics.no_search_data', 'No search data available yet.')}</EmptyState> : (
            <>
              {searches.map(s => (
                <div className="an-ld-search-row" key={s.term}>
                  <div><div className="an-ld-term">{s.term}</div><div className="an-ld-term-sub">{fmtNum(s.count, loc)} {t('analytics.lost_demand.searches_unit', 'searches')}</div></div>
                  <div className="an-ld-count">{s.count}</div>
                  <div className="an-ld-trend">{s.trendPct != null ? `↑ ${s.trendPct}%` : '—'}</div>
                </div>
              ))}
              <div className="an-ld-floor-note">{t('analytics.lost_demand.floor_note', 'Only showing search terms with meaningful volume.')}</div>
            </>
          )}
        </div>

        <div>
          <div className="an-ld-sublabel">{t('analytics.lost_demand.oos', 'Out-of-Stock Views')}</div>
          {!oos ? <EmptyState icon="visibility_off">{t('analytics.no_oos_data', 'No out-of-stock view data available yet.')}</EmptyState> : (
            <>
              <div className="an-ld-oos-count">{fmtNum(oos.total, loc)}</div>
              <div className="an-ld-oos-sub">{t('analytics.lost_demand.oos_sub', 'Views on products that were sold out at the time.')}</div>
              <div className="an-ld-oos-items">
                {(oos.items ?? []).map((o, i) => (
                  <div className="an-ld-oos-item" key={i}><span>{o.productName}{o.variant ? ` · ${o.variant}` : ''}</span><b>{o.views}</b></div>
                ))}
              </div>
            </>
          )}
        </div>

        <div>
          <div className="an-ld-sublabel">
            <span>{t('analytics.lost_demand.sizes', 'Size Misses')}</span>{' '}
            <span className="an-ld-v2tag">{t('analytics.lost_demand.sizes_pending_tag', 'Coming Soon')}</span>
          </div>
          {sizePending ? (
            <PendingBanner>{t('analytics.pending.size_misses', 'Size-miss tracking is coming soon.')}</PendingBanner>
          ) : (
            <>
              <div className="an-ld-size-row hdr"><div>{t('analytics.lost_demand.sizes_piece', 'Piece')}</div><div style={{ textAlign: 'center' }}>{t('analytics.lost_demand.sizes_size', 'Size')}</div><div style={{ textAlign: 'right' }}>{t('analytics.lost_demand.sizes_missed', 'Missed')}</div></div>
              {sizeMisses.map((z, i) => (
                <div className="an-ld-size-row" key={i}>
                  <div>{z.piece}</div>
                  <div style={{ textAlign: 'center' }}><span className="an-ld-size-chip">{z.size}</span></div>
                  <div className="an-ld-miss">{z.missed}</div>
                </div>
              ))}
            </>
          )}
          <div className="an-consent-note"><span className="material-symbols-outlined">lock</span><span>{t('analytics.lost_demand.sizes_note', 'Size data is only shown once enough customers have opted in.')}</span></div>
        </div>
      </div>
    </div>
  )
}

/* ── Visibility vs conversion matrix ── */
const MATRIX_VERDICT_LABELS = { reorder: 'Reorder', fix: 'Fix', expose: 'Expose', markdown: 'Markdown', early: 'Too Early' }
function MatrixChart({ matrix, thresholds, loading, t }) {
  if (!loading && (!matrix || matrix.length === 0)) return <EmptyState icon="scatter_plot">{t('analytics.no_matrix_data', 'No visibility/conversion data available yet.')}</EmptyState>
  if (loading || !matrix) return null

  const W = 520, H = 300, pad = 40, iw = W - pad - 18, ih = H - pad - 14
  const maxViews = Math.max(...matrix.map(m => m.viewsNormalized), 1)
  // Prefer the server's medians. It assigns each product's quadrant against
  // its own thresholds, computed over every active product in the window —
  // not just the ones returned here. Recomputing from the visible rows can
  // land the dashed split in a different place than the colours, so a "star"
  // would render inside the wrong quadrant.
  const midX = thresholds?.viewsNormalizedMedian ?? median(matrix.map(m => m.viewsNormalized))
  const midY = thresholds?.sellThroughPctMedian  ?? median(matrix.map(m => m.sellThroughPct))
  const xAt = v => pad + iw * Math.min(v, maxViews) / maxViews
  const yAt = s => 14 + ih - ih * s / 100
  const initials = name => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
  const verdictLabel = q => t(`analytics.matrix.verdict.${q}`, MATRIX_VERDICT_LABELS[q])

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
        <rect x={pad} y="14" width={iw} height={ih} fill="var(--cream)" stroke="var(--line)" />
        <line x1={xAt(midX)} y1="14" x2={xAt(midX)} y2={14 + ih} stroke="var(--line)" strokeDasharray="4 4" />
        <line x1={pad} y1={yAt(midY)} x2={pad + iw} y2={yAt(midY)} stroke="var(--line)" strokeDasharray="4 4" />
        <text className="an-axis-lbl" x={pad + 8} y="28">{verdictLabel('expose')}</text>
        <text className="an-axis-lbl" x={pad + iw - 8} y="28" textAnchor="end">{verdictLabel('reorder')}</text>
        <text className="an-axis-lbl" x={pad + 8} y={14 + ih - 10}>{verdictLabel('markdown')}</text>
        <text className="an-axis-lbl" x={pad + iw - 8} y={14 + ih - 10} textAnchor="end">{verdictLabel('fix')}</text>
        {matrix.map(m => {
          const meta = QUADRANT_META[m.quadrant] ?? QUADRANT_META.early
          return (
            <g key={m.productId}>
              <circle cx={xAt(m.viewsNormalized)} cy={yAt(m.sellThroughPct)} r="13" fill={meta.dashed ? 'var(--mist)' : meta.color} stroke={meta.dashed ? 'var(--stone)' : undefined} strokeDasharray={meta.dashed ? '3 3' : undefined} />
              <text x={xAt(m.viewsNormalized)} y={yAt(m.sellThroughPct) + 3} textAnchor="middle" style={{ fontSize: 8.5, fontWeight: 600, fill: meta.dashed ? 'var(--stone)' : 'var(--white)' }}>{initials(m.name)}</text>
            </g>
          )
        })}
        <text className="an-axis-lbl" x={pad + iw / 2} y={H - 2} textAnchor="middle">{t('analytics.matrix.axis_views', 'Views')} →</text>
        <text className="an-axis-lbl" x="12" y={14 + ih / 2} transform={`rotate(-90 12 ${14 + ih / 2})`} textAnchor="middle">{t('analytics.matrix.axis_sell', 'Sell-Through %')} →</text>
      </svg>
      <div className="an-mx-legend">
        {matrix.map(m => {
          const meta = QUADRANT_META[m.quadrant] ?? QUADRANT_META.early
          return (
            <div className="an-mx-leg-row" key={m.productId}>
              <div className="an-mx-leg-dot" style={{ background: meta.dashed ? 'var(--mist)' : meta.color, color: meta.dashed ? 'var(--stone)' : 'var(--white)', border: meta.dashed ? '1px dashed var(--stone)' : undefined }}>{initials(m.name)}</div>
              <div>{m.name} · {m.viewsNormalized} {t('analytics.matrix.axis_views', 'Views').toLowerCase()} · {m.sellThroughPct}% · {m.daysOnPlatform}{t('common.days_abbrev', 'd')}</div>
              <div className={`an-mx-verdict ${m.quadrant}`}>{verdictLabel(m.quadrant)}</div>
            </div>
          )
        })}
        <div className="an-mx-note">{t('analytics.matrix.threshold_note', 'Dashed line marks the median split between high and low performers.')}</div>
      </div>
    </>
  )
}

/* ── Saves aging ── */
// Fallback only — the real label comes from the bucket's own key/label so the
// boundaries on screen always match however the backend actually buckets them.
const AGING_BUCKET_LABELS = { 1: '0–7 days', 2: '8–30 days', 3: '31–90 days', 4: '90+ days' }
function bucketLabel(b, i) {
  const raw = b.label ?? b.key
  if (!raw) return AGING_BUCKET_LABELS[i + 1]
  // Backend sends ranges like "0-7" / "90+" — render them as readable days.
  return /^\d+(-\d+|\+)$/.test(String(raw)) ? `${String(raw).replace('-', '–')} days` : String(raw)
}
function SavesAging({ savesAging, loading, t }) {
  if (!loading && !savesAging) return <EmptyState icon="history">{t('analytics.no_aging_data', 'No saves-aging data available yet.')}</EmptyState>
  if (loading || !savesAging) return null
  const buckets  = savesAging.buckets ?? []
  const callList = savesAging.callList ?? []
  return (
    <>
      <div className="an-age-buckets">
        {buckets.map((b, i) => (
          <div className={`an-age-cell${b.hot ? ' hot' : ''}`} key={b.key ?? i}>
            <div className="an-age-val">{b.count}</div>
            <div className="an-age-lbl">{bucketLabel(b, i)}</div>
          </div>
        ))}
      </div>
      <div className="an-ld-sublabel">{t('analytics.aging.call_list', 'Call List')}</div>
      {callList.length === 0 ? <div className="an-card-sub">{t('analytics.no_call_list', 'No customers to call right now.')}</div> : callList.map((c, i) => (
        <div className="an-call-row" key={c.customerId ?? i}>
          <div><div className="an-call-name">{c.name}</div><div className="an-call-item">{c.item}{c.variant ? ` · ${c.variant}` : ''}</div></div>
          <div className="an-call-days">{c.daysSaved} {t('analytics.aging.days', 'days')}</div>
          <div className="an-call-channels">{(c.channels ?? []).filter(ch => ch !== 'whatsapp' || isWhatsappEnabled()).map(ch => <span key={ch} className="material-symbols-outlined">{CHANNEL_ICON[ch] ?? 'chat'}</span>)}</div>
        </div>
      ))}
      {savesAging.backInStockConversionPct != null && (
        <div className="an-bis-line">
          <b>{t('analytics.aging.bis_line_label', 'Back-in-stock conversion:')}</b>{' '}
          {t('analytics.aging.bis_line_mid', 'of notified customers,')}{' '}
          <b>{savesAging.backInStockConversionPct}%</b>{' '}
          {t('analytics.aging.bis_line_end', 'went on to purchase within 30 days.')}
        </div>
      )}
      {/* The API says WHY each saver is withheld — suppressedBreakdown splits
          it into noConsent vs notACustomer. The old note claimed a privacy
          reporting threshold for both, which is wrong for notACustomer: those
          people simply aren't registered with the boutique, and no amount of
          consent would surface them. Only fall back to the generic wording
          when no breakdown is sent. */}
      <div className="an-consent-note">
        <span className="material-symbols-outlined">lock</span>
        <span>{suppressedNote(t, savesAging)}</span>
      </div>
    </>
  )
}

/** Why savers were withheld from the call list, using the API's own breakdown. */
function suppressedNote(t, savesAging) {
  const total = savesAging?.suppressedCount
  if (total == null || total === 0) return t('analytics.aging.note_none', 'Every saver who can be contacted is listed above.')
  const noConsent    = savesAging?.suppressedBreakdown?.noConsent
  const notACustomer = savesAging?.suppressedBreakdown?.notACustomer
  if (noConsent > 0 && notACustomer > 0) {
    return t('analytics.aging.note_both', { count: total, noConsent, notACustomer,
      defaultValue: '{{count}} saver(s) hidden — {{noConsent}} without marketing consent, {{notACustomer}} not registered with your boutique.' })
  }
  if (notACustomer > 0) {
    return t('analytics.aging.note_not_customer', { count: notACustomer,
      defaultValue: '{{count}} saver(s) hidden — they are not registered as your customers, so you have no way to contact them.' })
  }
  if (noConsent > 0) {
    return t('analytics.aging.note_no_consent', { count: noConsent,
      defaultValue: '{{count}} saver(s) hidden — they have not given marketing consent.' })
  }
  return `${total} ${t('analytics.aging.note', 'customers suppressed to protect individual privacy (below reporting threshold).')}`
}

/* ── Walk-in heatmap (v1 transactions+pickups, v2 gated app-presence) ── */
function WalkInHeatmap({ heatmap, presence, hmSource, setHmSource, loading, presenceLoading, t, lang, loc }) {
  // The hour columns were hardcoded to 10:00–21:00 while the API returns a
  // full 24-hour grid, so every event before 10am was simply not drawn. On
  // live data that hid 71 of 134 events — including the single busiest hour
  // of the week (Wednesday 09:00, 21 events), which the API itself reports
  // as the peak. The range is derived from the data now: first to last hour
  // that actually has activity, widened to a readable minimum span.
  const hours = useMemo(() => {
    const grid = (hmSource === 'presence' ? presence?.grid : heatmap?.grid) ?? []
    let lo = 24, hi = -1
    for (const row of grid) {
      for (let h = 0; h < (row?.length ?? 0); h++) {
        // null means "suppressed": real activity the privacy floor is hiding.
        // It has to widen the range like any other busy hour — skipping it
        // pushed the suppressed cell outside the visible columns, so the one
        // thing the privacy rule exists to show never appeared.
        const busy = row[h] === null || row[h] > 0
        if (busy) { if (h < lo) lo = h; if (h > hi) hi = h }
      }
    }
    if (hi < lo) { lo = 10; hi = 21 }              // no data — keep the old window
    while (hi - lo < 7) { if (lo > 0) lo--; if (hi < 23) hi++ }  // never fewer than 8 columns
    return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
  }, [heatmap, presence, hmSource])

  // Shade against the busiest cell, the way the transactions grid does. This
  // was hardcoded to `v / 10`, so every hour with 10+ visitors came out the
  // same shade and the real peak was indistinguishable from a middling one.
  // Suppressed cells are null and are skipped.
  const presencePeak = useMemo(() => {
    let peak = 0
    for (const row of presence?.grid ?? []) for (const v of row ?? []) if (v > peak) peak = v
    return peak || 1
  }, [presence])

  const days = lang === 'it' ? ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <>
      <div className="card-hdr">
        <div className="an-card-hdr-l">
          <span className="material-symbols-outlined an-card-icon">schedule</span>
          <div>
            <div className="card-title">{t('analytics.heatmap.title_pre', 'Walk-In')} <em>{t('analytics.heatmap.title_em', 'Heatmap')}</em></div>
            <div className="an-card-sub">
              {t('analytics.heatmap.sub', {
                range: heatmap ? `${fmtDateLong(heatmap.windowStart, loc)} – ${fmtDateLong(heatmap.windowEnd, loc)}` : '…',
                defaultValue: '{{range}}',
              })}
            </div>
          </div>
        </div>
        <div className="an-hm-src-toggle">
          <div className={`an-hm-src-chip${hmSource === 'tx' ? ' act' : ''}`} onClick={() => setHmSource('tx')}>
            <span className="material-symbols-outlined">point_of_sale</span>{t('analytics.heatmap.src_tx', 'Transactions')}
          </div>
          <div className={`an-hm-src-chip${hmSource === 'presence' ? ' act' : ''}`} onClick={() => setHmSource('presence')}>
            <span className="material-symbols-outlined">location_on</span>{t('analytics.heatmap.src_presence', 'App Presence')}<span className="an-ld-v2tag">V2</span>
          </div>
        </div>
      </div>

      {hmSource === 'tx' ? (
        !loading && !heatmap ? <EmptyState icon="schedule">{t('analytics.no_heatmap_data', 'No heatmap data available yet.')}</EmptyState> : loading || !heatmap ? null : (
          <>
            <div className="an-hm-grid" style={{ '--an-hm-cols': hours.length }}>
              <div className="an-hm-lbl" />
              {hours.map(h => <div className="an-hm-hour" key={h}>{String(h).padStart(2, '0')}:00</div>)}
              {days.map((d, di) => (
                <Fragment key={di}>
                  <div className="an-hm-lbl">{d}</div>
                  {hours.map(h => {
                    const v = heatmap.grid?.[di]?.[h] ?? 0
                    const a = v / (heatmap.peak || 1)
                    return <div className="an-hm-cell" key={h} style={{ background: `rgba(179,148,90,${(0.06 + a * 0.85).toFixed(2)})` }} title={t('analytics.heatmap.cell_tooltip', { count: v, hour: String(h).padStart(2, '0'), defaultValue: '{{count}} event(s) at {{hour}}:00' })} />
                  })}
                </Fragment>
              ))}
            </div>
            {/* Say what a cell actually is. Every occurrence of that weekday
                inside the window is summed into one square, so "Wednesday
                09:00 = 21" is 21 events across ~13 Wednesdays, not 21 on one
                morning. Without this the grid reads like a calendar. */}
            <div className="an-hm-note">
              {t('analytics.heatmap.note_aggregate', {
                weeks: heatmap?.window?.days ? Math.round(heatmap.window.days / 7) : null,
                defaultValue: 'Each square combines every occurrence of that weekday and hour across the whole period — about {{weeks}} of each. Darker means busier. It shows when you are reliably busy, not what happened on one date.',
              })}
              {/* peak.day is an English weekday name from the API; use the
                  localised label off `days` via peak.dow (0 = Monday) so the
                  sentence doesn't switch language mid-way. */}
              {days[heatmap?.peak?.dow] && heatmap.peak.hour != null && (
                <> {t('analytics.heatmap.note_peak', {
                  day: days[heatmap.peak.dow], hour: String(heatmap.peak.hour).padStart(2, '0'), count: heatmap.peak.events,
                  defaultValue: 'Busiest: {{day}} at {{hour}}:00 ({{count}} events).',
                })}</>
              )}
            </div>
          </>
        )
      ) : (
        presenceLoading || !presence ? null : !presence.unlocked ? (
          <div className="an-hm-gate">
            <div className="an-hm-grid" style={{ '--an-hm-cols': hours.length }}>
              <div className="an-hm-lbl" />
              {hours.map(h => <div className="an-hm-hour" key={h}>{String(h).padStart(2, '0')}:00</div>)}
              {days.map((d, di) => (
                <Fragment key={di}>
                  <div className="an-hm-lbl">{d}</div>
                  {hours.map(h => <div className="an-hm-cell" key={h} />)}
                </Fragment>
              ))}
            </div>
            <div className="an-hm-gate-overlay">
              <div className="an-hm-gate-card">
                <span className="material-symbols-outlined">lock</span>
                <div className="an-hm-gate-t">{t('analytics.heatmap.gate_title', 'Unlock App Presence Data')}</div>
                {/* These two are not a fraction. Live data returns
                    opted_in 30 / identified_base 3 / pct 10 — the opted-in
                    pool is the bigger number, so rendering "30 / 3" read as
                    "30 out of 3". Label each one, and use the pct the API
                    already calculates. */}
                <div className="an-hm-gate-s">
                  {t('analytics.presence.coverage', {
                    optedIn:    presence.coverage?.opted_in ?? 0,
                    identified: presence.coverage?.identified_base ?? 0,
                    pct:        presence.coverage?.pct ?? 0,
                    defaultValue: '{{optedIn}} shopper(s) opted in · {{identified}} seen in your boutique ({{pct}}%)',
                  })}
                </div>
                {/* The gate used to show a bare "3 / 30" with no target, so
                    there was no way to tell what unlocks it. Prefer the
                    server's own explanation when it sends one. */}
                <div className="an-hm-gate-s">
                  {presence.message || (presence.k_floor
                    ? t('analytics.presence.gate_hint', { k: presence.k_floor, defaultValue: 'An hour appears once at least {{k}} opted-in customers have been seen in it. Below that it stays hidden, so no single visitor can be identified.' })
                    : t('analytics.presence.gate_hint_generic', 'Too few opted-in customers so far. Hours appear once enough people have been seen to keep them anonymous.'))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="an-hm-grid" style={{ '--an-hm-cols': hours.length }}>
            <div className="an-hm-lbl" />
            {hours.map(h => <div className="an-hm-hour" key={h}>{String(h).padStart(2, '0')}:00</div>)}
            {days.map((d, di) => (
              <Fragment key={di}>
                <div className="an-hm-lbl">{d}</div>
                {hours.map(h => {
                  const v = presence.grid?.[di]?.[h]
                  return v == null
                    ? <div className="an-hm-cell" key={h} style={{ background: 'var(--mist)' }}
                        title={t('analytics.presence.suppressed', { k: presence.k_floor, defaultValue: 'Hidden — fewer than {{k}} people, too few to show without identifying someone' })} />
                    : <div className="an-hm-cell" key={h}
                        style={{ background: `rgba(179,148,90,${(0.06 + (v / presencePeak) * 0.85).toFixed(2)})` }}
                        title={t('analytics.presence.cell_tooltip', { count: v, hour: String(h).padStart(2, '0'), defaultValue: '{{count}} visit(s) at {{hour}}:00' })} />
                })}
              </Fragment>
            ))}
          </div>
        )
      )}
    </>
  )
}

/* ── Reserve & pickup ── */
function ReservePickupCard({ reserve, loading, t, loc }) {
  return (
    <div className="an-reserve-card">
      <div className="an-reserve-tag">{t('analytics.reserve.tag', 'Reserve & Pickup')}</div>
      <div className="an-reserve-title">{t('analytics.reserve.title_pre', 'Reserve &')} <em>{t('analytics.reserve.title_em', 'Pickup')}</em></div>
      <div className="an-reserve-sub">{t('analytics.reserve.sub', 'Customers who reserved items to try or buy in-store.')}</div>
      <div className="an-reserve-stats">
        <div><div className="an-reserve-stat-v">{loading || !reserve ? '—' : fmtNum(reserve.requests, loc)}</div><div className="an-reserve-stat-l">{t('analytics.reserve.requests', 'Requests')}</div></div>
        <div><div className="an-reserve-stat-v">{loading || !reserve ? '—' : fmtEUR(reserve.reservedValue, loc)}</div><div className="an-reserve-stat-l">{t('analytics.reserve.value', 'Reserved Value')}</div></div>
        <div><div className="an-reserve-stat-v">{loading || !reserve ? '—' : `${reserve.pickupRatePct}%`}</div><div className="an-reserve-stat-l">{t('analytics.reserve.pickup_rate', 'Pickup Rate')}</div></div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════ */

const RANGE_LABELS = { 7: '7 Days', 30: '30 Days', 90: '90 Days' }
export default function Analytics() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language?.startsWith('it') ? 'it' : 'en'
  const loc  = lang === 'it' ? 'it-IT' : 'en-US'

  const [days, setDays] = useState(30)
  const [main, setMain] = useState(null)
  const [lostDemand, setLostDemand] = useState(null)
  const [matrix, setMatrix] = useState(null)
  const [savesAging, setSavesAging] = useState(null)
  const [heatmap, setHeatmap] = useState(null)
  const [loadingMain, setLoadingMain] = useState(true)

  const [failedCount, setFailedCount] = useState(0)
  const [totalCount, setTotalCount]   = useState(0)
  // Bumped by Retry. `days` can't do this job — setting state to the value it
  // already holds is a no-op in React, so the effect would never re-run.
  const [reloadKey, setReloadKey] = useState(0)

  const [hmSource, setHmSource] = useState('tx')
  const [presence, setPresence] = useState(null)
  const [presenceLoading, setPresenceLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoadingMain(true)
    Promise.allSettled([
      apiFetch(`${API}/boutique/analytics?days=${days}`).then(r => r.json()),
      apiFetch(`${API}/boutique/analytics/lost-demand?days=${days}`).then(r => r.json()),
      apiFetch(`${API}/boutique/analytics/matrix?days=${days}`).then(r => r.json()),
      apiFetch(`${API}/boutique/analytics/saves-aging?days=${days}`).then(r => r.json()),
      apiFetch(`${API}/boutique/analytics/heatmap`).then(r => r.json()),
    ]).then(results => {
      if (cancelled) return
      const [m, ld, mx, sa, hm] = results
      const dataOf = r => (r.status === 'fulfilled' && r.value?.success ? r.value.data : null)
      setMain(dataOf(m))
      setLostDemand(dataOf(ld))
      setMatrix(dataOf(mx))
      setSavesAging(dataOf(sa))
      setHeatmap(dataOf(hm))
      // allSettled swallows everything, so a dead backend used to look exactly
      // like a quiet month. Count the calls that genuinely failed (rejected, or
      // success:false) and say so — the per-section empty states can't tell the
      // difference between "no data yet" and "we never got an answer".
      // Store the count, not the sentence: building the message here would
      // capture `t` in the effect (and freeze the wording at load time, so it
      // would stay in the old language after a switch).
      setFailedCount(results.filter(r => r.status === 'rejected' || !r.value?.success).length)
      setTotalCount(results.length)
      setLoadingMain(false)
    })
    return () => { cancelled = true }
  }, [days, lang, reloadKey])

  useEffect(() => {
    if (hmSource !== 'presence' || presence) return
    setPresenceLoading(true)
    apiFetch(`${API}/presence/heatmap`)
      .then(r => r.json())
      .then(res => setPresence(res?.success ? adaptPresence(res.data) : adaptPresence({ unlocked: false, coverage: 0 })))
      .catch(() => setPresence(adaptPresence({ unlocked: false, coverage: 0 })))
      .finally(() => setPresenceLoading(false))
  }, [hmSource, presence])

  // Every value below used to fall back to the static "Sartoria Belloni"
  // sample data whenever the backend didn't answer — with nothing on screen
  // saying so. Invented revenue, invented top products, and a call list of
  // four customers who don't exist, all rendered exactly like real figures.
  //
  // Nothing falls back now, and the sample data has been deleted outright.
  // Each section already has its own "no data yet" empty state, so a missing
  // or failed response shows that instead. An empty panel is recoverable in
  // front of a client; a convincing wrong number is not.
  const stats          = main?.stats  ?? {}
  const deltas         = main?.deltas ?? {}
  const dailyTrend     = main?.dailyTrend ?? null
  const funnel         = main?.discoveryFunnel ? adaptFunnel(main.discoveryFunnel) : null
  const geo            = main?.geoBreakdown ? adaptGeo(main.geoBreakdown) : null
  const traffic        = main?.discoveryTrafficSources ? adaptTraffic(main.discoveryTrafficSources) : null
  const topProducts    = main?.topProducts?.length ? main.topProducts : null
  const reserveStats   = main?.reserveStats ? adaptReserve(main.reserveStats) : null
  const lostDemandData = lostDemand ? adaptLostDemand(lostDemand) : null
  const matrixData     = matrix     ? adaptMatrix(matrix)         : null
  const savesAgingData = savesAging ? adaptSavesAging(savesAging) : null
  const heatmapData    = heatmap    ?? null

  const matrixReorder = useMemo(() => (matrixData ?? []).filter(m => m.quadrant === 'reorder'), [matrixData])
  // The cell shading scales against the busiest cell. The API reports that
  // itself as an object — peak: {day, dow, hour, events} — so take its count
  // when present and only scan the grid as a fallback. `peak` is flattened to
  // a number here because that is what the shading maths expects.
  const heatmapWithPeak = useMemo(() => {
    if (!heatmapData?.grid) return heatmapData
    let peak = heatmapData.peak?.events ?? 0
    if (!peak) for (const row of heatmapData.grid) for (const v of row) if (v > peak) peak = v
    return { ...heatmapData, peak: peak || 1 }
  }, [heatmapData])

  return (
    <>
      {!loadingMain && failedCount > 0 && (
        <div className="alert alert-red">
          <span className="material-symbols-outlined">error</span>
          <div style={{ flex: 1 }}>
            {failedCount >= totalCount
              ? t('analytics.err_all', 'Could not load analytics. Please try again.')
              : t('analytics.err_partial', { count: failedCount, defaultValue: '{{count}} section(s) failed to load — the panels below may be incomplete.' })}
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => setReloadKey(k => k + 1)}>
            {t('common.retry', 'Retry')}
          </button>
        </div>
      )}
      <div className="an-range-bar">
        {[7, 30, 90].map(d => (
          <button key={d} className={`btn btn-sm ${days === d ? 'btn-primary' : 'btn-outline'}`} onClick={() => setDays(d)}>
            {t(`analytics.range.${d}`, RANGE_LABELS[d])}
          </button>
        ))}
      </div>

      <KpiStrip stats={stats} deltas={deltas} loading={loadingMain} loc={loc} t={t} />

      <div className="card">
        <div className="card-hdr">
          <div className="an-card-hdr-l">
            <span className="material-symbols-outlined an-card-icon">show_chart</span>
            <div>
              <div className="card-title">{t('analytics.trend.title_pre', 'Discovery')} <em>{t('analytics.trend.title_em', 'Trend')}</em></div>
              <div className="an-card-sub">{t('analytics.trend.sub', 'Daily views and saves over time.')}</div>
            </div>
          </div>
          <div className="an-legend">
            <div className="an-legend-item"><span className="an-legend-swatch" style={{ background: 'var(--gold)' }} />{t('analytics.trend.views', 'Views')}</div>
            <div className="an-legend-item"><span className="an-legend-swatch" style={{ background: 'var(--porpora)' }} />{t('analytics.trend.saves', 'Saves')}</div>
          </div>
        </div>
        <TrendChart trend={dailyTrend} loading={loadingMain} t={t} loc={loc} />
      </div>

      <div className="an-grid2">
        <div className="card">
          <CardHead icon="filter_alt" title={<>{t('analytics.funnel.title_pre', 'Discovery')} <em>{t('analytics.funnel.title_em', 'Funnel')}</em></>} sub={t('analytics.funnel.sub', 'From view to reserve request.')} />
          <DiscoveryFunnel funnel={funnel} loading={loadingMain} t={t} loc={loc} />
        </div>
        <div className="card">
          <CardHead icon="public" title={<>{t('analytics.geo.title_pre', 'Views by')} <em>{t('analytics.geo.title_em', 'Geography')}</em></>} sub={t('analytics.geo.sub', 'Where your online visitors are coming from.')} />
          <GeoList geo={geo} loading={loadingMain} t={t} loc={loc} />
        </div>
      </div>

      <div className="an-grid2">
        <div className="card">
          <CardHead icon="alt_route" title={<>{t('analytics.traffic.title_pre', 'Traffic')} <em>{t('analytics.traffic.title_em', 'Sources')}</em></>} sub={t('analytics.traffic.sub', 'How customers are discovering your boutique.')} />
          <TrafficList traffic={traffic} loading={loadingMain} t={t} loc={loc} />
        </div>
        <div className="card">
          <CardHead icon="visibility" title={<>{t('analytics.products.title_pre', 'Most-Viewed')} <em>{t('analytics.products.title_em', 'Products')}</em></>} sub={t('analytics.products.sub', 'Your most-viewed pieces this period.')} />
          <ProductsList products={topProducts} loading={loadingMain} t={t} loc={loc} />
        </div>
      </div>

      <LostDemandCard lostDemand={lostDemandData} matrixReorder={matrixReorder} days={days} loc={loc} t={t} />

      <div className="an-grid2">
        <div className="card">
          <CardHead icon="scatter_plot" title={<>{t('analytics.matrix.title_pre', 'Visibility vs.')} <em>{t('analytics.matrix.title_em', 'Conversion')}</em></>} sub={t('analytics.matrix.sub', 'Views vs. sell-through rate, by product.')} />
          <MatrixChart matrix={matrixData} thresholds={matrix?.thresholds} loading={loadingMain} t={t} />
        </div>
        <div className="card">
          <CardHead icon="history" title={<>{t('analytics.aging.title_pre', 'Saves')} <em>{t('analytics.aging.title_em', 'Aging')}</em></>} sub={t('analytics.aging.sub', 'How long saved items sit before selling or aging out.')} />
          <SavesAging savesAging={savesAgingData} loading={loadingMain} t={t} />
        </div>
      </div>

      <div className="card">
        <WalkInHeatmap
          heatmap={heatmapWithPeak} presence={presence} hmSource={hmSource} setHmSource={setHmSource}
          loading={loadingMain} presenceLoading={presenceLoading} t={t} lang={lang} loc={loc}
        />
      </div>

      <ReservePickupCard reserve={reserveStats} loading={loadingMain} t={t} loc={loc} />

      <div className="an-foot-note">
        <span className="material-symbols-outlined">tips_and_updates</span>
        <div>{t('analytics.footer.note', 'Data updates daily. Figures reflect the selected date range.')}</div>
      </div>
    </>
  )
}
