import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'
import { activeLocale } from '../lib/dateHelpers'
import Loading from '../components/ui/Loading'
import Toast, { useToast } from '../components/ui/Toast'
import { imgUrl } from '../lib/imageUrl'
import Toggle from '../components/ui/Toggle'

const API      = import.meta.env.VITE_API_URL

// Page size the products endpoint is asked for. The response says how many
// pages there are (data.pagination.total_pages) and every page is loaded, so
// this only sets how many requests that takes — not how many products show.
const PAGE_SIZE = 20

const FILTERS = ['all', 'on', 'off']

export default function Showroom() {
  const { t, i18n } = useTranslation()
  const { toasts, show: showToast } = useToast()

  const [settings, setSettings]             = useState({
    wholesale_default_discount_pct: 30,
    wholesale_min_order_value: 500,
    wholesale_auto_push_enabled: false,
    showroom_active: true,
    wholesale_deposit_pct: 50,
  })
  // What the backend last confirmed. The pause switch saves on its own, and
  // sends this plus the one change — not the form, which may hold edits the
  // merchant has not saved yet.
  const [savedSettings, setSavedSettings]   = useState(null)
  const [pauseBusy, setPauseBusy]           = useState(false)
  const [slug, setSlug]                     = useState('')
  const [stats, setStats]                   = useState({ products_on_showroom: 0, total_products: 0 })
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsSaved, setSettingsSaved]   = useState(false)
  const [products, setProducts]             = useState([])
  const [productsTotal, setProductsTotal]   = useState(0)
  const [loading, setLoading]               = useState(true)

  // Search and the On/Off filter work on the loaded list — every page is
  // fetched, so there is nothing server-side left to ask for.
  const [search, setSearch]                 = useState('')
  const [filter, setFilter]                 = useState('all')
  const [selected, setSelected]             = useState(new Set())
  const [bulkBusy, setBulkBusy]             = useState(false)
  // Inline MOQ edit: one row at a time. The wholesale price is not editable
  // here (that topic is parked with sir) — it is sent back unchanged.
  const [moqEditId, setMoqEditId]           = useState(null)
  const [moqDraft, setMoqDraft]             = useState('')
  const [moqSaving, setMoqSaving]           = useState(false)

  // ── commented out — edit wholesale/MOQ inline (needs the discount-vs-price
  //    answer from the backend; see Phase 2) ──
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
          if (res.data.settings) { setSettings(res.data.settings); setSavedSettings(res.data.settings) }
          setSlug(res.data.slug ?? '')
          setStats(res.data.stats ?? { products_on_showroom: 0, total_products: 0 })
          setSettingsFailed(false)
        } else setSettingsFailed(true)
      })
      .catch(() => setSettingsFailed(true))
  }, [])

  // Only page 1 used to be requested, so a boutique with 39 products saw 20
  // and could never list the other 19. Read the page count from the first
  // response and fetch the rest alongside each other.
  useEffect(() => {
    let cancelled = false
    const page = n => apiFetch(`${API}/boutique/showroom/products?page=${n}&limit=${PAGE_SIZE}`).then(r => r.json())

    page(1)
      .then(async res => {
        if (!res?.success || !res.data) throw new Error(res?.message || 'showroom products request failed')
        const first = res.data.products ?? []
        const pages = Number(res.data.pagination?.total_pages) || 1
        const total = Number(res.data.pagination?.total ?? first.length)

        let all = first
        if (pages > 1) {
          const rest = await Promise.all(
            Array.from({ length: pages - 1 }, (_, i) =>
              page(i + 2).then(p => p.data?.products ?? []).catch(() => []))
          )
          all = first.concat(...rest)
        }
        if (cancelled) return
        setProducts(all)
        setProductsTotal(total)
        setProductsFailed(false)
      })
      .catch(() => { if (!cancelled) setProductsFailed(true) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [i18n.language])

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
          if (res.data) { setSettings(res.data); setSavedSettings(res.data) }
          else setSavedSettings(settings)
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

  // Pause / resume. Saved straight away, as in the design: paused means
  // buyers cannot see the boutique or place new orders; product toggles are
  // left alone, so resuming brings back exactly the same selection.
  function togglePause() {
    if (!savedSettings || pauseBusy) return
    const next = !(savedSettings.showroom_active ?? true)
    setPauseBusy(true)
    apiFetch(`${API}/boutique/showroom/settings`, {
      method: 'PUT',
      body: JSON.stringify({ ...savedSettings, showroom_active: next }),
    })
      .then(r => r.json())
      .then(res => {
        if (!res?.success) { showToast(res?.message || t('showroom.banner.err_pause'), 'error'); return }
        const now = res.data?.showroom_active ?? next
        setSavedSettings(prev => ({ ...(res.data ?? prev), showroom_active: now }))
        setSettings(prev => ({ ...prev, showroom_active: now }))
        showToast(now ? t('showroom.banner.resumed') : t('showroom.banner.paused_toast'), 'success')
      })
      .catch(() => showToast(t('common.error_network'), 'error'))
      .finally(() => setPauseBusy(false))
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
  //       setEditingId(null)
  //     }
  //   })
  // }
  // ── end commented out ──

  // One product's listing. The current wholesale price and MOQ ride along
  // because this is a PUT — leaving them out could clear them. Resolves to
  // true/false rather than throwing, so the bulk path can count failures.
  function startMoqEdit(p) {
    setMoqEditId(p.id)
    setMoqDraft(p.wholesale_min_qty != null ? String(p.wholesale_min_qty) : '')
  }

  // Empty = no minimum (null). Anything else must be a whole number of 1 or
  // more; the buyer side refuses orders below it (422).
  function saveMoq(p) {
    const raw = moqDraft.trim()
    const qty = raw === '' ? null : Number(raw)
    if (qty !== null && (!Number.isInteger(qty) || qty < 1)) {
      showToast(t('showroom.moq.invalid'), 'error')
      return
    }
    if (qty === (p.wholesale_min_qty ?? null)) { setMoqEditId(null); return }
    setMoqSaving(true)
    apiFetch(`${API}/boutique/showroom/products/${p.id}`, {
      method: 'PUT',
      body: JSON.stringify({ showroom_enabled: !!p.showroom_enabled, wholesale_price: p.wholesale_price, wholesale_min_qty: qty }),
    })
      .then(r => r.json())
      .then(res => {
        if (!res?.success) { showToast(res?.message || t('showroom.moq.err_save'), 'error'); return }
        const saved = res.data?.wholesale_min_qty !== undefined ? res.data.wholesale_min_qty : qty
        setProducts(prev => prev.map(q => q.id === p.id ? { ...q, wholesale_min_qty: saved } : q))
        setMoqEditId(null)
      })
      .catch(() => showToast(t('common.error_network'), 'error'))
      .finally(() => setMoqSaving(false))
  }

  function putShowroom(p, enabled) {
    return apiFetch(`${API}/boutique/showroom/products/${p.id}`, {
      method: 'PUT',
      body: JSON.stringify({ showroom_enabled: enabled, wholesale_price: p.wholesale_price, wholesale_min_qty: p.wholesale_min_qty }),
    })
      .then(r => r.json())
      .then(res => {
        if (!res?.success) return false
        const now = res.data?.showroom_enabled ?? enabled
        setProducts(prev => prev.map(q => q.id === p.id ? { ...q, showroom_enabled: now } : q))
        return true
      })
      .catch(() => false)
  }

  // Listing a product for wholesale buyers is a publishing action, so a
  // failure that leaves the toggle sitting still and says nothing is the worst
  // outcome — the merchant reads the unmoved switch as "already off".
  function toggleShowroom(p) {
    putShowroom(p, !p.showroom_enabled).then(ok => {
      if (!ok) showToast(t('showroom.err_toggle'), 'error')
    })
  }

  // Each product is its own request, so they can fail independently — only the
  // ones that failed stay selected, and the toast says how many. Products
  // already in the requested state are skipped.
  function bulkSet(enabled) {
    const targets = products.filter(p => selected.has(p.id) && !!p.showroom_enabled !== enabled)
    if (!targets.length) { setSelected(new Set()); return }
    setBulkBusy(true)
    Promise.all(targets.map(p => putShowroom(p, enabled).then(ok => ({ id: p.id, ok }))))
      .then(results => {
        const failed = results.filter(r => !r.ok)
        setSelected(new Set(failed.map(r => r.id)))
        if (failed.length) {
          showToast(t('showroom.bulk.partial', {
            failed: failed.length, total: targets.length
          }), 'error')
        }
      })
      .finally(() => setBulkBusy(false))
  }

  // toFixed(2) always writes "1234.50" — it has no idea about locale — so
  // every wholesale price stayed in English form on an Italian page. "(auto)"
  // was a bare English literal too.
  const money = (n) =>
    `€${Number(n).toLocaleString(activeLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true })}`

  // A change of 0 is no change: neutral colour and no arrow. It used to read
  // "↑ 0%" in green, which on a new Showroom suggests growth that isn't there.
  const trend = n => (Number(n) > 0 ? 'up' : Number(n) < 0 ? 'dn' : 'nu')
  const arrow = n => (Number(n) > 0 ? '↑' : Number(n) < 0 ? '↓' : '')

  const defaultPct = Number(settings.wholesale_default_discount_pct) || 0

  function fmtWholesale(p) {
    if (p.wholesale_price) return money(p.wholesale_price)
    if (p.retail_price && defaultPct) {
      const calc = parseFloat(p.retail_price) * (1 - defaultPct / 100)
      return `${money(calc)} ${t('showroom.table.auto')}`
    }
    return '—'
  }

  // The discount a buyer actually gets. A product with its own wholesale price
  // shows the % that price works out to against retail; one without uses the
  // boutique default, labelled as such.
  function fmtDiscount(p) {
    const retail = parseFloat(p.retail_price)
    if (p.wholesale_price && retail > 0) {
      return `${Math.round((1 - parseFloat(p.wholesale_price) / retail) * 100)}%`
    }
    if (!retail) return '—'
    return `${defaultPct}% ${t('showroom.table.default')}`
  }

  /* Page-level wait, like Subscription: this tab is driven by one fetch, so
     until it lands there is nothing truthful to draw. Safe as an early return
     because every hook in this component is declared above it. */
  if (loading) return <Loading page />

  // Counts come from the loaded list so they move as products are toggled. The
  // settings endpoint's stats are a snapshot from page load and are only the
  // fallback for when the product list did not load.
  const onCount  = products.filter(p => p.showroom_enabled).length
  const counts   = { all: products.length, on: onCount, off: products.length - onCount }
  const loadedAll = !productsFailed && products.length >= productsTotal
  const isActive  = (savedSettings ?? settings).showroom_active !== false
  const hasOnShow = (loadedAll ? onCount : Number(stats.products_on_showroom)) > 0
  const isLive    = isActive && hasOnShow
  // live · paused · not live (switched on, but no products on Showroom)
  const banner = !isActive ? 'paused' : hasOnShow ? 'live' : 'not_live'
  const q = search.trim().toLowerCase()
  const visible = products.filter(p =>
    (filter === 'all' || (filter === 'on') === !!p.showroom_enabled) &&
    (!q || p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)))
  const allSelected = visible.length > 0 && visible.every(p => selected.has(p.id))

  function toggleAll() {
    setSelected(prev => {
      const next = new Set(prev)
      visible.forEach(p => allSelected ? next.delete(p.id) : next.add(p.id))
      return next
    })
  }
  function toggleRow(id) {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  const filterLabel = {
    all: t('showroom.filter.all'),
    on:  t('showroom.filter.on'),
    off: t('showroom.filter.off'),
  }

  return (
    <>
      {settingsFailed && (
        <div className="shw-error">{t('showroom.err_settings')}</div>
      )}

      {/* Status banner, as in the Showroom design. Three states: live, paused
          (showroom_active false — hidden from buyers), and not live (switched
          on but no product on Showroom). The switch is the pause control. */}
      <div className={`shw-banner ${banner}`}>
        <div className="shw-banner-icon"><span className="material-symbols-outlined">storefront</span></div>
        <div className="shw-banner-text">
          <div className="shw-banner-title">{t(`showroom.banner.${banner}`)}</div>
          <div className="shw-banner-sub">{t(`showroom.banner.${banner}_sub`)}</div>
          <div className="shw-banner-url">
            <span className="material-symbols-outlined">link</span>showroom.miitalia.com/{slug || '…'}
          </div>
        </div>
        <div className="shw-banner-right">
          <div className="shw-banner-status">
            <span className={`shw-banner-dot${isLive ? ' on' : ''}`} />
            {!isActive ? t('showroom.banner.status_paused') : isLive ? t('showroom.banner.active') : t('showroom.banner.inactive')}
          </div>
          <Toggle on={isActive} onToggle={togglePause} disabled={!savedSettings || pauseBusy} />
        </div>
      </div>

      {/* Stats */}
      <div className="stat-row col3">
        <div className="stat-card">
          <div className="stat-lbl">{t('showroom.stats.products')}</div>
          <div className="stat-val">{loadedAll ? onCount : stats.products_on_showroom}</div>
          <div className="stat-change nu">{t('showroom.stats.of')} {loadedAll ? products.length : stats.total_products} {t('showroom.stats.total')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">{t('showroom.stats.orders')}</div>
          <div className="stat-val">{stats.wholesale_orders_mtd ?? '—'}</div>
          {stats.wholesale_orders_change != null ? (
            <div className={`stat-change ${trend(stats.wholesale_orders_change)}`}>
              {arrow(stats.wholesale_orders_change)} {Math.abs(stats.wholesale_orders_change)} {t('showroom.stats.this_month')}
            </div>
          ) : (
            <div className="stat-change nu">{t('showroom.stats.not_tracked')}</div>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-lbl">{t('showroom.stats.revenue')}</div>
          <div className="stat-val">
            {stats.wholesale_revenue_mtd != null ? money(stats.wholesale_revenue_mtd) : '—'}
          </div>
          {stats.wholesale_revenue_change_pct != null ? (
            <div className={`stat-change ${trend(stats.wholesale_revenue_change_pct)}`}>
              {arrow(stats.wholesale_revenue_change_pct)} {Math.abs(stats.wholesale_revenue_change_pct)}%
            </div>
          ) : (
            <div className="stat-change nu">{t('showroom.stats.not_tracked')}</div>
          )}
        </div>
      </div>

      {/* Settings card — full width above the products, as in the Showroom
          design; the products table needs the whole row for its columns. */}
      <div className="card">
        <div className="card-hdr">
          <div className="card-title">{t('showroom.settings.title')} <em>{t('showroom.settings.title_em')}</em></div>
          <button className="btn btn-sm btn-primary" onClick={saveSettings} disabled={settingsSaving}>
            {settingsSaved ? `✓ ${t('common.saved')}` : settingsSaving ? t('common.saving') : t('common.save')}
          </button>
        </div>

        {saveError && (
          <div className="shw-error">{t('showroom.err_save')}</div>
        )}

        <div className="form-row2">
          <div className="form-group">
            <label className="form-lbl">{t('showroom.settings.discount_label')}</label>
            <input
              className="form-input"
              type="number"
              value={settings.wholesale_default_discount_pct}
              onChange={e => setSettings(s => ({ ...s, wholesale_default_discount_pct: parseFloat(e.target.value) || 0 }))}
              onWheel={e => e.target.blur()}
            />
            <div className="form-hint">{t('showroom.settings.discount_hint')}</div>
          </div>
          <div className="form-group">
            <label className="form-lbl">{t('showroom.settings.min_order_label')}</label>
            <input
              className="form-input"
              type="number"
              value={settings.wholesale_min_order_value}
              onChange={e => setSettings(s => ({ ...s, wholesale_min_order_value: parseFloat(e.target.value) || 0 }))}
              onWheel={e => e.target.blur()}
            />
            <div className="form-hint">{t('showroom.settings.min_order_hint')}</div>
          </div>
        </div>

        <div className="toggle-row shw-toggle-row">
          <div>
            <div className="shw-toggle-title">{t('showroom.settings.auto_push_title')}</div>
            <div className="shw-toggle-sub">{t('showroom.settings.auto_push_sub')}</div>
          </div>
          <Toggle
            on={settings.wholesale_auto_push_enabled}
            onToggle={() => setSettings(s => ({ ...s, wholesale_auto_push_enabled: !s.wholesale_auto_push_enabled }))}
          />
        </div>

        {/* Payment terms — saved with the rest of the form. Applies to new
            orders; existing orders keep the terms they were placed on. */}
        <div className="form-group shw-terms">
          <label className="form-lbl">{t('showroom.terms.label')}</label>
          <select
            className="form-input"
            value={String(settings.wholesale_deposit_pct ?? 50)}
            onChange={e => setSettings(s => ({ ...s, wholesale_deposit_pct: Number(e.target.value) }))}
          >
            <option value="50">{t('showroom.terms.opt_50')}</option>
            <option value="30">{t('showroom.terms.opt_30')}</option>
            <option value="100">{t('showroom.terms.opt_100')}</option>
          </select>
          <div className="form-hint">{t('showroom.terms.hint')}</div>
        </div>

        {/* Commission note, as in the design. The rate itself is per boutique
            and set by Mi Italia — each wholesale order shows its own. */}
        <div className="alert alert-info shw-commission">
          <span className="material-symbols-outlined">info</span>
          <div><strong>{t('showroom.settings.commission_title')}</strong> {t('showroom.settings.commission_note')}</div>
        </div>
      </div>

      {/* Products card */}
      <div className="card">
        <div className="card-hdr">
          <div className="card-title">{t('showroom.products.title')} <em>{t('showroom.products.title_em')}</em></div>
        </div>

        <div className="shw-toolbar">
          <div className="tabs shw-tabs">
            {FILTERS.map(f => (
              <div key={f} className={`tab${filter === f ? ' act' : ''}`} onClick={() => setFilter(f)}>
                {filterLabel[f]} <span className="tab-ct">{counts[f]}</span>
              </div>
            ))}
          </div>
          <div className="prod-search">
            <span className="material-symbols-outlined prod-search-icon">search</span>
            <input
              type="text"
              className="prod-search-input"
              placeholder={t('showroom.products.search')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* A page that came back short would make the counts above claim fewer
            products than the boutique has. Say so instead. */}
        {!productsFailed && products.length < productsTotal && (
          <div className="shw-error">
            {t('showroom.products.load_partial', {
              shown: products.length, total: productsTotal
            })}
          </div>
        )}

        {selected.size > 0 && (
          <div className="bulk-bar">
            <div className="bulk-bar-count">{selected.size} {t('products.selected')}</div>
            <div className="bulk-bar-actions">
              <button className="bulk-btn primary" onClick={() => bulkSet(true)} disabled={bulkBusy}>
                <span className="material-symbols-outlined">business_center</span>
                {t('showroom.bulk.enable')}
              </button>
              <button className="bulk-btn outline" onClick={() => bulkSet(false)} disabled={bulkBusy}>
                <span className="material-symbols-outlined">block</span>
                {t('showroom.bulk.disable')}
              </button>
            </div>
          </div>
        )}

        <table className="tbl">
          <thead>
            <tr>
              <th className="prod-th-check">
                <div className={`prod-checkbox${allSelected ? ' checked' : ''}`} onClick={toggleAll} title={t('products.select_all')} />
              </th>
              <th>{t('showroom.table.product')}</th>
              <th>{t('showroom.table.category')}</th>
              <th>{t('showroom.table.retail')}</th>
              <th>{t('showroom.table.discount')}</th>
              <th>{t('showroom.table.wholesale')}</th>
              <th>{t('showroom.table.moq')}</th>
              <th>{t('showroom.table.showroom')}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(p => (
              <tr key={p.id}>
                <td>
                  <div className={`prod-checkbox${selected.has(p.id) ? ' checked' : ''}`} onClick={() => toggleRow(p.id)} />
                </td>
                <td>
                  <div className="shw-product-cell">
                    {p.main_photo && (
                      <div className="shw-product-img" style={{ backgroundImage: `url('${imgUrl(p.main_photo)}')` }}/>
                    )}
                    <div>
                      <div className="shw-product-name">{p.name}</div>
                      <div className="shw-product-sku">{p.sku}</div>
                    </div>
                  </div>
                </td>
                <td className="shw-retail">{p.category || '—'}</td>
                <td className="shw-retail">{p.retail_price ? money(p.retail_price) : '—'}</td>
                <td className="shw-retail">{fmtDiscount(p)}</td>
                <td style={{ color: 'var(--green)', fontWeight: 600 }}>{fmtWholesale(p)}</td>
                <td>
                  {moqEditId === p.id ? (
                    <div className="shw-moq-edit">
                      <input
                        className="form-input shw-moq-input"
                        type="number" min="1" step="1" autoFocus
                        value={moqDraft}
                        placeholder="—"
                        onChange={e => setMoqDraft(e.target.value)}
                        onWheel={e => e.target.blur()}
                        onKeyDown={e => { if (e.key === 'Enter') saveMoq(p); if (e.key === 'Escape') setMoqEditId(null) }}
                        disabled={moqSaving}
                      />
                      <button className="shw-moq-btn" onClick={() => saveMoq(p)} disabled={moqSaving} title={t('common.save')}>
                        <span className="material-symbols-outlined">check</span>
                      </button>
                      <button className="shw-moq-btn" onClick={() => setMoqEditId(null)} disabled={moqSaving} title={t('common.cancel')}>
                        <span className="material-symbols-outlined">close</span>
                      </button>
                    </div>
                  ) : (
                    <button className="shw-moq-value" onClick={() => startMoqEdit(p)} title={t('showroom.moq.edit')}>
                      {p.wholesale_min_qty ?? '—'}
                      <span className="material-symbols-outlined">edit</span>
                    </button>
                  )}
                </td>
                <td>
                  <Toggle on={p.showroom_enabled} onToggle={() => toggleShowroom(p)} />
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="state-empty">
                  {productsFailed
                    ? t('showroom.err_products')
                    : products.length > 0
                      ? t('showroom.products.no_match')
                      : t('showroom.products.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Toast toasts={toasts} />
    </>
  )
}
