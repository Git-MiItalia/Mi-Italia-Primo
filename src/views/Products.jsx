import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'
import { statusLabel } from '../lib/statusLabel'
import { getAgeInfo, bracketName, bracketRangeShort, DEAD_STOCK_FROM_DAYS } from '../lib/ageBracket'
import Toast, { useToast } from '../components/ui/Toast'
import useLangStore from '../store/langStore'
import PrintTagModal from '../components/product/PrintTagModal'


const API      = import.meta.env.VITE_API_URL
const IMG_BASE = import.meta.env.VITE_IMG_BASE_URL
const MAX_PRODUCTS = Number(import.meta.env.VITE_MAX_PRODUCTS ?? 10)
const WEBSHOP_BASE = import.meta.env.VITE_WEBSHOP_URL 

function imgSrc(url) {
  if (!url) return null
  return url.startsWith('http') ? url : `${IMG_BASE}${url}`
}

// Thresholds, palette and labels now live in lib/ageBracket.js. They used to
// be local and were WIDER than the backend's (fresh 0-30 here vs 0-14 server
// side), so a 75-day product read "Aging" on this tab and "Slow" on Markdowns.
// The bracket word is still assembled at render time — this file's helpers run
// outside the component and have no `t`; `warn` says whether it carries the ⚠.

const AGE_FILTERS = [
  { key:'all',    border:'var(--deep)',        bg:'var(--deep)',         color:'var(--gold)', activeColor:'var(--gold)' },
  { key:'fresh',  border:'rgba(0,89,58,.3)',   bg:'rgba(0,89,58,.06)',   color:'#006C35',     activeColor:'white' },
  { key:'normal', border:'rgba(26,79,191,.25)',bg:'rgba(26,79,191,.05)', color:'#1A4FBF',     activeColor:'white' },
  { key:'aging',  border:'rgba(180,83,9,.3)',  bg:'rgba(180,83,9,.05)',  color:'#B45309',     activeColor:'white' },
  { key:'slow',   border:'rgba(197,0,26,.25)', bg:'rgba(197,0,26,.04)', color:'#C5001A',     activeColor:'white' },
  { key:'dead',   border:'rgba(197,0,26,.4)',  bg:'rgba(197,0,26,.07)', color:'#C5001A',     activeColor:'white' },
]

export default function Products() {
  const navigate      = useNavigate()
  const { t }         = useTranslation()
  const lang          = useLangStore(s => s.lang)

  const [activeTab, setActiveTab]   = useState(0)
  const [selected, setSelected]     = useState(new Set())
  const [products, setProducts]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [total, setTotal]           = useState(0)
  const [editingId, setEditingId]   = useState(null)
  const [editData, setEditData]     = useState({})
  const [filterAge, setFilterAge]   = useState('all')
  const [menuOpen, setMenuOpen]             = useState(null)
  const [dupModal, setDupModal]             = useState(null)
  const [dupSku, setDupSku]                 = useState('')
  const [dupLoading, setDupLoading]         = useState(false)
  const [dupError, setDupError]             = useState('')
  const [showPrintTag, setShowPrintTag]     = useState(false)
  const [printTagProduct, setPrintTagProduct] = useState(null)
  const [searchQuery, setSearchQuery]       = useState('')
  const { toasts, show: showToast }         = useToast()

  // The published-product cap. The plans sell 50 / 300 / unlimited, so the real
  // number belongs to the boutique's subscription — VITE_MAX_PRODUCTS is only a
  // fallback for when the API doesn't send one yet. `null` means unlimited.
  const [maxProducts, setMaxProducts] = useState(MAX_PRODUCTS)

  // The endpoint pages at 20. Every filter on this page — the status tabs, the
  // age chips, the search box — and the published-product count that gates
  // "Add Product" all work off the loaded array, so a single page would show at
  // most 20 products and quietly under-count the cap. Load every page instead;
  // the plans top out at 300 products, so that is at most ~15 small requests.
  useEffect(() => {
    let cancelled = false
    // `loading` starts true and is only ever cleared below — setting it back to
    // true here would be a setState directly in the effect body for no gain.
    apiFetch(`${API}/boutique/products`)
      .then(r => r.json())
      .then(async res => {
        if (res.success === false || !res.data) throw new Error(res.message || 'products request failed')

        const first    = res.data.products ?? []
        const totalNum = Number(res.data.total ?? first.length)
        const perPage  = Number(res.data.limit) || first.length || 20
        const pages    = perPage > 0 ? Math.ceil(totalNum / perPage) : 1

        // Accept either name — whichever the backend settles on. Deliberately
        // NOT res.data.limit, which is the page size, not the plan's cap.
        const cap = res.data.product_limit ?? res.data.max_products
        if (cap !== undefined && !cancelled) setMaxProducts(cap)

        let all = first
        if (pages > 1) {
          const rest = await Promise.all(
            Array.from({ length: pages - 1 }, (_, i) =>
              apiFetch(`${API}/boutique/products?page=${i + 2}&limit=${perPage}`)
                .then(r => r.json())
                .then(p => p.data?.products ?? [])
                .catch(() => [])
            )
          )
          all = first.concat(...rest)
        }

        if (cancelled) return
        setProducts(all)
        setTotal(totalNum)
        // If paging came back short, the tab count would claim more than the
        // list holds. Say what we actually have.
        if (all.length < totalNum) {
          showToast(t('products.load_partial',
            'Showing {{shown}} of {{total}} products — some could not be loaded.',
            { shown: all.length, total: totalNum }), 'error')
        }
      })
      .catch(() => {
        if (cancelled) return
        setProducts([]); setTotal(0)
        showToast(t('common.error_network'), 'error')
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
    // Depending on showToast/t would refetch the whole catalogue whenever a
    // toast fires or `t` is re-created, so the dep list stays on `lang` alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

  const TABS = [
    `${t('products.tabs.all', 'All')} (${total})`,
    t('products.tabs.active', 'Active'),
    t('products.tabs.hidden', 'Hidden'),
    t('products.tabs.showroom', 'Showroom'),
  ]

  // The row badge needs just the bracket word — the chip below adds the range.
  // Both come from lib/ageBracket so Products and Markdowns always agree.
  //
  // The old products.age.* / products.age_short.* keys are deliberately no
  // longer read: their bundle values bake in the OLD ranges ("Aging 61–90d")
  // and t(key, default) only falls back when the key is absent, so the wrong
  // text would win. common.age_bracket.* replaces them.
  const AGE_BADGE_LABELS = Object.fromEntries(
    AGE_FILTERS.filter(f => f.key !== 'all').map(f => [f.key, bracketName(t, f.key)])
  )

  // Filter chips spell out the range: "Aging 31–60d".
  const AGE_LABELS = {
    all: t('products.age.all', 'All'),
    ...Object.fromEntries(
      AGE_FILTERS.filter(f => f.key !== 'all')
        .map(f => [f.key, `${bracketName(t, f.key)} ${bracketRangeShort(t, f.key)}`])
    ),
  }

  const visibleProducts = products.filter(p => {
    if (activeTab === 1) return p.status === 'active'
    if (activeTab === 2) return p.status === 'hidden'
    if (activeTab === 3) return p.showroom_enabled
    return true
  })

  const publishedCount = products.filter(p => p.status === 'active' || p.status === 'hidden').length
  const atLimit        = maxProducts != null && publishedCount >= maxProducts

  const ageCounts = visibleProducts.reduce((acc, p) => {
    const b = getAgeInfo(p)?.bracket
    if (b) acc[b] = (acc[b] || 0) + 1
    return acc
  }, {})

  // ── Three-dot menu ──

  function generateDupSku() {
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
    return `DUP-${rand}`
  }

  function openDuplicate(product) {
    setMenuOpen(null)
    setDupSku(generateDupSku())
    setDupError('')
    setDupModal(product)
  }

  async function handleDuplicate() {
    if (!dupSku.trim()) { setDupError(t('products.duplicate.sku_required', 'SKU is required')); return }
    setDupLoading(true); setDupError('')
    const res = await apiFetch(`${API}/boutique/products/${dupModal.id}/duplicate`, {
      method: 'POST',
      body: JSON.stringify({ sku: dupSku.trim() })
    }).then(r => r.json()).catch(() => ({ success: false, message: t('common.error_network') }))
    setDupLoading(false)
    if (res.success) {
      setDupModal(null)
      // Refresh list
      // Guarded: on an error payload there is no `.data`, and reading
      // `.data.products` off it threw inside the promise — the duplicate had
      // already succeeded, so the list just never refreshed.
      apiFetch(`${API}/boutique/products`).then(r => r.json()).then(r => {
        if (!r?.success) return
        setProducts(r.data?.products ?? [])
        setTotal(r.data?.total ?? 0)
      }).catch(() => {})
    } else {
      setDupError(res.message ?? t('products.duplicate.error'))
    }
  }

  async function openPrintTag(product) {
    setMenuOpen(null)
    // Fetch full product details for the modal
    const res = await apiFetch(`${API}/boutique/products/${product.id}`).then(r => r.json()).catch(() => null)
    if (!res?.success) return
    const p = res.data
    const parts = (p.category_path ?? '').split(' / ')
    setPrintTagProduct({
      product: {
        name:        p.name,
        sku:         p.sku ?? '',
        retailPrice: parseFloat(p.retail_price) || 0,
        madeIn:      p.made_in ?? 'Italy',
        barcodeValue: p.barcode ?? '',
        barcodeFormat: p.barcode_format ?? '',
        vendorSku:   p.vendor_sku ?? '',
      },
      category: parts.length >= 3 ? { l1: parts[0], l2: parts[1], l3: parts[2], l4: p.style_slugs ?? [] } : null,
      brand: p.brand_name ?? '',
      sizes: (p.variants ?? []).map(v => ({ size: v.size_label })),
      productId: p.id,
    })
    setShowPrintTag(true)
  }

  function openAsCustomer(product) {
    setMenuOpen(null)
    window.open(`${WEBSHOP_BASE}/${product.id}`, '_blank')
  }

  const ageFilteredProducts = filterAge === 'all'
    ? visibleProducts
    : visibleProducts.filter(p => getAgeInfo(p)?.bracket === filterAge)

  const searchedProducts = (() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return ageFilteredProducts
    return ageFilteredProducts.filter(p =>
      p.name?.toLowerCase().includes(q)
      || p.sku?.toLowerCase().includes(q)
      || p.brand_name?.toLowerCase().includes(q)
    )
  })()

  const deadStockItems = visibleProducts.filter(p => getAgeInfo(p)?.bracket === 'dead')
  const allSelected    = selected.size > 0 && selected.size === visibleProducts.length

  function toggleAll()    { allSelected ? setSelected(new Set()) : setSelected(new Set(visibleProducts.map(p => p.id))) }
  function toggleRow(id)  { setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next }) }
  function toggleShowroom(id) {
    const product = products.find(p => p.id === id)
    const next = !product.showroom_enabled
    setProducts(prev => prev.map(p => p.id === id ? { ...p, showroom_enabled: next } : p))
    apiFetch(`${API}/boutique/products/${id}/showroom`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: next })
    })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setProducts(prev => prev.map(p => p.id === id ? { ...p, showroom_enabled: res.data.showroom_enabled } : p))
          return
        }
        // A rejected save used to leave the toggle flipped, so it looked saved
        // until the next refresh. Put it back and say what happened.
        setProducts(prev => prev.map(p => p.id === id ? { ...p, showroom_enabled: !next } : p))
        showToast(res.message || t('products.showroom_error', 'Could not update Showroom. Please try again.'), 'error')
      })
      .catch(() => {
        setProducts(prev => prev.map(p => p.id === id ? { ...p, showroom_enabled: !next } : p))
        showToast(t('common.error_network'), 'error')
      })
  }

  function bulkAction(action) {
    if (action === 'deleted') {
      const ids = [...selected]
      // Each delete is its own request, so they can fail independently. Only
      // drop the rows that actually went; previously every row was removed
      // regardless, so a failed delete still vanished from the list.
      Promise.all(ids.map(id =>
        apiFetch(`${API}/boutique/products/${id}`, { method:'DELETE' })
          .then(r => r.json())
          .then(res => ({ id, ok: !!res.success }))
          .catch(() => ({ id, ok: false }))
      )).then(results => {
        const deleted = results.filter(r => r.ok).map(r => r.id)
        const failed  = results.filter(r => !r.ok)
        if (deleted.length) {
          setProducts(prev => prev.filter(p => !deleted.includes(p.id)))
          setTotal(prev => Math.max(0, prev - deleted.length))
        }
        setSelected(new Set(failed.map(r => r.id)))
        if (failed.length) {
          showToast(t('products.bulk_delete_partial',
            '{{failed}} of {{total}} could not be deleted.',
            { failed: failed.length, total: ids.length }), 'error')
        }
      })
      return
    }
    apiFetch(`${API}/boutique/products/bulk`, {
      method:'PATCH',
      body: JSON.stringify({ action, product_ids: [...selected] })
    }).then(r => r.json()).then(res => {
      if (!res.success) {
        showToast(res.message || t('products.bulk_error', 'Bulk action failed. Please try again.'), 'error')
        return
      }
      setProducts(prev => prev.map(p => selected.has(p.id)
        ? { ...p, ...(action==='show' ? {status:'active'} : action==='hide' ? {status:'hidden'} : action==='showroom' ? {showroom_enabled:true} : {}) }
        : p
      ))
      setSelected(new Set())
    }).catch(() => showToast(t('common.error_network'), 'error'))
  }

  function openEdit(p) {
    setEditingId(p.id)
    setEditData({ name:p.name, retail_price:p.retail_price, pickup_discount_pct:p.pickup_discount_pct ?? '', status:p.status })
  }

  function closeEdit() { setEditingId(null); setEditData({}) }

  function saveEdit() {
    apiFetch(`${API}/boutique/products/${editingId}`, {
      method:'PUT',
      body: JSON.stringify(editData)
    }).then(r => r.json()).then(res => {
      if (res.success) { setProducts(prev => prev.map(p => p.id === editingId ? { ...p, ...editData } : p)); closeEdit() }
      // No else and no catch before this: a rejected inline edit did nothing
      // at all — the row stayed open with the typed values still showing, so
      // it read as an unresponsive button rather than a failed save. The row
      // is deliberately left open so the edit isn't lost.
      else showToast(res.message || t('products.edit_error', 'Could not save the changes. Please try again.'), 'error')
    }).catch(() => showToast(t('common.error_network'), 'error'))
  }

  return (
    <>
    {atLimit && (
      <div className="alert alert-warn" style={{ marginBottom: 12 }}>
        <span className="material-symbols-outlined">error</span>
        {t('products.at_limit',
           "You've reached the {{max}}-product limit. Hide or delete a product to add a new one. Drafts don't count toward the limit.",
           { max: maxProducts })}
      </div>
    )}
      {/* Tab bar + Add button */}
      <div className="prod-topbar">
        <div className="tabs prod-tabs">
          {TABS.map((tab, i) => (
            <div key={i} className={`tab${activeTab===i?' act':''}`} onClick={() => setActiveTab(i)}>{tab}</div>
          ))}
        </div>
        <button
          className="btn btn-primary"
          onClick={() => !atLimit && navigate('/products/add')}
          disabled={atLimit}
          title={atLimit
            ? t('products.limit_tooltip',
                'Limit reached: {{max}} published products max. Delete or hide products to add more.',
                { max: maxProducts })
            : undefined}
          style={atLimit ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
        >
          <span className="material-symbols-outlined">add</span>
          {t('products.add_btn', 'Add Product')}
          {publishedCount > 0 && (
            <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.75, fontWeight: 500 }}>
              · {publishedCount}/{maxProducts ?? '∞'}
            </span>
          )}
        </button>
      </div>

      {/* Stock Age filter row */}
      <div className="prod-age-row">
        <span className="prod-age-lbl">{t('products.stock_age', 'Stock Age')}:</span>
        <div className="prod-age-chips">
          {AGE_FILTERS.map(f => {
            const count    = f.key === 'all' ? visibleProducts.length : (ageCounts[f.key] ?? 0)
            const isActive = filterAge === f.key
            return (
              <button key={f.key} onClick={() => setFilterAge(f.key)}
                className="prod-age-chip"
                style={{
                  border:`1.5px solid ${f.border}`,
                  background: isActive ? f.border : f.bg,
                  color: isActive ? f.activeColor : f.color,
                }}>
                {AGE_LABELS[f.key]} ({count})
              </button>
            )
          })}
        </div>
        <div className="prod-age-right">
          <div className="prod-search">
            <span className="material-symbols-outlined prod-search-icon">search</span>
            <input
              type="text"
              className="prod-search-input"
              placeholder={t('products.search_placeholder', 'Search products') + '…'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="prod-age-report" onClick={() => navigate('/reports')}>
            <span className="material-symbols-outlined prod-age-report-icon">open_in_new</span>
            {t('products.full_report', 'Full Report')}
          </div>
        </div>
      </div>

      {/* Dead stock alert */}
      {deadStockItems.length > 0 && (filterAge === 'all' || filterAge === 'dead') && (
        <div className="prod-dead-alert">
          <span className="material-symbols-outlined prod-dead-alert-icon">warning</span>
          <div>
            {/* _days is a new key on purpose: the old products.dead_stock_alert
                has "120+ days" baked into the bundle, and a bundle value always
                beats defaultValue. The day count is interpolated now so it
                tracks lib/ageBracket instead of being written out by hand. */}
            <strong>{deadStockItems.length} {t('products.dead_stock_alert_days', { count: deadStockItems.length, days: DEAD_STOCK_FROM_DAYS, defaultValue: "product(s) haven't sold in {{days}}+ days:" })}</strong>{' '}
            {deadStockItems.map(p => p.name).join(', ')} — {t('products.dead_stock_action', 'consider marking down or moving to clearance.')}{' '}
            <span className="prod-dead-link" onClick={() => setFilterAge('dead')}>{t('products.view_dead', 'View dead stock')} →</span>
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bulk-bar">
          <div className="bulk-bar-count">{selected.size} {t('products.selected', 'selected')}</div>
          <div className="bulk-bar-actions">
            <button className="bulk-btn primary" onClick={() => bulkAction('show')}>
              <span className="material-symbols-outlined">visibility</span>{t('products.bulk.show', 'Show')}
            </button>
            <button className="bulk-btn outline" onClick={() => bulkAction('hide')}>
              <span className="material-symbols-outlined">visibility_off</span>{t('products.bulk.hide', 'Hide')}
            </button>
            <button className="bulk-btn outline" onClick={() => bulkAction('showroom')}>
              <span className="material-symbols-outlined">business_center</span>{t('products.bulk.showroom', 'Add to Showroom')}
            </button>
            <button className="bulk-btn danger" onClick={() => bulkAction('deleted')}>
              <span className="material-symbols-outlined">delete</span>{t('common.delete', 'Delete')}
            </button>
          </div>
        </div>
      )}

      {/* Product table */}
      <div className="card prod-table-card">
        <table className="tbl">
          <thead>
            <tr>
              <th className="prod-th-check">
                <div className={`prod-checkbox${allSelected?' checked':''}`} onClick={toggleAll} title={t('products.select_all', 'Select all')} />
              </th>
              <th className="prod-th-img"></th>
              <th>{t('products.table.product', 'Product')}</th>
              <th>{t('products.table.brand', 'Brand')}</th>
              <th>{t('products.table.price', 'Price')}</th>
              <th>{t('products.table.pickup_price', 'Pickup Price')}</th>
              <th>{t('products.table.stock', 'Stock')}</th>
              <th>{t('products.table.age', 'Age')}</th>
              <th>{t('products.table.showroom', 'Showroom')}</th>
              <th>{t('products.table.status', 'Status')}</th>
              <th></th>
            </tr>
          </thead>

          
          <tbody>
            {/* `loading` was declared and never used, so the body rendered as
                nothing at all: no "Loading…" while fetching, and no message
                when a filter or search matched zero products — just an empty
                table under a full set of headers. */}
            {loading && (
              <tr><td colSpan={11} className="empty">{t('common.loading')}</td></tr>
            )}
            {!loading && searchedProducts.length === 0 && (
              <tr>
                <td colSpan={11} className="empty">
                  {searchQuery.trim() || filterAge !== 'all'
                    ? t('products.no_match', 'No products match this filter.')
                    : t('products.empty', 'No products yet. Use Add Product to create your first one.')}
                </td>
              </tr>
            )}
            {searchedProducts.map(p => {
              const totalStock  = parseInt(p.total_stock ?? 0)
              const stockLow    = totalStock <= 2
              const pickupPrice = p.pickup_discount_pct
                ? (parseFloat(p.retail_price) * (1 - p.pickup_discount_pct / 100)).toFixed(2)
                : null
              const age = getAgeInfo(p)

              return (
                <tr key={p.id} className={age?.bracket === 'dead' ? 'prod-row-dead' : age?.bracket === 'aging' ? 'prod-row-aging' : ''}>
                  <td>
                    <div className={`prod-checkbox${selected.has(p.id)?' checked':''}`} onClick={() => toggleRow(p.id)} />
                  </td>
                  <td>
                    <div className="tbl-img" style={{ backgroundImage: imgSrc(p.main_photo) ? `url('${imgSrc(p.main_photo)}')` : 'none' }} />
                  </td>
                  <td>
                    <div className="prod-name">{p.name}</div>
                    <div className="prod-sku">{p.sku}</div>
                  </td>
                  <td>
                    {/* brand_id is null precisely when "Own Label" was chosen
                        in Add Product — there is no way to save a product with
                        no brand at all. A bare dash read as "missing data"
                        when it actually means "this is our own product". */}
                    <span className={`prod-brand-name${p.brand_name ? '' : ' prod-brand-own'}`}>
                      {p.brand_name ?? t('common.own_label', 'Own Label')}
                    </span>
                  </td>
                  <td>
                    {p.price_hidden
                      ? <span className="prod-price-hidden">{t('products.price_hidden', 'Hidden')}</span>
                      : `€${p.retail_price}`}
                  </td>
                  <td className="prod-pickup-price">
                    {pickupPrice
                      ? <>{`€${pickupPrice}`} <span className="prod-pickup-pct">–{p.pickup_discount_pct}%</span></>
                      : '—'}
                  </td>
                  <td>
                    {stockLow
                      ? <span className="prod-stock-low">{totalStock}</span>
                      : totalStock}
                  </td>
                  <td>
                    {age
                      ? <span className="prod-age-badge" style={{ background:age.bg, color:age.color }}>
                          {age.days}{t('common.days_abbrev', 'd')} · {AGE_BADGE_LABELS[age.bracket]}{age.warn ? ' ⚠' : ''}
                        </span>
                      : <span className="prod-age-none">—</span>}
                  </td>
                  <td>
                    <div className={`toggle${p.showroom_enabled?' on':''}`} onClick={() => toggleShowroom(p.id)}>
                      <div className="toggle-knob" />
                    </div>
                  </td>
                  <td>
                    <span className={`status ${p.status==='active'?'active':'cancelled'}`}>{statusLabel(t, p.status)}</span>
                  </td>
                  <td className="prod-actions">
                    <button className="btn btn-sm btn-outline" onClick={() => openEdit(p)}>
                      <span className="material-symbols-outlined">edit</span>
                    </button>
                    {' '}
                    <button className="btn btn-sm btn-outline" onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === p.id ? null : p.id) }}>
                      <span className="material-symbols-outlined">more_vert</span>
                    </button>
                    {menuOpen === p.id && (
                      <>
                      <div className="pd-menu-overlay" onClick={() => setMenuOpen(null)} />
                      <div className="pd-menu-dropdown">
                        <div className="pd-menu-item" onClick={() => openDuplicate(p)}>
                          <span className="material-symbols-outlined">content_copy</span>{t('products.menu.duplicate')}
                        </div>
                        <div className="pd-menu-item" onClick={() => openPrintTag(p)}>
                          <span className="material-symbols-outlined">print</span>{t('products.menu.print_tag')}
                        </div>
                        <div className="pd-menu-item" onClick={() => openAsCustomer(p)}>
                          <span className="material-symbols-outlined">visibility</span>{t('products.menu.view_customer')}
                        </div>
                      </div>
                      </>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="alert alert-info">
        <span className="material-symbols-outlined">info</span>
        {t('products.showroom_info', 'Showroom lets customers browse this product in-store via QR code, even when it\'s not available for online purchase.')}
      </div>

      {/* Edit modal */}
      {editingId && (
        <div className="modal-backdrop" onClick={closeEdit}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <span className="modal-title">{t('products.edit_modal.title', 'Edit')} <em>{t('products.edit_modal.title_em', 'Product')}</em></span>
              <span className="modal-close" onClick={closeEdit}>
                <span className="material-symbols-outlined">close</span>
              </span>
            </div>
            <p className="prod-edit-hint">{t('products.edit_modal.hint', 'Quick edit — for full details, variants, and photos, use Full Edit below.')}</p>
            <div className="form-group">
              <label className="form-lbl">{t('products.edit_modal.name_label', 'Product Name')}</label>
              <input className="form-input" value={editData.name} onChange={e => setEditData(d => ({...d, name:e.target.value}))} />
            </div>
            <div className="prod-edit-grid">
              <div className="form-group">
                <label className="form-lbl">{t('products.edit_modal.price_label', 'Retail Price')}</label>
                <input className="form-input" value={editData.retail_price} onChange={e => setEditData(d => ({...d, retail_price:e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-lbl">{t('products.edit_modal.pickup_label', 'Pickup Discount %')}</label>
                <input className="form-input" value={editData.pickup_discount_pct} onChange={e => setEditData(d => ({...d, pickup_discount_pct:e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-lbl">{t('products.edit_modal.status_label', 'Status')}</label>
                <select className="form-select" value={editData.status} onChange={e => setEditData(d => ({...d, status:e.target.value}))}>
                  <option value="active">{t('products.edit_modal.status_active', 'Active')}</option>
                  <option value="hidden">{t('products.edit_modal.status_hidden', 'Hidden')}</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={closeEdit}>{t('common.cancel', 'Cancel')}</button>
              <button className="btn btn-outline" onClick={() => navigate(`/products/edit/${editingId}`)}>
                <span className="material-symbols-outlined prod-full-edit-icon">open_in_full</span>{t('products.edit_modal.full_edit', 'Full Edit')}
              </button>
              <button className="btn btn-primary" onClick={saveEdit}>{t('products.edit_modal.save_btn', 'Save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Modal */}
      {dupModal && (
        <div className="modal-backdrop" onClick={() => setDupModal(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <div className="modal-title">{t('products.duplicate.title')} <em>{t('products.duplicate.title_em')}</em></div>
              <div className="modal-close" onClick={() => setDupModal(null)}>
                <span className="material-symbols-outlined">close</span>
              </div>
            </div>
            <div className="alert alert-info">
              <span className="material-symbols-outlined">content_copy</span>
              <div>{t('products.duplicate.info', { name: dupModal.name })}</div>
            </div>
            {dupError && <div className="eng-error">{dupError}</div>}
            <div className="form-group">
              <label className="form-lbl">{t('products.duplicate.sku_label')} *</label>
              <input className="form-input" value={dupSku} onChange={e => setDupSku(e.target.value)} placeholder="e.g. DUP-A1B2" />
              <div className="form-hint">{t('products.duplicate.sku_hint', { sku: dupModal.sku })}</div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDupModal(null)}>{t('common.cancel')}</button>
              <button className="btn btn-primary" onClick={handleDuplicate} disabled={dupLoading}>
                <span className="material-symbols-outlined">content_copy</span>
                {dupLoading ? t('products.duplicate.duplicating') : t('products.duplicate.submit')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Tag Modal */}
      {showPrintTag && printTagProduct && (
        <PrintTagModal
          isOpen={showPrintTag}
          onClose={() => { setShowPrintTag(false); setPrintTagProduct(null) }}
          product={printTagProduct.product}
          category={printTagProduct.category}
          brand={printTagProduct.brand}
          sizes={printTagProduct.sizes}
          productId={printTagProduct.productId}
        />
      )}

      <Toast toasts={toasts} />
    </>
  )
}
