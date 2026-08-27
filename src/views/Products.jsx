import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'
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

function getAgeInfo(p) {
  const days = p.days_in_stock ?? (p.created_at ? Math.floor((Date.now() - new Date(p.created_at)) / 86400000) : null)
  if (days === null) return null
  if (days <= 30)  return { bracket:'fresh',  days, label:`${days}d · Fresh`,    bg:'rgba(0,89,58,.08)',   color:'#006C35' }
  if (days <= 60)  return { bracket:'normal', days, label:`${days}d · Normal`,   bg:'rgba(26,79,191,.08)', color:'#1A4FBF' }
  if (days <= 90)  return { bracket:'aging',  days, label:`${days}d · Aging ⚠`, bg:'rgba(180,83,9,.1)',   color:'#B45309' }
  if (days <= 120) return { bracket:'slow',   days, label:`${days}d · Slow ⚠`,  bg:'rgba(197,0,26,.08)',  color:'#C5001A' }
  return           { bracket:'dead',   days, label:`${days}d · Dead ⚠`,  bg:'rgba(197,0,26,.12)', color:'#C5001A' }
}

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


  useEffect(() => {
    apiFetch(`${API}/boutique/products`)
      .then(r => r.json())
      .then(res => {
        setProducts(res.data.products ?? [])
        setTotal(res.data.total)
        setLoading(false)
      })
  }, [lang])

  const TABS = [
    `${t('products.tabs.all')} (${total})`,
    t('products.tabs.active'),
    t('products.tabs.hidden'),
    t('products.tabs.showroom'),
  ]

  const AGE_LABELS = {
    all:    t('products.age.all'),
    fresh:  t('products.age.fresh'),
    normal: t('products.age.normal'),
    aging:  t('products.age.aging'),
    slow:   t('products.age.slow'),
    dead:   t('products.age.dead'),
  }

  const visibleProducts = products.filter(p => {
    if (activeTab === 1) return p.status === 'active'
    if (activeTab === 2) return p.status === 'hidden'
    if (activeTab === 3) return p.showroom_enabled
    return true
  })

  const publishedCount = products.filter(p => p.status === 'active' || p.status === 'hidden').length
  const atLimit        = publishedCount >= MAX_PRODUCTS

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
    if (!dupSku.trim()) { setDupError('SKU is required'); return }
    setDupLoading(true); setDupError('')
    const res = await apiFetch(`${API}/boutique/products/${dupModal.id}/duplicate`, {
      method: 'POST',
      body: JSON.stringify({ sku: dupSku.trim() })
    }).then(r => r.json()).catch(() => ({ success: false, message: 'Network error' }))
    setDupLoading(false)
    if (res.success) {
      setDupModal(null)
      // Refresh list
      apiFetch(`${API}/boutique/products`).then(r => r.json()).then(r => {
        setProducts(r.data.products ?? [])
        setTotal(r.data.total)
      })
    } else {
      setDupError(res.message ?? 'Failed to duplicate product')
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
        }
      })
      .catch(() => {
        setProducts(prev => prev.map(p => p.id === id ? { ...p, showroom_enabled: !next } : p))
      })
  }

  function bulkAction(action) {
    if (action === 'deleted') {
      Promise.all([...selected].map(id =>
        apiFetch(`${API}/boutique/products/${id}`, { method:'DELETE' }).then(r => r.json())
      )).then(() => { setProducts(prev => prev.filter(p => !selected.has(p.id))); setSelected(new Set()) })
      return
    }
    apiFetch(`${API}/boutique/products/bulk`, {
      method:'PATCH',
      body: JSON.stringify({ action, product_ids: [...selected] })
    }).then(r => r.json()).then(res => {
      if (res.success) {
        setProducts(prev => prev.map(p => selected.has(p.id)
          ? { ...p, ...(action==='show' ? {status:'active'} : action==='hide' ? {status:'hidden'} : action==='showroom' ? {showroom_enabled:true} : {}) }
          : p
        ))
        setSelected(new Set())
      }
    })
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
    })
  }

  return (
    <>
    {atLimit && (
      <div className="alert alert-warn" style={{ marginBottom: 12 }}>
        <span className="material-symbols-outlined">error</span>
        You've reached the {MAX_PRODUCTS}-product limit. Hide or delete a product to add a new one. Drafts don't count toward the limit.
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
          title={atLimit ? `Limit reached: ${MAX_PRODUCTS} published products max. Delete or hide products to add more.` : undefined}
          style={atLimit ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
        >
          <span className="material-symbols-outlined">add</span>
          {t('products.add_btn')}
          {publishedCount > 0 && (
            <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.75, fontWeight: 500 }}>
              · {publishedCount}/{MAX_PRODUCTS}
            </span>
          )}
        </button>
      </div>

      {/* Stock Age filter row */}
      <div className="prod-age-row">
        <span className="prod-age-lbl">{t('products.stock_age')}:</span>
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
              placeholder={t('products.search_placeholder')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="prod-age-report" onClick={() => navigate('/reports')}>
            <span className="material-symbols-outlined prod-age-report-icon">open_in_new</span>
            {t('products.full_report')}
          </div>
        </div>
      </div>

      {/* Dead stock alert */}
      {deadStockItems.length > 0 && (filterAge === 'all' || filterAge === 'dead') && (
        <div className="prod-dead-alert">
          <span className="material-symbols-outlined prod-dead-alert-icon">warning</span>
          <div>
            <strong>{deadStockItems.length} {t('products.dead_stock_alert', { count: deadStockItems.length })}</strong>{' '}
            {deadStockItems.map(p => p.name).join(', ')} — {t('products.dead_stock_action')}{' '}
            <span className="prod-dead-link" onClick={() => setFilterAge('dead')}>{t('products.view_dead')} →</span>
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bulk-bar">
          <div className="bulk-bar-count">{selected.size} {t('products.selected')}</div>
          <div className="bulk-bar-actions">
            <button className="bulk-btn primary" onClick={() => bulkAction('show')}>
              <span className="material-symbols-outlined">visibility</span>{t('products.bulk.show')}
            </button>
            <button className="bulk-btn outline" onClick={() => bulkAction('hide')}>
              <span className="material-symbols-outlined">visibility_off</span>{t('products.bulk.hide')}
            </button>
            <button className="bulk-btn outline" onClick={() => bulkAction('showroom')}>
              <span className="material-symbols-outlined">business_center</span>{t('products.bulk.showroom')}
            </button>
            <button className="bulk-btn danger" onClick={() => bulkAction('deleted')}>
              <span className="material-symbols-outlined">delete</span>{t('common.delete')}
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
                <div className={`prod-checkbox${allSelected?' checked':''}`} onClick={toggleAll} title={t('products.select_all')} />
              </th>
              <th className="prod-th-img"></th>
              <th>{t('products.table.product')}</th>
              <th>{t('products.table.brand')}</th>
              <th>{t('products.table.price')}</th>
              <th>{t('products.table.pickup_price')}</th>
              <th>{t('products.table.stock')}</th>
              <th>{t('products.table.age')}</th>
              <th>{t('products.table.showroom')}</th>
              <th>{t('products.table.status')}</th>
              <th></th>
            </tr>
          </thead>

          
          <tbody>
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
                    <span className="prod-brand-name">{p.brand_name ?? '—'}</span>
                  </td>
                  <td>
                    {p.price_hidden
                      ? <span className="prod-price-hidden">{t('products.price_hidden')}</span>
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
                      ? <span className="prod-age-badge" style={{ background:age.bg, color:age.color }}>{age.label}</span>
                      : <span className="prod-age-none">—</span>}
                  </td>
                  <td>
                    <div className={`toggle${p.showroom_enabled?' on':''}`} onClick={() => toggleShowroom(p.id)}>
                      <div className="toggle-knob" />
                    </div>
                  </td>
                  <td>
                    <span className={`status ${p.status==='active'?'active':'cancelled'}`}>{p.status}</span>
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
                          <span className="material-symbols-outlined">content_copy</span>Duplicate Product
                        </div>
                        <div className="pd-menu-item" onClick={() => openPrintTag(p)}>
                          <span className="material-symbols-outlined">print</span>Print Tag
                        </div>
                        <div className="pd-menu-item" onClick={() => openAsCustomer(p)}>
                          <span className="material-symbols-outlined">visibility</span>View as Customer
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
        {t('products.showroom_info')}
      </div>

      {/* Edit modal */}
      {editingId && (
        <div className="modal-backdrop" onClick={closeEdit}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <span className="modal-title">{t('products.edit_modal.title')} <em>{t('products.edit_modal.title_em')}</em></span>
              <span className="modal-close" onClick={closeEdit}>
                <span className="material-symbols-outlined">close</span>
              </span>
            </div>
            <p className="prod-edit-hint">{t('products.edit_modal.hint')}</p>
            <div className="form-group">
              <label className="form-lbl">{t('products.edit_modal.name_label')}</label>
              <input className="form-input" value={editData.name} onChange={e => setEditData(d => ({...d, name:e.target.value}))} />
            </div>
            <div className="prod-edit-grid">
              <div className="form-group">
                <label className="form-lbl">{t('products.edit_modal.price_label')}</label>
                <input className="form-input" value={editData.retail_price} onChange={e => setEditData(d => ({...d, retail_price:e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-lbl">{t('products.edit_modal.pickup_label')}</label>
                <input className="form-input" value={editData.pickup_discount_pct} onChange={e => setEditData(d => ({...d, pickup_discount_pct:e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-lbl">{t('products.edit_modal.status_label')}</label>
                <select className="form-select" value={editData.status} onChange={e => setEditData(d => ({...d, status:e.target.value}))}>
                  <option value="active">{t('products.edit_modal.status_active')}</option>
                  <option value="hidden">{t('products.edit_modal.status_hidden')}</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={closeEdit}>{t('common.cancel')}</button>
              <button className="btn btn-outline" onClick={() => navigate(`/products/edit/${editingId}`)}>
                <span className="material-symbols-outlined prod-full-edit-icon">open_in_full</span>{t('products.edit_modal.full_edit')}
              </button>
              <button className="btn btn-primary" onClick={saveEdit}>{t('products.edit_modal.save_btn')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Modal */}
      {dupModal && (
        <div className="modal-backdrop" onClick={() => setDupModal(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <div className="modal-title">Duplicate <em>Product</em></div>
              <div className="modal-close" onClick={() => setDupModal(null)}>
                <span className="material-symbols-outlined">close</span>
              </div>
            </div>
            <div className="alert alert-info">
              <span className="material-symbols-outlined">content_copy</span>
              <div>This will create a copy of <strong>{dupModal.name}</strong> with all details, variants, and images. The new product will be saved as a draft.</div>
            </div>
            {dupError && <div className="eng-error">{dupError}</div>}
            <div className="form-group">
              <label className="form-lbl">New SKU *</label>
              <input className="form-input" value={dupSku} onChange={e => setDupSku(e.target.value)} placeholder="e.g. DUP-A1B2" />
              <div className="form-hint">Original SKU ({dupModal.sku}) cannot be reused. Enter a unique SKU for the duplicate.</div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDupModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleDuplicate} disabled={dupLoading}>
                <span className="material-symbols-outlined">content_copy</span>
                {dupLoading ? 'Duplicating…' : 'Duplicate Product'}
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
    </>
  )
}
