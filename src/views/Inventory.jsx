import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'
import CategorySelectorDropdown from '../components/product/CategorySelectorDropdown'
import RestockGrid from '../components/product/RestockGrid'
import useNotifStore from '../store/notifStore'
import { sortSizeLabels } from '../common/sizechart'

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
  const { t, i18n } = useTranslation()

  const notifications = useNotifStore(s => s.notifications)
  const markRead      = useNotifStore(s => s.markRead)
  const hasMarkedRead = useRef(false)
  const saveBtnRef     = useRef(null)

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
  const [restockGrid,      setRestockGrid]      = useState({ productId:'', cells:{} })
  const [restockSuccess,   setRestockSuccess]   = useState(null) // null | 'restock' | 'decrease'
  const [decreaseConfirm,  setDecreaseConfirm]  = useState(null) // null | { items:[...], pendingIncreases:[...] }
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
  }, [i18n.language])

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
    return sortSizeLabels(cols)
  }, [allProducts])

  // Row order is sorted by a fixed key (product name, then colour) instead of
  // whatever order the backend happens to return — the backend's order isn't
  // guaranteed stable, so without this, rows shuffle every time stock changes.
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
          rowKey:      `${p.id}::${colour}`,
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

    rows.sort((a, b) => {
      const nameCmp = a.productName.localeCompare(b.productName)
      return nameCmp !== 0 ? nameCmp : a.colour.localeCompare(b.colour)
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
        filterStatus === 'low' ? badge.cls === 'low' :
        filterStatus === 'out' ? badge.cls === 'out' : true
      return matchSearch && matchFilter
    })
  }, [tableRows, searchQuery, filterStatus, warnThreshold, critThreshold])

  function getCell(row, sizeLabel) {
    return row.variants.find(v => v.size_label === sizeLabel) ?? null
  }

  function findVariant(variantId) {
    for (const p of allProducts) {
      const v = p.variants?.find(v => v.id === variantId)
      if (v) return v
    }
    return null
  }

  function QtyChange(variantId, qty) {
    setChanges(prev => ({ ...prev, [variantId]: Number(qty) }))
  }

  function QtyBlur(e, row, cell) {
    if (e.relatedTarget && e.relatedTarget === saveBtnRef.current) return
    const typed = Number(e.target.value)
    if (!Number.isFinite(typed) || typed === cell.stock_qty) return
    const delta = typed - cell.stock_qty

    setChanges(prev => {
      const next = { ...prev }
      delete next[cell.id]
      return next
    })
    e.target.value = cell.stock_qty

    if (delta > 0) {
      openRestockGridForVariant(row.productId, cell.id, typed)
    } else {
      setDecreaseConfirm({
        items: [{
          variantId:   cell.id,
          productName: row.productName,
          variantLabel: `${cell.size_label}${cell.colour ? ` · ${cell.colour}` : ''}`,
          oldQty: cell.stock_qty,
          newQty: typed,
        }],
        pendingIncreases: [],
      })
    }
  }

  // ── Confirm decrease: /restocks rejects negative qty_added (400), so decreases
  // only ever go through the absolute PUT (no history row). Any increases staged
  // alongside them (from a mixed grid submit) are sent together as POST /restocks
  // so both halves of one "Add Restock" click apply atomically. ─────────────────
  function submitDecreaseConfirm() {
    if (!decreaseConfirm) return
    const calls = [
      apiFetch(`${API}/boutique/inventory`, {
        method: 'PUT',
        body: JSON.stringify({ updates: decreaseConfirm.items.map(i => ({ variant_id: i.variantId, stock_qty: i.newQty })) })
      }).then(r => r.json()),
      ...decreaseConfirm.pendingIncreases.map(inc =>
        apiFetch(`${API}/boutique/inventory/restocks`, {
          method: 'POST',
          body: JSON.stringify(inc)
        }).then(r => r.json())
      ),
    ]
    Promise.all(calls).then(results => {
      if (!results[0]?.success) return
      const hadIncreases = decreaseConfirm.pendingIncreases.length > 0
      setDecreaseConfirm(null)
      setRestockSuccess(hadIncreases ? 'restock' : 'decrease')
      apiFetch(`${API}/boutique/inventory`)
        .then(r => r.json())
        .then(res2 => {
          setAllProducts(res2.data.products ?? [])
          setApiStats(res2.data.stats ?? {})
        })
      if (hadIncreases) loadRestocks(setRestocks)
    })
  }

  // ── Save All Changes (Stock by Variant table edits) ───────────────────────
  // Increases go through POST /restocks only — that endpoint both bumps
  // stock_qty server-side AND logs the entry, so it must NOT also be sent
  // through the absolute PUT (that would double-apply the increase, same bug
  // as submitRestockGrid originally had). Decreases still go through the
  // absolute PUT, unlogged — the backend rejects negative qty_added. ────────
  function saveChanges() {
    const entries = Object.entries(changes).map(([variant_id, stock_qty]) => ({ variant_id, stock_qty }))
    if (!entries.length) {
      setSaveToast('No changes to save.')
      setTimeout(() => setSaveToast(''), 3000)
      return
    }

    const absoluteUpdates = []
    const restockIncreases = []
    entries.forEach(u => {
      const variant = findVariant(u.variant_id)
      const delta = variant ? u.stock_qty - variant.stock_qty : 0
      if (delta > 0) restockIncreases.push({ variant_id: u.variant_id, qty_added: delta })
      else absoluteUpdates.push(u)
    })

    const calls = []
    if (absoluteUpdates.length) {
      calls.push(apiFetch(`${API}/boutique/inventory`, {
        method: 'PUT',
        body: JSON.stringify({ updates: absoluteUpdates })
      }).then(r => r.json()))
    }
    restockIncreases.forEach(inc => {
      calls.push(apiFetch(`${API}/boutique/inventory/restocks`, {
        method: 'POST',
        body: JSON.stringify(inc)
      }).then(r => r.json()))
    })

    Promise.all(calls).then(results => {
      const putResult = absoluteUpdates.length ? results[0] : null
      setSaveMsg(putResult?.message || 'Changes saved.')
      setTimeout(() => setSaveMsg(''), 3000)
      setChanges({})
      apiFetch(`${API}/boutique/inventory`)
        .then(r => r.json())
        .then(res2 => {
          setAllProducts(res2.data.products ?? [])
          setApiStats(res2.data.stats ?? {})
        })
      if (restockIncreases.length) loadRestocks(setRestocks)
    })
  }

  function saveThresholds() {
    if (!Number.isFinite(warnThreshold) || !Number.isFinite(critThreshold) ||
        warnThreshold < 0 || critThreshold < 0) {
      setThresholdMsg('Please enter valid, non-negative numbers.')
      setTimeout(() => setThresholdMsg(''), 3000)
      return
    }
    if (warnThreshold < critThreshold) {
      setThresholdMsg('Warning threshold must be greater than or equal to the critical threshold.')
      setTimeout(() => setThresholdMsg(''), 3000)
      return
    }
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

  // Only the auto-hide flag is sent here, so only it should be applied back —
  // syncing warn/crit from this response would clobber unsaved edits sitting
  // in those inputs if the user hasn't clicked "Save" yet.
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
          setAutoHide(res.data.auto_hide_out_of_stock ?? next)
        }
      })
      .catch(() => setAutoHide(!next))
  }

  // ── Restock modal openers ─────────────────────────────────────────────────
  function buildRestockCells(product) {
    return Object.fromEntries((product?.variants ?? []).map(v => [v.id, v.stock_qty]))
  }

  function openRestockEntry() {
    setRestockGrid({ productId:'', cells:{} })
    setShowRestockModal(true)
  }

  function selectRestockProduct(productId) {
    const product = allProducts.find(p => p.id === productId)
    setRestockGrid({ productId, cells: buildRestockCells(product) })
  }

  function openRestockGridForVariant(productId, variantId, typedValue) {
    const product = allProducts.find(p => p.id === productId)
    setRestockGrid({ productId, cells: { ...buildRestockCells(product), [variantId]: typedValue } })
    setShowRestockModal(true)
  }

  function updateRestockCell(variantId, value) {
    setRestockGrid(g => ({ ...g, cells: { ...g.cells, [variantId]: value } }))
  }

  // ── Add Restock: increases go through POST /restocks only (logs the entry
  // AND increments stock_qty server-side — do NOT also PUT the total, that
  // double-applies the increment). Decreases require confirmation first, same
  // as the inline table's decrease flow — see submitDecreaseConfirm. ────────
  function submitRestockGrid() {
    const product = allProducts.find(p => p.id === restockGrid.productId)
    if (!product) return

    const restockIncreases = []
    const decreaseItems = []
    ;(product.variants ?? []).forEach(v => {
      const typed = Number(restockGrid.cells[v.id])
      if (!Number.isFinite(typed)) return
      const delta = typed - v.stock_qty
      if (delta > 0) {
        restockIncreases.push({ variant_id: v.id, qty_added: delta })
      } else if (delta < 0) {
        decreaseItems.push({
          variantId:   v.id,
          productName: product.name,
          variantLabel: `${v.size_label}${v.colour ? ` · ${v.colour}` : ''}`,
          oldQty: v.stock_qty,
          newQty: typed,
        })
      }
    })

    if (!restockIncreases.length && !decreaseItems.length) {
      setSaveToast('No changes to save.')
      setTimeout(() => setSaveToast(''), 3000)
      return
    }

    if (decreaseItems.length) {
      setShowRestockModal(false)
      setDecreaseConfirm({ items: decreaseItems, pendingIncreases: restockIncreases })
      return
    }

    Promise.all(restockIncreases.map(inc =>
      apiFetch(`${API}/boutique/inventory/restocks`, {
        method: 'POST',
        body: JSON.stringify(inc)
      }).then(r => r.json())
    )).then(() => {
      setShowRestockModal(false)
      setRestockSuccess('restock')
      apiFetch(`${API}/boutique/inventory`)
        .then(r => r.json())
        .then(res2 => {
          setAllProducts(res2.data.products ?? [])
          setApiStats(res2.data.stats ?? {})
        })
      loadRestocks(setRestocks)
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
          <button ref={saveBtnRef} className="btn btn-primary" onClick={saveChanges}>
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
                {filteredRows.map((row) => {
                  const badge = stockBadge(row.total, warnThreshold, critThreshold)
                  return (
                    <tr key={row.rowKey} className={row.total === 0 ? 'row-out' : ''}>
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
                              key={`${cell.id}-${cell.stock_qty}`}
                              className={`inv-qty-input${cls ? ' ' + cls : ''}`}
                              defaultValue={cell.stock_qty}
                              onChange={e => QtyChange(cell.id, e.target.value)}
                              onBlur={e => QtyBlur(e, row, cell)}
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
            <input type="number" min="0" className="inv-qty-input inv-threshold-input" value={warnThreshold} onChange={e => setWarnThreshold(Number(e.target.value))} />
            <span className="inv-units-lbl">{t('inventory.thresholds.units')}</span>
          </div>

          <div className="threshold-row inv-threshold-mb">
            <div className="threshold-icon critical"><span className="material-symbols-outlined">priority_high</span></div>
            <div className="inv-threshold-body">
              <div className="inv-threshold-title">{t('inventory.thresholds.crit_title')}</div>
              <div className="inv-threshold-sub">{t('inventory.thresholds.crit_sub')}</div>
            </div>
            <input type="number" min="0" className="inv-qty-input inv-threshold-input" value={critThreshold} onChange={e => setCritThreshold(Number(e.target.value))} />
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
                  <td className={`inv-restock-qty${r.qty_added < 0 ? ' neg' : ''}`}>{r.qty_added > 0 ? '+' : ''}{r.qty_added}</td>
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
        const selectedProduct = allProducts.find(p => p.id === restockGrid.productId)
        return (
          <div className="modal-backdrop" onClick={() => setShowRestockModal(false)}>
            <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
              <div className="modal-hdr">
                <span className="modal-title">
                  Add Restock <em>Entry</em>
                </span>
                <span className="modal-close" onClick={() => setShowRestockModal(false)}>
                  <span className="material-symbols-outlined">close</span>
                </span>
              </div>
              <div className="form-group">
                <label className="form-lbl">{t('inventory.restock.modal.product_label')}</label>
                <select className="form-select" value={restockGrid.productId}
                  onChange={e => selectRestockProduct(e.target.value)}>
                  <option value="">{t('inventory.restock.modal.product_placeholder')}</option>
                  {allProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {selectedProduct && (
                <div style={{ overflowX:'auto' }}>
                  <RestockGrid
                    variants={selectedProduct.variants ?? []}
                    values={restockGrid.cells}
                    onChange={updateRestockCell}
                    warnThreshold={warnThreshold}
                  />
                </div>
              )}
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => setShowRestockModal(false)}>{t('common.cancel')}</button>
                <button className="btn btn-primary" disabled={!restockGrid.productId} onClick={submitRestockGrid}>
                  Add Restock
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Restock Success Modal */}
      {restockSuccess && (
        <div className="modal-backdrop" onClick={() => setRestockSuccess(null)}>
          <div className="modal modal-sm inv-success-modal" onClick={e => e.stopPropagation()}>
            <div className="inv-success-emoji">✅</div>
            <div className="inv-success-title">
              {restockSuccess === 'decrease' ? <>Stock <em>Updated</em></> : <>Restock <em>Logged</em></>}
            </div>
            <div className="inv-success-sub">Stock has been updated successfully.</div>
            <button className="btn btn-primary inv-success-btn" onClick={() => setRestockSuccess(null)}>Done</button>
          </div>
        </div>
      )}

      {/* Decrease Confirmation Modal */}
      {decreaseConfirm && (
        <div className="modal-backdrop" onClick={() => setDecreaseConfirm(null)}>
          <div className="modal modal-sm inv-success-modal" onClick={e => e.stopPropagation()}>
            <div className="inv-success-emoji">⚠️</div>
            <div className="inv-success-title">
              Confirm Stock <em>Decrease</em>
            </div>
            <div className="inv-success-sub">
              {decreaseConfirm.items.map(i => (
                <div key={i.variantId}>
                  {i.productName} — {i.variantLabel}: {i.oldQty} → {i.newQty} units.
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDecreaseConfirm(null)}>{t('common.cancel')}</button>
              <button className="btn btn-primary" onClick={submitDecreaseConfirm}>Yes, Proceed</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
