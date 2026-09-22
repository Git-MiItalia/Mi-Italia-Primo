import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'
import Toast, { useToast } from '../components/ui/Toast'
import Loading from '../components/ui/Loading'
import useLangStore from '../store/langStore'
import { useCategoryTree } from '../lib/categoryTree'

const API      = import.meta.env.VITE_API_URL
const IMG_BASE = import.meta.env.VITE_IMG_BASE_URL

// The pickup endpoint returns main_photo as a full URL, while the product
// endpoints elsewhere return a path relative to the API host. Accept either, so
// this keeps working if the two are ever made consistent.
function photoUrl(url) {
  return !url ? null : url.startsWith('http') ? url : `${IMG_BASE}${url}`
}

// These three lists are all rendered with .filter/.map, so a non-array from the
// API takes the whole page down with "x.filter is not a function" — a blank
// screen with no clue why. Accept the first candidate that is genuinely an
// array and fall back to empty; an empty list renders as "none yet".
function asList(...candidates) {
  for (const c of candidates) if (Array.isArray(c)) return c
  return []
}

// "Division > Type" paths off the live category tree, e.g. "Men's > Coats".
// Both the promo modal and the seasonal-sale modal offer the same list, so it
// is built in one place — the seasonal one used to carry a hardcoded set of
// invented categories that had nothing to do with the boutique's own.
function categoryPaths(tree) {
  return (tree ?? []).flatMap(div => (div.types ?? []).map(ty => `${div.name} > ${ty.name}`))
}

function calcDiscounted(retail, pct) {
  const n = parseFloat(pct)
  if (isNaN(n) || !retail) return null
  const discounted = parseFloat(retail) * (1 - n / 100)
  const saving     = parseFloat(retail) - discounted
  return { price: '€' + discounted.toFixed(2), save: '€' + Math.round(saving) }
}

// This tab asks for one page and never offers a second. A boutique with more
// products than this saw the first slice with nothing to say so — it read as
// the whole catalogue. Search is server-side, so finding a specific product
// still works; the list below just says when it is showing a partial view.
const PICKUP_LIMIT = 20

/* ── Seasonal helpers ── */

// Locale is passed in, never hardcoded: 'en-GB' printed "30 Sep" to an
// Italian user who expects "30 set".
function fmtSaleDate(iso, lang) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB', { day:'numeric', month:'short', year:'numeric' })
}

// GET /seasonal-sales returns starts_at / ends_at, but the create+update
// payload uses start_date / end_date, and this screen was reading the payload
// names back off the response. Every field came out undefined: the date range
// showed "—", the countdown showed "Ends in 0 days", and opening Edit left
// both date boxes empty. Read both spellings.
const saleStart = (s) => s?.starts_at ?? s?.start_date ?? null
const saleEnd   = (s) => s?.ends_at   ?? s?.end_date   ?? null

// The API stores 'percent'; this form's dropdown option is 'percentage'. A
// controlled <select> whose value matches no option renders blank, so editing
// a percentage sale showed an empty Discount Type.
const saleTypeForForm = (type) => (type === 'fixed' ? 'fixed' : 'percentage')

// Counts whole calendar days, not raw milliseconds. Subtracting timestamps
// made the number tick down partway through the day and depend on the
// viewer's timezone. `inclusive` is for end dates: a date arrives as midnight
// at the START of that day, so a sale ending on the 30th used to read
// "0 days" all through the 30th while still badged RUNNING NOW — the sale
// runs through that day, so it counts.
function daysUntil(iso, inclusive = false) {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  const dayOf = (x) => Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate())
  const diff = Math.round((dayOf(d) - dayOf(new Date())) / 86400000) + (inclusive ? 1 : 0)
  return diff > 0 ? diff : 0
}

function saleDiscountLabel(sale, t) {
  return sale.discount_type === 'fixed'
    ? t('discounts.seasonal.off_amount', { value: sale.discount_value, defaultValue: '€{{value}} off' })
    : t('discounts.seasonal.off_pct',    { value: sale.discount_value, defaultValue: '{{value}}% off' })
}

// The form submits the literal option text "All products"; the API returns the
// enum "all". Only the first was recognised, so a card for an everything-sale
// printed a bare lowercase "all" and Edit selected an option reading "all".
const APPLIES_ALL = 'All products'
const isAppliesAll = (a) => !a || a === 'all' || a === APPLIES_ALL
const saleAppliesForForm = (a) => (isAppliesAll(a) ? APPLIES_ALL : a)

function saleAppliesLabel(appliesTo, t) {
  if (!appliesTo) return '—'
  return isAppliesAll(appliesTo)
    ? t('discounts.seasonal.modal.applies_all', 'All Products')
    : appliesTo
}

// Returns a key, not a label — this runs outside the component so it has no
// `t`. These badges only became visible once the seasonal list started
// loading, which is why they stayed English unnoticed.
const SALE_BADGE_FALLBACK = {
  active:    'RUNNING NOW',
  scheduled: 'SCHEDULED',
  paused:    'PAUSED',
  ended:     'ENDED',
}
function saleBadge(status) {
  if (status === 'active')    return { key:'active',    cls:'ss-badge-active' }
  if (status === 'scheduled') return { key:'scheduled', cls:'ss-badge-scheduled' }
  if (status === 'paused')    return { key:'paused',    cls:'ss-badge-paused' }
  return { key:'ended', cls:'ss-badge-ended' }
}

/* ── PromoList ── */
function PromoList({ codes, onDeleteConfirm, onToggleStatus }) {
  const { t } = useTranslation()
  const lang  = useLangStore(s => s.lang)
  return (
    <div className="card">
      {codes.length === 0 && (
        <div className="dc-empty">{t('discounts.promo.empty', 'No promo codes yet.')}</div>
      )}
      {codes.map(p => (
        <div key={p.id} className="promo-card">
          <div className="promo-code">{p.code}</div>
          <div className="promo-details">
            <div className="promo-name">{p.description}</div>
            <div className="promo-meta">
              {/* Values arrive as decimal strings ("12.00"), so trim the trailing
                  zeros rather than printing "12.00% off". */}
              {p.discount_type === 'percent'
                ? t('discounts.promo.off_pct', { value: parseFloat(p.discount_value), defaultValue: '{{value}}% off' })
                : t('discounts.promo.off_amount', { value: parseFloat(p.discount_value), defaultValue: '€{{value}} off' })}
              {/* "0.00" is a truthy string, so a plain truthiness check printed
                  "Min €0.00" on every code that has no minimum. */}
              {parseFloat(p.min_order_value) > 0
                ? ` · ${t('discounts.promo.min_order', { value: parseFloat(p.min_order_value), defaultValue: 'Min €{{value}}' })}`
                : ''}
              {p.expires_at
                ? ` · ${t('discounts.promo.expires_on', { date: fmtSaleDate(p.expires_at, lang), defaultValue: 'Expires {{date}}' })}`
                : ` · ${t('discounts.promo.no_expiry', 'No expiry')}`}
              {p.applies_to === 'category'
                ? ` · ${p.category_path ?? t('discounts.promo.applies_category', 'Selected category')}`
                : p.applies_to === 'pickup_only'
                  ? ` · ${t('discounts.promo.applies_pickup', 'Pickup orders only')}`
                  : ` · ${t('discounts.promo.applies_all', 'All products')}`}
            </div>
          </div>
          <div className="promo-uses">
            {t('discounts.promo.uses', { used: p.uses_count ?? 0, max: p.max_uses ?? '∞', defaultValue: '{{used}} / {{max}} uses' })}
          </div>
          <span className={`status ${p.status === 'active' ? 'active' : 'cancelled'}`}>
            {p.status === 'active' ? t('discounts.promo.status_active', 'Active') : p.status === 'paused' ? t('discounts.promo.status_paused', 'Paused') : t('discounts.promo.status_expired', 'Expired')}
          </span>
          <div className="dc-promo-actions">
            <button onClick={() => onToggleStatus(p)} className="btn btn-sm btn-outline dc-promo-btn">
              {p.status === 'active' ? t('discounts.promo.pause_btn', 'Pause') : t('discounts.promo.activate_btn', 'Activate')}
            </button>
            <button onClick={() => onDeleteConfirm(p)} className="btn btn-sm btn-outline dc-promo-btn dc-promo-delete">
              {t('discounts.promo.delete_btn', 'Delete')}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── CreatePromoModal ── */
function CreatePromoModal({ onClose, onCreate }) {
  const { t }                             = useTranslation()
  const [code, setCode]                   = useState('')
  const [desc, setDesc]                   = useState('')
  const [type, setType]                   = useState('percent')
  const [value, setValue]                 = useState('')
  const [minOrder, setMinOrder]           = useState('')
  const [appliesTo, setAppliesTo]         = useState('all')
  const [categoryValue, setCategoryValue] = useState('')
  const { tree: categoryTree }            = useCategoryTree()
  const categoryOptions = categoryPaths(categoryTree)
  const [maxUses, setMaxUses]             = useState('')
  const [expires, setExpires]             = useState('')
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState('')

  const todayStr = new Date().toISOString().split('T')[0]

  async function handleCreate() {
    if (!code.trim() || !value) return
    if (appliesTo === 'category' && !categoryValue) {
      setError(t('discounts.create_modal.err_category', 'Choose which category this applies to.'))
      return
    }
    if (expires && expires < todayStr) {
      setError(t('discounts.create_modal.err_expired', 'Expiry date has already passed. Choose a future date.'))
      return
    }
    setError('')
    setSaving(true)
    // Unguarded, a dropped connection rejected here and left the button stuck
    // on "Saving…" with no message — setSaving(false) below never ran.
    try {
      const res = await apiFetch(`${API}/boutique/discounts/promo-codes`, {
      method: 'POST',
      body: JSON.stringify({
        code:            code.toUpperCase().trim(),
        description:     desc,
        discount_type:   type,
        discount_value:  parseFloat(value),
        min_order_value: minOrder ? parseFloat(minOrder) : undefined,
        // `applies_to` is an enum ('all' | 'pickup_only' | 'category') and the
        // chosen category travels separately in `category_path` — putting the
        // path in applies_to is rejected outright.
        applies_to:      appliesTo,
        category_path:   appliesTo === 'category' ? categoryValue : undefined,
        max_uses:        maxUses ? parseInt(maxUses) : undefined,
        expires_at:      expires ? new Date(expires).toISOString() : undefined,
      })
      }).then(r => r.json())
      if (res.success) { onCreate(res.data); onClose() }
      else setError(res.message || t('discounts.create_modal.err_generic', 'Failed to create promo code.'))
    } catch {
      setError(t('common.error_network', 'Network error. Please check your connection.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-large-hdr">
          <div className="modal-large-title">{t('discounts.create_modal.title', 'Create')} <em className="dc-gold">{t('discounts.create_modal.title_em', 'Promo Code')}</em></div>
          <button onClick={onClose} className="modal-close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="modal-large-body">
          {error && <div className="alert alert-urgent">{error}</div>}
          <div>
            <label className="form-lbl">{t('discounts.create_modal.code_label', 'Code')}</label>
            <input className="form-input dc-code-input" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder={t('discounts.create_modal.code_placeholder', 'e.g. SUMMER20')} />
          </div>
          <div>
            <label className="form-lbl">{t('discounts.create_modal.desc_label', 'Description')}</label>
            <input className="form-input" value={desc} onChange={e => setDesc(e.target.value)} placeholder={t('discounts.create_modal.desc_placeholder', 'e.g. 20% off summer collection')} />
          </div>
          <div className="form-row2">
            <div>
              <label className="form-lbl">{t('discounts.create_modal.type_label', 'Type')}</label>
              <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
                <option value="percent">{t('discounts.create_modal.type_percent', 'Percentage')}</option>
                <option value="fixed">{t('discounts.create_modal.type_fixed', 'Fixed Amount')}</option>
              </select>
            </div>
            <div>
              <label className="form-lbl">{t('discounts.create_modal.value_label', 'Value')}</label>
              <input className="form-input" type="number" value={value} onChange={e => setValue(e.target.value)} placeholder={type === 'percent' ? '10' : '50'} />
            </div>
          </div>
          <div className="form-row2">
            <div>
              <label className="form-lbl">{t('discounts.create_modal.min_order_label', 'Minimum Order')}</label>
              <input className="form-input" type="number" value={minOrder} onChange={e => setMinOrder(e.target.value)} placeholder={t('discounts.create_modal.min_order_placeholder', 'Optional')} />
            </div>
            <div>
              <label className="form-lbl">{t('discounts.create_modal.max_uses_label', 'Max Uses')}</label>
              <input className="form-input" type="number" value={maxUses} onChange={e => setMaxUses(e.target.value)} placeholder={t('discounts.create_modal.max_uses_placeholder', 'Unlimited')} />
            </div>
          </div>
          <div className="form-row2">
            <div>
              <label className="form-lbl">{t('discounts.create_modal.applies_label', 'Applies To')}</label>
              <select className="form-select" value={appliesTo} onChange={e => setAppliesTo(e.target.value)}>
                <option value="all">{t('discounts.create_modal.applies_all', 'All Products')}</option>
                <option value="category">{t('discounts.create_modal.applies_category', 'Specific Category')}</option>
                {/* Value must match the API enum exactly — 'pickup' is rejected. */}
                <option value="pickup_only">{t('discounts.create_modal.applies_pickup', 'Pickup Orders Only')}</option>
              </select>
            </div>
            <div>
              <label className="form-lbl">{t('discounts.create_modal.expires_label', 'Expires')}</label>
              <input className="form-input" type="date" min={todayStr} value={expires} onChange={e => setExpires(e.target.value)} />
            </div>
          </div>
          {appliesTo === 'category' && (
            <div>
              <label className="form-lbl">{t('discounts.create_modal.category_label', 'Which category')}</label>
              <select className="form-select" value={categoryValue} onChange={e => setCategoryValue(e.target.value)}>
                <option value="">{t('discounts.create_modal.category_placeholder', 'Select a category') + '…'}</option>
                {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="modal-large-footer">
          <button onClick={onClose} className="btn btn-outline modal-large-cancel">{t('common.cancel', 'Cancel')}</button>
          <button onClick={handleCreate} disabled={saving || !code || !value} className="btn btn-primary modal-large-submit">
            <span className="material-symbols-outlined">add</span>
            {saving ? t('discounts.create_modal.creating', 'Creating…') : t('discounts.create_modal.create_btn', 'Create Promo Code')}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Main Component ── */
export default function Discounts() {
  const { t }                                 = useTranslation()
  const lang                                  = useLangStore(s => s.lang)
  const [activeTab, setActiveTab]             = useState(0)
  const { toasts, show }                      = useToast()
  // Seasonal sales pick a category too — same live tree the promo modal uses.
  const { tree: categoryTree, loading: catLoading, error: catError } = useCategoryTree()
  const saleCategoryOptions                   = categoryPaths(categoryTree)

  const [storeDiscount, setStoreDiscount]     = useState(5)
  const [localDiscount, setLocalDiscount]     = useState(5)
  const [products, setProducts]               = useState([])
  const [prodSearch, setProdSearch]           = useState('')
  const [savingStore, setSavingStore]         = useState(false)
  const debounceRef                           = useRef(null)
  // Two flags for one fetch, because the two halves of the pickup tab wait for
  // different things. `pickupLoading` is per-request and drives the product
  // list, which reloads on every debounced search. `pickupReady` only flips
  // once, and gates the store-wide slider: that number is not search-dependent,
  // so blanking it on every keystroke would flicker the card for no reason.
  const [pickupLoading, setPickupLoading]     = useState(true)
  const [pickupReady, setPickupReady]         = useState(false)

  const [promoCodes, setPromoCodes]           = useState([])
  // true, not false: the fetch starts in an effect, which runs after the first
  // paint, so a false start rendered one frame of "No promo codes yet" to every
  // boutique that has some.
  const [promoLoading, setPromoLoading]       = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm]     = useState(null)
  const [extendConfirm, setExtendConfirm]     = useState(null)
  const [newExpiry, setNewExpiry]             = useState('')

  // Seasonal state
  const [sales, setSales]                     = useState([])
  const [salesLoading, setSalesLoading]       = useState(true)
  // null = fine. A string = a load failed; the string is the server's own
  // message when it sent one, empty otherwise. Deliberately NOT translated
  // here: calling t() inside the loaders makes them reactive dependencies of
  // the fetch effect, and the wording would freeze in the old language after
  // a switch. The sentence is built at render instead.
  const [loadError, setLoadError]             = useState(null)
  const [saleSaving, setSaleSaving]           = useState(false)
  const [showSaleModal, setShowSaleModal]     = useState(false)
  const [editSale, setEditSale]               = useState(null)
  const [deleteSaleConfirm, setDeleteSaleConfirm] = useState(null)
  const [saleFormName, setSaleFormName]       = useState('')
  const [saleFormDesc, setSaleFormDesc]       = useState('')
  const [saleFormType, setSaleFormType]       = useState('percentage')
  const [saleFormVal, setSaleFormVal]         = useState('')
  const [saleFormApplies, setSaleFormApplies] = useState('All products')
  const [saleFormStart, setSaleFormStart]     = useState('')
  const [saleFormEnd, setSaleFormEnd]         = useState('')

  const activeSales  = sales.filter(s => s.status === 'active' || s.status === 'scheduled' || s.status === 'paused')
  const pastSales    = sales.filter(s => s.status === 'ended')
  const runningCount = sales.filter(s => s.status === 'active').length

  // All three loads used to give up quietly — `if (!res.success) return` with
  // no else, and loadSales swallowed thrown errors into an empty list. A
  // backend failure looked exactly like "you have no promo codes yet".
  // setLoadError is called inline in each loader rather than through a shared
  // helper: a helper defined in the component body counts as a changing
  // dependency, which would drag all three loaders into the fetch effect's
  // dependency list. State setters are stable, so inlining keeps them out.
  // `quiet` skips the spinner. Saving one product's override reloads the list
  // to pick up what the server made of it, but the list is already on screen
  // and the user is still working in it — replacing it with a spinner on every
  // blur would yank the rows out from under them. A quiet reload just swaps the
  // data in. First load, search and the Refresh action all spin normally.
  function loadPickup(search = '', quiet = false) {
    if (!quiet) setPickupLoading(true)
    const q = search ? `&product_name=${encodeURIComponent(search)}` : ''
    apiFetch(`${API}/boutique/discounts/pickup?page=1&limit=${PICKUP_LIMIT}${q}`)
      .then(r => r.json())
      .then(res => {
        if (!res.success) { setLoadError(res?.message || ''); return }
        const sw = res.data.store_wide?.pickup_discount_default ?? 5
        setStoreDiscount(sw); setLocalDiscount(sw)
        setProducts(asList(res.data?.products))
      })
      .catch(() => setLoadError(''))
      // In `finally`, so a failed load stops spinning and lets the error
      // banner above be the answer, rather than spinning under it forever.
      .finally(() => { setPickupLoading(false); setPickupReady(true) })
  }

  function loadPromos() {
    setPromoLoading(true)
    apiFetch(`${API}/boutique/discounts/promo-codes`)
      .then(r => r.json())
      .then(res => {
        if (!res.success) { setLoadError(res?.message || ''); return }
        setPromoCodes(asList(res.data?.promo_codes, res.data))
      })
      .catch(() => setLoadError(''))
      .finally(() => setPromoLoading(false))
  }

  function loadSales() {
    setSalesLoading(true)
    apiFetch(`${API}/boutique/discounts/seasonal-sales`)
      .then(r => r.json())
      .then(res => {
        if (!res?.success) { setLoadError(res?.message || ''); return }
        setSales(asList(res.data?.seasonal_sales, res.data?.sales, res.data))
      })
      .catch(() => setLoadError(''))
      .finally(() => setSalesLoading(false))
  }

  function reloadAll() {
    setLoadError(null)
    loadPickup(prodSearch); loadPromos(); loadSales()
  }

  useEffect(() => { loadPickup(); loadPromos(); loadSales() }, [lang])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => loadPickup(prodSearch), 350)
    return () => clearTimeout(debounceRef.current)
  }, [prodSearch, lang])

  // Every handler below talks to the network without a guard. A dropped
  // connection rejected the promise and the rest of the function never ran —
  // no toast, and for saveStoreDiscount the button stayed on "Saving…" for
  // good, because setSavingStore(false) sat after the await.
  async function saveStoreDiscount() {
    setSavingStore(true)
    try {
      const res = await apiFetch(`${API}/boutique/discounts/pickup`, {
        method: 'PUT',
        body: JSON.stringify({ pickup_discount_default: localDiscount })
      }).then(r => r.json())
      if (res.success) { setStoreDiscount(localDiscount); show(t('discounts.pickup.toast_store_saved', 'Store-wide discount updated'), 'success') }
      else show(res.message ?? t('common.error_generic', 'Something went wrong. Please try again.'), 'error')
    } catch {
      show(t('common.error_network', 'Network error. Please check your connection.'), 'error')
    } finally {
      setSavingStore(false)
    }
  }

  async function saveProductOverride(product) {
    const pct = parseFloat(product.pickup_discount_pct ?? product.pct)
    if (isNaN(pct)) return
    try {
      const res = await apiFetch(`${API}/boutique/discounts/pickup/products/${product.id}`, {
        method: 'PUT',
        body: JSON.stringify({ pickup_discount_pct: pct })
      }).then(r => r.json())
      if (res.success) { show(t('discounts.pickup.toast_product_saved', { name: res.data.name, defaultValue: 'Updated {{name}}' }), 'success'); loadPickup(prodSearch, true) }
      else show(res.message ?? t('common.error_generic', 'Something went wrong. Please try again.'), 'error')
    } catch {
      show(t('common.error_network', 'Network error. Please check your connection.'), 'error')
    }
  }

  function updateProductPct(id, val) {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, pickup_discount_pct: val } : p))
  }

  async function deletePromo(id) {
    try {
      const res = await apiFetch(`${API}/boutique/discounts/promo-codes/${id}`, {
        method: 'DELETE'
      }).then(r => r.json())
      if (res.success) { setPromoCodes(prev => prev.filter(p => p.id !== id)); show(t('discounts.promo.toast_deleted', 'Promo code deleted'), 'success'); setDeleteConfirm(null) }
      else show(res.message ?? t('discounts.promo.err_delete', 'Failed to delete promo code.'), 'error')
    } catch {
      show(t('common.error_network', 'Network error. Please check your connection.'), 'error')
    }
  }

  async function togglePromoStatus(promo) {
    const newStatus = promo.status === 'active' ? 'paused' : 'active'
    try {
      const res = await apiFetch(`${API}/boutique/discounts/promo-codes/${promo.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      }).then(r => r.json())
      if (res.success) { setPromoCodes(prev => prev.map(p => p.id === promo.id ? { ...p, status: newStatus } : p)); show(newStatus === 'active' ? t('discounts.promo.toast_activated', 'Promo code activated') : t('discounts.promo.toast_paused', 'Promo code paused'), 'success') }
      else if (res.message?.includes('expired')) { setExtendConfirm(promo); setNewExpiry('') }
      else show(res.message ?? t('common.error_generic', 'Something went wrong. Please try again.'), 'error')
    } catch {
      show(t('common.error_network', 'Network error. Please check your connection.'), 'error')
    }
  }

  async function extendAndActivate() {
    if (!newExpiry) return
    try {
      const res = await apiFetch(`${API}/boutique/discounts/promo-codes/${extendConfirm.id}`, {
        method: 'PUT',
        body: JSON.stringify({ expires_at: new Date(newExpiry).toISOString(), status: 'active' })
      }).then(r => r.json())
      if (res.success) {
        setPromoCodes(prev => prev.map(p => p.id === extendConfirm.id ? { ...p, status:'active', expires_at: new Date(newExpiry).toISOString() } : p))
        show(t('discounts.promo.toast_extended', 'Promo code extended and activated'), 'success')
        setExtendConfirm(null)
      } else show(res.message ?? t('discounts.promo.err_extend', 'Failed to extend promo code.'), 'error')
    } catch {
      show(t('common.error_network', 'Network error. Please check your connection.'), 'error')
    }
  }

  function handlePromoCreated(newPromo) {
    setPromoCodes(prev => [newPromo, ...prev])
    show(t('discounts.promo.toast_created', 'Promo code created'), 'success')
  }

  // ── Seasonal handlers ──
  function openCreateSale() {
    setEditSale(null)
    setSaleFormName(''); setSaleFormDesc(''); setSaleFormType('percentage'); setSaleFormVal(''); setSaleFormApplies('All products'); setSaleFormStart(''); setSaleFormEnd('')
    setShowSaleModal(true)
  }

  function openEditSale(sale) {
    setEditSale(sale)
    setSaleFormName(sale.name); setSaleFormDesc(sale.description ?? ''); setSaleFormType(saleTypeForForm(sale.discount_type)); setSaleFormVal(String(sale.discount_value)); setSaleFormApplies(saleAppliesForForm(sale.category_path ?? sale.applies_to)); setSaleFormStart(saleStart(sale)?.slice(0,10) ?? ''); setSaleFormEnd(saleEnd(sale)?.slice(0,10) ?? '')
    setShowSaleModal(true)
  }

  async function handleSaveSale() {
    if (saleSaving) return
    // This used to `return` in silence. The button is enabled, so forgetting
    // the end date meant clicking Save and getting nothing at all — no toast,
    // no highlight, no clue which of the four required fields was empty.
    const missing = [
      !saleFormName.trim() && t('discounts.seasonal.modal.name_label', 'Sale Name'),
      !saleFormVal         && t('discounts.seasonal.modal.value_label', 'Discount Value'),
      !saleFormStart       && t('discounts.seasonal.modal.start_label', 'Start Date'),
      !saleFormEnd         && t('discounts.seasonal.modal.end_label', 'End Date'),
    ].filter(Boolean)
    if (missing.length > 0) {
      show(t('discounts.seasonal.err_required', { fields: missing.join(', '), defaultValue: 'Please fill in: {{fields}}' }), 'error')
      return
    }
    if (new Date(saleFormEnd) < new Date(saleFormStart)) {
      show(t('discounts.seasonal.err_dates', 'The end date is before the start date.'), 'error')
      return
    }
    // The API names these starts_at / ends_at on the way in as well as out.
    // Sending start_date / end_date meant every create came back
    // {"success":false,"message":"starts_at is required"} — seasonal sales
    // could not be created at all.
    //
    // applies_to is the enum 'all' | 'category', with the chosen path in its
    // own category_path field; the whole path was going into applies_to,
    // which is the same mistake the promo-code payload already documents.
    const isAll = isAppliesAll(saleFormApplies)
    const saleData = {
      name: saleFormName.trim(),
      description: saleFormDesc,
      // The API's word is 'percent' — that is what it returns here and what
      // the working promo-code payload sends. This form's option value is
      // 'percentage', so translate it rather than inventing a third spelling.
      discount_type: saleFormType === 'fixed' ? 'fixed' : 'percent',
      discount_value: parseFloat(saleFormVal),
      applies_to: isAll ? 'all' : 'category',
      category_path: isAll ? null : saleFormApplies,
      starts_at: new Date(saleFormStart).toISOString(),
      ends_at: new Date(saleFormEnd).toISOString(),
    }
    setSaleSaving(true)
    try {
      // A duplicate carries the source id only to prefill the form, so treat it
      // as a create — otherwise it would overwrite the sale it was copied from.
      const isUpdate = editSale && !editSale.isDuplicate
      const res = await apiFetch(
        isUpdate ? `${API}/boutique/discounts/seasonal-sales/${editSale.id}` : `${API}/boutique/discounts/seasonal-sales`,
        { method: isUpdate ? 'PUT' : 'POST', body: JSON.stringify(saleData) }
      ).then(r => r.json())

      if (!res?.success) {
        show(res?.message ?? t('discounts.seasonal.err_save', 'Failed to save sale.'), 'error')
        return
      }
      const saved = res.data?.seasonal_sale ?? res.data?.sale ?? res.data
      if (isUpdate) {
        setSales(prev => prev.map(s => s.id === editSale.id ? { ...s, ...saved } : s))
        show(t('discounts.seasonal.toast.updated', 'Sale updated.'), 'success')
      } else {
        setSales(prev => [saved, ...prev])
        show(t('discounts.seasonal.toast.created', 'Sale created.'), 'success')
      }
      setShowSaleModal(false)
    } catch {
      show(t('common.error_network', 'Network error. Please check your connection.'), 'error')
    } finally {
      setSaleSaving(false)
    }
  }

  async function handleDeleteSale(id) {
    try {
      const res = await apiFetch(`${API}/boutique/discounts/seasonal-sales/${id}`, { method: 'DELETE' }).then(r => r.json())
      if (!res?.success) { show(res?.message ?? t('discounts.seasonal.err_delete', 'Failed to delete sale.'), 'error'); return }
      setSales(prev => prev.filter(s => s.id !== id))
      setDeleteSaleConfirm(null)
      show(t('discounts.seasonal.toast.deleted', 'Sale deleted.'), 'success')
    } catch {
      show(t('common.error_network', 'Network error. Please check your connection.'), 'error')
    }
  }

  async function handlePauseSale(sale) {
    const newStatus = sale.status === 'paused' ? 'active' : 'paused'
    // Flip immediately so the button responds, then undo if the server refuses.
    setSales(prev => prev.map(s => s.id === sale.id ? { ...s, status: newStatus } : s))
    try {
      const res = await apiFetch(`${API}/boutique/discounts/seasonal-sales/${sale.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      }).then(r => r.json())
      if (!res?.success) {
        setSales(prev => prev.map(s => s.id === sale.id ? { ...s, status: sale.status } : s))
        show(res?.message ?? t('discounts.seasonal.err_status', 'Failed to update sale.'), 'error')
        return
      }
      show(newStatus === 'paused' ? t('discounts.seasonal.toast.paused', 'Sale paused.') : t('discounts.seasonal.toast.resumed', 'Sale resumed.'), 'success')
    } catch {
      setSales(prev => prev.map(s => s.id === sale.id ? { ...s, status: sale.status } : s))
      show(t('common.error_network', 'Network error. Please check your connection.'), 'error')
    }
  }

  function handleDuplicateSale(sale) {
    // Opens the form prefilled; nothing is created until Save. `isDuplicate`
    // tells handleSaveSale to POST rather than PUT over the original.
    // Both spellings have to be cleared: blanking only start_date/end_date left
    // starts_at/ends_at intact, so the copy silently inherited the original's
    // dates instead of opening with empty date boxes.
    openEditSale({ ...sale, name: `${sale.name} (copy)`, start_date: '', end_date: '', starts_at: '', ends_at: '', isDuplicate: true })
  }

  const TABS = [t('discounts.tabs.pickup', 'Pickup Discounts'), t('discounts.tabs.promo', 'Promo Codes'), t('discounts.tabs.seasonal', 'Seasonal Sales')]

  return (
    <>
      {loadError !== null && (
        <div className="alert alert-red">
          <span className="material-symbols-outlined">error</span>
          <div style={{ flex: 1 }}>{loadError || t('discounts.err_load', 'Could not load discounts. Please try again.')}</div>
          <button className="btn btn-outline btn-sm" onClick={reloadAll}>{t('common.retry', 'Retry')}</button>
        </div>
      )}
      <div className="tabs">
        {TABS.map((tab, i) => (
          <div key={tab} className={`tab${activeTab === i ? ' act' : ''}`} onClick={() => setActiveTab(i)}>{tab}</div>
        ))}
      </div>

      {/* ── Tab 0: Pickup Discounts ── */}
      {activeTab === 0 && (
        <div className="grid2 dc-pickup-grid">
          <div>
            <div className="card">
              <div className="card-hdr">
                <div className="card-title">{t('discounts.pickup.title', 'Pickup')} <em>{t('discounts.pickup.title_em', 'Discounts')}</em></div>
              </div>
              {/* Until the fetch lands, `localDiscount` is the useState seed of
                  5, not the boutique's setting — so the card used to show a
                  confident "5%" that could jump to something else a moment
                  later. Nothing truthful to draw yet, so draw the spinner. */}
              {!pickupReady && <Loading />}
              {pickupReady && (
              <div className="dc-store-discount-inner">
                <div className="dc-store-discount-row">
                  <div className="dc-store-discount-body">
                    <div className="dc-store-discount-title">{t('discounts.pickup.default_label', 'Store-Wide Default')}</div>
                    <div className="dc-store-discount-sub">{t('discounts.pickup.default_sub', 'Applied to all products unless overridden below.')}</div>
                  </div>
                  <div className="dc-store-discount-val">
                    <div className="dc-store-discount-num">{localDiscount}</div>
                    <div className="dc-store-discount-pct">%</div>
                  </div>
                </div>
                <input type="range" min="0" max="20" value={localDiscount} onChange={e => setLocalDiscount(Number(e.target.value))} className="dc-range" />
                <div className="dc-range-labels">
                  {['0%', '5%', '10%', '15%', '20%'].map(l => <span key={l}>{l}</span>)}
                </div>
                {localDiscount !== storeDiscount && (
                  <button onClick={saveStoreDiscount} disabled={savingStore} className="btn btn-primary btn-sm dc-save-btn">
                    <span className="material-symbols-outlined">save</span>
                    {savingStore ? t('discounts.pickup.saving', 'Saving…') : t('discounts.pickup.save_btn', { pct: localDiscount, defaultValue: 'Save {{pct}}%' })}
                  </button>
                )}
              </div>
              )}
              <div className="alert alert-info">
                <span className="material-symbols-outlined">info</span>
                {t('discounts.pickup.alert', 'Pickup discounts only apply to in-store pickup orders, not shipped orders.')}
              </div>
            </div>

            <div className="card">
              <div className="card-hdr">
                <div className="card-title">{t('discounts.pickup.overrides_title', 'Product')} <em>{t('discounts.pickup.overrides_em', 'Overrides')}</em></div>
                <div className="card-action" onClick={() => loadPickup(prodSearch)}>{t('discounts.pickup.refresh', 'Refresh')}</div>
              </div>
              <div className="dc-prod-search">
                <span className="material-symbols-outlined dc-prod-search-icon">search</span>
                <input className="dc-prod-search-input" value={prodSearch} onChange={e => setProdSearch(e.target.value)} placeholder={t('discounts.pickup.search_placeholder', 'Search products…')} />
              </div>
              {/* Search is server-side, so every keystroke re-fetches. Without
                  this the list sat on the previous results — or, on the very
                  first load, on "No products found." — with nothing to say a
                  request was in flight. The empty state waits for the answer. */}
              {pickupLoading && <Loading />}
              {!pickupLoading && products.length === 0 && (
                <div className="dc-empty">
                  {prodSearch ? t('discounts.pickup.no_results', 'No products match your search.') : t('discounts.pickup.no_products', 'No products found.')}
                </div>
              )}
              {!pickupLoading && products.map(p => {
                const pct  = p.pickup_discount_pct ?? p.effective_pickup_pct ?? storeDiscount
                const calc = calcDiscounted(p.retail_price ?? p.retail, pct)
                return (
                  <div key={p.id} className="discount-card">
                    {/* `main_photo`. This read `p.img ?? p.image_url`, and the
                        pickup endpoint has never returned either name, so every
                        tile on the page fell through to the blank grey square —
                        which looked exactly like a catalogue with no photos
                        rather than like a bug. */}
                    <div
                      className="discount-img"
                      style={photoUrl(p.main_photo)
                        ? { backgroundImage: `url('${photoUrl(p.main_photo)}')` }
                        : { background: 'var(--mist)' }}
                    />
                    <div className="discount-body">
                      <div className="discount-name">{p.name}</div>
                      <div className="discount-meta">{t('discounts.pickup.retail', { price: parseFloat(p.retail_price ?? p.retail ?? 0).toFixed(2), defaultValue: 'Retail: €{{price}}' })}</div>
                    </div>
                    <input className="discount-pct-input" value={pct} onChange={e => updateProductPct(p.id, e.target.value)} onBlur={() => saveProductOverride({ ...p, pickup_discount_pct: pct })} />
                    <div className="dc-calc">
                      {/* "save €20" is the verb, not the Save button — it needs
                          its own key ("risparmia", not "salva"). */}
                      {calc ? <>{calc.price}<br /><span className="dc-calc-save">{t('discounts.pickup.you_save', { amount: calc.save, defaultValue: 'save {{amount}}' })}</span></> : '—'}
                    </div>
                  </div>
                )
              })}
              {!pickupLoading && products.length >= PICKUP_LIMIT && (
                <div className="dc-empty">
                  {t('discounts.pickup.more_products', { count: PICKUP_LIMIT, defaultValue: 'Showing the first {{count}} products. Use the search above to find a specific one.' })}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="dc-promo-header">
              <h3 className="dc-promo-title">{t('discounts.promo.title', 'Promo')} <em className="dc-gold">{t('discounts.promo.title_em', 'Codes')}</em></h3>
              <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                <span className="material-symbols-outlined">add</span>{t('discounts.promo.new_btn', 'New Code')}
              </button>
            </div>
            {/* Same list as tab 1, so it waits the same way — this copy used to
                show "No promo codes yet" while tab 1 showed a spinner. */}
            {promoLoading
              ? <Loading />
              : <PromoList codes={promoCodes} onDeleteConfirm={setDeleteConfirm} onToggleStatus={togglePromoStatus} />
            }
          </div>
        </div>
      )}

      {/* ── Tab 1: Promo Codes ── */}
      {activeTab === 1 && (
        <div>
          <div className="dc-promo-header">
            <h3 className="dc-promo-title">{t('discounts.promo.title', 'Promo')} <em className="dc-gold">{t('discounts.promo.title_em', 'Codes')}</em></h3>
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              <span className="material-symbols-outlined">add</span>{t('discounts.promo.new_btn', 'New Code')}
            </button>
          </div>
          {promoLoading
            ? <Loading />
            : <PromoList codes={promoCodes} onDeleteConfirm={setDeleteConfirm} onToggleStatus={togglePromoStatus} />
          }
        </div>
      )}

      {/* ── Tab 2: Seasonal Sales ── */}
      {activeTab === 2 && (
        <div className="card ss-wrap">
          <div className="ss-header">
            <div>
              <div className="ss-title">{t('discounts.seasonal.title', 'Seasonal')} <em>{t('discounts.seasonal.title_em', 'Sales')}</em></div>
              <div className="ss-subtitle">{t('discounts.seasonal.summary', { total: sales.length, running: runningCount, defaultValue: '{{total}} sales total · {{running}} running now' })}</div>
            </div>
            <button className="btn btn-primary" onClick={openCreateSale}>
              <span className="material-symbols-outlined">add</span>{t('discounts.seasonal.new_sale', 'New Sale')}
            </button>
          </div>

          {salesLoading && <Loading />}

          {!salesLoading && activeSales.length === 0 && pastSales.length === 0 && (
            <div className="ss-empty">
              <span className="material-symbols-outlined">sell</span>
              <div className="ss-empty-title">{t('discounts.seasonal.empty_title', 'No seasonal sales yet')}</div>
              <div className="ss-empty-sub">{t('discounts.seasonal.empty_sub', 'Create your first seasonal sale to get started.')}</div>
            </div>
          )}

          {activeSales.map(sale => {
            const badge = saleBadge(sale.status)
            // The API works this out for us. status alone can say 'active' for
            // a sale whose start date has not arrived yet, which would show
            // "Ends in" on something that has not begun.
            const isRunning = sale.is_currently_running ?? (sale.status === 'active')
            const timeLabel = isRunning
              ? t('discounts.seasonal.ends_in', 'Ends in')
              : sale.status === 'paused'
                ? t('discounts.seasonal.status_paused', 'Paused')
                : t('discounts.seasonal.starts_in', 'Starts in')
            const days = isRunning ? daysUntil(saleEnd(sale), true) : daysUntil(saleStart(sale))
            const timeVal = sale.status === 'paused'
              ? '—'
              : days == null
                // No usable date rather than a real zero — don't invent "0 days".
                ? '—'
                : t('discounts.seasonal.days_count', { count: days, defaultValue: '{{count}} day(s)' })
            return (
              <div key={sale.id} className="ss-card">
                <div className="ss-card-top">
                  <div className="ss-card-info">
                    <div className="ss-card-name-row">
                      <div className="ss-card-name">{sale.name}</div>
                      <span className={`ss-badge ${badge.cls}`}>
                        {t(`discounts.seasonal.badge.${badge.key}`, SALE_BADGE_FALLBACK[badge.key])}
                      </span>
                    </div>
                    <div className="ss-card-desc">{sale.description}</div>
                  </div>
                  <div className="ss-card-actions">
                    <button className="ss-action-btn" title={t('common.edit', 'Edit')} onClick={() => openEditSale(sale)}>
                      <span className="material-symbols-outlined">edit</span>
                    </button>
                    <button className="ss-action-btn" title={sale.status === 'paused' ? t('discounts.seasonal.resume', 'Resume') : t('discounts.seasonal.pause', 'Pause')} onClick={() => handlePauseSale(sale)}>
                      <span className="material-symbols-outlined">{sale.status === 'paused' ? 'play_arrow' : 'pause'}</span>
                    </button>
                    <button className="ss-action-btn ss-action-danger" title={t('common.delete', 'Delete')} onClick={() => setDeleteSaleConfirm(sale.id)}>
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                </div>
                <div className="ss-card-divider" />
                <div className="ss-card-details">
                  <div className="ss-detail">
                    <div className="ss-detail-lbl">{t('discounts.seasonal.col_discount', 'Discount')}</div>
                    <div className="ss-detail-val ss-detail-discount">{saleDiscountLabel(sale, t)}</div>
                  </div>
                  <div className="ss-detail">
                    <div className="ss-detail-lbl">{t('discounts.seasonal.col_applies', 'Applies To')}</div>
                    <div className="ss-detail-val">{saleAppliesLabel(sale.category_path ?? sale.applies_to, t)}</div>
                  </div>
                  <div className="ss-detail">
                    <div className="ss-detail-lbl">{t('discounts.seasonal.col_runs', 'Runs')}</div>
                    <div className="ss-detail-val">{fmtSaleDate(saleStart(sale), lang)} — {fmtSaleDate(saleEnd(sale), lang)}</div>
                  </div>
                  <div className="ss-detail">
                    <div className="ss-detail-lbl">{timeLabel}</div>
                    <div className="ss-detail-val">{timeVal}</div>
                  </div>
                </div>
              </div>
            )
          })}

          {pastSales.length > 0 && (
            <>
              <div className="ss-past-divider"><span>{t('discounts.seasonal.past_sales', { count: pastSales.length, defaultValue: '{{count}} past sale(s)' })}</span></div>
              {pastSales.map(sale => (
                <div key={sale.id} className="ss-past-card">
                  <div className="ss-past-info">
                    <div className="ss-card-name-row">
                      <div className="ss-card-name">{sale.name}</div>
                      <span className="ss-badge ss-badge-ended">{t('discounts.seasonal.ended_badge', 'ENDED')}</span>
                    </div>
                    <div className="ss-past-meta">{saleDiscountLabel(sale, t)} · {saleAppliesLabel(sale.category_path ?? sale.applies_to, t)} · {t('discounts.seasonal.ended_on', { date: fmtSaleDate(saleEnd(sale), lang), defaultValue: 'ended {{date}}' })}</div>
                  </div>
                  <button className="ss-action-btn" title={t('discounts.seasonal.duplicate', 'Duplicate')} onClick={() => handleDuplicateSale(sale)}>
                    <span className="material-symbols-outlined">content_copy</span>
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Create promo modal */}
      {showCreateModal && (
        <CreatePromoModal onClose={() => setShowCreateModal(false)} onCreate={handlePromoCreated} />
      )}

      {/* Delete promo confirmation modal */}
      {deleteConfirm && (
        <div className="modal-backdrop" onClick={() => setDeleteConfirm(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-confirm-title">
              {t('discounts.delete_modal.title', 'Delete')} <em className="modal-em-red">{t('discounts.delete_modal.title_em', 'Promo Code')}</em>
            </div>
            <div className="modal-confirm-msg">
              {t('discounts.delete_modal.msg', { code: deleteConfirm.code, defaultValue: 'Are you sure you want to delete {{code}}? This cannot be undone.' })}
            </div>
            <div className="modal-confirm-actions">
              <button onClick={() => setDeleteConfirm(null)} className="btn btn-outline modal-confirm-btn">{t('common.cancel', 'Cancel')}</button>
              <button onClick={() => deletePromo(deleteConfirm.id)} className="btn btn-red modal-confirm-btn">
                {t('discounts.delete_modal.delete_btn', 'Delete Promo Code')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extend & Activate modal */}
      {extendConfirm && (
        <div className="modal-backdrop" onClick={() => setExtendConfirm(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-confirm-title">
              {t('discounts.extend_modal.title', 'Extend expiry for')} <em className="dc-gold">{extendConfirm.code}</em>
            </div>
            <div className="modal-confirm-msg">{t('discounts.extend_modal.msg', 'This promo code has expired. Set a new expiry date to reactivate it.')}</div>
            <div className="form-group">
              <label className="form-lbl">{t('discounts.extend_modal.expiry_label', 'New Expiry Date')}</label>
              <input className="form-input" type="date" value={newExpiry} min={new Date().toISOString().split('T')[0]} onChange={e => setNewExpiry(e.target.value)} />
            </div>
            <div className="modal-confirm-actions">
              <button onClick={() => setExtendConfirm(null)} className="btn btn-outline modal-confirm-btn">{t('common.cancel', 'Cancel')}</button>
              <button onClick={extendAndActivate} disabled={!newExpiry} className="btn btn-primary modal-confirm-btn">
                {t('discounts.extend_modal.submit_btn', 'Extend & Activate')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Seasonal: Create/Edit sale modal */}
      {showSaleModal && (
        <div className="modal-backdrop" onClick={() => setShowSaleModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <div className="modal-title">{editSale ? t('common.edit', 'Edit') : t('common.create', 'Create')} <em>{t('discounts.seasonal.modal.title_em', 'Sale')}</em></div>
              <div className="modal-close" onClick={() => setShowSaleModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </div>
            </div>
            <div className="form-group">
              <label className="form-lbl">{t('discounts.seasonal.modal.name_label', 'Sale Name')} *</label>
              <input className="form-input" value={saleFormName} onChange={e => setSaleFormName(e.target.value)} placeholder={t('discounts.seasonal.modal.name_placeholder', 'e.g. Spring Collection Sale')} />
            </div>
            <div className="form-group">
              <label className="form-lbl">{t('discounts.seasonal.modal.desc_label', 'Description')}</label>
              <input className="form-input" value={saleFormDesc} onChange={e => setSaleFormDesc(e.target.value)} placeholder={t('discounts.seasonal.modal.desc_placeholder', 'e.g. 20% off all outerwear')} />
            </div>
            <div className="form-row2">
              <div className="form-group">
                <label className="form-lbl">{t('discounts.seasonal.modal.type_label', 'Discount Type')}</label>
                <div className="select-wrap">
                  <select className="form-select" value={saleFormType} onChange={e => setSaleFormType(e.target.value)}>
                    <option value="percentage">{t('discounts.seasonal.modal.type_percent', 'Percentage')}</option>
                    <option value="fixed">{t('discounts.seasonal.modal.type_fixed', 'Fixed Amount')}</option>
                  </select>
                  <span className="material-symbols-outlined select-arrow">expand_more</span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-lbl">{t('discounts.seasonal.modal.value_label', 'Discount Value')} *</label>
                <input className="form-input" type="number" value={saleFormVal} onChange={e => setSaleFormVal(e.target.value)} placeholder={saleFormType === 'percentage' ? t('discounts.seasonal.modal.value_ph_pct', 'e.g. 20') : t('discounts.seasonal.modal.value_ph_fixed', 'e.g. 50')} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-lbl">{t('discounts.seasonal.modal.applies_label', 'Applies To')}</label>
              <div className="select-wrap">
                {/* Was a hardcoded list of invented categories ("Men's >
                    Outerwear" and friends) that no boutique actually has.
                    Now the live tree, same as the promo modal. */}
                <select className="form-select" value={saleFormApplies} onChange={e => setSaleFormApplies(e.target.value)}>
                  <option value="All products">{t('discounts.seasonal.modal.applies_all', 'All Products')}</option>
                  {/* An existing sale may be stored against a category that is
                      no longer in the tree (renamed, removed, or one of the old
                      invented ones). Keep it as an option so opening Edit and
                      pressing Save can't silently reassign the sale. */}
                  {saleFormApplies && saleFormApplies !== 'All products' && !saleCategoryOptions.includes(saleFormApplies) && (
                    <option value={saleFormApplies}>{saleFormApplies}</option>
                  )}
                  {saleCategoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <span className="material-symbols-outlined select-arrow">expand_more</span>
              </div>
              {/* Without this, a failed category load leaves a dropdown with a
                  single option and no hint that anything went wrong. */}
              {catLoading && (
                <div className="form-hint">{t('discounts.seasonal.modal.cat_loading', 'Loading categories') + '…'}</div>
              )}
              {!catLoading && catError && (
                <div className="form-hint">{t('discounts.seasonal.modal.cat_error', 'Could not load your categories — only "All Products" is available right now.')}</div>
              )}
              {!catLoading && !catError && saleCategoryOptions.length === 0 && (
                <div className="form-hint">{t('discounts.seasonal.modal.cat_empty', 'No categories set up yet — this sale will apply to all products.')}</div>
              )}
            </div>
            <div className="form-row2">
              <div className="form-group">
                <label className="form-lbl">{t('discounts.seasonal.modal.start_label', 'Start Date')} *</label>
                <input className="form-input" type="date" value={saleFormStart} onChange={e => setSaleFormStart(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-lbl">{t('discounts.seasonal.modal.end_label', 'End Date')} *</label>
                <input className="form-input" type="date" value={saleFormEnd} onChange={e => setSaleFormEnd(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowSaleModal(false)} disabled={saleSaving}>{t('common.cancel', 'Cancel')}</button>
              <button className="btn btn-primary" onClick={handleSaveSale} disabled={saleSaving}>
                <span className="material-symbols-outlined">{editSale ? 'save' : 'add'}</span>
                {saleSaving
                  ? t('common.saving', 'Saving') + '…'
                  : editSale ? t('discounts.seasonal.modal.save_changes', 'Save Changes') : t('discounts.seasonal.modal.create_sale', 'Create Sale')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Seasonal: Delete sale confirmation */}
      {deleteSaleConfirm && (
        <div className="modal-backdrop" onClick={() => setDeleteSaleConfirm(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-confirm-title">{t('common.delete', 'Delete')} <em className="modal-em-red">{t('discounts.seasonal.delete.title_em', 'Sale')}</em></div>
            <div className="modal-confirm-msg">{t('discounts.seasonal.delete.message', 'Are you sure you want to delete this sale? This cannot be undone.')}</div>
            <div className="modal-confirm-actions">
              <button className="btn btn-outline modal-confirm-btn" onClick={() => setDeleteSaleConfirm(null)}>{t('common.cancel', 'Cancel')}</button>
              <button className="btn btn-red modal-confirm-btn" onClick={() => handleDeleteSale(deleteSaleConfirm)}>{t('discounts.seasonal.delete.confirm', 'Delete Sale')}</button>
            </div>
          </div>
        </div>
      )}

      <Toast toasts={toasts} />
    </>
  )
}
