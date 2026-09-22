import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'
import { csvRow, triggerDownload } from '../lib/csv'
import CategorySelectorDropdown from '../components/product/CategorySelectorDropdown'
import RestockGrid from '../components/product/RestockGrid'
import useNotifStore from '../store/notifStore'
import { sortSizeLabels } from '../common/sizechart'
import Loading from '../components/ui/Loading'

const API      = import.meta.env.VITE_API_URL
const IMG_BASE = import.meta.env.VITE_IMG_BASE_URL ?? ''

function loadRestocks(setRestocks) {
  apiFetch(`${API}/boutique/inventory/restocks`)
    .then(r => r.json())
    .then(res => setRestocks(res.data?.restocks ?? []))
    // Without this an unreachable API left the previous list on screen, so a
    // stale restock history looked like the current one.
    .catch(() => setRestocks([]))
}

// Internal grouping sentinel for variants with no colour set. Never displayed —
// rows keyed to it render an empty colour cell — so it must NOT be translated:
// the value is compared by identity when the rows are built.
const NO_COLOUR = '__no_colour__'

// English fallbacks for stockBadge's keys, used only if a key is ever absent.
const BADGE_FALLBACK = {
  not_for_sale: 'Not for sale',
  out_of_stock: 'Out of Stock',
  critical:     'Critical',
  low_stock:    'Low Stock',
  in_stock:     'In Stock',
}

// `hasActive` false means every size of this row is switched off, so the row
// isn't out of stock — it isn't on sale at all. Saying "Out of Stock" there
// would send someone off to restock a size that wouldn't sell anyway.
//
// Returns a key, not a label — this runs outside the component so it has no
// `t`, and hardcoding the label here kept every stock badge in English.
function stockBadge(total, minQty, warn, crit, hasActive = true) {
  if (!hasActive)     return { cls:'out', icon:'block',   key:'not_for_sale' }
  if (total === 0)    return { cls:'out', icon:'error',   key:'out_of_stock' }
  if (minQty <= crit) return { cls:'low', icon:'warning', key:'critical'     }
  if (minQty <= warn) return { cls:'low', icon:'warning', key:'low_stock'    }
  return                     { cls:'in',  icon:null,      key:'in_stock'     }
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
  const [loadFailed,       setLoadFailed]       = useState(false)
  // Guards every stock write. All three submit paths were fire-and-forget, so a
  // double-click sent the same restock or decrease twice.
  const [submitting,       setSubmitting]       = useState(false)

  const [reloadTick, setReloadTick] = useState(0)
  // { l1, l2, l3, l4 } from CategorySelectorDropdown, or null for "no filter".
  const [category,   setCategory]   = useState(null)

  function toast(msg) {
    setSaveToast(msg)
    setTimeout(() => setSaveToast(''), 3000)
  }

  function retryLoad() {
    setLoading(true)
    setLoadFailed(false)
    setReloadTick(n => n + 1)
  }

  // Load inventory, settings and restocks on mount
  useEffect(() => {
    apiFetch(`${API}/boutique/inventory`)
      .then(r => r.json())
      .then(res => {
        // `res.data.stats` threw outright when the payload had no `data`, and
        // nothing checked `success` — an error body became an empty inventory.
        if (res.success === false || !res.data) throw new Error(res.message || 'inventory request failed')
        setApiStats(res.data.stats ?? {})
        setAllProducts(res.data.products ?? [])
        setLoadFailed(false)
      })
      .catch(() => {
        setApiStats({})
        setAllProducts([])
        setLoadFailed(true)
      })
      // `loading` used to be cleared only on success, so any failure left the
      // page spinning on "Loading…" permanently with no way out.
      .finally(() => setLoading(false))

    apiFetch(`${API}/boutique/inventory/settings`)
      .then(r => r.json())
      .then(res => {
        if (!res.success) throw new Error(res.message || 'inventory settings failed')
        setWarnThreshold(res.data.low_stock_warning_threshold  ?? 3)
        setCritThreshold(res.data.low_stock_critical_threshold ?? 1)
        setAutoHide(res.data.auto_hide_out_of_stock            ?? true)
      })
      // Failing silently meant the low/critical stock badges were drawn
      // against default thresholds rather than the boutique's configured ones.
      // i18n.t, not the hook's t: using t here would make it a dependency
      // of this fetch effect and re-run the whole load on every re-render.
      .catch(() => toast(i18n.t('inventory.err_settings', 'Could not load your stock thresholds — showing the defaults.')))

    loadRestocks(setRestocks)
    // `i18n` is only read inside the catch above, to translate a toast at the
    // moment it fires. Listing it as a dependency would be harmless but
    // misleading — the reload is driven by the language VALUE and reloadTick,
    // not by the i18n instance, which never changes identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language, reloadTick])

  // Mark stock notifications as read on mount
  useEffect(() => {
    if (hasMarkedRead.current) return
    if (notifications.length === 0) return
    hasMarkedRead.current = true
    notifications
      .filter(n => !n.read_at && !n.is_read && n.type?.toLowerCase().includes('stock'))
      .forEach(n => {
        apiFetch(`${API}/boutique/notifications/${n.id}/read`, { method:'PUT', body: JSON.stringify({}) })
          .catch(() => {}) // best-effort; a failed read-receipt shouldn't surface
        markRead(n.id)
      })
    // Deliberately runs once, gated by hasMarkedRead. Depending on the full
    // `notifications` array or `markRead` would re-enter on every store update
    // and re-PUT receipts that were already sent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        const key = v.colour ?? NO_COLOUR
        if (!colourMap[key]) colourMap[key] = []
        colourMap[key].push(v)
      })
      Object.entries(colourMap).forEach(([colour, variants]) => {
        // Totals and thresholds only count sizes that are switched on — an
        // inactive size can't be sold, so counting its units overstates what's
        // available and its qty must not drive the low/critical badge.
        const sellable = variants.filter(v => v.is_active !== false)
        const total    = sellable.reduce((s, v) => s + v.stock_qty, 0)
        const minQty   = sellable.length > 0 ? Math.min(...sellable.map(v => v.stock_qty)) : 0
        rows.push({
          rowKey:      `${p.id}::${colour}`,
          productId:   p.id,
          productName: p.name,
          sku:         p.sku,
          img:         imgUrl(p.main_photo),
          colour:      colour === NO_COLOUR ? '' : colour,
          // "Women's / Tops / Blouse" when the API sends it. Same field POS
          // filters on; /boutique/inventory does not return it yet.
          categoryPath: p.category_path ?? p.category ?? '',
          variants,
          total,
          minQty,
          hasActive:   sellable.length > 0,
        })
      })
    })

    rows.sort((a, b) => {
      const nameCmp = a.productName.localeCompare(b.productName)
      return nameCmp !== 0 ? nameCmp : a.colour.localeCompare(b.colour)
    })

    return rows
  }, [allProducts])

  // The dropdown can only filter if the API actually labels each product. Drive
  // the control off the data rather than a hardcoded "coming soon", so it turns
  // itself on the moment /boutique/inventory starts sending category_path.
  const categoryFilterReady = useMemo(
    () => tableRows.some(r => r.categoryPath),
    [tableRows],
  )

  // The selector yields { l1, l2, l3 }; category_path is those joined by " / ".
  // Compare on the selected prefix so picking just a division matches every
  // style beneath it.
  const categoryPrefix = [category?.l1, category?.l2, category?.l3]
    .filter(Boolean)
    .join(' / ')
    .toLowerCase()

  const filteredRows = useMemo(() => {
    return tableRows.filter(row => {
      const matchSearch = row.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          row.sku.toLowerCase().includes(searchQuery.toLowerCase())
      const badge = stockBadge(row.total, row.minQty, warnThreshold, critThreshold, row.hasActive)
      const matchFilter =
        filterStatus === 'all' ? true :
        filterStatus === 'low' ? badge.cls === 'low' :
        filterStatus === 'out' ? badge.cls === 'out' : true
      const matchCategory =
        !categoryPrefix || row.categoryPath.toLowerCase().startsWith(categoryPrefix)
      return matchSearch && matchFilter && matchCategory
    })
  }, [tableRows, searchQuery, filterStatus, warnThreshold, critThreshold, categoryPrefix])

  // Exports what's on screen. It used to export `tableRows`, so filtering to
  // "Out of Stock" and clicking Export silently handed back the whole catalogue.
  // Quoting comes from lib/csv — the old `r.join(',')` corrupted every row after
  // a product name containing a comma.
  function exportCsv() {
    const header = [
      t('inventory.table.product'),
      t('inventory.table.colour', 'Colour'),
      t('inventory.table.sku'),
      t('inventory.table.total'),
    ]
    const body = filteredRows.map(r => [r.productName, r.colour, r.sku, r.total])
    triggerDownload([csvRow(header), ...body.map(csvRow)].join('\n'), 'inventory.csv')
  }

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
    if (!decreaseConfirm || submitting) return
    setSubmitting(true)
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
      // Bailing silently here left the modal open with no explanation, which
      // read as a dead button. Every call has to land, not just the PUT.
      if (results.some(r => r?.success === false)) throw new Error('stock update failed')
      const hadIncreases = decreaseConfirm.pendingIncreases.length > 0
      setDecreaseConfirm(null)
      setRestockSuccess(hadIncreases ? 'restock' : 'decrease')
      refreshInventory()
      if (hadIncreases) loadRestocks(setRestocks)
    })
      .catch(() => {
        toast(t('common.error_generic'))
        // A stock write is several requests, so a failure can be partial: some
        // deltas already applied. Without re-reading, the next Save recomputes
        // deltas from stale quantities and re-posts the ones that succeeded,
        // adding the same restock twice.
        refreshInventory()
      })
      .finally(() => setSubmitting(false))
  }

  // Re-read inventory after a write. Shared by all three submit paths, which
  // had three copies of this with no error handling between them.
  function refreshInventory() {
    apiFetch(`${API}/boutique/inventory`)
      .then(r => r.json())
      .then(res => {
        if (res.success === false || !res.data) throw new Error(res.message || 'inventory refresh failed')
        setAllProducts(res.data.products ?? [])
        setApiStats(res.data.stats ?? {})
      })
      // This re-read is what stops the next Save recomputing deltas from
      // stale quantities and re-posting a restock twice (see the save
      // handler's comment). Swallowing its failure left pre-save numbers on
      // screen as though they were current, with that bug armed again.
      .catch(() => toast(t('inventory.err_refresh', 'Saved, but the figures on screen could not be refreshed. Please reload before editing stock again.')))
  }

  // ── Save All Changes (Stock by Variant table edits) ───────────────────────
  // Increases go through POST /restocks only — that endpoint both bumps
  // stock_qty server-side AND logs the entry, so it must NOT also be sent
  // through the absolute PUT (that would double-apply the increase, same bug
  // as submitRestockGrid originally had). Decreases still go through the
  // absolute PUT, unlogged — the backend rejects negative qty_added. ────────
  function saveChanges() {
    if (submitting) return
    const entries = Object.entries(changes).map(([variant_id, stock_qty]) => ({ variant_id, stock_qty }))
    if (!entries.length) {
      toast(t('inventory.no_changes', 'No changes to save.'))
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

    setSubmitting(true)
    Promise.all(calls).then(results => {
      // Only results[0] (the PUT) used to be inspected, so a rejected restock
      // POST still reported "Changes saved." while the stock hadn't moved.
      if (results.some(r => r?.success === false)) throw new Error('stock update failed')
      // The backend message was rendered raw, so a French boutique saw whatever
      // language the API replied in. The local string is always translated.
      setSaveMsg(t('inventory.changes_saved', 'Changes saved.'))
      setTimeout(() => setSaveMsg(''), 3000)
      setChanges({})
      refreshInventory()
      if (restockIncreases.length) loadRestocks(setRestocks)
    })
      .catch(() => {
        toast(t('common.error_generic'))
        // A stock write is several requests, so a failure can be partial: some
        // deltas already applied. Without re-reading, the next Save recomputes
        // deltas from stale quantities and re-posts the ones that succeeded,
        // adding the same restock twice.
        refreshInventory()
      })
      .finally(() => setSubmitting(false))
  }

  function saveThresholds() {
    if (submitting) return
    if (!Number.isFinite(warnThreshold) || !Number.isFinite(critThreshold) ||
        warnThreshold < 0 || critThreshold < 0) {
      setThresholdMsg(t('inventory.thresholds.error_invalid', 'Please enter valid, non-negative numbers.'))
      setTimeout(() => setThresholdMsg(''), 3000)
      return
    }
    if (warnThreshold < critThreshold) {
      setThresholdMsg(t('inventory.thresholds.error_order', 'Warning threshold must be greater than or equal to the critical threshold.'))
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
        if (res.success === false) throw new Error(res.message || 'settings save failed')
        // Was `res.message` — the raw backend string, untranslated.
        setThresholdMsg(t('inventory.thresholds.saved', 'Thresholds saved.'))
        setTimeout(() => setThresholdMsg(''), 3000)
      })
      // Previously swallowed, so a failed save looked exactly like a successful
      // one that simply showed no message.
      .catch(() => {
        setThresholdMsg(t('common.error_generic'))
        setTimeout(() => setThresholdMsg(''), 3000)
      })
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
          return
        }
        // A rejected save used to leave the switch flipped, so it looked saved
        // until the next reload. Put it back and say so.
        setAutoHide(!next)
        toast(res.message || t('common.error_generic'))
      })
      .catch(() => {
        setAutoHide(!next)
        toast(t('common.error_network'))
      })
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
    if (submitting) return
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
      // Was a hardcoded English literal, while the identical message in
      // saveChanges went through t() — same string, two code paths.
      toast(t('inventory.no_changes', 'No changes to save.'))
      return
    }

    if (decreaseItems.length) {
      setShowRestockModal(false)
      setDecreaseConfirm({ items: decreaseItems, pendingIncreases: restockIncreases })
      return
    }

    setSubmitting(true)
    Promise.all(restockIncreases.map(inc =>
      apiFetch(`${API}/boutique/inventory/restocks`, {
        method: 'POST',
        body: JSON.stringify(inc)
      }).then(r => r.json())
    )).then(results => {
      // Nothing was checked here at all — the ✅ success modal appeared even
      // when every POST had failed and no stock had moved.
      if (results.some(r => r?.success === false)) throw new Error('restock failed')
      setShowRestockModal(false)
      setRestockSuccess('restock')
      refreshInventory()
      loadRestocks(setRestocks)
    })
      .catch(() => {
        toast(t('common.error_generic'))
        // A stock write is several requests, so a failure can be partial: some
        // deltas already applied. Without re-reading, the next Save recomputes
        // deltas from stale quantities and re-posts the ones that succeeded,
        // adding the same restock twice.
        refreshInventory()
      })
      .finally(() => setSubmitting(false))
  }

  /* Page-level wait, like Subscription: this tab is driven by one fetch, so
     until it lands there is nothing truthful to draw. Safe as an early return
     because every hook in this component is declared above it. */
  if (loading) return <Loading page />

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
          <button className="btn btn-outline" onClick={exportCsv}>
            <span className="material-symbols-outlined">download</span>{t('inventory.export_btn')}
          </button>
          <button ref={saveBtnRef} className="btn btn-primary" onClick={saveChanges} disabled={submitting}>
            <span className="material-symbols-outlined">save</span>{t('inventory.save_btn')}
          </button>
        </div>
      </div>

      {saveMsg && <div className="alert alert-info inv-save-msg">{saveMsg}</div>}

      {/* Stats */}
      <div className="inv-grid">
        {[
          { cls:'ok',       lbl: t('inventory.stats.total_units'),  val: apiStats.total_units ?? '—',           sub: '' },
          // The old copy hardcoded "(≤ 2 units)", so the card below could be set
          // to 6 and this line still said 2. Read the live threshold instead.
          { cls:'warn',     lbl: t('inventory.stats.low_stock'),    val: apiStats.low_stock_products ?? '—',    sub: t('inventory.stats.low_stock_sub_n', 'Below threshold (≤ {{n}} units)', { n: warnThreshold }) },
          { cls:'critical', lbl: t('inventory.stats.out_of_stock'), val: apiStats.out_of_stock_variants ?? '—', sub: t('inventory.stats.out_of_stock_sub') },
          { cls:'ok',       lbl: t('inventory.stats.avg_stock'),    val: apiStats.avg_stock_per_variant ?? '—', sub: t('inventory.stats.avg_stock_sub') },
        ].map((s, i) => (
          // Keyed by position, not by the translated label — two labels can
          // collide once a locale renders them the same.
          <div key={i} className={`inv-stat ${s.cls}`}>
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

        {/* The filter itself is wired; whether it can run depends on the API
            labelling each product. /boutique/inventory returns only
            id/name/sku/status/photo/variants today, so `categoryFilterReady` is
            false and the control stays inert — but it activates by itself the
            moment category_path starts arriving, with no further change here. */}
        <div className="inv-cat-selector">
          <div className="inv-cat-selector-lbl">
            <span className="material-symbols-outlined">category</span>
            {t('inventory.filter_category', 'Filter by category')}
            {!categoryFilterReady && (
              <>{' '}<span className="inv-cat-soon">({t('common.coming_soon', 'coming soon')})</span></>
            )}
            {categoryFilterReady && categoryPrefix && (
              <>
                {' '}
                <button className="btn btn-sm btn-outline inv-cat-clear" onClick={() => setCategory(null)}>
                  {t('inventory.clear_category', 'Clear')}
                </button>
              </>
            )}
          </div>
          <div className={categoryFilterReady ? undefined : 'inv-cat-selector-off'}
               aria-disabled={categoryFilterReady ? undefined : 'true'}>
            <CategorySelectorDropdown onChange={categoryFilterReady ? setCategory : undefined} />
          </div>
        </div>

        {/* The loading arm is gone: the page-level spinner above means this is
            only reached once the fetch has settled. */}
        {loadFailed ? (
          <div className="inv-cat-prompt">
            <span className="material-symbols-outlined">cloud_off</span>
            <div>{t('common.error_generic')}</div>
            <button className="btn btn-outline btn-sm" onClick={retryLoad}>{t('common.refresh')}</button>
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
                  const badge = stockBadge(row.total, row.minQty, warnThreshold, critThreshold, row.hasActive)
                  return (
                    <tr key={row.rowKey} className={row.total === 0 ? 'row-out' : ''}>
                      <td style={{ position:'sticky', left:0, background:'var(--card)', zIndex:1 }}>
                        <div className="inv-product-cell">
                          {/* A product with no photo produced url('null') here,
                              and the class sets no background colour, so the
                              cell was an invisible gap rather than an empty
                              thumbnail — the name looked misaligned against the
                              rows around it. */}
                          <div
                            className="inv-product-img"
                            style={row.img
                              ? { backgroundImage: `url('${row.img}')` }
                              : { background: 'var(--mist)' }}
                          />
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
                        const inactive = cell.is_active === false
                        // A switched-off size gets no low/critical colouring — it
                        // isn't on sale, so the warning would be noise. Stock stays
                        // editable so it can be restocked before being switched on.
                        const cls = inactive
                          ? ''
                          : cell.stock_qty === 0 ? 'zero' : cell.stock_qty <= critThreshold ? 'crit' : cell.stock_qty <= warnThreshold ? 'warn' : ''
                        return (
                          <td key={size} style={{ textAlign:'center' }}>
                            <input
                              key={`${cell.id}-${cell.stock_qty}`}
                              className={`inv-qty-input${cls ? ' ' + cls : ''}${inactive ? ' inv-qty-inactive' : ''}`}
                              defaultValue={cell.stock_qty}
                              onChange={e => QtyChange(cell.id, e.target.value)}
                              onBlur={e => QtyBlur(e, row, cell)}
                            />
                            {inactive && (
                              <div className="inv-cell-inactive">
                                {t('inventory.table.inactive', 'Off')}
                              </div>
                            )}
                          </td>
                        )
                      })}
                      <td className="inv-total" style={{ textAlign:'center' }}>{row.total}</td>
                      <td>
                        <span className={`stock-badge ${badge.cls}`}>
                          {badge.icon && <span className="material-symbols-outlined inv-badge-icon">{badge.icon}</span>}
                          {t(`inventory.badge.${badge.key}`, BADGE_FALLBACK[badge.key])}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={allSizeCols.length + 4} className="inv-empty-row">
                      {t('inventory.empty')}
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
          <button className="btn btn-primary btn-sm inv-threshold-save" onClick={saveThresholds} disabled={submitting}>
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
                  <td>{new Date(r.created_at).toLocaleDateString(i18n.language, { day:'2-digit', month:'short', year:'numeric' })}</td>
                  <td>{r.added_by}</td>
                </tr>
              ))}
              {restocks.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty">
                    {t('inventory.restock.empty', 'No restock entries yet.')}
                  </td>
                </tr>
              )}
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
                  {t('inventory.restock.modal.title_add', 'Add Restock')} <em>{t('inventory.restock.modal.title_add_em', 'Entry')}</em>
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
                <button className="btn btn-primary" disabled={!restockGrid.productId || submitting} onClick={submitRestockGrid}>{t('inventory.restock.modal.submit_add', 'Add Restock')}</button>
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
              {restockSuccess === 'decrease'
                ? <>{t('inventory.stock_updated.title', 'Stock')} <em>{t('inventory.stock_updated.title_em', 'Updated')}</em></>
                : <>{t('inventory.restock_success.title')} <em>{t('inventory.restock_success.title_em')}</em></>}
            </div>
            <div className="inv-success-sub">{t('inventory.restock_success.message')}</div>
            <button className="btn btn-primary inv-success-btn" onClick={() => setRestockSuccess(null)}>{t('inventory.restock_success.done')}</button>
          </div>
        </div>
      )}

      {/* Decrease Confirmation Modal */}
      {decreaseConfirm && (
        <div className="modal-backdrop" onClick={() => setDecreaseConfirm(null)}>
          <div className="modal modal-sm inv-success-modal" onClick={e => e.stopPropagation()}>
            <div className="inv-success-emoji">⚠️</div>
            <div className="inv-success-title">
              {t('inventory.decrease_confirm.title', 'Confirm Stock')} <em>{t('inventory.decrease_confirm.title_em', 'Decrease')}</em>
            </div>
            <div className="inv-success-sub">
              {decreaseConfirm.items.map(i => (
                <div key={i.variantId}>
                  {t('inventory.decrease_confirm.line', '{{product}} — {{variant}}: {{from}} → {{to}} units.', { product: i.productName, variant: i.variantLabel, from: i.oldQty, to: i.newQty })}
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDecreaseConfirm(null)}>{t('common.cancel')}</button>
              <button className="btn btn-primary" disabled={submitting} onClick={submitDecreaseConfirm}>{t('inventory.decrease_confirm.proceed', 'Yes, Proceed')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
