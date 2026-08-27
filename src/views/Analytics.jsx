import { useState, useEffect, useMemo, Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'

const API = import.meta.env.VITE_API_URL

/* ── formatting helpers (per-view convention — see POS.jsx, Discounts.jsx) ── */
function fmtNum(n, loc) { return Number(n ?? 0).toLocaleString(loc) }
function fmtEUR(n, loc) { return n != null ? `€${Number(n).toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—' }
function fmtDateShort(iso, loc) { return iso ? new Date(iso).toLocaleDateString(loc, { day: 'numeric', month: 'short' }) : '' }
function fmtDateLong(iso, loc) { return iso ? new Date(iso).toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' }) : '' }
function median(arr) {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
function countryFlag(code) {
  if (!code || code.toUpperCase() === 'GB' || code.toUpperCase() === 'UK') return null
  return code.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)))
}

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

const TRAFFIC_ICON  = { app: 'smartphone', web: 'language', search: 'search', referral: 'share', social: 'favorite' }
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

/* ── Static sample data — Sartoria Belloni, transcribed from the design source
   (primo-analytics-discovery.html) so every section can be previewed before
   the backend endpoints in the handoff spec exist. Used only as a fallback:
   once `dailyTrend` (or the matching per-section field) comes back from the
   real API, the real value wins automatically — see the `extended`/`??`
   checks in the Analytics() component below. Remove once every endpoint in
   the handoff is live. ── */
function mockDailyTrend(days) {
  const views = [88,102,96,120,134,118,142,156,138,150,168,175,160,182,190,178,196,205,188,210,224,208,232,246,228,252,268,244,270,288]
  const saves = [9,12,10,14,16,13,18,20,15,19,22,24,20,25,28,24,30,32,27,33,36,31,38,41,34,40,44,38,42,47]
  const out = []
  for (let i = 0; i < days; i++) {
    const day = new Date(); day.setDate(day.getDate() - (days - 1 - i))
    out.push({ day: day.toISOString().slice(0, 10), views: views[i % views.length], saves: saves[i % saves.length] })
  }
  return out
}
function mockHeatmapGrid() {
  const compact = [
    [1,2,2,3,3,2,2,3,4,3,2,1],
    [1,2,3,3,4,3,3,4,5,4,2,1],
    [2,2,3,4,4,3,3,5,6,5,3,1],
    [2,3,3,4,5,4,4,6,7,6,3,2],
    [2,3,4,5,5,4,5,7,8,7,4,2],
    [4,6,7,8,9,8,7,9,10,8,5,3],
    [3,4,5,6,6,5,4,5,5,4,2,1],
  ]
  return compact.map(row => {
    const full = Array(24).fill(0)
    row.forEach((v, i) => { full[10 + i] = v })
    return full
  })
}
const MOCK = {
  stats: { totalViews: 4182, uniqueVisitors: 2346, favorites: 524, discoveryReserveRate: 4.5 },
  deltas: {
    totalViews:           { changePct: 27,  direction: 'up' },
    uniqueVisitors:        { changePct: 19,  direction: 'up' },
    favorites:             { changePct: 16,  direction: 'up' },
    discoveryReserveRate:  { changePct: 0.6, direction: 'up' },
  },
  dailyTrend: mockDailyTrend(30),
  discoveryFunnel: [
    { stage: 'views',           count: 4182, pct: 100  },
    { stage: 'deepViews',       count: 1506, pct: 36   },
    { stage: 'saves',           count: 524,  pct: 12.5 },
    { stage: 'productClicks',   count: 388,  pct: 9.3  },
    { stage: 'reserveRequests', count: 188,  pct: 4.5  },
  ],
  geoBreakdown: [
    { countryCode: 'IT', countryName: 'Italia',          views: 1840, pct: 100 },
    { countryCode: 'GB', countryName: 'United Kingdom',  views: 642,  pct: 35  },
    { countryCode: 'DE', countryName: 'Deutschland',     views: 508,  pct: 28  },
    { countryCode: 'FR', countryName: 'France',          views: 396,  pct: 22  },
    { countryCode: 'JP', countryName: 'Japan',            views: 284,  pct: 15  },
  ],
  discoveryTrafficSources: [
    { source: 'app',      views: 2118, pct: 100 },
    { source: 'web',      views: 986,  pct: 47  },
    { source: 'search',   views: 604,  pct: 29  },
    { source: 'referral', views: 312,  pct: 15  },
    { source: 'social',   views: 162,  pct: 8   },
  ],
  topProducts: [
    { name: 'Cashmere Trench Coat',   category: 'Outerwear · Loro Piana',  views: 842, reserves: 34 },
    { name: 'Bordeaux Silk Dress',    category: 'Ready-to-Wear · SS26',    views: 716, reserves: 28 },
    { name: 'Structured Leather Tote', category: 'Bags · Nero',            views: 588, reserves: 19 },
    { name: 'Hand-fringed Scarf',     category: 'Accessories · Sasso',     views: 472, reserves: 15 },
    { name: "Suede Derby Shoes",      category: "Men's Shoes · Doucal's",  views: 394, reserves: 11 },
  ],
  reserveStats: { requests: 188, reservedValue: 94200, pickupRatePct: 76 },
  lostDemand: {
    unstockedSearches: [
      { term: 'cashmere cape',           count: 214, trendPct: 38 },
      { term: 'velvet smoking jacket',   count: 156, trendPct: 22 },
      { term: 'silk foulard',            count: 128, trendPct: 15 },
      { term: 'wide-leg wool trousers',  count: 96,  trendPct: 9  },
    ],
    outOfStockViews: {
      total: 312,
      items: [
        { productName: 'Bordeaux Silk Dress',   variant: '40', views: 118 },
        { productName: 'Cashmere Trench Coat',  variant: '42', views: 104 },
        { productName: 'Suede Derby',           variant: '43', views: 90  },
      ],
    },
    sizeMisses: { status: 'pending', reason: 'regia_fit_v2' },
  },
  matrix: [
    { productId: 'CT', name: 'Cashmere Trench Coat',    viewsNormalized: 842, sellThroughPct: 78, daysOnPlatform: 120, quadrant: 'reorder' },
    { productId: 'BD', name: 'Bordeaux Silk Dress',      viewsNormalized: 716, sellThroughPct: 34, daysOnPlatform: 88,  quadrant: 'fix'      },
    { productId: 'LT', name: 'Structured Leather Tote',  viewsNormalized: 588, sellThroughPct: 62, daysOnPlatform: 140, quadrant: 'reorder' },
    { productId: 'HS', name: 'Hand-fringed Scarf',       viewsNormalized: 214, sellThroughPct: 71, daysOnPlatform: 95,  quadrant: 'expose'  },
    { productId: 'WB', name: 'Wool Beret',               viewsNormalized: 150, sellThroughPct: 22, daysOnPlatform: 160, quadrant: 'markdown' },
    { productId: 'SD', name: 'Suede Derby Shoes',        viewsNormalized: 394, sellThroughPct: 44, daysOnPlatform: 110, quadrant: 'markdown' },
    { productId: 'CK', name: 'SS26 Capsule Knit',        viewsNormalized: 96,  sellThroughPct: 8,  daysOnPlatform: 12,  quadrant: 'early'    },
  ],
  savesAging: {
    buckets: [
      { key: '0-7',  count: 186, hot: false },
      { key: '8-30', count: 214, hot: false },
      { key: '31-60', count: 78, hot: true  },
      { key: '60+',  count: 46,  hot: true  },
    ],
    backInStockConversionPct: 31,
    suppressedCount: 14,
    callList: [
      { customerId: 'c1', name: 'Sofia Marchetti',   item: 'Cashmere Trench Coat', variant: '40', daysSaved: 41, channels: ['email', 'whatsapp'] },
      { customerId: 'c2', name: 'Federica Lombardi', item: 'Structured Leather Tote', variant: '',  daysSaved: 38, channels: ['whatsapp'] },
      { customerId: 'c3', name: 'Marco Rossi',        item: 'Suede Derby Shoes',    variant: '43', daysSaved: 52, channels: ['email'] },
      { customerId: 'c4', name: 'Chiara De Luca',     item: 'Hand-fringed Scarf',  variant: '',   daysSaved: 64, channels: ['email', 'whatsapp'] },
    ],
  },
  heatmap: (() => {
    const end = new Date(), start = new Date(); start.setDate(end.getDate() - 90)
    return { grid: mockHeatmapGrid(), windowStart: start.toISOString().slice(0, 10), windowEnd: end.toISOString().slice(0, 10), windowDays: 90 }
  })(),
}

/* ── API response adapters ─────────────────────────────────────────────
   The backend response shapes differ from what the components consume.
   These lightweight mappers bridge the gap so the rendering code stays
   clean and we don't litter adapters throughout the JSX. ── */

// Funnel: API → {key, label, count, ofPrevious, ofTop}  →  {stage, count, pct}
function adaptFunnel(apiFunnel) {
  if (!apiFunnel?.length) return apiFunnel
  const KEY_TO_STAGE = { visits: 'views', productViews: 'deepViews', saves: 'saves', reserves: 'productClicks', orders: 'reserveRequests' }
  const top = apiFunnel[0]?.count || 1
  return apiFunnel.map(f => ({
    stage: KEY_TO_STAGE[f.key] ?? f.key,
    count: f.count,
    pct:   Math.round((f.count / top) * 1000) / 10,
  }))
}

// Geo: API → {city, cityKey, visitors, reserves, orders, revenue}  →  {countryCode, countryName, views, pct}
function adaptGeo(apiGeo) {
  if (!apiGeo?.length) return apiGeo
  const maxViews = Math.max(...apiGeo.map(g => (g.visitors || 0) + (g.reserves || 0) + (g.orders || 0)), 1)
  return apiGeo.map(g => {
    const views = (g.visitors || 0) + (g.reserves || 0) + (g.orders || 0)
    return {
      countryCode: (g.cityKey ?? g.city ?? '').toUpperCase().slice(0, 2),
      countryName: g.city ?? 'Unknown',
      views,
      pct: Math.round(views / maxViews * 100),
    }
  })
}

// Traffic: API → {source, views, visitors, share}  →  {source, views, pct}
function adaptTraffic(apiTraffic) {
  if (!apiTraffic?.length) return apiTraffic
  const maxViews = Math.max(...apiTraffic.map(t => t.views || 0), 1)
  return apiTraffic.map(t => ({
    source: t.source === 'external' ? 'app' : t.source === 'direct' ? 'search' : t.source,
    views:  t.views,
    pct:    Math.round((t.views || 0) / maxViews * 100),
  }))
}

// Lost demand OOS: API → [{productId, name, categoryPath, views, viewers, lastViewedAt, stockNow, restocked}]
//                    →  {total, items: [{productName, variant, views}]}
function adaptLostDemand(apiLD) {
  if (!apiLD) return apiLD
  const oosItems = apiLD.outOfStockViews ?? []
  return {
    unstockedSearches: apiLD.unstockedSearches ?? [],
    outOfStockViews: {
      total: oosItems.reduce((s, o) => s + (o.views || 0), 0),
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
            {t(`analytics.kpi.${k.key}`)}
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
    return <EmptyState icon="show_chart">{t('analytics.no_trend_data')}</EmptyState>
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
function DiscoveryFunnel({ funnel, loading, t, loc }) {
  if (!loading && (!funnel || funnel.length === 0)) {
    return <EmptyState icon="filter_alt">{t('analytics.no_funnel_data')}</EmptyState>
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
            <div className="an-df-name">{t(`analytics.funnel.${stageKey(f.stage)}`)}</div>
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
            from: t(`analytics.funnel.${stageKey(biggestDrop.from.stage)}`),
            to: t(`analytics.funnel.${stageKey(biggestDrop.to.stage)}`),
            pct: biggestDrop.to.pct,
          })}
        </div>
      )}
    </>
  )
}
function stageKey(stage) {
  return { views: 'views', deepViews: 'deep_views', saves: 'saves', productClicks: 'clicks', reserveRequests: 'reserves' }[stage] ?? stage
}

/* ── Geography + traffic (shared row-list layout) ── */
function GeoList({ geo, loading, t, loc }) {
  if (!loading && (!geo || geo.length === 0)) return <EmptyState icon="public">{t('analytics.no_geo_data')}</EmptyState>
  if (loading || !geo) return null
  return (
    <div className="an-rl-list">
      {geo.map(g => {
        const flag = countryFlag(g.countryCode)
        return (
          <div className="an-rl-row" key={g.countryCode}>
            {flag ? <span className="an-rl-flag">{flag}</span> : <span className="an-rl-badge">{g.countryCode}</span>}
            <div>
              <div className="an-rl-name">{g.countryName}</div>
              <div className="an-rl-track"><div className="an-rl-fill" style={{ width: `${g.pct}%` }} /></div>
            </div>
            <div className="an-rl-val">{fmtNum(g.views, loc)}</div>
          </div>
        )
      })}
    </div>
  )
}
function TrafficList({ traffic, loading, t, loc }) {
  if (!loading && (!traffic || traffic.length === 0)) return <EmptyState icon="alt_route">{t('analytics.no_traffic_data')}</EmptyState>
  if (loading || !traffic) return null
  return (
    <div className="an-rl-list">
      {traffic.map(tr => (
        <div className="an-rl-row" key={tr.source}>
          <span className="an-rl-ico"><span className="material-symbols-outlined">{TRAFFIC_ICON[tr.source] ?? 'link'}</span></span>
          <div>
            <div className="an-rl-name">{t(`analytics.traffic.${tr.source}`)}</div>
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
  if (!loading && (!products || products.length === 0)) return <EmptyState icon="visibility">{t('analytics.no_product_data')}</EmptyState>
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
          <div className="an-prod-stat"><div className="an-prod-stat-v">{fmtNum(p.views, loc)}</div><div className="an-prod-stat-l">{t('analytics.products.views')}</div></div>
          <div className="an-prod-stat"><div className="an-prod-stat-v res">{p.reserves ?? '—'}</div><div className="an-prod-stat-l">{t('analytics.products.reserves')}</div></div>
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
            <div className="card-title">{t('analytics.lost_demand.title_pre')} <em>{t('analytics.lost_demand.title_em')}</em></div>
            <div className="an-card-sub">{t('analytics.lost_demand.sub')}</div>
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={downloadBuySheet}>
          <span className="material-symbols-outlined">download</span>{t('analytics.lost_demand.buy_sheet')}
        </button>
      </div>

      <div className="an-ld-grid3">
        <div>
          <div className="an-ld-sublabel">{t('analytics.lost_demand.searches')}</div>
          {searches.length === 0 ? <EmptyState icon="search_off">{t('analytics.no_search_data')}</EmptyState> : (
            <>
              {searches.map(s => (
                <div className="an-ld-search-row" key={s.term}>
                  <div><div className="an-ld-term">{s.term}</div><div className="an-ld-term-sub">{fmtNum(s.count, loc)} {t('analytics.lost_demand.searches_unit')}</div></div>
                  <div className="an-ld-count">{s.count}</div>
                  <div className="an-ld-trend">{s.trendPct != null ? `↑ ${s.trendPct}%` : '—'}</div>
                </div>
              ))}
              <div className="an-ld-floor-note">{t('analytics.lost_demand.floor_note')}</div>
            </>
          )}
        </div>

        <div>
          <div className="an-ld-sublabel">{t('analytics.lost_demand.oos')}</div>
          {!oos ? <EmptyState icon="visibility_off">{t('analytics.no_oos_data')}</EmptyState> : (
            <>
              <div className="an-ld-oos-count">{fmtNum(oos.total, loc)}</div>
              <div className="an-ld-oos-sub">{t('analytics.lost_demand.oos_sub')}</div>
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
            <span>{t('analytics.lost_demand.sizes')}</span>{' '}
            <span className="an-ld-v2tag">{t('analytics.lost_demand.sizes_pending_tag')}</span>
          </div>
          {sizePending ? (
            <PendingBanner>{t('analytics.pending.size_misses')}</PendingBanner>
          ) : (
            <>
              <div className="an-ld-size-row hdr"><div>{t('analytics.lost_demand.sizes_piece')}</div><div style={{ textAlign: 'center' }}>{t('analytics.lost_demand.sizes_size')}</div><div style={{ textAlign: 'right' }}>{t('analytics.lost_demand.sizes_missed')}</div></div>
              {sizeMisses.map((z, i) => (
                <div className="an-ld-size-row" key={i}>
                  <div>{z.piece}</div>
                  <div style={{ textAlign: 'center' }}><span className="an-ld-size-chip">{z.size}</span></div>
                  <div className="an-ld-miss">{z.missed}</div>
                </div>
              ))}
            </>
          )}
          <div className="an-consent-note"><span className="material-symbols-outlined">lock</span><span>{t('analytics.lost_demand.sizes_note')}</span></div>
        </div>
      </div>
    </div>
  )
}

/* ── Visibility vs conversion matrix ── */
function MatrixChart({ matrix, loading, t }) {
  if (!loading && (!matrix || matrix.length === 0)) return <EmptyState icon="scatter_plot">{t('analytics.no_matrix_data')}</EmptyState>
  if (loading || !matrix) return null

  const W = 520, H = 300, pad = 40, iw = W - pad - 18, ih = H - pad - 14
  const maxViews = Math.max(...matrix.map(m => m.viewsNormalized), 1)
  const midX = median(matrix.map(m => m.viewsNormalized))
  const midY = median(matrix.map(m => m.sellThroughPct))
  const xAt = v => pad + iw * Math.min(v, maxViews) / maxViews
  const yAt = s => 14 + ih - ih * s / 100
  const initials = name => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
  const verdictLabel = q => t(`analytics.matrix.verdict.${q}`)

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
        <text className="an-axis-lbl" x={pad + iw / 2} y={H - 2} textAnchor="middle">{t('analytics.matrix.axis_views')} →</text>
        <text className="an-axis-lbl" x="12" y={14 + ih / 2} transform={`rotate(-90 12 ${14 + ih / 2})`} textAnchor="middle">{t('analytics.matrix.axis_sell')} →</text>
      </svg>
      <div className="an-mx-legend">
        {matrix.map(m => {
          const meta = QUADRANT_META[m.quadrant] ?? QUADRANT_META.early
          return (
            <div className="an-mx-leg-row" key={m.productId}>
              <div className="an-mx-leg-dot" style={{ background: meta.dashed ? 'var(--mist)' : meta.color, color: meta.dashed ? 'var(--stone)' : 'var(--white)', border: meta.dashed ? '1px dashed var(--stone)' : undefined }}>{initials(m.name)}</div>
              <div>{m.name} · {m.viewsNormalized} {t('analytics.matrix.axis_views').toLowerCase()} · {m.sellThroughPct}% · {m.daysOnPlatform}d</div>
              <div className={`an-mx-verdict ${m.quadrant}`}>{verdictLabel(m.quadrant)}</div>
            </div>
          )
        })}
        <div className="an-mx-note">{t('analytics.matrix.threshold_note')}</div>
      </div>
    </>
  )
}

/* ── Saves aging ── */
function SavesAging({ savesAging, loading, t }) {
  if (!loading && !savesAging) return <EmptyState icon="history">{t('analytics.no_aging_data')}</EmptyState>
  if (loading || !savesAging) return null
  const buckets  = savesAging.buckets ?? []
  const callList = savesAging.callList ?? []
  return (
    <>
      <div className="an-age-buckets">
        {buckets.map((b, i) => (
          <div className={`an-age-cell${b.hot ? ' hot' : ''}`} key={b.key ?? i}>
            <div className="an-age-val">{b.count}</div>
            <div className="an-age-lbl">{t(`analytics.aging.b${i + 1}`)}</div>
          </div>
        ))}
      </div>
      <div className="an-ld-sublabel">{t('analytics.aging.call_list')}</div>
      {callList.length === 0 ? <div className="an-card-sub">{t('analytics.no_call_list')}</div> : callList.map((c, i) => (
        <div className="an-call-row" key={c.customerId ?? i}>
          <div><div className="an-call-name">{c.name}</div><div className="an-call-item">{c.item}{c.variant ? ` · ${c.variant}` : ''}</div></div>
          <div className="an-call-days">{c.daysSaved} {t('analytics.aging.days')}</div>
          <div className="an-call-channels">{(c.channels ?? []).map(ch => <span key={ch} className="material-symbols-outlined">{CHANNEL_ICON[ch] ?? 'chat'}</span>)}</div>
        </div>
      ))}
      {savesAging.backInStockConversionPct != null && (
        <div className="an-bis-line">
          <b>{t('analytics.aging.bis_line_label')}</b>{' '}
          {t('analytics.aging.bis_line_mid')}{' '}
          <b>{savesAging.backInStockConversionPct}%</b>{' '}
          {t('analytics.aging.bis_line_end')}
        </div>
      )}
      <div className="an-consent-note">
        <span className="material-symbols-outlined">lock</span>
        <span>{savesAging.suppressedCount != null ? `${savesAging.suppressedCount} ` : ''}{t('analytics.aging.note')}</span>
      </div>
    </>
  )
}

/* ── Walk-in heatmap (v1 transactions+pickups, v2 gated app-presence) ── */
function WalkInHeatmap({ heatmap, presence, hmSource, setHmSource, loading, presenceLoading, t, lang, loc }) {
  const hours = Array.from({ length: 12 }, (_, i) => 10 + i)
  const days = lang === 'it' ? ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <>
      <div className="card-hdr">
        <div className="an-card-hdr-l">
          <span className="material-symbols-outlined an-card-icon">schedule</span>
          <div>
            <div className="card-title">{t('analytics.heatmap.title_pre')} <em>{t('analytics.heatmap.title_em')}</em></div>
            <div className="an-card-sub">
              {t('analytics.heatmap.sub', {
                range: heatmap ? `${fmtDateLong(heatmap.windowStart, loc)} – ${fmtDateLong(heatmap.windowEnd, loc)}` : '…',
              })}
            </div>
          </div>
        </div>
        <div className="an-hm-src-toggle">
          <div className={`an-hm-src-chip${hmSource === 'tx' ? ' act' : ''}`} onClick={() => setHmSource('tx')}>
            <span className="material-symbols-outlined">point_of_sale</span>{t('analytics.heatmap.src_tx')}
          </div>
          <div className={`an-hm-src-chip${hmSource === 'presence' ? ' act' : ''}`} onClick={() => setHmSource('presence')}>
            <span className="material-symbols-outlined">location_on</span>{t('analytics.heatmap.src_presence')}<span className="an-ld-v2tag">V2</span>
          </div>
        </div>
      </div>

      {hmSource === 'tx' ? (
        !loading && !heatmap ? <EmptyState icon="schedule">{t('analytics.no_heatmap_data')}</EmptyState> : loading || !heatmap ? null : (
          <>
            <div className="an-hm-grid">
              <div className="an-hm-lbl" />
              {hours.map(h => <div className="an-hm-hour" key={h}>{h}</div>)}
              {days.map((d, di) => (
                <Fragment key={di}>
                  <div className="an-hm-lbl">{d}</div>
                  {hours.map(h => {
                    const v = heatmap.grid?.[di]?.[h] ?? 0
                    const a = v / (heatmap.peak || 1)
                    return <div className="an-hm-cell" key={h} style={{ background: `rgba(179,148,90,${(0.06 + a * 0.85).toFixed(2)})` }} title={`${v} events`} />
                  })}
                </Fragment>
              ))}
            </div>
            <div className="an-hm-note">{t('analytics.heatmap.note')}</div>
          </>
        )
      ) : (
        presenceLoading || !presence ? null : !presence.unlocked ? (
          <div className="an-hm-gate">
            <div className="an-hm-grid">
              <div className="an-hm-lbl" />
              {hours.map(h => <div className="an-hm-hour" key={h}>{h}</div>)}
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
                <div className="an-hm-gate-t">{t('analytics.heatmap.gate_title')}</div>
                <div className="an-hm-gate-s">
                  {t('analytics.pending.presence')} ({presence.coverage?.opted_in ?? 0} / {presence.coverage?.identified_base ?? 0})
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="an-hm-grid">
            <div className="an-hm-lbl" />
            {hours.map(h => <div className="an-hm-hour" key={h}>{h}</div>)}
            {days.map((d, di) => (
              <Fragment key={di}>
                <div className="an-hm-lbl">{d}</div>
                {hours.map(h => {
                  const v = presence.grid?.[di]?.[h]
                  return v == null
                    ? <div className="an-hm-cell" key={h} style={{ background: 'var(--mist)' }} title={`suppressed (below k=${presence.k_floor})`} />
                    : <div className="an-hm-cell" key={h} style={{ background: `rgba(179,148,90,${(0.06 + Math.min(v / 10, 1) * 0.85).toFixed(2)})` }} title={`${v} visits`} />
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
      <div className="an-reserve-tag">{t('analytics.reserve.tag')}</div>
      <div className="an-reserve-title">{t('analytics.reserve.title_pre')} <em>{t('analytics.reserve.title_em')}</em></div>
      <div className="an-reserve-sub">{t('analytics.reserve.sub')}</div>
      <div className="an-reserve-stats">
        <div><div className="an-reserve-stat-v">{loading || !reserve ? '—' : fmtNum(reserve.requests, loc)}</div><div className="an-reserve-stat-l">{t('analytics.reserve.requests')}</div></div>
        <div><div className="an-reserve-stat-v">{loading || !reserve ? '—' : fmtEUR(reserve.reservedValue, loc)}</div><div className="an-reserve-stat-l">{t('analytics.reserve.value')}</div></div>
        <div><div className="an-reserve-stat-v">{loading || !reserve ? '—' : `${reserve.pickupRatePct}%`}</div><div className="an-reserve-stat-l">{t('analytics.reserve.pickup_rate')}</div></div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════ */

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
    ]).then(([m, ld, mx, sa, hm]) => {
      if (cancelled) return
      setMain(m.status === 'fulfilled' && m.value?.success ? m.value.data : null)
      setLostDemand(ld.status === 'fulfilled' && ld.value?.success ? ld.value.data : null)
      setMatrix(mx.status === 'fulfilled' && mx.value?.success ? mx.value.data : null)
      setSavesAging(sa.status === 'fulfilled' && sa.value?.success ? sa.value.data : null)
      setHeatmap(hm.status === 'fulfilled' && hm.value?.success ? hm.value.data : null)
      setLoadingMain(false)
    })
    return () => { cancelled = true }
  }, [days, lang])

  useEffect(() => {
    if (hmSource !== 'presence' || presence) return
    setPresenceLoading(true)
    apiFetch(`${API}/presence/heatmap`)
      .then(r => r.json())
      .then(res => setPresence(res?.success ? adaptPresence(res.data) : adaptPresence({ unlocked: false, coverage: 0 })))
      .catch(() => setPresence(adaptPresence({ unlocked: false, coverage: 0 })))
      .finally(() => setPresenceLoading(false))
  }, [hmSource, presence])

  // `extended` is true once the backend ships the new discovery fields (see
  // the handoff spec) — until then every section below falls back to the
  // static Sartoria Belloni sample data so the page can be previewed in full.
  const extended     = main?.dailyTrend != null
  const stats         = extended ? { ...MOCK.stats,  ...main.stats  } : MOCK.stats
  const deltas        = extended ? { ...MOCK.deltas, ...main.deltas } : MOCK.deltas
  const dailyTrend    = extended ? main.dailyTrend               : MOCK.dailyTrend
  const funnel        = extended ? adaptFunnel(main.discoveryFunnel)     : MOCK.discoveryFunnel
  const geo           = extended ? adaptGeo(main.geoBreakdown)           : MOCK.geoBreakdown
  const traffic       = extended ? adaptTraffic(main.discoveryTrafficSources) : MOCK.discoveryTrafficSources
  const topProducts   = extended && main.topProducts?.length     ? main.topProducts : MOCK.topProducts
  const reserveStats  = extended ? adaptReserve(main.reserveStats)       : MOCK.reserveStats
  const lostDemandData = lostDemand ? adaptLostDemand(lostDemand) : MOCK.lostDemand
  const matrixData     = matrix   ? adaptMatrix(matrix)                  : MOCK.matrix
  const savesAgingData = savesAging ? adaptSavesAging(savesAging)        : MOCK.savesAging
  const heatmapData    = heatmap    ?? MOCK.heatmap

  const matrixReorder = useMemo(() => (matrixData ?? []).filter(m => m.quadrant === 'reorder'), [matrixData])
  const heatmapWithPeak = useMemo(() => {
    if (!heatmapData?.grid) return heatmapData
    let peak = 1
    for (const row of heatmapData.grid) for (const v of row) if (v > peak) peak = v
    return { ...heatmapData, peak }
  }, [heatmapData])

  return (
    <>
      <div className="an-range-bar">
        {[7, 30, 90].map(d => (
          <button key={d} className={`btn btn-sm ${days === d ? 'btn-primary' : 'btn-outline'}`} onClick={() => setDays(d)}>
            {t(`analytics.range.${d}`)}
          </button>
        ))}
      </div>

      <KpiStrip stats={stats} deltas={deltas} loading={loadingMain} loc={loc} t={t} />

      <div className="card">
        <div className="card-hdr">
          <div className="an-card-hdr-l">
            <span className="material-symbols-outlined an-card-icon">show_chart</span>
            <div>
              <div className="card-title">{t('analytics.trend.title_pre')} <em>{t('analytics.trend.title_em')}</em></div>
              <div className="an-card-sub">{t('analytics.trend.sub')}</div>
            </div>
          </div>
          <div className="an-legend">
            <div className="an-legend-item"><span className="an-legend-swatch" style={{ background: 'var(--gold)' }} />{t('analytics.trend.views')}</div>
            <div className="an-legend-item"><span className="an-legend-swatch" style={{ background: 'var(--porpora)' }} />{t('analytics.trend.saves')}</div>
          </div>
        </div>
        <TrendChart trend={dailyTrend} loading={loadingMain} t={t} loc={loc} />
      </div>

      <div className="an-grid2">
        <div className="card">
          <CardHead icon="filter_alt" title={<>{t('analytics.funnel.title_pre')} <em>{t('analytics.funnel.title_em')}</em></>} sub={t('analytics.funnel.sub')} />
          <DiscoveryFunnel funnel={funnel} loading={loadingMain} t={t} loc={loc} />
        </div>
        <div className="card">
          <CardHead icon="public" title={<>{t('analytics.geo.title_pre')} <em>{t('analytics.geo.title_em')}</em></>} sub={t('analytics.geo.sub')} />
          <GeoList geo={geo} loading={loadingMain} t={t} loc={loc} />
        </div>
      </div>

      <div className="an-grid2">
        <div className="card">
          <CardHead icon="alt_route" title={<>{t('analytics.traffic.title_pre')} <em>{t('analytics.traffic.title_em')}</em></>} sub={t('analytics.traffic.sub')} />
          <TrafficList traffic={traffic} loading={loadingMain} t={t} loc={loc} />
        </div>
        <div className="card">
          <CardHead icon="visibility" title={<>{t('analytics.products.title_pre')} <em>{t('analytics.products.title_em')}</em></>} sub={t('analytics.products.sub')} />
          <ProductsList products={topProducts} loading={loadingMain} t={t} loc={loc} />
        </div>
      </div>

      <LostDemandCard lostDemand={lostDemandData} matrixReorder={matrixReorder} days={days} loc={loc} t={t} />

      <div className="an-grid2">
        <div className="card">
          <CardHead icon="scatter_plot" title={<>{t('analytics.matrix.title_pre')} <em>{t('analytics.matrix.title_em')}</em></>} sub={t('analytics.matrix.sub')} />
          <MatrixChart matrix={matrixData} loading={loadingMain} t={t} />
        </div>
        <div className="card">
          <CardHead icon="history" title={<>{t('analytics.aging.title_pre')} <em>{t('analytics.aging.title_em')}</em></>} sub={t('analytics.aging.sub')} />
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
        <div>{t('analytics.footer.note')}</div>
      </div>
    </>
  )
}
