import { useState, useEffect, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'
import { activeLocale } from '../lib/dateHelpers'
import Loading from '../components/ui/Loading'

const API = import.meta.env.VITE_API_URL

// ── Static UI config (not driven by backend) ──────────────────────────────
const SUBJECT_TYPE_META = {
  flagship: { emoji: '👘', bg: 'linear-gradient(135deg,#2A1510,#1A0D07)', color: 'var(--green)' },
  standard: { emoji: '🏪', bg: 'linear-gradient(135deg,#1A100A,#0D0806)', color: 'var(--stone)' },
  popup:    { emoji: '🎪', bg: 'linear-gradient(135deg,#0A0A1A,#060612)', color: '#635BFF' },
  outlet:   { emoji: '🏷️', bg: 'linear-gradient(135deg,#0D0D0D,#000000)', color: '#B45309' },
}

const ROLE_META = {
  owner:   { style: { background: 'rgba(184,149,90,.1)',  color: '#8A6A30' } },
  manager: { style: { background: 'rgba(99,91,255,.08)',  color: '#635BFF' } },
  staff:   { style: { background: 'var(--mist)',          color: 'var(--stone)' } },
}

/* Backend enums that were rendered raw.
 *
 * `loc.type` printed as "popup" in the table but "Popup" on the card, because
 * one place capitalised it by hand — the same value appearing two ways on one
 * screen. The role tag printed "staff", the Stripe status "connected", the
 * transfer status "complete": all lowercase English, in every language.
 *
 * Each now goes through a label map, the pattern lib/statusLabel.js already
 * uses for order statuses. A value we do not know about falls through to
 * itself rather than to a blank, so a new value the backend starts sending is
 * visible and reportable instead of silently disappearing. */
const LOC_TYPE_EN = { standard: 'Standard', flagship: 'Flagship', popup: 'Pop-up', outlet: 'Outlet' }
const ROLE_EN     = { owner: 'Owner', manager: 'Manager', staff: 'Staff' }
const TERMINAL_EN = { connected: 'Connected', none: 'Not connected', pending: 'Pending', disconnected: 'Disconnected' }
const TRANSFER_EN = { complete: 'Complete', completed: 'Completed', pending: 'Pending', cancelled: 'Cancelled', failed: 'Failed' }

function enumLabel(t, group, value, english) {
  if (value == null || value === '') return '—'
  const key = String(value).toLowerCase()
  return t(`locations.${group}.${key}`, { defaultValue: english[key] ?? value })
}
const locTypeLabel  = (t, v) => enumLabel(t, 'type',     v, LOC_TYPE_EN)
const roleLabel     = (t, v) => enumLabel(t, 'role',     v, ROLE_EN)
const terminalLabel = (t, v) => enumLabel(t, 'terminal', v ?? 'none', TERMINAL_EN)
const transferLabel = (t, v) => enumLabel(t, 'tstatus',  v ?? 'complete', TRANSFER_EN)

// ── Helpers ───────────────────────────────────────────────────────────────
function typeMeta(t) { return SUBJECT_TYPE_META[t] ?? SUBJECT_TYPE_META.standard }
function initials(n) { return (n ?? '').trim().split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?' }
function shortName(name) { return (name ?? '').replace(/^[^—]+—\s*/, '') }
/* `undefined` as the locale follows the BROWSER's language, not the portal's —
   so an Italian boutique on an English browser read "Sep 2026" while every
   other date on the page said "set 2026". activeLocale() is the portal's. */
function formatSince(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(activeLocale(), { month: 'short', year: 'numeric' })
}
/* Day names and "Closed" were baked in English into a string the merchant
   reads in the locations table. The hours themselves ("10:00-19:30") are what
   they typed, so they stay exactly as entered. */
function formatHours(t, oh) {
  if (!oh) return '—'
  const parts = []
  const closed = t('locations.hours.closed', 'Closed')
  if (oh.mon_sat) parts.push(`${t('locations.hours.mon_sat', 'Mon–Sat')} ${oh.mon_sat}`)
  if (oh.sun)     parts.push(`${t('locations.hours.sun', 'Sun')} ${/^closed$/i.test(oh.sun) ? closed : oh.sun}`)
  return parts.join(' / ') || '—'
}
function statusStyleForBadge(status) {
  if (status === 'active')   return { background: 'rgba(0,108,53,.08)',  color: 'var(--green)' }
  if (status === 'inactive') return { background: 'var(--mist)',          color: 'var(--stone)' }
  return {}
}
function permIconVal(v) {
  if (v === 'full')    return 1
  if (v === 'limited') return 2
  return 0
}

/* A staff member's assigned locations.
 *
 * Two shapes are in play: the assignment endpoint TAKES an array of id
 * strings, but the staff endpoint RETURNS an array of location objects. The
 * code read the returned objects as if they were ids and used them as object
 * keys, which stringifies them — so editing a staff member sent
 *   { locationIds: ["[object Object]"] }
 * and the server rejected it with exactly that text. Saving assigned
 * locations from the Edit Staff dialog could therefore never succeed.
 *
 * Accepts either shape, so this keeps working whichever the backend settles
 * on, and anything that is not a usable id is dropped rather than sent. */
const locationIdOf = (v) =>
  (v && typeof v === 'object') ? (v.id ?? v.location_id ?? v.locationId ?? null) : v
const locationIdsOf = (list) =>
  (list ?? []).map(locationIdOf).filter(id => typeof id === 'string' && id)

// ── Small components ─────────────────────────────────────────────────────
function SectionTitle({ children }) {
  return <div className="loc-section-title">{children}<span className="loc-section-line" /></div>
}

function Alert({ type = 'info', icon, children }) {
  return (
    <div className={`loc-alert loc-alert-${type}`}>
      <span className="material-symbols-outlined loc-alert-icon">{icon}</span>
      <div>{children}</div>
    </div>
  )
}

function PermIcon({ val }) {
  if (val === 1) return <span className="loc-perm-full">●</span>
  if (val === 2) return <span className="loc-perm-partial">◐</span>
  return             <span className="loc-perm-none">○</span>
}

function StockBadge({ type, value }) {
  return (
    <span className={`loc-stock-badge loc-stock-${type ?? 'na'}`}>
      {(type === 'na' || value == null) ? '—' : value}
    </span>
  )
}

// ══════════════════════════════════════════════════════════════════════════
export default function Locations() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [view, setView] = useState('overview')

  // ── Locations ───────────────────────────────────────────────────────────
  const [locations, setLocations]           = useState([])
  const [summary, setSummary]               = useState(null)
  const [loadingLocations, setLoadingLocs]  = useState(true)
  const [locationsError, setLocationsError] = useState(null)

  // ── Staff ───────────────────────────────────────────────────────────────
  const [staff, setStaff]               = useState([])
  const [loadingStaff, setLoadingStaff] = useState(true)
  const [staffError, setStaffError]     = useState(null)

  // ── Permissions matrix ──────────────────────────────────────────────────
  const [permMatrix, setPermMatrix]     = useState([])
  const [loadingPerms, setLoadingPerms] = useState(true)

  // ── Stock ───────────────────────────────────────────────────────────────
  const [stock, setStock]               = useState({ locations: [], items: [] })
  const [loadingStock, setLoadingStock] = useState(true)
  const [stockError, setStockError]     = useState(null)

  // ── Transfers ───────────────────────────────────────────────────────────
  const [transferHistory, setTransferHistory]       = useState([])
  const [suggestedTransfers, setSuggestedTransfers] = useState([])
  const [loadingTransfers, setLoadingTransfers]     = useState(true)

  // ── Reservations ────────────────────────────────────────────────────────
  const [reservations, setReservations] = useState([])
  const [loadingReservations, setLoadingReservations] = useState(true)

  // ── Modal state ─────────────────────────────────────────────────────────
  const [showEditLoc, setShowEditLoc]       = useState(null)
  const [showAddStaff, setShowAddStaff]     = useState(false)
  const [showEditStaff, setShowEditStaff]   = useState(null)
  const [showTransfer, setShowTransfer]     = useState(null)

  // ══ MOUNT: fetch everything in parallel ══════════════════════════════════
  useEffect(() => {
    fetchLocations()
    fetchStaff()
    fetchPermissions()
    fetchStock()
    fetchTransfers()
    fetchReservations()
  }, [i18n.language])

  // ── Fetchers ────────────────────────────────────────────────────────────
  function fetchLocations() {
    setLoadingLocs(true)
    setLocationsError(null)
    return apiFetch(`${API}/boutique/locations`)
      .then(r => r.json())
      .then(res => {
        if (res?.success) {
          setLocations(res.data?.locations ?? [])
          setSummary(res.data?.summary ?? null)
        } else {
          setLocationsError(res?.message ?? true)
        }
      })
      .catch(err => { console.error('[Locations] fetchLocations', err); setLocationsError('Network error') })
      .finally(() => setLoadingLocs(false))
  }

  function fetchStaff() {
    setLoadingStaff(true)
    setStaffError(null)
    return apiFetch(`${API}/boutique/locations/staff`)
      .then(r => r.json())
      .then(res => {
        if (res?.success) setStaff(res.data?.staff ?? [])
        else setStaffError(res?.message ?? true)
      })
      .catch(err => { console.error('[Locations] fetchStaff', err); setStaffError('Network error') })
      .finally(() => setLoadingStaff(false))
  }

  function fetchPermissions() {
    setLoadingPerms(true)
    return apiFetch(`${API}/boutique/locations/permissions-matrix`)
      .then(r => r.json())
      .then(res => {
        if (res?.success) {
          // res.data.role is deliberately dropped: it was held in state that
          // nothing ever read, so storing it only cost a render.
          setPermMatrix(res.data?.matrix ?? [])
        }
      })
      .catch(err => console.error('[Locations] fetchPermissions', err))
      .finally(() => setLoadingPerms(false))
  }

  function fetchStock() {
    setLoadingStock(true)
    setStockError(null)
    return apiFetch(`${API}/boutique/locations/stock`)
      .then(r => r.json())
      .then(res => {
        if (res?.success) setStock(res.data ?? { locations: [], items: [] })
        else setStockError(res?.message ?? true)
      })
      .catch(err => { console.error('[Locations] fetchStock', err); setStockError('Network error') })
      .finally(() => setLoadingStock(false))
  }

  function fetchTransfers() {
    setLoadingTransfers(true)
    return Promise.all([
      apiFetch(`${API}/boutique/locations/transfers`).then(r => r.json()),
      apiFetch(`${API}/boutique/locations/stock/suggested-transfers`).then(r => r.json()),
    ])
      .then(([hist, sug]) => {
        setTransferHistory(hist?.data?.transfers ?? [])
        setSuggestedTransfers(sug?.data?.suggestions ?? [])
      })
      .catch(err => console.error('[Locations] fetchTransfers', err))
      .finally(() => setLoadingTransfers(false))
  }

  function fetchReservations() {
    setLoadingReservations(true)
    return apiFetch(`${API}/boutique/locations/reservations`)
      .then(r => r.json())
      .then(res => { if (res?.success) setReservations(res.data?.reservations ?? []) })
      .catch(err => console.error('[Locations] fetchReservations', err))
      .finally(() => setLoadingReservations(false))
  }

  const SUBNAV = [
    { key: 'overview',     icon: 'grid_view',     label: t('locations.nav.overview') },
    { key: 'locations',    icon: 'store',         label: t('locations.nav.locations') },
    { key: 'inventory',    icon: 'inventory_2',   label: t('locations.nav.inventory') },
    { key: 'transfers',    icon: 'swap_horiz',    label: t('locations.nav.transfers') },
    { key: 'staff',        icon: 'badge',         label: t('locations.nav.staff') },
    { key: 'reservations', icon: 'calendar_today', label: t('locations.nav.reservations') },
  ]

  const kpis = [
    { lbl: t('locations.overview.revenue'),      val: '—', sub: t('locations.overview.revenue_sub'),      subColor: 'var(--stone)' },
    { lbl: t('locations.overview.transactions'), val: '—', sub: t('locations.overview.txns_sub') },
    { lbl: t('locations.overview.active_staff'), val: summary?.totalStaff ?? '—', sub: t('locations.overview.staff_sub') },
    { lbl: t('locations.overview.reservations'), val: reservations.length || '—', sub: t('locations.overview.res_sub'), subColor: 'var(--green)' },
    { lbl: t('locations.overview.low_stock'),    val: summary?.lowStockAlerts ?? 0, valColor: (summary?.lowStockAlerts ?? 0) > 0 ? 'var(--red)' : 'var(--deep)', sub: t('locations.overview.low_stock_sub') },
  ]

  return (
    <>
      {/* Subnav */}
      <div className="loc-subnav">
        {SUBNAV.map(s => (
          <div key={s.key} onClick={() => setView(s.key)} className={`loc-subnav-item${view === s.key ? ' act' : ''}`}>
            <span className="material-symbols-outlined loc-subnav-icon">{s.icon}</span>{s.label}
          </div>
        ))}
        <div className="loc-subnav-actions">
          <button className="btn btn-outline btn-sm" disabled title={t('common.coming_soon', 'Coming soon')}>
            <span className="material-symbols-outlined">download</span>{t('common.export')}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/locations/new')}>
            <span className="material-symbols-outlined">add</span>{t('locations.add_location')}
          </button>
        </div>
      </div>

      {/* ══ OVERVIEW ══ */}
      {view === 'overview' && (
        <>
          <Alert type="info" icon="info">{t('locations.overview.alert')}</Alert>

          <div className="loc-kpi-grid">
            {kpis.map(k => (
              <div key={k.lbl} className="card loc-kpi-card">
                <div className="loc-kpi-lbl">{k.lbl}</div>
                <div className="loc-kpi-val" style={{ color: k.valColor || 'var(--deep)' }}>{k.val}</div>
                {k.sub && <div className="loc-kpi-sub" style={{ color: k.subColor || 'var(--stone)', fontWeight: k.subColor ? 600 : 400 }}>{k.sub}</div>}
              </div>
            ))}
          </div>

          {loadingLocations && <Loading />}
          {!loadingLocations && locationsError && <Alert type="warn" icon="error">{typeof locationsError === 'string' ? locationsError : t('locations.err.load_locations', 'Could not load your locations.')}</Alert>}

          {!loadingLocations && !locationsError && (
            <>
              <SectionTitle>{t('locations.overview.location_status')}</SectionTitle>
              {locations.length === 0 && <div className="state-empty">{t('locations.empty.locations', 'No locations yet. Add your first location to get started.')}</div>}
              {locations.map(loc => {
                const m = typeMeta(loc.type)
                return (
                  <div key={loc.id} className="card loc-card">
                    <div className="loc-card-hdr">
                      <div className="loc-card-icon" style={{ background: m.bg }}>{m.emoji}</div>
                      <div className="loc-card-info">
                        <div className="loc-card-name">
                          {loc.name}
                          {loc.isPrimary && <span className="loc-primary-badge">{t('locations.primary', 'Primary')}</span>}
                        </div>
                        <div className="loc-card-addr">
                          {loc.address?.line1}{loc.address?.city ? `, ${loc.address.city}` : ''}
                          {loc.type && <strong> · {locTypeLabel(t, loc.type)}</strong>}
                        </div>
                      </div>
                      <span className="loc-status-badge" style={statusStyleForBadge(loc.status)}>
                        {loc.status === 'active' ? t('common.active') : t('common.inactive')}
                      </span>
                      <button className="btn btn-outline btn-sm" onClick={() => setShowEditLoc(loc)}>{t('locations.settings')}</button>
                    </div>
                    <div className="loc-card-stats">
                      {[
                        { val: loc.stats?.todayRevenue != null ? `€${loc.stats.todayRevenue}` : '—', lbl: t('locations.overview.revenue') },
                        { val: loc.stats?.transactions ?? '—',                                       lbl: t('locations.overview.transactions') },
                        { val: loc.stats?.staffOnDuty ?? 0,                                          lbl: t('locations.staff_on_duty') },
                        { val: loc.stats?.lowStock ?? 0,                                             lbl: t('locations.low_stock'), valColor: (loc.stats?.lowStock ?? 0) > 0 ? 'var(--red)' : 'var(--deep)' },
                      ].map((s, i) => (
                        <div key={i} className={`loc-card-stat${i < 3 ? ' loc-card-stat-border' : ''}`}>
                          <div className="loc-card-stat-val" style={{ color: s.valColor || 'var(--deep)' }}>{s.val}</div>
                          <div className="loc-card-stat-lbl">{s.lbl}</div>
                        </div>
                      ))}
                    </div>
                    <div className="loc-card-footer">
                      <span className="loc-card-footer-stripe">
                        📟 Stripe Terminal · {loc.stripeTerminal?.status ?? 'None'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </>
      )}

      {/* ══ LOCATIONS TABLE ══ */}
      {view === 'locations' && (
        <>
          <Alert type="info" icon="store">{t('locations.settings_alert')}</Alert>
          {loadingLocations && <Loading />}
          {!loadingLocations && locationsError && <Alert type="warn" icon="error">{typeof locationsError === 'string' ? locationsError : t('locations.err.load_locations', 'Could not load your locations.')}</Alert>}
          {!loadingLocations && !locationsError && (
            <div className="card loc-table-card">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t('locations.table.location')}</th>
                    <th>{t('locations.table.type')}</th>
                    <th>{t('locations.table.hours')}</th>
                    <th>{t('locations.table.stripe')}</th>
                    <th>{t('locations.table.since')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {locations.map(loc => {
                    const m = typeMeta(loc.type)
                    return (
                      <tr key={loc.id}>
                        <td>
                          <div className="loc-tbl-name-cell">
                            <div className="loc-tbl-icon" style={{ background: m.bg }}>{m.emoji}</div>
                            <div>
                              <div className="loc-tbl-name">{shortName(loc.name)}</div>
                              <div className="loc-tbl-addr">
                                {loc.address?.line1 ?? '—'}
                                {loc.isPrimary && <> · <strong>{t('locations.primary', 'Primary')}</strong></>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td><span className="loc-type-tag" style={{ color: m.color }}>{locTypeLabel(t, loc.type)}</span></td>
                        <td className="loc-tbl-hours">
                          {formatHours(t, loc.openingHours).split(' / ').map((h, i) => <div key={i}>{h}</div>)}
                        </td>
                        <td>
                          <span className="loc-stripe-status" style={{ color: loc.stripeTerminal?.status === 'connected' ? 'var(--green)' : 'var(--stone)' }}>
                            {terminalLabel(t, loc.stripeTerminal?.status)}
                          </span>
                        </td>
                        <td className="loc-tbl-since">{formatSince(loc.activatedOn)}</td>
                        <td><button className="btn btn-outline btn-xs" onClick={() => setShowEditLoc(loc)}>{t('locations.settings')}</button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ══ STOCK BY LOCATION ══ */}
      {view === 'inventory' && (
        <>
          <div className="loc-inv-topbar">
            <div className="loc-inv-hint">{t('locations.inventory.hint')}</div>
            <div className="loc-inv-actions">
              <button className="btn btn-outline btn-sm" onClick={() => setShowTransfer({})}>
                <span className="material-symbols-outlined">swap_horiz</span>{t('locations.inventory.transfer_btn')}
              </button>
            </div>
          </div>
          {loadingStock && <Loading />}
          {!loadingStock && stockError && <Alert type="warn" icon="error">{typeof stockError === 'string' ? stockError : t('locations.err.load_stock', 'Could not load stock by location.')}</Alert>}
          {!loadingStock && !stockError && (
            <div className="card loc-table-card">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t('locations.inventory.product')}</th>
                    <th>{t('locations.inventory.sku')}</th>
                    {stock.locations.map(l => <th key={l.id} className="loc-th-center">{shortName(l.name)}</th>)}
                    <th className="loc-th-center">{t('locations.inventory.total')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {stock.items.length === 0 && (
                    <tr><td colSpan={stock.locations.length + 4} className="state-empty">{t('locations.empty.stock', 'No products with stock yet.')}</td></tr>
                  )}
                  {stock.items.map(p => (
                    <tr key={p.productId}>
                      <td>
                        <div className="loc-inv-product-name">{p.productName}</div>
                        <div className="loc-inv-product-cat">{p.category}</div>
                      </td>
                      <td className="loc-inv-sku">{p.sku}</td>
                      {stock.locations.map(loc => {
                        const cell = p.byLocation.find(b => b.locationId === loc.id)
                        return <td key={loc.id} className="loc-th-center"><StockBadge type={cell?.status} value={cell?.qty} /></td>
                      })}
                      <td className="loc-th-center"><strong>{p.total ?? 0}</strong></td>
                      <td>
                        <button className="btn btn-xs btn-outline" onClick={() => setShowTransfer({ productId: p.productId })}>
                          {t('locations.inventory.transfer')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="loc-inv-legend">
                {[
                  { t: 'ok',  v: 'n', lbl: t('locations.inventory.legend.in_stock') },
                  { t: 'low', v: 'n', lbl: t('locations.inventory.legend.low') },
                  { t: 'out', v: '0', lbl: t('locations.inventory.legend.out') },
                  { t: 'na',  v: '—', lbl: t('locations.inventory.legend.na') },
                ].map(l => (
                  <span key={l.lbl} className="loc-inv-legend-item"><StockBadge type={l.t} value={l.v} />{l.lbl}</span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ══ TRANSFERS ══ */}
      {view === 'transfers' && (
        <>
          <div className="loc-transfers-topbar">
            <div className="loc-transfers-hint">{t('locations.transfers.hint')}</div>
            <button className="btn btn-primary" onClick={() => setShowTransfer({})}>
              <span className="material-symbols-outlined">add</span>{t('locations.transfers.new_btn')}
            </button>
          </div>

          {loadingTransfers && <Loading />}

          {!loadingTransfers && (
            <>
              {suggestedTransfers.length > 0 && (
                <>
                  <Alert type="warn" icon="warning">{t('locations.transfers.urgent_alert')}</Alert>
                  <SectionTitle>{t('locations.transfers.suggested')}</SectionTitle>
                  <div className="loc-suggested-list">
                    {suggestedTransfers.map((s, i) => (
                      <div key={s.id ?? i} className={`card loc-suggested-card${s.urgent ? ' loc-suggested-urgent' : ''}`}>
                        <div className="loc-suggested-body">
                          <div className="loc-suggested-name">
                            {s.productName ?? s.name ?? 'Product'}
                            {s.sku && <span className="loc-suggested-sku"> · {s.sku}</span>}
                          </div>
                          <div className="loc-suggested-desc">{s.description ?? s.desc ?? '—'}</div>
                        </div>
                        <div className="loc-suggested-dir">
                          {(s.fromLocationName ?? '?')} → {(s.toLocationName ?? '?')}
                        </div>
                        <div className="loc-suggested-qty">Move {s.suggestedQuantity ?? s.qty ?? 1} units</div>
                        <button
                          className={`btn btn-sm ${s.urgent ? 'btn-primary' : 'btn-outline'}`}
                          onClick={() => setShowTransfer({
                            productId:      s.productId,
                            fromLocationId: s.fromLocationId,
                            toLocationId:   s.toLocationId,
                            quantity:       s.suggestedQuantity ?? 1,
                          })}>
                          {s.urgent ? t('locations.transfers.transfer_now') : t('locations.transfers.transfer')}
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <SectionTitle>{t('locations.transfers.history')}</SectionTitle>
              <div className="card loc-table-card">
                {transferHistory.length === 0 ? (
                  <div className="state-empty">{t('locations.empty.transfers', 'No transfers yet.')}</div>
                ) : (
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>{t('locations.transfers.table.date')}</th>
                        <th>{t('locations.transfers.table.product')}</th>
                        <th>{t('locations.transfers.table.from')}</th>
                        <th>{t('locations.transfers.table.to')}</th>
                        <th>{t('locations.transfers.table.qty')}</th>
                        <th>{t('locations.transfers.table.by')}</th>
                        <th>{t('locations.transfers.table.status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transferHistory.map((th, i) => (
                        <tr key={th.id ?? i}>
                          <td className="loc-tbl-since">{formatSince(th.createdAt)}</td>
                          <td className="loc-inv-product-name">{th.productName ?? '—'}</td>
                          <td className="loc-tbl-hours">{th.fromLocationName ?? '—'}</td>
                          <td className="loc-tbl-hours">{th.toLocationName ?? '—'}</td>
                          <td><strong>{th.quantity ?? '—'}</strong></td>
                          <td className="loc-tbl-since">{th.actorName ?? '—'}</td>
                          <td><span className="loc-complete-badge">{transferLabel(t, th.status)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ══ STAFF & PERMISSIONS ══ */}
      {view === 'staff' && (
        <>
          <div className="loc-staff-topbar">
            <div className="loc-transfers-hint">{t('locations.staff.hint')}</div>
            <button className="btn btn-primary" onClick={() => setShowAddStaff(true)}>
              <span className="material-symbols-outlined">person_add</span>{t('locations.staff.add_btn')}
            </button>
          </div>

          <div className="grid2 loc-staff-grid">
            <div>
              <SectionTitle>{t('locations.staff.by_location')}</SectionTitle>

              {loadingStaff && <Loading />}
              {!loadingStaff && staffError && <Alert type="warn" icon="error">{typeof staffError === 'string' ? staffError : t('locations.err.load_staff', 'Could not load your staff.')}</Alert>}
              {!loadingStaff && !staffError && staff.length === 0 && (
                <div className="state-empty">{t('locations.empty.staff', 'No staff members yet.')}</div>
              )}

              {!loadingStaff && !staffError && staff.map(s => {
                const roleStyle = ROLE_META[s.role]?.style ?? ROLE_META.staff.style
                const locNames = locationIdsOf(s.locations).map(id => locations.find(l => l.id === id)?.name).filter(Boolean)
                return (
                  <div key={s.id} className="card loc-staff-card">
                    <div className="loc-staff-av" style={roleStyle}>{initials(s.name)}</div>
                    <div className="loc-staff-info">
                      <div className="loc-staff-name">
                        {s.name}
                        {!s.is_active && <span className="loc-inactive-tag">{t('common.inactive')}</span>}
                      </div>
                      <div className="loc-staff-email">{s.email}</div>
                      <div className="loc-staff-locs">
                        {locNames.length === 0
                          ? <span className="loc-staff-loc-empty">{t('locations.staff.no_locations', 'No locations assigned')}</span>
                          : locNames.map(n => <span key={n} className="loc-staff-loc-tag">{shortName(n)}</span>)
                        }
                      </div>
                    </div>
                    <div className="loc-staff-actions">
                      <span className="loc-staff-role-tag" style={roleStyle}>{roleLabel(t, s.role)}</span>
                      <button className="btn btn-outline btn-xs" onClick={() => setShowEditStaff(s)}>{t('common.edit')}</button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div>
              <SectionTitle>{t('locations.staff.permissions')}</SectionTitle>
              {loadingPerms && <Loading />}
              {!loadingPerms && (
                <div className="card loc-table-card">
                  <table className="loc-perm-table">
                    <thead>
                      <tr>
                        <th className="loc-perm-th-left">{t('locations.staff.feature')}</th>
                        {['owner', 'manager', 'staff'].map(r => <th key={r} className="loc-perm-th">{roleLabel(t, r)}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {permMatrix.map(cat => (
                        <Fragment key={cat.category}>
                          <tr><td colSpan={4} className="loc-perm-cat">{cat.category}</td></tr>
                          {cat.features.map(p => (
                            <tr key={p.key}>
                              <td className="loc-perm-name">{p.label}</td>
                              <td className="loc-perm-cell"><PermIcon val={permIconVal(p.owner)} /></td>
                              <td className="loc-perm-cell"><PermIcon val={permIconVal(p.manager)} /></td>
                              <td className="loc-perm-cell"><PermIcon val={permIconVal(p.staff)} /></td>
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                  <div className="loc-perm-legend">
                    <span><span className="loc-perm-full">●</span> {t('locations.staff.full_access')}</span>
                    <span><span className="loc-perm-partial">◐</span> {t('locations.staff.limited_access')}</span>
                    <span><span className="loc-perm-none">○</span> {t('locations.staff.no_access')}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ══ RESERVATIONS ══ */}
      {view === 'reservations' && (
        <>
          <Alert type="info" icon="calendar_today">{t('locations.reservations.alert')}</Alert>
          <SectionTitle>{t('locations.reservations.today_title')}</SectionTitle>
          {loadingReservations && <div className="state-empty">{t('common.loading')}</div>}
          {!loadingReservations && reservations.length === 0 && (
            <div className="state-empty">{t('locations.empty.reservations', 'No reservations across your locations yet.')}</div>
          )}
          {/* Reservation rendering follows real schema once backend populates it */}
        </>
      )}

      {/* ══ MODAL: Edit Location ══ */}
      {showEditLoc && (
        <EditLocationModal
          location={showEditLoc}
          onClose={() => setShowEditLoc(null)}
          onSaved={() => { setShowEditLoc(null); fetchLocations() }}
        />
      )}

      {/* ══ MODAL: Add Staff ══ */}
      {showAddStaff && (
        <AddStaffModal
          locations={locations}
          onClose={() => setShowAddStaff(false)}
          onInvited={() => { setShowAddStaff(false); fetchStaff() }}
        />
      )}

      {/* ══ MODAL: Edit Staff ══ */}
      {showEditStaff && (
        <EditStaffModal
          staff={showEditStaff}
          locations={locations}
          onClose={() => setShowEditStaff(null)}
          onSaved={() => { setShowEditStaff(null); fetchStaff() }}
        />
      )}

      {/* ══ MODAL: Stock Transfer ══ */}
      {showTransfer && (
        <StockTransferModal
          prefill={showTransfer}
          locations={locations}
          stockItems={stock.items}
          onClose={() => setShowTransfer(null)}
          onCompleted={() => { setShowTransfer(null); fetchTransfers(); fetchStock() }}
        />
      )}
    </>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// MODAL COMPONENTS
// ══════════════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────────────────
function EditLocationModal({ location, onClose, onSaved }) {
  const { t } = useTranslation()
  const [name, setName]                 = useState(location.name ?? '')
  const [type, setType]                 = useState(location.type ?? 'standard')
  const [addressLine1, setAddr]         = useState(location.address?.line1 ?? '')
  const [city, setCity]                 = useState(location.address?.city ?? '')
  const [postcode, setPostcode]         = useState(location.address?.postcode ?? '')
  const [phone, setPhone]               = useState(location.phone ?? '')
  const [email, setEmail]               = useState(location.email ?? '')
  const [monSat, setMonSat]             = useState(location.openingHours?.mon_sat ?? '10:00-19:30')
  const [sun, setSun]                   = useState(location.openingHours?.sun ?? '11:00-18:00')
  const [listingName, setListingName]   = useState(location.miItaliaListingName ?? '')
  const [description, setDescription]   = useState(location.description ?? '')
  const [saving, setSaving]             = useState(false)
  const [deactivating, setDeactivating] = useState(false)
  const [error, setError]               = useState(null)

  async function submit() {
    if (saving) return
    setSaving(true); setError(null)
    try {
      const res = await apiFetch(`${API}/boutique/locations/${location.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name, type,
          addressLine1, city, postcode,
          phone: phone || null,
          email: email || null,
          openingHours: { mon_sat: monSat, sun },
          miItaliaListingName: listingName || name,
          description: description || null,
        }),
      }).then(r => r.json())
      if (res?.success) onSaved()
      else setError(res?.message ?? t('locations.err.save_location', 'Could not save this location.'))
    } catch (err) { console.error('[EditLocationModal] failed', err); setError(t('common.error_network')) }
    finally { setSaving(false) }
  }

  async function deactivate() {
    const isActive = location.status === 'active'
    if (!confirm(`${isActive ? 'Deactivate' : 'Reactivate'} this location?`)) return
    setDeactivating(true); setError(null)
    try {
      const res = await apiFetch(`${API}/boutique/locations/${location.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: isActive ? 'inactive' : 'active' }),
      }).then(r => r.json())
      if (res?.success) onSaved()
      else setError(res?.message ?? t('locations.err.save_status', 'Could not change this location status.'))
    } catch (err) { console.error('[EditLocationModal] deactivate failed', err); setError(t('common.error_network')) }
    finally { setDeactivating(false) }
  }

  const isActive = location.status === 'active'

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <span className="modal-title">{shortName(location.name)} — <em>{t('locations.modal.settings_title')}</em></span>
          <button className="modal-close" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="grid2">
          <div>
            <SectionTitle>{t('locations.modal.basic_details')}</SectionTitle>
            <div className="form-group"><label className="form-lbl">{t('locations.modal.loc_name')}</label>
              <input className="form-input" value={name} onChange={e => setName(e.target.value)} /></div>
            <div className="form-group"><label className="form-lbl">{t('locations.modal.type')}</label>
              <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
                <option value="standard">{locTypeLabel(t, 'standard')}</option>
                <option value="flagship">{locTypeLabel(t, 'flagship')}</option>
                <option value="popup">{locTypeLabel(t, 'popup')}</option>
                <option value="outlet">{locTypeLabel(t, 'outlet')}</option>
              </select></div>
            <div className="form-group"><label className="form-lbl">{t('locations.modal.address')}</label>
              <input className="form-input" value={addressLine1} onChange={e => setAddr(e.target.value)} /></div>
            <div className="form-row2">
              <div className="form-group"><label className="form-lbl">{t('locations.modal.city')}</label>
                <input className="form-input" value={city} onChange={e => setCity(e.target.value)} /></div>
              <div className="form-group"><label className="form-lbl">{t('locations.modal.postcode')}</label>
                <input className="form-input" value={postcode} onChange={e => setPostcode(e.target.value)} /></div>
            </div>
            <div className="form-group"><label className="form-lbl">{t('locations.modal.phone')}</label>
              <input className="form-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder={t('locations.modal.phone_ph', '+39 055 123 4567')} /></div>
            <div className="form-group"><label className="form-lbl">{t('locations.modal.email')}</label>
              <input className="form-input" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('locations.modal.email_ph', 'name@boutique.it')} /></div>
            <SectionTitle>{t('locations.modal.opening_hours')}</SectionTitle>
            <div className="loc-hours-list">
              <div className="loc-hours-row">
                <span className="loc-hours-day">{t('locations.hours.mon_sat', 'Mon–Sat')}</span>
                <input className="form-input loc-hours-input" value={monSat} onChange={e => setMonSat(e.target.value)} placeholder="10:00-19:30" />
              </div>
              <div className="loc-hours-row">
                <span className="loc-hours-day">{t('locations.hours.sunday', 'Sunday')}</span>
                <input className="form-input loc-hours-input" value={sun} onChange={e => setSun(e.target.value)} placeholder={t('locations.hours.sun_ph', '11:00-18:00 or Closed')} />
              </div>
            </div>
          </div>
          <div>
            <SectionTitle>{t('locations.modal.mi_profile')}</SectionTitle>
            <Alert type="info" icon="store">{t('locations.modal.mi_alert')}</Alert>
            <div className="form-group"><label className="form-lbl">{t('locations.modal.mi_name')}</label>
              <input className="form-input" value={listingName} onChange={e => setListingName(e.target.value)} /></div>
            <div className="form-group"><label className="form-lbl">{t('locations.modal.description')}</label>
              <textarea className="form-textarea" value={description} onChange={e => setDescription(e.target.value)} /></div>

            <SectionTitle>{t('locations.modal.stripe_terminal')}</SectionTitle>
            <div className="loc-terminal-row">
              <div className="loc-terminal-icon">📟</div>
              <div className="loc-terminal-info">
                <div className="loc-terminal-name">Stripe Terminal</div>
                <div className="loc-terminal-status">
                  {t('locations.modal.terminal_status', 'Status')}: {terminalLabel(t, location.stripeTerminal?.status)}
                  {location.stripeTerminal?.id && <> · {t('locations.modal.reader_id', 'Reader ID')}: {location.stripeTerminal.id}</>}
                </div>
              </div>
              <button className="btn btn-outline btn-xs" disabled title={t('common.coming_soon', 'Coming soon')}>{t('locations.modal.replace')}</button>
            </div>
            <button className="btn btn-outline btn-sm loc-add-terminal-btn" disabled title={t('common.coming_soon', 'Coming soon')}>
              <span className="material-symbols-outlined">add</span>{t('locations.modal.add_terminal')}
            </button>

            <SectionTitle>{t('locations.modal.danger_zone')}</SectionTitle>
            <div className="loc-danger-zone">
              <div className="loc-danger-title">
                {isActive ? t('locations.modal.deactivate_title') : t('locations.modal.reactivate_title', 'Reactivate this location')}
              </div>
              <div className="loc-danger-sub">
                {isActive ? t('locations.modal.deactivate_sub') : t('locations.modal.reactivate_sub', 'This location will become available again for POS, orders, and reservations.')}
              </div>
              <button className={`btn btn-sm ${isActive ? 'btn-red' : 'btn-primary'}`} onClick={deactivate} disabled={deactivating}>
                {deactivating ? t('common.loading') : (isActive ? t('locations.modal.deactivate_btn') : t('locations.modal.reactivate_btn', 'Reactivate Location'))}
              </button>
            </div>
          </div>
        </div>
        {error && <div className="alert alert-red loc-inline-alert"><span className="material-symbols-outlined">error</span>{error}</div>}
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
function AddStaffModal({ locations, onClose, onInvited }) {
  const { t } = useTranslation()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [email, setEmail]         = useState('')
  const [role, setRole]           = useState('staff')
  const [locAssign, setLocAssign] = useState({})
  const [inviting, setInviting]   = useState(false)
  const [error, setError]         = useState(null)

  async function invite() {
    if (!email.trim() || !firstName.trim() || inviting) return
    setInviting(true); setError(null)
    try {
      // Step 1: invite
      const fullName = `${firstName} ${lastName}`.trim()
      const invRes = await apiFetch(`${API}/boutique/staff/invite`, {
        method: 'POST',
        body: JSON.stringify({ email, name: fullName, role }),
      }).then(r => r.json())

      if (!invRes?.success) { setError(invRes?.message ?? t('locations.err.invite', 'Could not send the invitation.')); return }

      // Step 2: assign locations (if any picked)
      const locationIds = locationIdsOf(Object.entries(locAssign).filter(([, on]) => on).map(([id]) => id))
      if (locationIds.length > 0) {
        const newId = invRes.data?.id
        await apiFetch(`${API}/boutique/locations/staff/${newId}`, {
          method: 'PUT',
          body: JSON.stringify({ locationIds }),
        }).then(r => r.json())
      }
      onInvited()
    } catch (err) { console.error('[AddStaffModal] invite failed', err); setError(t('common.error_network')) }
    finally { setInviting(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <span className="modal-title">{t('locations.modal.add_staff_title')} <em>{t('locations.modal.add_staff_title_em')}</em></span>
          <button className="modal-close" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="form-row2">
          <div className="form-group"><label className="form-lbl">{t('locations.modal.first_name')}</label>
            <input className="form-input" placeholder="Elena" value={firstName} onChange={e => setFirstName(e.target.value)} /></div>
          <div className="form-group"><label className="form-lbl">{t('locations.modal.last_name')}</label>
            <input className="form-input" placeholder="Conti" value={lastName} onChange={e => setLastName(e.target.value)} /></div>
        </div>
        <div className="form-group"><label className="form-lbl">{t('locations.modal.staff_email')}</label>
          <input className="form-input" type="email" placeholder="elena@neglia.it" value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div className="form-group">
          <label className="form-lbl">{t('locations.modal.role')}</label>
          <select className="form-select" value={role} onChange={e => setRole(e.target.value)}>
            <option value="staff">{roleLabel(t, 'staff')}</option>
            <option value="manager">{roleLabel(t, 'manager')}</option>
          </select>
          <div className="form-hint">{t('locations.modal.role_hint')}</div>
        </div>
        <div className="form-group">
          <label className="form-lbl">{t('locations.modal.assigned_locations')}</label>
          <div className="loc-assign-list">
            {locations.length === 0 && <div className="loc-assign-empty">{t('locations.modal.no_locations_assignable', 'No locations to assign yet.')}</div>}
            {locations.map(l => (
              <label key={l.id} className="loc-assign-item">
                <input type="checkbox" checked={!!locAssign[l.id]}
                  onChange={e => setLocAssign(p => ({ ...p, [l.id]: e.target.checked }))}
                  className="loc-assign-checkbox" />
                {shortName(l.name)}{l.isPrimary && <span className="loc-primary-badge-sm">{t('locations.primary', 'Primary')}</span>}
              </label>
            ))}
          </div>
          <div className="form-hint">{t('locations.modal.locations_hint')}</div>
        </div>
        {error && <div className="alert alert-red loc-inline-alert"><span className="material-symbols-outlined">error</span>{error}</div>}
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={invite} disabled={inviting || !email.trim() || !firstName.trim()}>
            <span className="material-symbols-outlined">send</span>{inviting ? t('common.loading') : t('locations.modal.send_invite')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
function EditStaffModal({ staff, locations, onClose, onSaved }) {
  const { t } = useTranslation()
  const [name, setName]         = useState(staff.name ?? '')
  const [role, setRole]         = useState(staff.role ?? 'staff')
  const [isActive, setIsActive] = useState(staff.is_active !== false)
  const [locAssign, setLocAssign] = useState(() => {
    const initial = {}
    locationIdsOf(staff.locations).forEach(id => { initial[id] = true })
    return initial
  })
  const [saving, setSaving]         = useState(false)
  const [resetting, setResetting]   = useState(false)
  const [deleting, setDeleting]     = useState(false)
  const [error, setError]           = useState(null)
  const [notice, setNotice]         = useState(null)

  async function save() {
    if (saving) return
    setSaving(true); setError(null); setNotice(null)
    try {
      // Step 1: update name/role/is_active
      const infoRes = await apiFetch(`${API}/boutique/staff/${staff.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, role, is_active: isActive }),
      }).then(r => r.json())

      if (!infoRes?.success) { setError(infoRes?.message ?? t('locations.err.save_staff', 'Could not save this staff member.')); return }

      // Step 2: update location assignments
      const locationIds = locationIdsOf(Object.entries(locAssign).filter(([, on]) => on).map(([id]) => id))
      const locRes = await apiFetch(`${API}/boutique/locations/staff/${staff.id}`, {
        method: 'PUT',
        body: JSON.stringify({ locationIds }),
      }).then(r => r.json())

      if (!locRes?.success) { setError(locRes?.message ?? t('locations.err.assign', 'Could not save the assigned locations.')); return }
      onSaved()
    } catch (err) { console.error('[EditStaffModal] save failed', err); setError(t('common.error_network')) }
    finally { setSaving(false) }
  }

  async function resetPassword() {
    if (!confirm(`Send password reset email to ${staff.email}?`)) return
    setResetting(true); setError(null); setNotice(null)
    try {
      const res = await apiFetch(`${API}/boutique/staff/${staff.id}/reset-password`, {
        method: 'PUT',
      }).then(r => r.json())
      if (res?.success) setNotice(res?.message ?? 'Password reset email sent')
      else setError(res?.message ?? t('locations.err.reset', 'Could not send the password reset email.'))
    } catch (err) { console.error('[EditStaffModal] resetPassword failed', err); setError(t('common.error_network')) }
    finally { setResetting(false) }
  }

  async function del() {
    if (!confirm(`Remove ${staff.name} from your staff? This cannot be undone.`)) return
    setDeleting(true); setError(null)
    try {
      const res = await apiFetch(`${API}/boutique/staff/${staff.id}`, { method: 'DELETE' }).then(r => r.json())
      if (res?.success) onSaved()
      else setError(res?.message ?? t('locations.err.delete', 'Could not remove this staff member.'))
    } catch (err) { console.error('[EditStaffModal] delete failed', err); setError(t('common.error_network')) }
    finally { setDeleting(false) }
  }

  const isOwner = staff.role === 'owner'

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <span className="modal-title">{t('locations.modal.edit_staff_title', 'Edit')} <em>{t('locations.modal.edit_staff_title_em', 'Staff')}</em></span>
          <button className="modal-close" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="form-group"><label className="form-lbl">{t('locations.modal.email_readonly', 'Email (read-only)')}</label>
          <input className="form-input" value={staff.email} readOnly /></div>
        <div className="form-group"><label className="form-lbl">{t('locations.modal.staff_name', 'Name')}</label>
          <input className="form-input" value={name} onChange={e => setName(e.target.value)} /></div>
        <div className="form-row2">
          <div className="form-group">
            <label className="form-lbl">{t('locations.modal.role')}</label>
            <select className="form-select" value={role} onChange={e => setRole(e.target.value)} disabled={isOwner}>
              {isOwner && <option value="owner">{roleLabel(t, 'owner')}</option>}
              <option value="manager">{roleLabel(t, 'manager')}</option>
              <option value="staff">{roleLabel(t, 'staff')}</option>
            </select>
            {isOwner && <div className="form-hint">{t('locations.modal.owner_role_locked', 'Owner role cannot be changed here.')}</div>}
          </div>
          <div className="form-group">
            <label className="form-lbl">{t('locations.modal.status', 'Status')}</label>
            <div className="loc-staff-active-toggle">
              <label className="loc-assign-item">
                <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="loc-assign-checkbox" />
                {t('common.active')}
              </label>
            </div>
          </div>
        </div>
        <div className="form-group">
          <label className="form-lbl">{t('locations.modal.assigned_locations')}</label>
          <div className="loc-assign-list">
            {locations.length === 0 && <div className="loc-assign-empty">{t('locations.modal.no_locations_assignable', 'No locations to assign yet.')}</div>}
            {locations.map(l => (
              <label key={l.id} className="loc-assign-item">
                <input type="checkbox" checked={!!locAssign[l.id]}
                  onChange={e => setLocAssign(p => ({ ...p, [l.id]: e.target.checked }))}
                  className="loc-assign-checkbox" />
                {shortName(l.name)}{l.isPrimary && <span className="loc-primary-badge-sm">{t('locations.primary', 'Primary')}</span>}
              </label>
            ))}
          </div>
        </div>
        {notice && <div className="alert alert-info loc-inline-alert"><span className="material-symbols-outlined">check_circle</span>{notice}</div>}
        {error  && <div className="alert alert-red  loc-inline-alert"><span className="material-symbols-outlined">error</span>{error}</div>}

        <SectionTitle>{t('locations.modal.danger_zone')}</SectionTitle>
        <div className="loc-danger-zone">
          <div className="loc-danger-title">{t('locations.modal.reset_title', 'Send password reset email')}</div>
          <div className="loc-danger-sub">{t('locations.modal.reset_sub', 'The staff member will receive a link to set a new password.')}</div>
          <button className="btn btn-outline btn-sm" onClick={resetPassword} disabled={resetting}>
            <span className="material-symbols-outlined">key</span>{resetting ? t('common.loading') : t('locations.modal.reset_btn', 'Send reset link')}
          </button>
        </div>
        {!isOwner && (
          <div className="loc-danger-zone loc-danger-zone-mt">
            <div className="loc-danger-title">{t('locations.modal.remove_title', 'Remove this staff member')}</div>
            <div className="loc-danger-sub">{t('locations.modal.remove_sub', 'Their access will be revoked immediately.')}</div>
            <button className="btn btn-red btn-sm" onClick={del} disabled={deleting}>
              <span className="material-symbols-outlined">delete</span>{deleting ? t('common.loading') : t('locations.modal.remove_btn', 'Remove staff')}
            </button>
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Uses variants + per-location stock directly from GET /boutique/locations/stock.
// No fetch to /boutique/products/:id anymore — that endpoint returns global
// variant totals, not per-location, so it was misleading. Per-location qty
// now comes from `variants[].byLocation[].qty` in the stock payload.
function StockTransferModal({ prefill, locations, stockItems, onClose, onCompleted }) {
  const { t } = useTranslation()
  const [fromId, setFromId]         = useState(prefill.fromLocationId ?? locations[0]?.id ?? '')
  const [toId, setToId]             = useState(prefill.toLocationId ?? locations[1]?.id ?? '')
  const [productId, setProductId]   = useState(prefill.productId ?? '')
  const [variantId, setVariantId]   = useState(() => {
    if (!prefill.productId) return ''
    const product = stockItems.find(p => p.productId === prefill.productId)
    return product?.variants?.[0]?.variantId ?? ''
  })
  const [quantity, setQuantity]     = useState(prefill.quantity ?? 1)
  const [note, setNote]             = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState(null)

  // Derived data — no async fetches needed.
  const currentProduct = stockItems.find(p => p.productId === productId)
  const variants       = currentProduct?.variants ?? []
  const currentVariant = variants.find(v => v.variantId === variantId)

  // Source availability — from the current variant's byLocation for FROM location.
  // qty can be null (untracked → treat as 0).
  const sourceQty = currentVariant?.byLocation.find(l => l.locationId === fromId)?.qty ?? 0

  // Helper for the variant dropdown label
  const qtyAt = (variant, locId) => variant.byLocation.find(l => l.locationId === locId)?.qty ?? 0

  // When user picks a different product, reset variant to that product's first
  function handleProductChange(newProductId) {
    setProductId(newProductId)
    const product = stockItems.find(p => p.productId === newProductId)
    setVariantId(product?.variants?.[0]?.variantId ?? '')
  }

  async function submit() {
    if (submitting) return
    if (!fromId || !toId || fromId === toId || !variantId || !quantity) {
      setError('Fill from, to (different), variant, and quantity.')
      return
    }
    // Client-side guard — prevents the "Source has only 0 unit(s)" backend
    // error and gives the user immediate feedback.
    if (Number(quantity) > sourceQty) {
      setError(`Source has only ${sourceQty} unit(s) available.`)
      return
    }
    setSubmitting(true); setError(null)
    try {
      const res = await apiFetch(`${API}/boutique/locations/transfers`, {
        method: 'POST',
        body: JSON.stringify({
          fromLocationId: fromId,
          toLocationId:   toId,
          variantId,
          quantity: Number(quantity),
          note: note || null,
        }),
      }).then(r => r.json())
      if (res?.success) onCompleted()
      else setError(res?.message ?? t('locations.err.transfer', 'Could not create this transfer.'))
    } catch (err) { console.error('[StockTransferModal] submit failed', err); setError(t('common.error_network')) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-sm loc-transfer-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <span className="modal-title">{t('locations.modal.transfer_title')} <em>{t('locations.modal.transfer_title_em')}</em></span>
          <button className="modal-close" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>

        <div className="loc-transfer-from-to">
          <div className="loc-transfer-loc loc-transfer-from">
            <div className="loc-transfer-loc-lbl">{t('locations.modal.from')}</div>
            <select className="loc-transfer-select" value={fromId} onChange={e => setFromId(e.target.value)}>
              {locations.map(l => <option key={l.id} value={l.id}>{shortName(l.name)}</option>)}
            </select>
          </div>
          <div className="loc-transfer-arrow">→</div>
          <div className="loc-transfer-loc loc-transfer-to">
            <div className="loc-transfer-loc-lbl">{t('locations.modal.to')}</div>
            <select className="loc-transfer-select" value={toId} onChange={e => setToId(e.target.value)}>
              {locations.filter(l => l.id !== fromId).map(l => <option key={l.id} value={l.id}>{shortName(l.name)}</option>)}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-lbl">{t('locations.modal.product')}</label>
          <select className="form-select" value={productId} onChange={e => handleProductChange(e.target.value)}>
            <option value="">{t('locations.modal.select_product', 'Select a product…')}</option>
            {stockItems.map(p => <option key={p.productId} value={p.productId}>{p.productName} ({p.sku})</option>)}
          </select>
        </div>

        {productId && (
          <div className="form-group">
            <label className="form-lbl">{t('locations.modal.variant', 'Variant')}</label>
            <select className="form-select" value={variantId} onChange={e => setVariantId(e.target.value)}>
              {variants.length === 0 && <option value="">{t('locations.modal.no_variants', 'No variants available')}</option>}
              {variants.map(v => (
                <option key={v.variantId} value={v.variantId}>
                  {v.label} (at source: {qtyAt(v, fromId)})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="form-row2">
          <div className="form-group">
            <label className="form-lbl">{t('locations.modal.transfer_qty')}</label>
            <input className="form-input" type="number" min="1" max={sourceQty || undefined} value={quantity}
              onChange={e => setQuantity(e.target.value)} onWheel={e => e.target.blur()} />
          </div>
          <div className="form-group">
            <label className="form-lbl">{t('locations.modal.available_at_source')}</label>
            <div className="loc-available-units">
              {sourceQty} {t('inventory.thresholds.units')}
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-lbl">{t('locations.modal.note')}</label>
          <input className="form-input" placeholder={t('locations.modal.note_ph', 'e.g. for a reservation at 16:30')}
            value={note} onChange={e => setNote(e.target.value)} />
        </div>

        {error && <div className="alert alert-red loc-inline-alert"><span className="material-symbols-outlined">error</span>{error}</div>}
        <Alert type="info" icon="info">{t('locations.modal.transfer_alert')}</Alert>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={submit}
            disabled={submitting || !variantId || !quantity || sourceQty === 0}>
            <span className="material-symbols-outlined">swap_horiz</span>
            {submitting ? t('common.loading') : t('locations.modal.confirm_transfer')}
          </button>
        </div>
      </div>
    </div>
  )
}
