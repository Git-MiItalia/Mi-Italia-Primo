import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'

const API      = import.meta.env.VITE_API_URL
const IMG_BASE = import.meta.env.VITE_IMG_BASE_URL

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

  useEffect(() => {
    apiFetch(`${API}/boutique/showroom/settings`)
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setSettings(res.data.settings)
          setSlug(res.data.slug)
          setStats(res.data.stats)
        }
      })
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: 1, limit: 20 })
    apiFetch(`${API}/boutique/showroom/products?${params}`)
      .then(r => r.json())
      .then(res => { setProducts(res.data.products ?? []); setLoading(false) })
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
    apiFetch(`${API}/boutique/showroom/settings`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    }).then(r => r.json()).then(res => {
      setSettingsSaving(false)
      if (res.success) {
        setSettings(res.data)
        setSettingsSaved(true)
        setTimeout(() => setSettingsSaved(false), 2000)
      }
    })
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

  function toggleShowroom(p) {
    const newEnabled = !p.showroom_enabled
    apiFetch(`${API}/boutique/showroom/products/${p.id}`, {
      method: 'PUT',
      body: JSON.stringify({ showroom_enabled: newEnabled, wholesale_price: p.wholesale_price, wholesale_min_qty: p.wholesale_min_qty }),
    }).then(r => r.json()).then(res => {
      if (res.success) {
        setProducts(prev => prev.map(q => q.id === p.id ? { ...q, showroom_enabled: res.data.showroom_enabled } : q))
        setStats(prev => ({ ...prev, products_on_showroom: prev.products_on_showroom + (newEnabled ? 1 : -1) }))
      }
    })
  }

  function fmtWholesale(p) {
    if (p.wholesale_price) return `€${parseFloat(p.wholesale_price).toFixed(2)}`
    if (p.retail_price && settings.wholesale_default_discount_pct) {
      const calc = parseFloat(p.retail_price) * (1 - settings.wholesale_default_discount_pct / 100)
      return `€${calc.toFixed(2)} (auto)`
    }
    return '—'
  }

  return (
    <>
      {/* Stats */}
      <div className="stat-row col3">
        <div className="stat-card">
          <div className="stat-lbl">{t('showroom.stats.products', 'Products on Showroom')}</div>
          <div className="stat-val">{stats.products_on_showroom}</div>
          <div className="stat-change nu">{t('showroom.stats.of', 'of')} {stats.total_products} {t('showroom.stats.total', 'total')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">{t('showroom.stats.orders', 'Wholesale Orders (MTD)')}</div>
          <div className="stat-val">8</div>
          <div className="stat-change up">↑ 3 {t('showroom.stats.this_month', 'this month')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">{t('showroom.stats.revenue', 'Wholesale Revenue')}</div>
          <div className="stat-val">€14,560</div>
          <div className="stat-change up">↑ 22%</div>
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

          {loading && <div className="state-loading">{t('showroom.products.loading', 'Loading products…')}</div>}

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
                    <td colSpan={4} className="state-empty">{t('showroom.products.empty', 'No products found.')}</td>
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
