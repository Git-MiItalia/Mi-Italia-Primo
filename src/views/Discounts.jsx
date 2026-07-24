import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'
import Toast, { useToast } from '../components/ui/Toast'

const API = import.meta.env.VITE_API_URL

function calcDiscounted(retail, pct) {
  const n = parseFloat(pct)
  if (isNaN(n) || !retail) return null
  const discounted = parseFloat(retail) * (1 - n / 100)
  const saving     = parseFloat(retail) - discounted
  return { price: '€' + discounted.toFixed(2), save: '€' + Math.round(saving) }
}

/* ── PromoList ── */
function PromoList({ codes, onDeleteConfirm, onToggleStatus }) {
  const { t } = useTranslation()
  return (
    <div className="card">
      {codes.length === 0 && (
        <div className="dc-empty">{t('discounts.promo.empty')}</div>
      )}
      {codes.map(p => (
        <div key={p.id} className="promo-card">
          <div className="promo-code">{p.code}</div>
          <div className="promo-details">
            <div className="promo-name">{p.description}</div>
            <div className="promo-meta">
              {p.discount_type === 'percent' ? `${p.discount_value}% off` : `€${p.discount_value} off`}
              {p.min_order_value ? ` · Min €${p.min_order_value}` : ''}
              {p.expires_at
                ? ` · Expires ${new Date(p.expires_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}`
                : ' · No expiry'}
              {p.applies_to !== 'all' ? ` · ${p.applies_to}` : ' · All products'}
            </div>
          </div>
          <div className="promo-uses">
            {t('discounts.promo.uses', { used: p.uses_count ?? 0, max: p.max_uses ?? '∞' })}
          </div>
          <span className={`status ${p.status === 'active' ? 'active' : 'cancelled'}`}>
            {p.status === 'active' ? t('discounts.promo.status_active') : p.status === 'paused' ? t('discounts.promo.status_paused') : t('discounts.promo.status_expired')}
          </span>
          <div className="dc-promo-actions">
            <button onClick={() => onToggleStatus(p)} className="btn btn-sm btn-outline dc-promo-btn">
              {p.status === 'active' ? t('discounts.promo.pause_btn') : t('discounts.promo.activate_btn')}
            </button>
            <button onClick={() => onDeleteConfirm(p)} className="btn btn-sm btn-outline dc-promo-btn dc-promo-delete">
              {t('discounts.promo.delete_btn')}
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
  const [maxUses, setMaxUses]             = useState('')
  const [expires, setExpires]             = useState('')
  const [saving, setSaving]               = useState(false)

  async function handleCreate() {
    if (!code.trim() || !value) return
    setSaving(true)
    const res = await apiFetch(`${API}/boutique/discounts/promo-codes`, {
      method: 'POST',
      body: JSON.stringify({
        code:            code.toUpperCase().trim(),
        description:     desc,
        discount_type:   type,
        discount_value:  parseFloat(value),
        min_order_value: minOrder ? parseFloat(minOrder) : undefined,
        applies_to:      appliesTo,
        max_uses:        maxUses ? parseInt(maxUses) : undefined,
        expires_at:      expires ? new Date(expires).toISOString() : undefined,
      })
    }).then(r => r.json())
    setSaving(false)
    if (res.success) { onCreate(res.data); onClose() }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
  <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-large-hdr">
          <div className="modal-large-title">{t('discounts.create_modal.title')} <em className="dc-gold">{t('discounts.create_modal.title_em')}</em></div>
          <button onClick={onClose} className="modal-close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="modal-large-body">
          <div>
            <label className="form-lbl">{t('discounts.create_modal.code_label')}</label>
            <input className="form-input dc-code-input" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder={t('discounts.create_modal.code_placeholder')} />
          </div>
          <div>
            <label className="form-lbl">{t('discounts.create_modal.desc_label')}</label>
            <input className="form-input" value={desc} onChange={e => setDesc(e.target.value)} placeholder={t('discounts.create_modal.desc_placeholder')} />
          </div>
          <div className="form-row2">
            <div>
              <label className="form-lbl">{t('discounts.create_modal.type_label')}</label>
              <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
                <option value="percent">{t('discounts.create_modal.type_percent')}</option>
                <option value="fixed">{t('discounts.create_modal.type_fixed')}</option>
              </select>
            </div>
            <div>
              <label className="form-lbl">{t('discounts.create_modal.value_label')}</label>
              <input className="form-input" type="number" value={value} onChange={e => setValue(e.target.value)} placeholder={type === 'percent' ? '10' : '50'} />
            </div>
          </div>
          <div className="form-row2">
            <div>
              <label className="form-lbl">{t('discounts.create_modal.min_order_label')}</label>
              <input className="form-input" type="number" value={minOrder} onChange={e => setMinOrder(e.target.value)} placeholder={t('discounts.create_modal.min_order_placeholder')} />
            </div>
            <div>
              <label className="form-lbl">{t('discounts.create_modal.max_uses_label')}</label>
              <input className="form-input" type="number" value={maxUses} onChange={e => setMaxUses(e.target.value)} placeholder={t('discounts.create_modal.max_uses_placeholder')} />
            </div>
          </div>
          <div className="form-row2">
            <div>
              <label className="form-lbl">{t('discounts.create_modal.applies_label')}</label>
              <select className="form-select" value={appliesTo} onChange={e => setAppliesTo(e.target.value)}>
                <option value="all">{t('discounts.create_modal.applies_all')}</option>
                <option value="category">{t('discounts.create_modal.applies_category')}</option>
                <option value="pickup">{t('discounts.create_modal.applies_pickup')}</option>
              </select>
            </div>
            <div>
              <label className="form-lbl">{t('discounts.create_modal.expires_label')}</label>
              <input className="form-input" type="date" value={expires} onChange={e => setExpires(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="modal-large-footer">
          <button onClick={onClose} className="btn btn-outline modal-large-cancel">{t('common.cancel')}</button>
          <button onClick={handleCreate} disabled={saving || !code || !value} className="btn btn-primary modal-large-submit">
            <span className="material-symbols-outlined">add</span>
            {saving ? t('discounts.create_modal.creating') : t('discounts.create_modal.create_btn')}
          </button>
        </div>
      </div>
  </div>
  )
}

/* ── Main Component ── */
export default function Discounts() {
  const { t }                                 = useTranslation()
  const [activeTab, setActiveTab]             = useState(0)
  const { toasts, show }                      = useToast()

  const [storeDiscount, setStoreDiscount]     = useState(5)
  const [localDiscount, setLocalDiscount]     = useState(5)
  const [products, setProducts]               = useState([])
  const [prodSearch, setProdSearch]           = useState('')
  const [savingStore, setSavingStore]         = useState(false)
  const debounceRef                           = useRef(null)

  const [promoCodes, setPromoCodes]           = useState([])
  const [promoLoading, setPromoLoading]       = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm]     = useState(null)
  const [extendConfirm, setExtendConfirm]     = useState(null)
  const [newExpiry, setNewExpiry]             = useState('')

  function loadPickup(search = '') {
    const q = search ? `&product_name=${encodeURIComponent(search)}` : ''
    apiFetch(`${API}/boutique/discounts/pickup?page=1&limit=20${q}`)
      .then(r => r.json())
      .then(res => {
        if (!res.success) return
        const sw = res.data.store_wide?.pickup_discount_default ?? 5
        setStoreDiscount(sw); setLocalDiscount(sw)
        setProducts(res.data.products ?? [])
      })
  }

  function loadPromos() {
    setPromoLoading(true)
    apiFetch(`${API}/boutique/discounts/promo-codes`)
      .then(r => r.json())
      .then(res => { if (res.success) setPromoCodes(res.data.promo_codes ?? []) })
      .finally(() => setPromoLoading(false))
  }

  useEffect(() => { loadPickup(); loadPromos() }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => loadPickup(prodSearch), 350)
    return () => clearTimeout(debounceRef.current)
  }, [prodSearch])

  async function saveStoreDiscount() {
    setSavingStore(true)
    const res = await apiFetch(`${API}/boutique/discounts/pickup`, {
      method: 'PUT',
      body: JSON.stringify({ pickup_discount_default: localDiscount })
    }).then(r => r.json())
    setSavingStore(false)
    if (res.success) { setStoreDiscount(localDiscount); show('Store-wide discount updated', 'success') }
    else show(res.message ?? 'Failed to update')
  }

  async function saveProductOverride(product) {
    const pct = parseFloat(product.pickup_discount_pct ?? product.pct)
    if (isNaN(pct)) return
    const res = await apiFetch(`${API}/boutique/discounts/pickup/products/${product.id}`, {
      method: 'PUT',
      body: JSON.stringify({ pickup_discount_pct: pct })
    }).then(r => r.json())
    if (res.success) { show(`Updated ${res.data.name}`, 'success'); loadPickup(prodSearch) }
    else show(res.message ?? 'Failed to update')
  }

  function updateProductPct(id, val) {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, pickup_discount_pct: val } : p))
  }

  async function deletePromo(id) {
    const res = await apiFetch(`${API}/boutique/discounts/promo-codes/${id}`, {
      method: 'DELETE'
    }).then(r => r.json())
    if (res.success) { setPromoCodes(prev => prev.filter(p => p.id !== id)); show('Promo code deleted', 'success'); setDeleteConfirm(null) }
    else show(res.message ?? 'Failed to delete')
  }

  async function togglePromoStatus(promo) {
    const newStatus = promo.status === 'active' ? 'paused' : 'active'
    const res = await apiFetch(`${API}/boutique/discounts/promo-codes/${promo.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus })
    }).then(r => r.json())
    if (res.success) { setPromoCodes(prev => prev.map(p => p.id === promo.id ? { ...p, status: newStatus } : p)); show(`Promo code ${newStatus}`, 'success') }
    else if (res.message?.includes('expired')) { setExtendConfirm(promo); setNewExpiry('') }
    else show(res.message ?? 'Failed to update')
  }

  async function extendAndActivate() {
    if (!newExpiry) return
    const res = await apiFetch(`${API}/boutique/discounts/promo-codes/${extendConfirm.id}`, {
      method: 'PUT',
      body: JSON.stringify({ expires_at: new Date(newExpiry).toISOString(), status: 'active' })
    }).then(r => r.json())
    if (res.success) {
      setPromoCodes(prev => prev.map(p => p.id === extendConfirm.id ? { ...p, status:'active', expires_at: new Date(newExpiry).toISOString() } : p))
      show('Promo code extended and activated', 'success')
      setExtendConfirm(null)
    } else show(res.message ?? 'Failed to extend')
  }

  function handlePromoCreated(newPromo) {
    setPromoCodes(prev => [newPromo, ...prev])
    show('Promo code created', 'success')
  }

  const TABS = [t('discounts.tabs.pickup'), t('discounts.tabs.promo'), t('discounts.tabs.seasonal')]

  return (
    <>
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
                <div className="card-title">{t('discounts.pickup.title')} <em>{t('discounts.pickup.title_em')}</em></div>
              </div>
              <div className="dc-store-discount-inner">
                <div className="dc-store-discount-row">
                  <div className="dc-store-discount-body">
                    <div className="dc-store-discount-title">{t('discounts.pickup.default_label')}</div>
                    <div className="dc-store-discount-sub">{t('discounts.pickup.default_sub')}</div>
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
                    {savingStore ? t('discounts.pickup.saving') : t('discounts.pickup.save_btn', { pct: localDiscount })}
                  </button>
                )}
              </div>
              <div className="alert alert-info">
                <span className="material-symbols-outlined">info</span>
                {t('discounts.pickup.alert')}
              </div>
            </div>

            <div className="card">
              <div className="card-hdr">
                <div className="card-title">{t('discounts.pickup.overrides_title')} <em>{t('discounts.pickup.overrides_em')}</em></div>
                <div className="card-action" onClick={() => loadPickup(prodSearch)}>{t('discounts.pickup.refresh')}</div>
              </div>
              <div className="dc-prod-search">
                <span className="material-symbols-outlined dc-prod-search-icon">search</span>
                <input className="dc-prod-search-input" value={prodSearch} onChange={e => setProdSearch(e.target.value)} placeholder={t('discounts.pickup.search_placeholder')} />
              </div>
              {products.length === 0 && (
                <div className="dc-empty">
                  {prodSearch ? t('discounts.pickup.no_results') : t('discounts.pickup.no_products')}
                </div>
              )}
              {products.map(p => {
                const pct  = p.pickup_discount_pct ?? p.effective_pickup_pct ?? storeDiscount
                const calc = calcDiscounted(p.retail_price ?? p.retail, pct)
                return (
                  <div key={p.id} className="discount-card">
                    <div className="discount-img" style={{ backgroundImage:`url('${p.img ?? p.image_url}')`, background:(!p.img && !p.image_url) ? 'var(--mist)' : undefined }} />
                    <div className="discount-body">
                      <div className="discount-name">{p.name}</div>
                      <div className="discount-meta">Retail: €{parseFloat(p.retail_price ?? p.retail ?? 0).toFixed(2)}</div>
                    </div>
                    <input className="discount-pct-input" value={pct} onChange={e => updateProductPct(p.id, e.target.value)} onBlur={() => saveProductOverride({ ...p, pickup_discount_pct: pct })} />
                    <div className="dc-calc">
                      {calc ? <>{calc.price}<br /><span className="dc-calc-save">save {calc.save}</span></> : '—'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <div className="dc-promo-header">
              <h3 className="dc-promo-title">Promo <em className="dc-gold">{t('discounts.promo.title_em')}</em></h3>
              <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                <span className="material-symbols-outlined">add</span>{t('discounts.promo.new_btn')}
              </button>
            </div>
            <PromoList codes={promoCodes} onDeleteConfirm={setDeleteConfirm} onToggleStatus={togglePromoStatus} />
          </div>
        </div>
      )}

      {/* ── Tab 1: Promo Codes ── */}
      {activeTab === 1 && (
        <div>
          <div className="dc-promo-header">
            <h3 className="dc-promo-title">{t('discounts.promo.title')} <em className="dc-gold">{t('discounts.promo.title_em')}</em></h3>
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              <span className="material-symbols-outlined">add</span>{t('discounts.promo.new_btn')}
            </button>
          </div>
          {promoLoading
            ? <div className="dc-loading">{t('discounts.promo.loading')}</div>
            : <PromoList codes={promoCodes} onDeleteConfirm={setDeleteConfirm} onToggleStatus={togglePromoStatus} />
          }
        </div>
      )}

      {/* ── Tab 2: Seasonal Sales ── */}
      {activeTab === 2 && (
        <div className="card">
          <div className="card-hdr">
            <div className="card-title">{t('discounts.seasonal.title')} <em>{t('discounts.seasonal.title_em')}</em></div>
          </div>
          <div className="dc-empty">{t('discounts.seasonal.empty')}</div>
        </div>
      )}

      {/* Create promo modal */}
      {showCreateModal && (
        <CreatePromoModal onClose={() => setShowCreateModal(false)} onCreate={handlePromoCreated} />
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <>
          <div className="modal-backdrop" onClick={() => setDeleteConfirm(null)}>
            <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-confirm-title">
              {t('discounts.delete_modal.title')} <em className="modal-em-red">{t('discounts.delete_modal.title_em')}</em>
            </div>
            <div className="modal-confirm-msg">
              {t('discounts.delete_modal.msg', { code: deleteConfirm.code })}
            </div>
            <div className="modal-confirm-actions">
              <button onClick={() => setDeleteConfirm(null)} className="btn btn-outline modal-confirm-btn">{t('common.cancel')}</button>
              <button onClick={() => deletePromo(deleteConfirm.id)} className="btn btn-red modal-confirm-btn">
                {t('discounts.delete_modal.delete_btn')}
              </button>
            </div>
          </div>
          </div>
        </>
      )}

      {/* Extend & Activate modal */}
      {extendConfirm && (
        <>
          <div className="modal-backdrop" onClick={() => setExtendConfirm(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-confirm-title">
              {t('discounts.extend_modal.title')} <em className="dc-gold">{extendConfirm.code}</em>
            </div>
            <div className="modal-confirm-msg">{t('discounts.extend_modal.msg')}</div>
            <div className="form-group">
              <label className="form-lbl">{t('discounts.extend_modal.expiry_label')}</label>
              <input className="form-input" type="date" value={newExpiry} min={new Date().toISOString().split('T')[0]} onChange={e => setNewExpiry(e.target.value)} />
            </div>
            <div className="modal-confirm-actions">
              <button onClick={() => setExtendConfirm(null)} className="btn btn-outline modal-confirm-btn">{t('common.cancel')}</button>
              <button onClick={extendAndActivate} disabled={!newExpiry} className="btn btn-primary modal-confirm-btn">
                {t('discounts.extend_modal.submit_btn')}
              </button>
            </div>
          </div>
          </div>
        </>
      )}

      <Toast toasts={toasts} />
    </>
  )
}
