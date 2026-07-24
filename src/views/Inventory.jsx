import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'
import CategorySelectorDropdown from '../components/product/CategorySelectorDropdown'
import useNotifStore from '../store/notifStore'

const API      = import.meta.env.VITE_API_URL
const IMG_BASE = import.meta.env.VITE_IMG_BASE_URL ?? ''

function loadRestocks(setRestocks) {
  apiFetch(`${API}/boutique/inventory/restocks`)
    .then(r => r.json())
    .then(res => setRestocks(res.data?.restocks ?? []))
}

function stockBadge(total, warn, crit) {
  if (total === 0)   return { cls:'out', icon:'error',   label:'Out of Stock' }
  if (total <= crit) return { cls:'low', icon:'warning', label:'Critical'     }
  if (total <= warn) return { cls:'low', icon:'warning', label:'Low'          }
  return                    { cls:'in',  icon:null,      label:'In Stock'     }
}

function imgUrl(raw) {
  if (!raw) return ''
  return raw.startsWith('http') ? raw : `${IMG_BASE}${raw}`
}

export default function Inventory() {
  const navigate = useNavigate()
  const { t }    = useTranslation()

  const notifications = useNotifStore(s => s.notifications)
  const markRead      = useNotifStore(s => s.markRead)
  const hasMarkedRead = useRef(false)

  const [apiStats,    setApiStats]    = useState({})
  const [allProducts, setAllProducts] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [restocks,    setRestocks]    = useState([])
  const [changes,     setChanges]     = useState({})
  const [saveMsg,     setSaveMsg]     = useState('')
  const [saveToast,   setSaveToast]   = useState('')
  const [autoHide,    setAutoHide]    = useState(true)
  const [warnThreshold, setWarnThreshold] = useState(3)
  const [critThreshold, setCritThreshold] = useState(1)
  const [thresholdMsg,  setThresholdMsg]  = useState('')
  const [searchQuery,   setSearchQuery]   = useState('')
  const [filterStatus,  setFilterStatus]  = useState('all')
  const [showRestockModal, setShowRestockModal] = useState(false)
  const [restockMode,      setRestockMode]      = useState('entry') // 'entry' | 'log'
  const [restockForm,      setRestockForm]      = useState({ productId:'', variantId:'', qty:'', note:'' })
  const [restockSuccess,   setRestockSuccess]   = useState(false)
  const [category,         setCategory]         = useState(null)

  // Load inventory, settings and restocks on mount
  useEffect(() => {
    apiFetch(`${API}/boutique/inventory`)
      .then(r => r.json())
      .then(res => {
        setApiStats(res.data.stats)
        setAllProducts(res.data.products ?? [])
        setLoading(false)
      })

    apiFetch(`${API}/boutique/inventory/settings`)
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setWarnThreshold(res.data.low_stock_warning_threshold  ?? 3)
          setCritThreshold(res.data.low_stock_critical_threshold ?? 1)
          setAutoHide(res.data.auto_hide_out_of_stock            ?? true)
        }
      })
      .catch(() => {})

    loadRestocks(setRestocks)
  }, [])

  // Mark stock notifications as read on mount
  useEffect(() => {
    if (hasMarkedRead.current) return
    if (notifications.length === 0) return
    hasMarkedRead.current = true
    notifications
      .filter(n => !n.read_at && !n.is_read && n.type?.toLowerCase().includes('stock'))
      .forEach(n => {
        apiFetch(`${API}/boutique/notifications/${n.id}/read`, { method:'PUT', body: JSON.stringify({}) })
        markRead(n.id)
      })
  }, [notifications.length])

  // ── Derive table rows and columns ─────────────────────────────────────────
  const allSizeCols = useMemo(() => {
    const seen = new Set()
    const cols = []
    allProducts.forEach(p => {
      p.variants?.forEach(v => {
        if (!seen.has(v.size_label)) { seen.add(v.size_label); cols.push(v.size_label) }
      })
    })
    return cols
  }, [allProducts])

  const tableRows = useMemo(() => {
    const rows = []
    allProducts.forEach(p => {
      const colourMap = {}
      p.variants?.forEach(v => {
        const key = v.colour ?? 'No Colour'
        if (!colourMap[key]) colourMap[key] = []
        colourMap[key].push(v)
      })
      Object.entries(colourMap).forEach(([colour, variants]) => {
        const total = variants.reduce((s, v) => s + v.stock_qty, 0)
        rows.push({
          productId:   p.id,
          productName: p.name,
          sku:         p.sku,
          img:         imgUrl(p.main_photo),
          colour:      colour === 'No Colour' ? '' : colour,
          variants,
          total,
        })
      })
    })
    return rows
  }, [allProducts])

  const filteredRows = useMemo(() => {
    return tableRows.filter(row => {
      const matchSearch = row.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          row.sku.toLowerCase().includes(searchQuery.toLowerCase())
      const badge = stockBadge(row.total, warnThreshold, critThreshold)
      const matchFilter =
        filterStatus === 'all' ? true :
        filterStatus === 'low' ? badge.cls === 'low-stock' || badge.cls === 'critical' :
        filterStatus === 'out' ? badge.cls === 'out-of-stock' : true
      return matchSearch && matchFilter
    })
  }, [tableRows, searchQuery, filterStatus, warnThreshold, critThreshold])

  function getCell(row, sizeLabel) {
    return row.variants.find(v => v.size_label === sizeLabel) ?? null
  }

  function QtyChange(variantId, qty) {
    setChanges(prev => ({ ...prev, [variantId]: Number(qty) }))
  }

  // ── Save All Changes (Stock by Variant table edits) ───────────────────────
  function saveChanges() {
    const updates = Object.entries(changes).map(([variant_id, stock_qty]) => ({ variant_id, stock_qty }))
    if (!updates.length) {
      setSaveToast('No changes to save.')
      setTimeout(() => setSaveToast(''), 3000)
      return
    }
    apiFetch(`${API}/boutique/inventory`, {
      method: 'PUT',
      body: JSON.stringify({ updates })
    })
      .then(r => r.json())
      .then(res => {
        setSaveMsg(res.message)
        setTimeout(() => setSaveMsg(''), 3000)
        setChanges({})
        apiFetch(`${API}/boutique/inventory`)
          .then(r => r.json())
          .then(res2 => setAllProducts(res2.data.products ?? []))
      })
  }

  function saveThresholds() {
    apiFetch(`${API}/boutique/inventory/settings`, {
      method: 'PUT',
      body: JSON.stringify({
        low_stock_warning_threshold:  warnThreshold,
        low_stock_critical_threshold: critThreshold,
      })
    })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setThresholdMsg(res.message)
          setTimeout(() => setThresholdMsg(''), 3000)
        }
      })
      .catch(() => {})
  }

  function toggleAutoHide() {
    const next = !autoHide
    setAutoHide(next)
    apiFetch(`${API}/boutique/inventory/settings`, {
      method: 'PUT',
      body: JSON.stringify({ auto_hide_out_of_stock: next })
    })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setWarnThreshold(res.data.low_stock_warning_threshold  ?? warnThreshold)
          setCritThreshold(res.data.low_stock_critical_threshold ?? critThreshold)
          setAutoHide(res.data.auto_hide_out_of_stock            ?? next)
        }
      })
      .catch(() => setAutoHide(!next))
  }

  // ── Restock modal openers ─────────────────────────────────────────────────
  function openRestockEntry() {
    setRestockForm({ productId:'', variantId:'', qty:'', note:'' })
    setRestockMode('entry')
    setShowRestockModal(true)
  }

  function openRestockLog() {
    setRestockForm({ productId:'', variantId:'', qty:'', note:'' })
    setRestockMode('log')
    setShowRestockModal(true)
  }

  // ── Add Restock Entry: updates Stock by Variant only ─────────────────────
  function submitRestockEntry() {
    if (!restockForm.variantId || !restockForm.qty) return
    apiFetch(`${API}/boutique/inventory`, {
      method: 'PUT',
      body: JSON.stringify({ updates: [{ variant_id: restockForm.variantId, stock_qty: Number(restockForm.qty) }] })
    })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setShowRestockModal(false)
          setRestockSuccess(true)
          apiFetch(`${API}/boutique/inventory`)
            .then(r => r.json())
            .then(res2 => setAllProducts(res2.data.products ?? []))
        }
      })
  }

  // ── Log Restock: updates Restock History only ─────────────────────────────
  function submitRestockLog() {
    if (!restockForm.variantId || !restockForm.qty) return
    apiFetch(`${API}/boutique/inventory/restocks`, {
      method: 'POST',
      body: JSON.stringify({ variant_id: restockForm.variantId, qty_added: Number(restockForm.qty), note: restockForm.note })
    })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setShowRestockModal(false)
          setRestockSuccess(true)
          loadRestocks(setRestocks)
        }
      })
  }

  return (
    <>
      {/* Toast */}
      {saveToast && (
        <div className="inv-toast">
          <span className="material-symbols-outlined">info</span>
          {saveToast}
        </div>
      )}

      {/* Top bar */}
      <div className="inv-topbar">
        <div className="inv-topbar-left">
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/products')}>
            <span className="material-symbols-outlined">arrow_back</span>{t('inventory.back_btn')}
          </button>
          <h2 className="inv-topbar-title">
            {t('inventory.title')} <em>{t('inventory.title_em')}</em>
          </h2>
        </div>
        <div className="inv-topbar-actions">
          <button className="btn btn-outline" onClick={() => {
            const rows = [['Product', 'Colour', 'SKU', 'Total Stock']]
            tableRows.forEach(r => rows.push([r.productName, r.colour, r.sku, r.total]))
            const csv = rows.map(r => r.join(',')).join('\n')
            const a = document.createElement('a')
            a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv' }))
            a.download = 'inventory.csv'
            a.click()
          }}>
            <span className="material-symbols-outlined">download</span>{t('inventory.export_btn')}
          </button>
          <button className="btn btn-primary" onClick={saveChanges}>
            <span className="material-symbols-outlined">save</span>{t('inventory.save_btn')}
          </button>
        </div>
      </div>

      {saveMsg && <div className="alert alert-info inv-save-msg">{saveMsg}</div>}

      {/* Stats */}
      <div className="inv-grid">
        {[
          { cls:'ok',       lbl: t('inventory.stats.total_units'),  val: apiStats.total_units ?? '—',           sub: '' },
          { cls:'warn',     lbl: t('inventory.stats.low_stock'),    val: apiStats.low_stock_products ?? '—',    sub: t('inventory.stats.low_stock_sub') },
          { cls:'critical', lbl: t('inventory.stats.out_of_stock'), val: apiStats.out_of_stock_variants ?? '—', sub: t('inventory.stats.out_of_stock_sub') },
          { cls:'ok',       lbl: t('inventory.stats.avg_stock'),    val: apiStats.avg_stock_per_variant ?? '—', sub: t('inventory.stats.avg_stock_sub') },
        ].map(s => (
          <div key={s.lbl} className={`inv-stat ${s.cls}`}>
            <div className="inv-stat-lbl">{s.lbl}</div>
            <div className="inv-stat-val">{s.val}</div>
            <div className="inv-stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Stock table */}
      <div className="card inv-table-card">
        <div className="inv-table-hdr">
          <div className="inv-table-title">
            {t('inventory.stock_by')} <em className="inv-table-em">{t('inventory.stock_by_em')}</em>
          </div>
          <div className="inv-table-controls">
            <div className="inv-search">
              <span className="material-symbols-outlined inv-search-icon">search</span>
              <input
                className="inv-search-input"
                placeholder={t('inventory.search_placeholder')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <select className="form-select inv-filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">{t('inventory.filter_all')}</option>
              <option value="low">{t('inventory.filter_low')}</option>
              <option value="out">{t('inventory.filter_out')}</option>
            </select>
          </div>
        </div>

        {/* Category selector */}
        <div className="inv-cat-selector">
          <div className="inv-cat-selector-lbl">
            <span className="material-symbols-outlined">category</span>
            Filter by category (coming soon)
          </div>
          <CategorySelectorDropdown onChange={(cat) => setCategory(cat)} />
        </div>

        {loading ? (
          <div className="inv-cat-prompt">
            <span className="material-symbols-outlined">hourglass_empty</span>
            <div>Loading inventory…</div>
          </div>
        ) : (
          <div className="inv-tbl-scroll">
            <table className="inv-tbl" style={{ minWidth: `${300 + allSizeCols.length * 90}px` }}>
              <thead>
                <tr>
                  <th className="inv-th-left" style={{ minWidth:200, position:'sticky', left:0, background:'var(--card)', zIndex:2 }}>
                    {t('inventory.table.product')}
                  </th>
                  <th className="inv-th-left" style={{ minWidth:100 }}>{t('inventory.table.sku')}</th>
                  {allSizeCols.map(size => (
                    <th key={size} style={{ minWidth:80, textAlign:'center' }}>{size}</th>
                  ))}
                  <th style={{ minWidth:70, textAlign:'center' }}>{t('inventory.table.total')}</th>
                  <th style={{ minWidth:100 }}>{t('inventory.table.status')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, ri) => {
                  const badge = stockBadge(row.total, warnThreshold, critThreshold)
                  return (
                    <tr key={`${row.productId}-${row.colour}-${ri}`} className={row.total === 0 ? 'row-out' : ''}>
                      <td style={{ position:'sticky', left:0, background:'var(--card)', zIndex:1 }}>
                        <div className="inv-product-cell">
                          <div className="inv-product-img" style={{ backgroundImage:`url('${row.img}')` }} />
                          <div>
                            <div className="inv-product-name">{row.productName}</div>
                            {row.colour && <div className="inv-product-color">{row.colour}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="inv-sku">{row.sku}</td>
                      {allSizeCols.map(size => {
                        const cell = getCell(row, size)
                        if (!cell) return <td key={size} className="inv-empty-cell">—</td>
                        const cls = cell.stock_qty === 0 ? 'zero' : cell.stock_qty <= critThreshold ? 'crit' : cell.stock_qty <= warnThreshold ? 'warn' : ''
                        return (
                          <td key={size} style={{ textAlign:'center' }}>
                            <input
                              className={`inv-qty-input${cls ? ' ' + cls : ''}`}
                              defaultValue={cell.stock_qty}
                              onChange={e => QtyChange(cell.id, e.target.value)}
                            />
                          </td>
                        )
                      })}
                      <td className="inv-total" style={{ textAlign:'center' }}>{row.total}</td>
                      <td>
                        <span className={`stock-badge ${badge.cls}`}>
                          {badge.icon && <span className="material-symbols-outlined inv-badge-icon">{badge.icon}</span>}
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={allSizeCols.length + 4} className="inv-empty-row">
                      No products found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="inv-table-footer">
          <div className="inv-table-hint">{t('inventory.table_hint')}</div>
          <button className="btn btn-outline btn-sm" onClick={openRestockEntry}>
            <span className="material-symbols-outlined">add</span>{t('inventory.add_restock')}
          </button>
        </div>
      </div>

      <div className="grid2">
        {/* Thresholds */}
        <div className="card">
          <div className="card-hdr">
            <div className="card-title">{t('inventory.thresholds.title')} <em>{t('inventory.thresholds.title_em')}</em></div>
          </div>
          <div className="inv-threshold-hint">{t('inventory.thresholds.hint')}</div>

          <div className="threshold-row">
            <div className="threshold-icon warn"><span className="material-symbols-outlined">warning</span></div>
            <div className="inv-threshold-body">
              <div className="inv-threshold-title">{t('inventory.thresholds.warn_title')}</div>
              <div className="inv-threshold-sub">{t('inventory.thresholds.warn_sub')}</div>
            </div>
            <input className="inv-qty-input inv-threshold-input" value={warnThreshold} onChange={e => setWarnThreshold(Number(e.target.value))} />
            <span className="inv-units-lbl">{t('inventory.thresholds.units')}</span>
          </div>

          <div className="threshold-row inv-threshold-mb">
            <div className="threshold-icon critical"><span className="material-symbols-outlined">priority_high</span></div>
            <div className="inv-threshold-body">
              <div className="inv-threshold-title">{t('inventory.thresholds.crit_title')}</div>
              <div className="inv-threshold-sub">{t('inventory.thresholds.crit_sub')}</div>
            </div>
            <input className="inv-qty-input inv-threshold-input" value={critThreshold} onChange={e => setCritThreshold(Number(e.target.value))} />
            <span className="inv-units-lbl">{t('inventory.thresholds.units')}</span>
          </div>

          <div className="inv-autohide-row">
            <div>
              <div className="inv-autohide-title">{t('inventory.thresholds.autohide_title')}</div>
              <div className="inv-autohide-sub">{t('inventory.thresholds.autohide_sub')}</div>
            </div>
            <div className={`toggle${autoHide ? ' on' : ''}`} onClick={toggleAutoHide}>
              <div className="toggle-knob" />
            </div>
          </div>

          {thresholdMsg && <div className="inv-threshold-msg">{thresholdMsg}</div>}
          <button className="btn btn-primary btn-sm inv-threshold-save" onClick={saveThresholds}>
            {t('inventory.thresholds.save_btn')}
          </button>
        </div>

        {/* Restock history */}
        <div className="card">
          <div className="card-hdr">
            <div className="card-title">{t('inventory.restock.title')} <em>{t('inventory.restock.title_em')}</em></div>
            <div className="card-action" onClick={openRestockLog}>
              <span className="material-symbols-outlined">add</span>{t('inventory.restock.log_btn')}
            </div>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('inventory.restock.table.product')}</th>
                <th>{t('inventory.restock.table.variant')}</th>
                <th>{t('inventory.restock.table.qty')}</th>
                <th>{t('inventory.restock.table.date')}</th>
                <th>{t('inventory.restock.table.by')}</th>
              </tr>
            </thead>
            <tbody>
              {restocks.map(r => (
                <tr key={r.id}>
                  <td className="inv-restock-product">{r.product_name}</td>
                  <td>{r.size_label}{r.colour ? ` · ${r.colour}` : ''}</td>
                  <td className="inv-restock-qty">+{r.qty_added}</td>
                  <td>{new Date(r.created_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}</td>
                  <td>{r.added_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Restock Modal */}
      {showRestockModal && (() => {
        const selectedProduct = allProducts.find(p => p.id === restockForm.productId)
        const variants = selectedProduct
          ? (selectedProduct.variants ?? []).map(v => ({ label: `${v.size_label}${v.colour ? ` · ${v.colour}` : ''}`, variantId: v.id }))
          : []
        const isEntry = restockMode === 'entry'
        return (
          <div className="modal-backdrop" onClick={() => setShowRestockModal(false)}>
            <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
              <div className="modal-hdr">
                <span className="modal-title">
                  {isEntry ? 'Add Restock' : 'Log Restock'} <em>{isEntry ? 'Entry' : 'History'}</em>
                </span>
                <span className="modal-close" onClick={() => setShowRestockModal(false)}>
                  <span className="material-symbols-outlined">close</span>
                </span>
              </div>
              <div className="form-group">
                <label className="form-lbl">{t('inventory.restock.modal.product_label')}</label>
                <select className="form-select" value={restockForm.productId}
                  onChange={e => setRestockForm(f => ({ ...f, productId: e.target.value, variantId: '' }))}>
                  <option value="">{t('inventory.restock.modal.product_placeholder')}</option>
                  {allProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-lbl">{t('inventory.restock.modal.size_label')}</label>
                <select className="form-select" value={restockForm.variantId}
                  onChange={e => setRestockForm(f => ({ ...f, variantId: e.target.value }))}
                  disabled={!restockForm.productId}>
                  <option value="">{t('inventory.restock.modal.size_placeholder')}</option>
                  {variants.map(v => <option key={v.variantId} value={v.variantId}>{v.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-lbl">{t('inventory.restock.modal.qty_label')}</label>
                <input className="form-input" type="number" min="1" placeholder="e.g. 10"
                  value={restockForm.qty} onChange={e => setRestockForm(f => ({ ...f, qty: e.target.value }))} />
              </div>
              {!isEntry && (
                <div className="form-group">
                  <label className="form-lbl">{t('inventory.restock.modal.note_label')}</label>
                  <input className="form-input" placeholder={t('inventory.restock.modal.note_placeholder')}
                    value={restockForm.note} onChange={e => setRestockForm(f => ({ ...f, note: e.target.value }))} />
                </div>
              )}
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => setShowRestockModal(false)}>{t('common.cancel')}</button>
                <button className="btn btn-primary" onClick={isEntry ? submitRestockEntry : submitRestockLog}>
                  {t('inventory.restock.modal.submit_btn')}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Restock Success Modal */}
      {restockSuccess && (
        <div className="modal-backdrop" onClick={() => setRestockSuccess(false)}>
          <div className="modal modal-sm inv-success-modal" onClick={e => e.stopPropagation()}>
            <div className="inv-success-emoji">✅</div>
            <div className="inv-success-title">
              Restock <em>Logged</em>
            </div>
            <div className="inv-success-sub">Stock has been updated successfully.</div>
            <button className="btn btn-primary inv-success-btn" onClick={() => setRestockSuccess(false)}>Done</button>
          </div>
        </div>
      )}
    </>
  )
}
