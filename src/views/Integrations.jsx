import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'
import { activeLocale } from '../lib/dateHelpers'
import Loading from '../components/ui/Loading'
import CategorySelectorDropdown from '../components/product/CategorySelectorDropdown'
import { useCategoryTree, findDivision, findType, findStyle } from '../lib/categoryTree'
import Toast, { useToast } from '../components/ui/Toast'
import * as shopify from '../lib/shopifyIntegration'
import Toggle from '../components/ui/Toggle'

const API = import.meta.env.VITE_API_URL

function slugify(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// 'en-US' was pinned here, so a boutique reading its own product counts in
// Italian saw 1,240 where the rest of the portal writes 1.240.
function fmt(n) { return (n ?? 0).toLocaleString(activeLocale()) }

function errMsg(err, fallback) { return err?.message || fallback }

/* ── Shopify store handle ──────────────────────────────────────────────────
 * The field takes the handle only — the ".myshopify.com" is printed beside the
 * input, not typed. The form used to accept anything non-empty, so an email
 * address went through and the backend built
 *     https://strom@mailinator.com.myshopify.com/admin/api/…
 * which its HTTP client rejected outright ("URL that includes credentials" —
 * everything before the @ reads as a username). The connection was stored and
 * every later call 500'd, with nothing on screen to say the domain was the
 * problem.
 *
 * normaliseShop absorbs what people actually paste — the full admin URL, the
 * suffix, a trailing slash, capitals — and isShopHandle then holds the line.
 * Shopify handles are lowercase letters, digits and hyphens, not starting or
 * ending with a hyphen; anything with '@', a dot or a space is not one. */
function normaliseShop(v) {
  return String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')                 // /admin/… and any trailing slash
    .replace(/\.myshopify\.com$/, '')
}
const isShopHandle = (v) => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(v)

export default function Integrations() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { toasts, show } = useToast()
  const { tree } = useCategoryTree()

  // ── Locations (Shopify connects one store per Primo location) ──
  const [locations, setLocations] = useState([])
  const [locLoading, setLocLoading] = useState(true)
  const [locationId, setLocationId] = useState('')

  useEffect(() => {
    apiFetch(`${API}/boutique/locations`)
      .then(r => r.json())
      .then(res => {
        const list = res?.data?.locations ?? []
        setLocations(list)
        if (list.length) setLocationId(String(list[0].id))
      })
      .catch(() => {})
      .finally(() => setLocLoading(false))
  }, [])

  const currentLocation = locations.find(l => String(l.id) === String(locationId))

  // ── Connection state for the selected location ──
  const [conn, setConn] = useState(null)
  const [connLoading, setConnLoading] = useState(true)
  const [step, setStep] = useState(null) // null | 'connect' | 'consent' | 'importing' | 'mapping'

  useEffect(() => {
    if (!locationId) { setConnLoading(false); return }
    let cancelled = false
    setConnLoading(true)
    setStep(null)
    shopify.getConnection(locationId)
      .then(c => { if (!cancelled) setConn(c) })
      .catch(() => { if (!cancelled) setConn(null) })
      .finally(() => { if (!cancelled) setConnLoading(false) })
    return () => { cancelled = true }
  }, [locationId])

  // ── Connect step ──
  const [domain, setDomain] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [scopes, setScopes] = useState({ fulfil: true, inv: true })
  const [connecting, setConnecting] = useState(false)

  function startConnect() {
    // Deliberately left blank rather than pre-filled with a guessed slug of
    // the location name — a plausible-looking but fake domain was too easy
    // to submit as-is (see ConnectStep's placeholder for the hint instead).
    setDomain('')
    setAccessToken('')
    setScopes({ fulfil: true, inv: true })
    setStep('connect')
  }
  function toggleScope(key) { setScopes(s => ({ ...s, [key]: !s[key] })) }

  async function handleConnect() {
    setConnecting(true)
    try {
      const record = await shopify.connectStore(locationId, { domain, accessToken, scopes })
      setConn(record)
      startImport(record)
    } catch (err) {
      show(errMsg(err, t('integrations.toast.connect_failed')), 'error')
    } finally {
      setConnecting(false)
    }
  }

  // ── Importing step ──
  function startImport(record) {
    setStep('importing')
    shopify.syncTypes(record.id)
      .then(result => finishImport(result))
      .catch(err => finishImport({ __error: err }))
  }

  async function finishImport(result) {
    if (result?.__error) {
      show(errMsg(result.__error, t('integrations.toast.sync_failed')), 'error')
      setStep(null)
      return
    }
    const { stats, rows } = result
    setConn(c => c ? { ...c, productCount: stats.products, mapping: rows } : c)
    setMapRows(rows.map(r => ({ ...r })))
    setMapFilter('all')
    setMapOpenIdx(null)
    setStep('mapping')
    show(t('integrations.toast.imported'), 'success')
  }

  // ── Mapping step ──
  const [mapRows, setMapRows] = useState([])
  const [mapFilter, setMapFilter] = useState('all')
  const [mapOpenIdx, setMapOpenIdx] = useState(null)
  const [mapBusy, setMapBusy] = useState(false)

  async function openMapping() {
    try {
      const { rows } = await shopify.getMapping(conn.id)
      setMapRows(rows.map(r => ({ ...r })))
      setMapFilter('all')
      setMapOpenIdx(null)
      setStep('mapping')
    } catch (err) {
      show(errMsg(err, t('common.error')), 'error')
    }
  }

  // Only persists once a full Division + Category is chosen (mirrors the
  // old "mapped" requirement of main && sub) — categoryTypeId only exists
  // once a Category (l2) node is resolved.
  async function setRowCategory(i, sel) {
    if (!sel.l1 || !sel.l2) return
    const typeNode = findType(findDivision(tree, sel.l1), sel.l2)
    if (!typeNode?.id) return
    const styleNode = sel.l3 ? findStyle(typeNode, sel.l3) : null
    // Style nodes are expected to carry a `slug`; falls back to a client
    // slugify of the display name if the tree doesn't expose one — unverified
    // against the live category-tree response shape.
    const styleSlug = sel.l3 ? (styleNode?.slug ?? slugify(sel.l3)) : null

    setMapBusy(true)
    try {
      const row = mapRows[i]
      // The PATCH response (`data.row`) comes back snake_cased and without
      // display names or a `status` field (category_type_id/style_slug/
      // overridden only) — a different shape than the GET mapping/sync-types
      // rows this component otherwise renders. Build the merged row from
      // what was just chosen instead of trusting that response's shape.
      await shopify.overrideMappingRow(conn.id, row.id, { categoryTypeId: typeNode.id, styleSlug })
      setMapRows(rows => rows.map((r, idx) => idx !== i ? r : {
        ...r,
        categoryTypeId: typeNode.id,
        categoryName: sel.l1,
        typeName: sel.l2,
        styleSlug,
        status: 'over',
        reasonKey: null,
        reasonLine: null,
      }))
    } catch (err) {
      show(errMsg(err, t('common.error')), 'error')
    } finally {
      setMapBusy(false)
    }
  }

  async function applyMapping() {
    try {
      const { stats, rows } = await shopify.applyMapping(conn.id)
      setConn(c => c ? { ...c, mapping: rows, productCount: stats.products } : c)
      setStep(null)
      show(stats.review > 0
        ? t('integrations.toast.mapping_some', { count: stats.review, defaultValue: '{{count}} products still need a category' })
        : t('integrations.toast.mapping_all'), 'success')
    } catch (err) {
      show(errMsg(err, t('common.error')), 'error')
    }
  }

  // ── Connected settings ──
  const [writeback, setWriteback] = useState({ fulfil: true, inv: true })
  const [shopifyLocId, setShopifyLocId] = useState('')
  const [saving, setSaving] = useState(false)

  const [loadedConn, setLoadedConn] = useState(conn)
  if (conn !== loadedConn) {
    setLoadedConn(conn)
    if (conn) { setWriteback(conn.writeback); setShopifyLocId(conn.shopifyLocationId ?? conn.shopifyLocations?.[0]?.id ?? '') }
  }

  // The write-back API can only turn a scope OFF (re-enabling needs a
  // disconnect + reconnect), so the toggle only ever moves true → false.
  function toggleWriteback(key) {
    setWriteback(w => (w[key] ? { ...w, [key]: false } : w))
  }

  async function saveConnected() {
    setSaving(true)
    try {
      let record = conn
      const chosenLoc = (conn.shopifyLocations ?? []).find(l => l.id === shopifyLocId)
      const keep = { productCount: record.productCount, mapping: record.mapping, shopifyLocations: record.shopifyLocations }
      if (chosenLoc && chosenLoc.id !== conn.shopifyLocationId) {
        record = await shopify.setLocationMapping(conn.id, { shopifyLocationId: chosenLoc.id, shopifyLocationName: chosenLoc.name }, keep)
      }
      if (writeback.fulfil !== conn.scopes.fulfil || writeback.inv !== conn.scopes.inv) {
        record = await shopify.setWriteback(conn.id, writeback, keep)
      }
      setConn(record)
      show(t('integrations.toast.saved'), 'success')
    } catch (err) {
      show(errMsg(err, t('common.error')), 'error')
    } finally {
      setSaving(false)
    }
  }

  // No generic "resync" endpoint exists yet — this re-runs sync-types, the
  // closest available "pull fresh data from Shopify" action. last-synced
  // is stamped client-side since the response doesn't return one.
  async function handleSyncNow() {
    try {
      const { stats, rows } = await shopify.syncTypes(conn.id)
      setConn(c => c ? { ...c, mapping: rows, productCount: stats.products, lastSyncAt: new Date().toISOString() } : c)
      show(t('integrations.toast.sync_started'), 'success')
    } catch (err) {
      show(errMsg(err, t('common.error')), 'error')
    }
  }

  async function handleDisconnect() {
    try {
      await shopify.disconnect(locationId)
      setConn(null)
      setStep(null)
      show(t('integrations.toast.disconnected'), 'info')
    } catch (err) {
      show(errMsg(err, t('common.error')), 'error')
    }
  }

  // ── Customers & orders (connected view) ──
  const [customersBusy, setCustomersBusy] = useState(false)
  const [orders, setOrders] = useState(null) // null = not loaded yet
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersSyncing, setOrdersSyncing] = useState(false)

  useEffect(() => {
    if (!conn?.id) return
    let cancelled = false
    setOrdersLoading(true)
    shopify.getOrders(conn.id)
      .then(({ rows }) => { if (!cancelled) setOrders(rows) })
      .catch(() => { if (!cancelled) setOrders([]) })
      .finally(() => { if (!cancelled) setOrdersLoading(false) })
    return () => { cancelled = true }
  }, [conn?.id])

  async function handleImportCustomers() {
    setCustomersBusy(true)
    try {
      const { merged, created } = await shopify.importCustomers(conn.id)
      show(t('integrations.toast.customers_imported', { created, merged, defaultValue: '{{created}} new, {{merged}} matched to existing customers' }), 'success')
    } catch (err) {
      show(errMsg(err, t('common.error')), 'error')
    } finally {
      setCustomersBusy(false)
    }
  }

  async function handleSyncOrders() {
    setOrdersSyncing(true)
    try {
      const { rows } = await shopify.syncOrders(conn.id)
      setOrders(rows)
      show(t('integrations.toast.orders_synced'), 'success')
    } catch (err) {
      show(errMsg(err, t('common.error')), 'error')
    } finally {
      setOrdersSyncing(false)
    }
  }

  // ═══════════════════════════════════════════════════════════
  if (locLoading) return <Loading page />

  return (
    <>
      {step === 'connect'   && <ConnectStep {...{ t, show, currentLocation, domain, setDomain, accessToken, setAccessToken, scopes, toggleScope, setStep }} onContinue={() => setStep('consent')} />}
      {step === 'consent'   && <ConsentStep {...{ t, domain, scopes, toggleScope, setStep, connecting }} onInstall={handleConnect} />}
      {step === 'importing' && <ImportingStep t={t} />}
      {step === 'mapping'   && (
        <MappingStep {...{ t, mapRows, mapFilter, setMapFilter, mapOpenIdx, setMapOpenIdx, setRowCategory, mapBusy }}
          onApply={applyMapping} onCancel={() => setStep(null)} />
      )}
      {step === null && connLoading && locations.length > 0 && <Loading page />}
      {step === null && !connLoading && (
        <div className="shp-wrap">
          <div className="card">
            <div className="card-hdr">
              <div className="card-title">{t('integrations.location_picker.title')} <em>{t('integrations.location_picker.title_em')}</em></div>
            </div>
            {locations.length === 0 ? (
              <div className="alert alert-warn shp-alert-link" role="button" tabIndex={0}
                onClick={() => navigate('/locations/new')}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate('/locations/new') }}>
                <span className="material-symbols-outlined">info</span>
                {t('integrations.location_picker.none')}
                <span className="shp-alert-link-cta">{t('integrations.location_picker.add_btn')}<span className="material-symbols-outlined">arrow_forward</span></span>
              </div>
            ) : (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-lbl">{t('integrations.location_picker.select_lbl')}</label>
                <select className="form-select" value={locationId} onChange={e => setLocationId(e.target.value)}>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {locations.length > 0 && (conn
            ? (
              <ConnectedView {...{
                t, conn, currentLocation, writeback, toggleWriteback, shopifyLocId, setShopifyLocId, saving,
                customersBusy, orders, ordersLoading, ordersSyncing,
              }}
                onReviewMapping={openMapping}
                onSyncNow={handleSyncNow}
                onSave={saveConnected}
                onDisconnect={handleDisconnect}
                onImportCustomers={handleImportCustomers}
                onSyncOrders={handleSyncOrders}
              />
            )
            : <NotConnectedHero t={t} onConnect={startConnect} />
          )}
        </div>
      )}

      <Toast toasts={toasts} />
    </>
  )
}

// ─────────────────────────────────────────────────────────────
function NotConnectedHero({ t, onConnect }) {
  return (
    <div className="card shp-hero">
      <div className="shp-logo">S</div>
      <div className="shp-hero-body">
        <div className="shp-hero-name">Shopify</div>
        <div className="shp-hero-desc">{t('integrations.hero.desc')}</div>
        <div className="shp-status off"><span className="shp-status-dot" />{t('integrations.status.not_connected')}</div>
      </div>
      <button className="btn btn-primary" onClick={onConnect}>
        {t('integrations.hero.connect_btn')}<span className="material-symbols-outlined">arrow_forward</span>
      </button>
    </div>
  )
}

function ConnectStep({ t, show, currentLocation, domain, setDomain, accessToken, setAccessToken, scopes, toggleScope, setStep, onContinue }) {
  function handleContinue() {
    const shop = normaliseShop(domain)
    if (!shop) {
      show(t('integrations.toast.domain_required'), 'error')
      return
    }
    if (!isShopHandle(shop)) {
      show(t('integrations.toast.domain_invalid'), 'error')
      return
    }
    // Write the cleaned handle back, so what is sent is what is shown.
    if (shop !== domain) setDomain(shop)
    if (!accessToken.trim()) {
      show(t('integrations.toast.token_required'), 'error')
      return
    }
    onContinue()
  }
  return (
    <div className="shp-wrap">
      <div className="shp-context">{t('integrations.context.connecting_for')} <strong>{currentLocation?.name}</strong></div>
      <div className="card">
        <div className="card-hdr">
          <div className="card-title">{t('integrations.connect.title')} <em>{t('integrations.connect.title_em')}</em></div>
        </div>
        <div className="form-group">
          <label className="form-lbl">{t('integrations.connect.domain_lbl')}</label>
          <div className="shp-domain-group">
            <input className="form-input shp-domain-input" value={domain} onChange={e => setDomain(e.target.value)} placeholder={slugify(currentLocation?.name) || 'sartoria-belloni'} />
            <span className="shp-domain-suffix">.myshopify.com</span>
          </div>
          <div className="shp-hint" style={{ marginTop: 6 }}>{t('integrations.connect.domain_hint')}</div>
        </div>

        <div className="form-group">
          <label className="form-lbl">{t('integrations.connect.token_lbl')}</label>
          <input className="form-input" type="password" autoComplete="off" value={accessToken} onChange={e => setAccessToken(e.target.value)} placeholder="shpat_..." />
          <div className="shp-hint" style={{ marginTop: 6 }}>{t('integrations.connect.token_hint')}</div>
        </div>

        <div className="form-lbl" style={{ marginTop: 20 }}>{t('integrations.writeback.header')}</div>
        <ScopeRow
          on={scopes.fulfil} onClick={() => toggleScope('fulfil')}
          label={t('integrations.scope.fulfil_lbl')}
          sub={t('integrations.scope.fulfil_sub')}
        />
        <ScopeRow
          on={scopes.inv} onClick={() => toggleScope('inv')}
          label={t('integrations.scope.inv_lbl')}
          sub={t('integrations.scope.inv_sub')}
        />

        <div className="shp-hint">{t('integrations.connect.hint')}</div>

        <div className="shp-actions">
          <button className="btn btn-outline" onClick={() => setStep(null)}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={handleContinue}>
            {t('integrations.connect.continue_btn')}<span className="material-symbols-outlined">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function ScopeRow({ on, onClick, label, sub }) {
  return (
    <div className="shp-scope-row" onClick={onClick}>
      <div className="shp-scope-info">
        <div className="shp-scope-lbl">{label}</div>
        <div className="shp-scope-sub">{sub}</div>
      </div>
      <Toggle on={on} />
    </div>
  )
}

// Repurposed from a simulated-Shopify-consent screen into a plain
// review-before-connecting step, since /connect takes the access token
// directly — there's no real OAuth redirect for it to precede. Still on
// the old "hosted page" card styling (shp-consent-bar / the 'S' logo bar);
// a follow-up design pass could restyle this as a plain Primo card now that
// it isn't impersonating Shopify's own screen.
function ConsentStep({ t, domain, scopes, toggleScope, setStep, connecting, onInstall }) {
  const readOnly = !scopes.fulfil && !scopes.inv
  return (
    <div className="shp-wrap">
      <div className="shp-consent">
        <div className="shp-consent-bar"><span className="shp-consent-sf">S</span>{domain || 'your-store'}.myshopify.com</div>
        <div className="shp-consent-body">
          <div className="shp-consent-hdr">
            {t('integrations.consent.title')}
          </div>
          <div className="shp-consent-h">{t('integrations.consent.h')}</div>
          <div className="shp-consent-p">{t('integrations.consent.p')}</div>

          <div className="shp-perm shp-perm-req">
            <span className="material-symbols-outlined">visibility</span>
            <div className="shp-perm-txt">{t('integrations.perm.read')}</div>
            <span className="shp-perm-tag">{t('integrations.perm.required')}</span>
          </div>
          <PermToggle on={scopes.fulfil} onClick={() => toggleScope('fulfil')}
            b={t('integrations.perm.fulfil_b')}
            desc={t('integrations.perm.fulfil_t')} />
          <PermToggle on={scopes.inv} onClick={() => toggleScope('inv')}
            b={t('integrations.perm.inv_b')}
            desc={t('integrations.perm.inv_t')} />

          <div className="shp-consent-note">
            {readOnly
              ? t('integrations.perm.readonly')
              : t('integrations.perm.tap')}
          </div>
          <div className="shp-consent-note">{t('integrations.consent.note')}</div>

          <div className="shp-actions">
            <button className="btn btn-outline" disabled={connecting} onClick={() => setStep('connect')}>{t('common.cancel')}</button>
            <button className="btn btn-primary" disabled={connecting} onClick={onInstall}>
              {connecting ? t('integrations.consent.connecting_btn') : t('integrations.consent.install_btn')}
              {!connecting && <span className="material-symbols-outlined">check</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PermToggle({ on, onClick, b, desc }) {
  return (
    <div className={`shp-perm shp-perm-tog${on ? '' : ' off'}`} onClick={onClick}>
      <span className="material-symbols-outlined">edit</span>
      <div className="shp-perm-txt"><span className="shp-perm-strong">{b}</span> {desc}</div>
      <Toggle on={on} />
    </div>
  )
}

function ImportingStep({ t }) {
  return (
    <div className="shp-wrap">
      <div className="card">
        <div className="shp-import-icon"><span className="material-symbols-outlined spin">cloud_sync</span></div>
        <div className="card-title" style={{ marginBottom: 6 }}>{t('integrations.import.title')} <em>{t('integrations.import.title_em')}</em></div>
        <div className="shp-hint" style={{ marginTop: 0 }}>{t('integrations.import.sub')}</div>
      </div>
    </div>
  )
}

function MappingStep({ t, mapRows, mapFilter, setMapFilter, mapOpenIdx, setMapOpenIdx, setRowCategory, mapBusy, onApply, onCancel }) {
  const totals = shopify.mappingTotals(mapRows)
  const reviewCount = mapRows.filter(r => !shopify.isMapped(r)).length
  const mappedCount = mapRows.length - reviewCount

  const tabs = [
    { k: 'all',    label: t('integrations.mapping.tab_all'), n: mapRows.length },
    { k: 'review', label: t('integrations.mapping.tab_review'), n: reviewCount },
    { k: 'mapped', label: t('integrations.mapping.tab_mapped'), n: mappedCount },
  ]
  const visible = mapRows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => mapFilter === 'review' ? !shopify.isMapped(r) : mapFilter === 'mapped' ? shopify.isMapped(r) : true)

  return (
    <div className="shp-wrap shp-wrap-wide">
      <div className="card-title" style={{ marginBottom: 4 }}>{t('integrations.mapping.title')} <em>{t('integrations.mapping.title_em')}</em></div>
      <div className="shp-hint" style={{ marginTop: 0, marginBottom: 18 }}>
        {t('integrations.mapping.sub')}
      </div>

      <div className="card shp-map-summary">
        <div className="shp-map-stat"><span className="n">{fmt(totals.products)}</span><span className="l">{t('integrations.mapping.stat_products')}</span></div>
        <div className="shp-map-sep" />
        <div className="shp-map-stat"><span className="n">{fmt(totals.types)}</span><span className="l">{t('integrations.mapping.stat_types')}</span></div>
        <div className="shp-map-sep" />
        <div className="shp-map-stat ok"><span className="n">{fmt(totals.mapped)}</span><span className="l">{t('integrations.mapping.stat_mapped')}</span></div>
        <div className="shp-map-sep" />
        <div className="shp-map-stat warn"><span className="n">{fmt(totals.review)}</span><span className="l">{t('integrations.mapping.stat_review')}</span></div>
      </div>

      <div className="shp-map-tabs">
        {tabs.map(tb => (
          <button key={tb.k} className={`shp-map-tab${mapFilter === tb.k ? ' active' : ''}`} onClick={() => setMapFilter(tb.k)}>
            <span className="b">{tb.n}</span> {tb.label}
          </button>
        ))}
      </div>

      <div className="shp-map-head">
        <div>{t('integrations.mapping.col_type')}</div><div />
        <div>{t('integrations.mapping.col_cat')}</div>
        <div>{t('integrations.mapping.col_status')}</div><div />
      </div>
      <div className="card shp-map-list">
        {visible.length === 0 && (
          <div className="shp-map-empty">{t('integrations.mapping.empty')}</div>
        )}
        {visible.map(({ r, i }) => (
          <MapRow key={r.id ?? i} r={r} i={i} open={mapOpenIdx === i} busy={mapBusy}
            onToggle={() => setMapOpenIdx(mapOpenIdx === i ? null : i)}
            onSetCategory={sel => setRowCategory(i, sel)}
            t={t} />
        ))}
      </div>

      <div className="shp-map-foot">
        <div className="shp-map-note">
          {totals.review > 0
            ? <><span className="material-symbols-outlined">error</span>{t('integrations.mapping.note_review', { count: totals.review, defaultValue: '{{count}} products stay in Needs category until their type is mapped.' })}</>
            : <><span className="material-symbols-outlined" style={{ color: 'var(--green)' }}>check_circle</span>{t('integrations.mapping.note_ok')}</>}
        </div>
        <div className="shp-actions" style={{ margin: 0 }}>
          <button className="btn btn-outline" onClick={onCancel}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={onApply}>{t('integrations.mapping.apply_btn')}<span className="material-symbols-outlined">check</span></button>
        </div>
      </div>
    </div>
  )
}

function MapRow({ r, open, busy, onToggle, onSetCategory, t }) {
  const mapped = shopify.isMapped(r)
  const status = r.status ?? (!mapped ? 'review' : 'auto')
  const chip = status === 'auto'
    ? <span className="shp-chip auto"><span className="dot" />{t('integrations.mapping.chip_auto')}</span>
    : status === 'over'
      ? <span className="shp-chip over"><span className="dot" />{t('integrations.mapping.chip_over')}</span>
      : <span className="shp-chip review"><span className="dot" />{t('integrations.mapping.chip_review')}</span>

  // categoryName/typeName are the Division/Category display names; styleSlug
  // is a raw slug (e.g. "mini"), not a display name — the mapping API has
  // no Style display-name field yet, so overridden rows show the slug as-is.
  const path = mapped
    ? <div className="shp-map-path">{r.categoryName}<span className="sep">›</span>{r.typeName}{r.styleSlug && <><span className="sep">›</span><span className="item">{r.styleSlug}</span></>}</div>
    : <div className="shp-map-path unset">{t('integrations.mapping.not_set')}</div>

  const actionLabel = open ? t('common.close') : mapped ? t('common.change') : t('integrations.mapping.resolve_btn')
  const typeLabel = r.shopifyProductType || t('integrations.mapping.no_type')

  return (
    <div className="shp-map-row">
      <div className="shp-map-row-grid">
        <div>
          <div className={`shp-type${!r.shopifyProductType ? ' blank' : ''}`}>{typeLabel}</div>
          <div className="shp-map-meta">
            <span>{t('integrations.mapping.n_products', { count: r.productCount, defaultValue: '{{count}} products' })}</span>
          </div>
          {r.reasonLine && !mapped && <div className="shp-map-reason"><span className="material-symbols-outlined">info</span>{r.reasonLine}</div>}
        </div>
        <div className="shp-arrow-col"><span className="material-symbols-outlined">arrow_forward</span></div>
        <div>{path}</div>
        <div>{chip}</div>
        <div className="shp-map-act"><button className="shp-link-btn" disabled={busy} onClick={onToggle}>{actionLabel}</button></div>
      </div>
      {open && (
        <div className="shp-map-editor">
          <CategorySelectorDropdown onChange={onSetCategory} />
          <div className="shp-map-editor-foot">
            <button className="btn btn-sm btn-outline" onClick={onToggle}>{t('common.done')}</button>
          </div>
        </div>
      )}
    </div>
  )
}

function ConnectedView({
  t, conn, currentLocation, writeback, toggleWriteback, shopifyLocId, setShopifyLocId, saving,
  customersBusy, orders, ordersLoading, ordersSyncing,
  onReviewMapping, onSyncNow, onSave, onDisconnect, onImportCustomers, onSyncOrders,
}) {
  const totals = shopify.mappingTotals(conn.mapping ?? [])
  const shopifyLocations = conn.shopifyLocations ?? []

  return (
    <>
      <div className="card-title" style={{ marginBottom: 4 }}>{t('integrations.connected.title')} <em>{t('integrations.connected.title_em')}</em></div>
      <div className="shp-hint" style={{ marginTop: 0, marginBottom: 18 }}>{t('integrations.connected.sub')}</div>

      <div className="shp-set-block">
        <div className="shp-set-block-h">{t('integrations.connected.block_connection')}</div>
        <div className="card shp-health">
          <div className="shp-health-dot" />
          <div className="shp-health-body">
            {conn.domain}.myshopify.com
            <div className="shp-health-sub">{t('integrations.connected.health_sub', { count: conn.productCount ?? 0, when: conn.lastSyncAt ? new Date(conn.lastSyncAt).toLocaleString(activeLocale()) : t('integrations.connected.never_synced') })}</div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={onSyncNow}><span className="material-symbols-outlined">sync</span>{t('integrations.connected.sync_btn')}</button>
        </div>
      </div>

      <div className="shp-set-block">
        <div className="shp-set-block-h">{t('integrations.connected.block_mapping')}</div>
        <div className="card shp-recap">
          <div className="shp-health-dot" style={{ background: totals.review > 0 ? 'var(--gold)' : 'var(--green)' }} />
          <div className="shp-health-body">
            {t('integrations.connected.recap_title')}
            <div className="shp-health-sub">
              {totals.review > 0
                ? t('integrations.connected.recap_some', { types: totals.types, n: totals.review })
                : t('integrations.connected.recap_all', { types: totals.types })}
            </div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={onReviewMapping}><span className="material-symbols-outlined">tune</span>{t('integrations.connected.review_btn')}</button>
        </div>
      </div>

      <div className="shp-set-block">
        <div className="shp-set-block-h">{t('integrations.connected.block_customers')}</div>
        <div className="card shp-recap">
          <div className="shp-health-dot" style={{ background: 'var(--green)' }} />
          <div className="shp-health-body">
            {t('integrations.customers.title')}
            <div className="shp-health-sub">{t('integrations.customers.sub')}</div>
          </div>
          <button className="btn btn-outline btn-sm" disabled={customersBusy} onClick={onImportCustomers}>
            <span className="material-symbols-outlined">group</span>
            {customersBusy ? t('common.syncing') + '…' : t('integrations.customers.import_btn')}
          </button>
        </div>
      </div>

      <div className="shp-set-block">
        <div className="shp-set-block-h">{t('integrations.connected.block_orders')}</div>
        <div className="card shp-health" style={{ marginBottom: 12 }}>
          <div className="shp-health-dot" />
          <div className="shp-health-body">
            {t('integrations.orders.title')}
            <div className="shp-health-sub">{t('integrations.orders.sub', { count: orders?.length ?? 0 })}</div>
          </div>
          <button className="btn btn-outline btn-sm" disabled={ordersSyncing} onClick={onSyncOrders}>
            <span className="material-symbols-outlined">sync</span>
            {ordersSyncing ? t('common.syncing') + '…' : t('integrations.orders.sync_btn')}
          </button>
        </div>
        {ordersLoading ? (
          <Loading className="ld-cell" />
        ) : !orders || orders.length === 0 ? (
          <div className="card shp-order-empty">{t('integrations.orders.empty')}</div>
        ) : (
          <>
            <div className="shp-order-head">
              <div>{t('integrations.orders.col_order')}</div>
              <div>{t('integrations.orders.col_customer')}</div>
              <div>{t('integrations.orders.col_items')}</div>
              <div>{t('integrations.orders.col_status')}</div>
            </div>
            <div className="card shp-order-list">
              {orders.map(o => (
                <div key={o.id} className="shp-order-row">
                  <div className="shp-order-id">{(o.shopify_order_id ?? o.id).split('/').pop()}</div>
                  <div className="shp-order-email">{o.customer_email}</div>
                  <div className="shp-order-items">{(o.line_items ?? []).map(li => `${li.qty}× ${li.sku}`).join(', ')}</div>
                  <div>
                    {o.fulfilled_at
                      ? <span className="shp-chip fulfilled"><span className="dot" />{t('integrations.orders.status_fulfilled')}</span>
                      : <span className="shp-chip unfulfilled"><span className="dot" />{t('integrations.orders.status_unfulfilled')}</span>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="shp-set-block">
        <div className="shp-set-block-h">{t('integrations.connected.block_location')}</div>
        <div className="card">
          <div className="form-group">
            <label className="form-lbl">{t('integrations.connected.loc_field1')}</label>
            <select className="form-select" value={currentLocation?.name ?? ''} disabled><option>{currentLocation?.name}</option></select>
          </div>
          <div className="form-group" style={{ marginBottom: 8 }}>
            <label className="form-lbl">{t('integrations.connected.loc_field2')}</label>
            <select className="form-select" value={shopifyLocId} onChange={e => setShopifyLocId(e.target.value)} disabled={shopifyLocations.length === 0}>
              {shopifyLocations.length === 0 && <option value="">{t('integrations.connected.loc_none')}</option>}
              {shopifyLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="shp-hint">{t('integrations.connected.loc_hint')}</div>
        </div>
      </div>

      <div className="shp-set-block">
        <div className="shp-set-block-h">{t('integrations.writeback.header')}</div>
        <WritebackRow
          on={writeback.fulfil} granted={conn.scopes.fulfil} onClick={() => toggleWriteback('fulfil')}
          label={t('integrations.wb.fulfil_lbl')}
          sub={t('integrations.wb.fulfil_sub')}
          lockText={t('integrations.scope.lock', { scope: 'write_fulfillments' })}
        />
        <WritebackRow
          on={writeback.inv} granted={conn.scopes.inv} onClick={() => toggleWriteback('inv')}
          label={t('integrations.wb.inv_lbl')}
          sub={t('integrations.wb.inv_sub')}
          rec={t('integrations.wb.inv_rec')}
          lockText={t('integrations.scope.lock', { scope: 'write_inventory' })}
        />
      </div>

      <div className="shp-actions" style={{ justifyContent: 'space-between' }}>
        <button className="btn btn-red" disabled={saving} onClick={onDisconnect}><span className="material-symbols-outlined">link_off</span>{t('integrations.connected.disconnect_btn')}</button>
        <button className="btn btn-primary" disabled={saving} onClick={onSave}>{saving ? t('common.saving') : t('integrations.connected.save_btn')}</button>
      </div>
    </>
  )
}

function WritebackRow({ on, granted, onClick, label, sub, rec, lockText }) {
  return (
    <div className={`card shp-toggle-row${granted ? '' : ' locked'}`} onClick={granted ? onClick : undefined}>
      <div className="shp-toggle-info">
        <div className="shp-toggle-lbl">{label}</div>
        <div className="shp-toggle-sub">{sub}</div>
        {granted && rec && <div className="shp-warn"><span className="material-symbols-outlined">info</span>{rec}</div>}
        {!granted && <div className="shp-warn lock"><span className="material-symbols-outlined">lock</span>{lockText}</div>}
      </div>
      <Toggle on={granted && on} />
    </div>
  )
}
