import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'
import { activeLocale } from '../lib/dateHelpers'
import Loading from '../components/ui/Loading'

const API      = import.meta.env.VITE_API_URL
const IMG_BASE = import.meta.env.VITE_IMG_BASE_URL

// One page is requested and no second one is offered, so only this many
// products can ever be put on the showroom. The list says so rather than
// pretending it is the whole catalogue — see the note below the table.
const PRODUCTS_LIMIT = 20

export default function Showroom() {
  const { t, i18n } = useTranslation()

  const [settings, setSettings]             = useState({
    wholesale_default_discount_pct: 30,
    wholesale_min_order_value: 500,
    wholesale_auto_push_enabled: false,
  })
  const [slug, setSlug]                     = useState('')
  const [stats, setStats]                   = useState({ products_on_showroom: 0, total_products: 0 })
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsSaved, setSettingsSaved]   = useState(false)
  const [products, setProducts]             = useState([])
  const [loading, setLoading]               = useState(true)

  // ── commented out — search and showroom-only filter pending review ──
  // const [search, setSearch]             = useState('')
  // const [showroomOnly, setShowroomOnly] = useState(false)
  // ── end commented out ──

  // ── commented out — edit wholesale/MOQ inline ──
  // const [editingId, setEditingId]       = useState(null)
  // const [editWholesale, setEditWholesale] = useState('')
  // const [editMoq, setEditMoq]           = useState('')
  // ── end commented out ──

  // Nothing on this page caught a failure. The products load was the worst of
  // it: it read res.data.products with no success check, so an error response
  // (where `data` is absent) threw inside the .then — and with no catch and
  // setLoading(false) sitting in that same callback, the table stayed on
  // "Loading products…" for good. Flags are stored raw and worded at render so
  // `t` stays out of these effects.
  const [settingsFailed, setSettingsFailed] = useState(false)
  const [productsFailed, setProductsFailed] = useState(false)
  const [saveError, setSaveError]           = useState(false)

  useEffect(() => {
    apiFetch(`${API}/boutique/showroom/settings`)
      .then(r => r.json())
      .then(res => {
        if (res?.success && res.data) {
          if (res.data.settings) setSettings(res.data.settings)
          setSlug(res.data.slug ?? '')
          setStats(res.data.stats ?? { products_on_showroom: 0, total_products: 0 })
          setSettingsFailed(false)
        } else setSettingsFailed(true)
      })
      .catch(() => setSettingsFailed(true))
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: 1, limit: String(PRODUCTS_LIMIT) })
    apiFetch(`${API}/boutique/showroom/products?${params}`)
      .then(r => r.json())
      .then(res => {
        if (res?.success && res.data) { setProducts(res.data.products ?? []); setProductsFailed(false) }
        else setProductsFailed(true)
      })
      .catch(() => setProductsFailed(true))
      .finally(() => setLoading(false))
  }, [i18n.language])

  // ── commented out — re-fetch when search/filter changes ──
  // useEffect(() => {
  //   setLoading(true)
  //   const params = new URLSearchParams({ page:1, limit:20 })
  //   if (showroomOnly) params.set('showroom_only', 'true')
  //   if (search.trim()) params.set('product_name', search.trim())
  //   apiFetch(`${API}/boutique/showroom/products?${params}`)
  //     .then(r => r.json())
  //     .then(res => { setProducts(res.data.products ?? []); setLoading(false) })
  // }, [search, showroomOnly])
  // ── end commented out ──

  function saveSettings() {
    setSettingsSaving(true)
    setSaveError(false)
    apiFetch(`${API}/boutique/showroom/settings`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    })
      .then(r => r.json())
      .then(res => {
        if (res?.success) {
          if (res.data) setSettings(res.data)
          setSettingsSaved(true)
          setTimeout(() => setSettingsSaved(false), 2000)
        } else {
          // A refused save used to leave the button reading "Save" again with
          // no message, so the merchant believed their discount had stuck.
          setSaveError(true)
        }
      })
      .catch(() => setSaveError(true))
      // setSettingsSaving(false) lived inside .then, so a dropped connection
      // left the button disabled on "Saving…" until a page reload.
      .finally(() => setSettingsSaving(false))
  }

  // ── commented out — inline product edit ──
  // function openEdit(p) { setEditingId(p.id); setEditWholesale(p.wholesale_price ?? ''); setEditMoq(p.wholesale_min_qty ?? '') }
  // function saveProduct(id) {
  //   apiFetch(`${API}/boutique/showroom/products/${id}`, {
  //     method: 'PUT',
  //     body: JSON.stringify({ showroom_enabled:true, wholesale_price:parseFloat(editWholesale)||null, wholesale_min_qty:parseInt(editMoq)||null }),
  //   }).then(r => r.json()).then(res => {
  //     if (res.success) {
  //       setProducts(prev => prev.map(p => p.id === id ? { ...p, ...res.data } : p))
  //       setStats(prev => ({ ...prev, products_on_showroom: prev.products_on_showroom + (res.data.showroom_enabled ? 1 : 0) }))
  //       setEditingId(null)
  //     }
  //   })
  // }
  // ── end commented out ──

  // Listing a product for wholesale buyers is a publishing action, so a
  // failure that leaves the toggle sitting still and says nothing is the worst
  // outcome — the merchant reads the unmoved switch as "already off".
  const [toggleError, setToggleError] = useState(false)
  function toggleShowroom(p) {
    const newEnabled = !p.showroom_enabled
    setToggleError(false)
    apiFetch(`${API}/boutique/showroom/products/${p.id}`, {
      method: 'PUT',
      body: JSON.stringify({ showroom_enabled: newEnabled, wholesale_price: p.wholesale_price, wholesale_min_qty: p.wholesale_min_qty }),
    })
      .then(r => r.json())
      .then(res => {
        if (res?.success) {
          setProducts(prev => prev.map(q => q.id === p.id ? { ...q, showroom_enabled: res.data?.showroom_enabled ?? newEnabled } : q))
          setStats(prev => ({ ...prev, products_on_showroom: prev.products_on_showroom + (newEnabled ? 1 : -1) }))
        } else setToggleError(true)
      })
      .catch(() => setToggleError(true))
  }

  // toFixed(2) always writes "1234.50" — it has no idea about locale — so
  // every wholesale price stayed in English form on an Italian page. "(auto)"
  // was a bare English literal too.
  const money = (n) =>
    `€${Number(n).toLocaleString(activeLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true })}`

  function fmtWholesale(p) {
    if (p.wholesale_price) return money(p.wholesale_price)
    if (p.retail_price && settings.wholesale_default_discount_pct) {
      const calc = parseFloat(p.retail_price) * (1 - settings.wholesale_default_discount_pct / 100)
      return `${money(calc)} ${t('showroom.table.auto', '(auto)')}`
    }
    return '—'
  }

  /* Page-level wait, like Subscription: this tab is driven by one fetch, so
     until it lands there is nothing truthful to draw. Safe as an early return
     because every hook in this component is declared above it. */
  if (loading) return <Loading page />

  return (
    <>
      {settingsFailed && (
        <div className="shw-error">{t('showroom.err_settings', 'Could not load your Showroom settings — the values below are defaults, not your saved ones. Reload before changing them.')}</div>
      )}
      {toggleError && (
        <div className="shw-error">{t('showroom.err_toggle', 'Could not change that product. It has not been listed or unlisted — please try again.')}</div>
      )}

      {/* Stats */}
      <div className="stat-row col3">
        <div className="stat-card">
          <div className="stat-lbl">{t('showroom.stats.products', 'Products on Showroom')}</div>
          <div className="stat-val">{stats.products_on_showroom}</div>
          <div className="stat-change nu">{t('showroom.stats.of', 'of')} {stats.total_products} {t('showroom.stats.total', 'total')}</div>
        </div>
        {/* Wholesale order/revenue totals aren't returned by the API yet — show a
            placeholder rather than a hardcoded figure, and light up automatically
            once the backend starts sending them in `stats`. */}
        <div className="stat-card">
          <div className="stat-lbl">{t('showroom.stats.orders', 'Wholesale Orders (MTD)')}</div>
          <div className="stat-val">{stats.wholesale_orders_mtd ?? '—'}</div>
          {stats.wholesale_orders_change != null ? (
            <div className={`stat-change ${stats.wholesale_orders_change >= 0 ? 'up' : 'dn'}`}>
              {stats.wholesale_orders_change >= 0 ? '↑' : '↓'} {Math.abs(stats.wholesale_orders_change)} {t('showroom.stats.this_month', 'this month')}
            </div>
          ) : (
            <div className="stat-change nu">{t('showroom.stats.not_tracked', 'Not available yet')}</div>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-lbl">{t('showroom.stats.revenue', 'Wholesale Revenue')}</div>
          <div className="stat-val">
            {stats.wholesale_revenue_mtd != null ? money(stats.wholesale_revenue_mtd) : '—'}
          </div>
          {stats.wholesale_revenue_change_pct != null ? (
            <div className={`stat-change ${stats.wholesale_revenue_change_pct >= 0 ? 'up' : 'dn'}`}>
              {stats.wholesale_revenue_change_pct >= 0 ? '↑' : '↓'} {Math.abs(stats.wholesale_revenue_change_pct)}%
            </div>
          ) : (
            <div className="stat-change nu">{t('showroom.stats.not_tracked', 'Not available yet')}</div>
          )}
        </div>
      </div>

      <div className="grid2">

        {/* Settings card */}
        <div className="card">
          <div className="card-hdr">
            <div className="card-title">{t('showroom.settings.title', 'Showroom')} <em>{t('showroom.settings.title_em', 'Settings')}</em></div>
            <button className="btn btn-sm btn-primary" onClick={saveSettings} disabled={settingsSaving}>
              {settingsSaved ? `✓ ${t('common.saved', 'Saved')}` : settingsSaving ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
            </button>
          </div>

          {saveError && (
            <div className="shw-error">{t('showroom.err_save', 'Could not save these settings — your changes have not been applied.')}</div>
          )}

          <div className="form-row2">
            <div className="form-group">
              <label className="form-lbl">{t('showroom.settings.discount_label', 'Default Wholesale Discount (%)')}</label>
              <input
                className="form-input"
                type="number"
                value={settings.wholesale_default_discount_pct}
                onChange={e => setSettings(s => ({ ...s, wholesale_default_discount_pct: parseFloat(e.target.value) || 0 }))}
                onWheel={e => e.target.blur()}
              />
              <div className="form-hint">{t('showroom.settings.discount_hint', 'Applied when no per-product wholesale price is set.')}</div>
            </div>
            <div className="form-group">
              <label className="form-lbl">{t('showroom.settings.min_order_label', 'Minimum Order Value (€)')}</label>
              <input
                className="form-input"
                type="number"
                value={settings.wholesale_min_order_value}
                onChange={e => setSettings(s => ({ ...s, wholesale_min_order_value: parseFloat(e.target.value) || 0 }))}
                onWheel={e => e.target.blur()}
              />
              <div className="form-hint">{t('showroom.settings.min_order_hint', 'Min wholesale order value for B2B buyers.')}</div>
            </div>
          </div>

          <div className="toggle-row shw-toggle-row">
            <div>
              <div className="shw-toggle-title">{t('showroom.settings.auto_push_title', 'Auto-push new products to Showroom')}</div>
              <div className="shw-toggle-sub">{t('showroom.settings.auto_push_sub', 'New products automatically listed for wholesale buyers')}</div>
            </div>
            <div
              className={`toggle${settings.wholesale_auto_push_enabled ? ' on' : ''}`}
              onClick={() => setSettings(s => ({ ...s, wholesale_auto_push_enabled: !s.wholesale_auto_push_enabled }))}
            >
              <div className="toggle-knob" />
            </div>
          </div>

          <div className="alert alert-info">
            <span className="material-symbols-outlined">business_center</span>
            {t('showroom.settings.live_at', 'Your Showroom is live at')} <strong>showroom.miitalia.com/{slug || '…'}</strong>
          </div>
        </div>

        {/* Products card */}
        <div className="card">
          <div className="card-hdr">
            <div className="card-title">{t('showroom.products.title', 'Showroom')} <em>{t('showroom.products.title_em', 'Products')}</em></div>
          </div>

          {/* ── commented out — search + showroom-only filter ──
          <div className="shw-search">
            <span className="material-symbols-outlined shw-search-icon">search</span>
            <input className="input-bare" placeholder={t('showroom.products.search')} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <label className="shw-filter-label">
            <input type="checkbox" checked={showroomOnly} onChange={e => setShowroomOnly(e.target.checked)} className="shw-filter-checkbox" />
            {t('showroom.products.showroom_only')}
          </label>
          ── end commented out ── */}


          {!loading && (
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('showroom.table.product', 'Product')}</th>
                  <th>{t('showroom.table.wholesale', 'Wholesale')}</th>
                  <th>{t('showroom.table.moq', 'MOQ')}</th>
                  <th>{t('showroom.table.showroom', 'Showroom')}</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div className="shw-product-cell">
                        {p.main_photo && (
                          <div className="shw-product-img" style={{ backgroundImage: `url('${p.main_photo?.startsWith('http') ? p.main_photo : IMG_BASE + p.main_photo}')` }}/>
                        )}
                        <div>
                          <div className="shw-product-name">{p.name}</div>
                          <div className="shw-product-sku">{p.sku}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ color: 'var(--green)', fontWeight: 600 }}>{fmtWholesale(p)}</td>
                    <td>{p.wholesale_min_qty ?? '—'}</td>
                    <td>
                      <div
                        className={`toggle${p.showroom_enabled ? ' on' : ''}`}
                        onClick={() => toggleShowroom(p)}
                      >
                        <div className="toggle-knob" />
                      </div>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={4} className="state-empty">
                      {productsFailed
                        ? t('showroom.err_products', 'Could not load your products.')
                        : t('showroom.products.empty', 'No products found.')}
                    </td>
                  </tr>
                )}
                {products.length >= PRODUCTS_LIMIT && (
                  <tr>
                    <td colSpan={4} className="state-empty">
                      {t('showroom.products.capped', { count: PRODUCTS_LIMIT, defaultValue: 'Showing the first {{count}} products — there is no way to reach the rest from this page yet.' })}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {/* ── commented out — retail price column + edit button ──
          // <th>{t('showroom.table.retail')}</th>
          // <td className="shw-retail">€{parseFloat(p.retail_price).toFixed(2)}</td>
          // <th></th>
          // <td className="shw-actions">
          //   <button className="btn btn-sm btn-outline" onClick={() => openEdit(p)}>
          //     <span className="material-symbols-outlined">edit</span>
          //   </button>
          // </td>
          ── end commented out ── */}
        </div>
      </div>
    </>
  )
}
