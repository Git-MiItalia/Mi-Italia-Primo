import { useState, useMemo, useEffect, useRef } from 'react'

// Italian standard VAT. Used only for the live cart total, which has to be
// shown before an order exists. Once the order is created the API returns its
// own vat_rate and the receipt uses that.
const VAT_RATE = 0.22
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'
import { statusLabel } from '../lib/statusLabel'
import { clearToken } from '../lib/auth'
import useLangStore from '../store/langStore'
import { SEED_POLICIES, RETURNS_CLASSES, BASELINE_POLICY_ID, DEFAULT_CLASS_ID, findById } from '../lib/returnsPolicy/model'
import { resolvePolicy, buildClassMap } from '../lib/returnsPolicy/engine'
import { receiptPolicyLine, guaranteeLine } from '../lib/returnsPolicy/copy'
import { fetchPolicies, fetchClasses } from '../lib/returnsPolicy/api'

const API      = import.meta.env.VITE_API_URL
const IMG_BASE = import.meta.env.VITE_IMG_BASE_URL

// ══ Helpers ═══════════════════════════════════════════════════════════

/* Which payment tab the modal opens on, from the boutique's saved preference.
 *
 * Store Profile › Tech Stack has always offered a "Default POS Payment Method"
 * and told the merchant it "pre-selects the payment tab when you open POS".
 * Nothing read it — POS opened on Cash for everyone — so the setting was a
 * promise the till never kept.
 *
 * The two screens name these differently and a straight lookup would not work:
 * the profile stores external_terminal / stripe / cash, the tabs here are
 * cash / card / external / split. 'stripe' is this modal's simulated Stripe
 * Terminal, which is the 'card' tab.
 *
 * 'external' was the missing one for a long time: a boutique on SumUp or
 * Verifone takes the payment on its own machine and only needs Primo to record
 * the sale, and there was no tab for that, so the till fell back to Cash and
 * filed the sale as cash — money in the Z-report that never reached the
 * drawer. The backend now accepts payment_method "external" and the tab
 * exists, so the sale is recorded as what it was.
 */
const POS_METHOD_BY_PREFERENCE = { cash: 'cash', stripe: 'card', external_terminal: 'external' }

/* Which payment tabs this boutique can actually complete.
 *
 * Tech Stack asks "How do you take card payments in-store?", and the answer
 * decides what the counter is physically able to do. The modal used to draw
 * Cash, Card and Split for everyone, so a cash-only shop was offered a Stripe
 * screen it could never finish, and a shop on a SumUp machine was offered the
 * same — both halfway through a real sale in front of a real customer.
 *
 *   none                              cash only, nothing else completes
 *   stripe                            the integrated terminal — Card is its tab
 *   sumup/square/verifone/bank/other  their own machine — External
 *
 * Split stays wherever a second method exists, since it is cash plus that.
 *
 * An absent profile — still loading, or never answered — keeps the old three
 * tabs. Showing a tab that turns out to be unusable is recoverable; hiding one
 * the shop needs, mid-sale, is not.
 */
function allowedMethods(profile) {
  const terminal = profile?.payment_terminal_type
  if (!terminal)           return ['cash', 'card', 'split']
  if (terminal === 'none') return ['cash']
  if (terminal === 'stripe') return ['cash', 'card', 'split']
  return ['cash', 'external', 'split']
}

function defaultPayMethod(profile) {
  // The two settings are saved independently, so a merchant can leave the
  // default on Stripe after changing the terminal answer to "none" — the
  // default is therefore filtered through what is actually on offer rather
  // than trusted, or the till would open on a tab that is not rendered.
  const wanted = POS_METHOD_BY_PREFERENCE[profile?.default_pos_payment_method] ?? 'cash'
  return allowedMethods(profile).includes(wanted) ? wanted : 'cash'
}

function fmt(n) { return '€' + Number(n).toFixed(2) }
function imgSrc(url) { return !url ? null : url.startsWith('http') ? url : `${IMG_BASE}${url}` }

// Extract distinct top-level categories from products' category_path
function extractCategories(products) {
  const set = new Set()
  for (const p of products) {
    const path = p.category_path || p.category || ''
    const top = path.split(/\s*\/\s*/)[0].trim()
    if (top) set.add(top)
  }
  return Array.from(set).sort()
}

// Reads staff info from localStorage — tries common key names defensively.
// Adjust the key names if your auth uses different storage.
function readStaffInfo() {
  try {
    const staffStr = localStorage.getItem('staff')
    if (staffStr) {
      const s = JSON.parse(staffStr)
      if (s?.name) return { name: s.name, role: s.role || '' }
    }
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const u = JSON.parse(userStr)
      if (u?.name) return { name: u.name, role: u.role || '' }
    }
    const authStr = localStorage.getItem('auth') || localStorage.getItem('authData')
    if (authStr) {
      const a = JSON.parse(authStr)
      const s = a?.staff || a?.user || a?.data?.staff
      if (s?.name) return { name: s.name, role: s.role || '' }
    }
  } catch (err) {
    console.warn('[POS] Could not read staff info from localStorage', err)
  }
  return { name: 'Staff', role: '' }
}

function getInitials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase() || 'S'
}

function formatTime(d) {
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

// ── Held-carts persistence ─────────────────────────────────────────────
const HELD_CARTS_KEY = 'pos_held_carts'
function loadHeldCarts() {
  try { return JSON.parse(localStorage.getItem(HELD_CARTS_KEY) || '[]') }
  catch { return [] }
}
function persistHeldCarts(carts) {
  try { localStorage.setItem(HELD_CARTS_KEY, JSON.stringify(carts)) } catch { /* private browsing or a full quota — held carts stay in memory for this session */ }
}

// ══ Variant Picker Modal ══════════════════════════════════════════════
function VariantPickerModal({ t, product, onClose, onPick }) {
  const lang = useLangStore(s => s.lang)
  const [variants, setVariants] = useState(null)   // null = loading
  const [selectedId, setSelectedId] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    apiFetch(`${API}/boutique/products/${product.id}`)
      .then(r => r.json())
      .then(res => {
        if (res?.success) {
          const vs = res.data?.variants ?? []
          setVariants(vs)
          // Never preselect a size that's switched off — it can't be sold.
          const firstSellable = vs.find(v => v.is_active !== false && Number(v.stock_qty ?? 0) > 0)
          if (firstSellable) setSelectedId(firstSellable.id)
          else {
            const firstActive = vs.find(v => v.is_active !== false)
            if (firstActive) setSelectedId(firstActive.id)
          }
        } else {
          setError(res?.message ?? 'Failed to load variants')
          setVariants([])
        }
      })
      .catch(err => {
        console.error('[VariantPicker] fetch failed', err)
        setError('Network error')
        setVariants([])
      })
  }, [product.id, lang])

  function handleAdd() {
    const variant = variants?.find(v => v.id === selectedId)
    if (variant) onPick(product, variant)
  }

  const loading = variants === null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-sm pos-variant-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <div className="modal-title">{t('pos.variant.title')} <em>{t('pos.variant.title_em')}</em></div>
          <button className="modal-close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="pos-vpick-prod">
          {product.main_photo && <img src={imgSrc(product.main_photo)} alt="" />}
          <div>
            <div className="pos-vpick-prod-name">{product.name}</div>
            <div className="pos-vpick-prod-sku">{product.sku}</div>
            <div className="pos-vpick-prod-price">{fmt(product.retail_price)}</div>
          </div>
        </div>

        {loading && <div className="pos-vpick-loading">{t('pos.variant.loading')}</div>}
        {error && <div className="alert alert-red pos-vpick-alert">{error}</div>}

        {!loading && variants && variants.length === 0 && !error && (
          <div className="pos-vpick-empty">{t('pos.variant.empty')}</div>
        )}

        {!loading && variants && variants.length > 0 && (
          <div className="pos-vpick-grid">
            {variants.map(v => {
              const stock    = Number(v.stock_qty ?? 0)
              const inactive = v.is_active === false
              const oos      = stock <= 0
              // A size switched off in the portal isn't on sale, so it can't be
              // rung up here either — otherwise the toggle only holds online.
              const blocked  = inactive || oos
              return (
                <button
                  key={v.id}
                  className={`pos-vpick-cell${selectedId === v.id ? ' on' : ''}${blocked ? ' oos' : ''}`}
                  disabled={blocked}
                  onClick={() => !blocked && setSelectedId(v.id)}>
                  <div className="pos-vpick-cell-size">{v.size_label ?? v.size_it ?? '—'}</div>
                  {v.colour && <div className="pos-vpick-cell-col">{v.colour}</div>}
                  <div className="pos-vpick-cell-stock">
                    {inactive
                      ? t('pos.variant.inactive', 'Not for sale')
                      : oos ? t('pos.variant.out') : `${stock} ${t('pos.variant.in_stock')}`}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={handleAdd} disabled={!selectedId || loading}>
            <span className="material-symbols-outlined">add_shopping_cart</span>
            {t('pos.variant.add_to_cart')}
          </button>
        </div>
      </div>
    </div>
  )
}

// The lookup returns one row per source, so the same person can appear several
// times — once as a CRM contact (`walkin`, carrying boutique_customer_id) and
// again as a Mi Italia account (`new_mi_italia`, carrying only
// mi_italia_user_id). Only the CRM row can be attached to an order, so picking
// the wrong twin silently recorded the sale as Guest.
//
// Merge by email (falling back to phone), keeping both ids, and put rows that
// can actually be linked first.
function mergeLookupResults(results) {
  const byKey = new Map()
  for (const r of results) {
    const key = (r.email || r.phone || r.boutique_customer_id || r.mi_italia_user_id || '')
      .toString().trim().toLowerCase()
    const existing = byKey.get(key)
    if (!existing) { byKey.set(key, { ...r }); continue }
    // Keep whichever id each row happens to carry, plus the richer profile.
    existing.boutique_customer_id = existing.boutique_customer_id ?? r.boutique_customer_id
    existing.mi_italia_user_id    = existing.mi_italia_user_id    ?? r.mi_italia_user_id
    existing.platform_profile     = existing.platform_profile     ?? r.platform_profile
    existing.profile_photo_url    = existing.profile_photo_url    ?? r.profile_photo_url
    existing.boutique_history     = existing.boutique_history     ?? r.boutique_history
    if (r.boutique_customer_id) existing.source = r.source
  }
  return [...byKey.values()].sort(
    (a, b) => (b.boutique_customer_id ? 1 : 0) - (a.boutique_customer_id ? 1 : 0)
  )
}

// ══ CustomerModal (functional) ═════════════════════════════════════════
function CustomerModal({ t, customer, onClose, onAttach, onDetach }) {
  const lang = useLangStore(s => s.lang)
  const [search, setSearch]       = useState('')
  const [results, setResults]     = useState([])
  const [searching, setSearching] = useState(false)
  const [mode, setMode]           = useState('search')   // 'search' | 'walkin'
  const [error, setError]         = useState(null)
  const [walkin, setWalkin]       = useState({ firstName: '', lastName: '', email: '', phone: '' })
  const [saving, setSaving]       = useState(false)
  const debRef = useRef(null)

  // Extra CRM detail (segment/tier/spend/visits) for an already-attached customer
  const [detail, setDetail] = useState(null)
  useEffect(() => {
    setDetail(null)
    if (!customer?.boutique_customer_id) return
    apiFetch(`${API}/boutique/customers/${customer.boutique_customer_id}`)
      .then(r => r.json())
      .then(res => { if (res?.success) setDetail(res.data) })
      .catch(err => console.error('[CustomerModal] detail fetch failed', err))
  }, [customer?.boutique_customer_id])

  // Message / re-engage
  const [showMessage, setShowMessage] = useState(false)
  const [msgSubject, setMsgSubject]   = useState('We miss you!')
  const [msgBody, setMsgBody]         = useState("It's been a while — come see our new arrivals.")
  const [msgSending, setMsgSending]   = useState(false)
  const [msgSent, setMsgSent]         = useState(false)
  const [msgError, setMsgError]       = useState(null)

  async function sendMessage() {
    if (!customer?.boutique_customer_id || !msgSubject.trim() || !msgBody.trim()) return
    setMsgSending(true); setMsgError(null)
    try {
      const res = await apiFetch(`${API}/boutique/customers/${customer.boutique_customer_id}/message`, {
        method: 'POST',
        body: JSON.stringify({ subject: msgSubject.trim(), message: msgBody.trim() }),
      }).then(r => r.json())
      if (res?.success) {
        setMsgSent(true)
        setTimeout(() => { setMsgSent(false); setShowMessage(false) }, 1800)
      } else {
        setMsgError(res?.message ?? 'Failed to send message.')
      }
    } catch { setMsgError('Network error') }
    finally { setMsgSending(false) }
  }

  useEffect(() => {
    if (!search.trim()) { setResults([]); return }
    clearTimeout(debRef.current)
    debRef.current = setTimeout(() => {
      setSearching(true)
      apiFetch(`${API}/boutique/pos/customers/lookup?q=${encodeURIComponent(search.trim())}`)
        .then(r => r.json())
        .then(res => { if (res?.success) setResults(mergeLookupResults(res.data?.results ?? [])) })
        .catch(err => console.error('[CustomerModal] lookup failed', err))
        .finally(() => setSearching(false))
    }, 300)
    return () => clearTimeout(debRef.current)
  }, [search, lang])

  // Backend has no server-side dedup on POST /boutique/customers (unconfirmed
  // either way, so we don't rely on it) — check the existing lookup by
  // email/phone first and let the cashier choose, rather than silently
  // creating a second record for someone already in the CRM.
  const [dupMatch, setDupMatch] = useState(null)

  async function checkDupAndCreate() {
    if (!walkin.firstName.trim()) { setError(t('pos.cust.first_required')); return }
    setSaving(true); setError(null)
    const emailQ = walkin.email.trim()
    const phoneQ = walkin.phone.trim()
    if (emailQ || phoneQ) {
      try {
        const lookupRes = await apiFetch(`${API}/boutique/pos/customers/lookup?q=${encodeURIComponent(emailQ || phoneQ)}`).then(r => r.json())
        const existing = lookupRes?.success
          ? (lookupRes.data?.results ?? []).find(r =>
              (emailQ && r.email?.toLowerCase() === emailQ.toLowerCase()) ||
              (phoneQ && r.phone?.replace(/\s+/g, '') === phoneQ.replace(/\s+/g, '')))
          : null
        if (existing) { setDupMatch(existing); setSaving(false); return }
      } catch { /* lookup failure shouldn't block creating the walk-in */ }
    }
    await createWalkin()
  }

  async function createWalkin() {
    setSaving(true); setError(null)
    try {
      const res = await apiFetch(`${API}/boutique/customers`, {
        method: 'POST',
        body: JSON.stringify({
          name:  `${walkin.firstName.trim()} ${walkin.lastName.trim()}`.trim(),
          email: walkin.email.trim() || undefined,
          phone: walkin.phone.trim() || undefined,
        }),
      }).then(r => r.json())
      if (res?.success) {
        onAttach({
          source:               'walkin',
          boutique_customer_id: res.data.id,
          mi_italia_user_id:    null,
          name:                 res.data.name,
          email:                res.data.email,
          phone:                res.data.phone,
        })
      } else {
        setError(res?.message ?? 'Failed to create customer.')
      }
    } catch { setError('Network error') }
    finally { setSaving(false) }
  }

  function attachExistingMatch() {
    onAttach({
      source:               dupMatch.source ?? 'walkin',
      boutique_customer_id: dupMatch.boutique_customer_id,
      mi_italia_user_id:    dupMatch.mi_italia_user_id ?? null,
      name:                 dupMatch.name,
      email:                dupMatch.email,
      phone:                dupMatch.phone,
    })
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-sm pos-cust-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <div className="modal-title">
            {customer ? <>{t('pos.cust.attached')} <em>{t('pos.cust.customer')}</em></> : mode === 'walkin' ? <>{t('pos.cust.add')} <em>{t('pos.cust.walkin')}</em></> : <>{t('pos.cust.attach')} <em>{t('pos.cust.customer')}</em></>}
          </div>
          <button className="modal-close" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>

        {customer && (
          <div className="pos-cust-attached">
            <div className="pos-cust-attached-name">{customer.name}</div>
            <div className="pos-cust-attached-meta">
              {customer.email && <span>{customer.email}</span>}
              {customer.phone && <span>{customer.phone}</span>}
              {customer.source && <span className="pos-cust-attached-source">{customer.source}</span>}
            </div>

            {detail && (
              <div className="pos-cust-attached-meta">
                {detail.segment && <span>{statusLabel(t, detail.segment)}</span>}
                {detail.tier && <span>{statusLabel(t, detail.tier)}</span>}
                <span>{t('pos.receipt.order') /* reuse "Order" label context */}: {detail.purchase_count ?? 0}</span>
                <span>€{Number(detail.boutique_total_spend ?? 0).toFixed(2)}</span>
              </div>
            )}

            {!showMessage ? (
              <div className="pos-cust-attached-actions">
                <button className="btn btn-outline btn-sm" onClick={() => setShowMessage(true)} disabled={!customer.boutique_customer_id}>
                  <span className="material-symbols-outlined">forum</span>{t('pos.cust.message', { defaultValue: 'Message' })}
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => { onDetach(); onClose() }}>
                  <span className="material-symbols-outlined">person_remove</span>{t('pos.cust.detach')}
                </button>
              </div>
            ) : (
              <div className="pos-cust-form">
                <input
                  className="pos-pay-input"
                  placeholder={t('pos.cust.message_subject', { defaultValue: 'Subject' })}
                  value={msgSubject}
                  onChange={e => setMsgSubject(e.target.value)}
                />
                <textarea
                  className="pos-pay-input"
                  rows={3}
                  placeholder={t('pos.cust.message_body', { defaultValue: 'Message' })}
                  value={msgBody}
                  onChange={e => setMsgBody(e.target.value)}
                />
                {msgError && <div className="alert alert-red pos-cust-alert">{msgError}</div>}
                <div className="modal-footer">
                  <button className="btn btn-outline" onClick={() => setShowMessage(false)}>{t('common.back')}</button>
                  <button className="btn btn-primary" onClick={sendMessage} disabled={msgSending || msgSent || !msgSubject.trim() || !msgBody.trim()}>
                    {msgSent ? `✓ ${t('pos.receipt.sent')}` : msgSending ? t('common.saving') : t('pos.cust.message_send', { defaultValue: 'Send' })}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {!customer && mode === 'search' && (
          <>
            <div className="pos-cust-search">
              <span className="material-symbols-outlined pos-cust-search-ic">person_search</span>
              <input
                autoFocus
                className="pos-cust-search-input"
                placeholder={t('pos.cust.search_placeholder')}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {searching && <div className="pos-cust-loading">{t('pos.cust.searching')}</div>}

            {!searching && search.trim() && results.length === 0 && (
              <div className="pos-cust-empty">
                {t('pos.cust.no_match', { query: search })}
              </div>
            )}

            {results.length > 0 && (
              <div className="pos-cust-results">
                {results.map(r => {
                  // Only a CRM contact can be attached to the order. Say so on
                  // the row rather than letting the cashier find out afterwards
                  // when the receipt says Guest.
                  const linkable = !!r.boutique_customer_id
                  return (
                    <button
                      key={r.boutique_customer_id || r.mi_italia_user_id}
                      className={`pos-cust-result${linkable ? '' : ' pos-cust-result-unlinked'}`}
                      onClick={() => { onAttach(r); onClose() }}>
                      <div className="pos-cust-result-av">
                        {(r.name || '?').split(/\s+/).slice(0,2).map(n=>n[0]).join('').toUpperCase()}
                      </div>
                      <div className="pos-cust-result-info">
                        <div className="pos-cust-result-name">
                          {r.name}
                          <span className={`pos-cust-badge${linkable ? ' crm' : ''}`}>
                            {linkable
                              ? t('pos.cust.in_crm', 'In your CRM')
                              : t('pos.cust.mi_only', 'Mi Italia only')}
                          </span>
                        </div>
                        <div className="pos-cust-result-meta">
                          {r.email || r.phone || '—'}
                          {r.platform_profile?.tier && <span className="pos-cust-result-tier"> · {r.platform_profile.tier}</span>}
                          {!linkable && ` · ${t('pos.cust.not_linked_hint', 'sale records as Guest')}`}
                        </div>
                      </div>
                      <span className="material-symbols-outlined pos-cust-result-chev">chevron_right</span>
                    </button>
                  )
                })}
              </div>
            )}

            <div className="pos-cust-walkin-link">
              <button className="btn-ghost" onClick={() => setMode('walkin')}>
                <span className="material-symbols-outlined">person_add</span>
                {t('pos.cust.add_walkin')}
              </button>
            </div>
          </>
        )}

        {!customer && mode === 'walkin' && (
          <>
            <div className="pos-cust-form">
              <div className="pos-cust-form-row">
                <input
                  className="pos-pay-input"
                  placeholder={t('pos.cust.first_name')}
                  autoFocus
                  value={walkin.firstName}
                  onChange={e => setWalkin(w => ({ ...w, firstName: e.target.value }))}
                />
                <input
                  className="pos-pay-input"
                  placeholder={t('pos.cust.last_name')}
                  value={walkin.lastName}
                  onChange={e => setWalkin(w => ({ ...w, lastName: e.target.value }))}
                />
              </div>
              <input
                className="pos-pay-input"
                placeholder={t('staff.table.email', 'Email')}
                value={walkin.email}
                onChange={e => { setWalkin(w => ({ ...w, email: e.target.value })); setDupMatch(null) }}
              />
              <input
                className="pos-pay-input"
                placeholder={t('staff.invite_modal.phone_label', 'Phone')}
                value={walkin.phone}
                onChange={e => { setWalkin(w => ({ ...w, phone: e.target.value })); setDupMatch(null) }}
              />
            </div>

            {dupMatch && (
              <div className="alert alert-red pos-cust-alert">
                <div>{t('pos.cust.dup_found', { name: dupMatch.name, defaultValue: `Already in CRM: ${dupMatch.name}` })}</div>
                <div className="modal-footer">
                  <button className="btn btn-outline btn-sm" onClick={() => { setDupMatch(null); createWalkin() }} disabled={saving}>
                    {t('pos.cust.dup_create_anyway', { defaultValue: 'Create new anyway' })}
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={attachExistingMatch}>
                    {t('pos.cust.dup_attach_existing', { defaultValue: 'Attach existing' })}
                  </button>
                </div>
              </div>
            )}

            {error && <div className="alert alert-red pos-cust-alert">{error}</div>}
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setMode('search')}>{t('common.back')}</button>
              <button className="btn btn-primary" onClick={checkDupAndCreate} disabled={saving || !walkin.firstName.trim() || !!dupMatch}>
                {saving ? t('common.saving') : t('pos.cust.save_attach')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ══ DiscountModal (functional) ═════════════════════════════════════════
function DiscountModal({ t, current, subtotal, cart, onClose, onApply, onRemove }) {
  const [type, setType]   = useState(current?.type ?? 'pct')
  const [value, setValue] = useState(current?.value ?? '')
  const [code, setCode]   = useState(current?.code ?? '')
  const [quoting, setQuoting] = useState(false)
  const [quoteError, setQuoteError] = useState(null)

  const previewAmount = (() => {
    if (type === 'pct')   return Math.round(subtotal * (Number(value) || 0) / 100 * 100) / 100
    if (type === 'fixed') return Math.min(Number(value) || 0, subtotal)
    return 0
  })()
  const newTotal = Math.max(0, subtotal - previewAmount)

  async function handleApply() {
    if (type === 'code') {
      if (!code.trim()) return
      setQuoting(true); setQuoteError(null)
      try {
        const res = await apiFetch(`${API}/boutique/orders/pos/quote`, {
          method: 'POST',
          body: JSON.stringify({
            items: (cart ?? []).map(i => ({ unit_price: i.price, qty: i.qty })),
            promo_code: code.trim(),
            vat_rate: 0.22,
          }),
        }).then(r => r.json())
        if (res?.success && Number(res.data?.promo_discount) > 0) {
          onApply({ type: 'code', value: Number(res.data.promo_discount), code: code.trim() })
          onClose()
        } else {
          setQuoteError(res?.message ?? 'That code isn’t valid for this order.')
        }
      } catch { setQuoteError('Network error') }
      finally { setQuoting(false) }
    } else {
      const v = Number(value)
      if (!v || v <= 0) return
      onApply({ type, value: v })
      onClose()
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-sm pos-disc-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <div className="modal-title">{t('pos.disc_modal.title')} <em>{t('pos.disc_modal.title_em')}</em></div>
          <button className="modal-close" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>

        <div className="pos-disc-tabs">
          {[
            { k: 'pct',   label: t('pos.disc_modal.pct'),   ic: 'percent' },
            { k: 'fixed', label: t('pos.disc_modal.fixed'), ic: 'euro' },
            { k: 'code',  label: t('pos.disc_modal.code'),  ic: 'sell' },
          ].map(t => (
            <button
              key={t.k}
              className={`pos-disc-tab${type === t.k ? ' on' : ''}`}
              onClick={() => setType(t.k)}>
              <span className="material-symbols-outlined">{t.ic}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <div className="pos-disc-body">
          {type === 'pct' && (
            <>
              <div className="pos-pay-field-lbl">{t('pos.disc_modal.pct_label')}</div>
              <div className="pos-disc-input-wrap">
                <input
                  autoFocus
                  className="pos-pay-input pos-disc-input"
                  inputMode="decimal"
                  placeholder="0"
                  value={value}
                  onChange={e => setValue(e.target.value.replace(/[^\d.]/g, ''))}
                />
                <span className="pos-disc-input-suffix">%</span>
              </div>
            </>
          )}
          {type === 'fixed' && (
            <>
              <div className="pos-pay-field-lbl">{t('pos.disc_modal.fixed_label')}</div>
              <div className="pos-disc-input-wrap">
                <span className="pos-disc-input-prefix">€</span>
                <input
                  autoFocus
                  className="pos-pay-input pos-disc-input"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={value}
                  onChange={e => setValue(e.target.value.replace(/[^\d.]/g, ''))}
                />
              </div>
            </>
          )}
          {type === 'code' && (
            <>
              <div className="pos-pay-field-lbl">{t('pos.disc_modal.code_label')}</div>
              <input
                autoFocus
                className="pos-pay-input"
                placeholder="e.g. SUMMER25"
                value={code}
                onChange={e => { setCode(e.target.value.toUpperCase()); setQuoteError(null) }}
              />
              {quoteError && <div className="alert alert-red pos-pay-note">{quoteError}</div>}
              <div className="pos-pay-note">
                <span className="material-symbols-outlined">info</span>
                <span>{t('pos.disc_modal.code_note')}</span>
              </div>
            </>
          )}
        </div>

        {type !== 'code' && (
          <div className="pos-disc-preview">
            <div><span>{t('pos.subtotal')}</span><span>{fmt(subtotal)}</span></div>
            <div className="pos-disc-preview-neg"><span>{t('pos.discount')}</span><span>−{fmt(previewAmount)}</span></div>
            <div className="pos-disc-preview-total"><span>{t('pos.disc_modal.new_subtotal')}</span><span>{fmt(newTotal)}</span></div>
          </div>
        )}

        <div className="modal-footer">
          {current && (
            <button className="btn btn-red btn-sm" onClick={() => { onRemove(); onClose() }}>
              <span className="material-symbols-outlined">delete</span>{t('common.remove')}
            </button>
          )}
          <button className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={handleApply} disabled={quoting || (type === 'code' && !code.trim())}>
            {quoting ? t('common.saving') : t('common.apply')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ HoldModal (localStorage) ═══════════════════════════════════════════
function HoldModal({ t, cart, customer, discount, heldCarts, onClose, onSaveNew, onRetrieve, onDelete }) {
  const lang = useLangStore(s => s.lang)
  const [note, setNote] = useState('')
  const canSave = cart.length > 0

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal pos-hold-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <div className="modal-title">{t('pos.hold.title')} <em>{t('pos.hold.title_em')}</em></div>
          <button className="modal-close" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>

        {canSave && (
          <div className="pos-hold-save">
            <div className="pos-pay-field-lbl">{t('pos.hold.save_current')}</div>
            <div className="pos-hold-save-row">
              <input
                className="pos-pay-input"
                placeholder={t('pos.hold.note_placeholder')}
                value={note}
                onChange={e => setNote(e.target.value)}
              />
              <button className="btn btn-primary btn-sm" onClick={() => onSaveNew(note)}>
                <span className="material-symbols-outlined">pause_circle</span>
                {t('pos.hold_btn')}
              </button>
            </div>
            <div className="pos-hold-save-sum">
              {t('pos.hold.items_count', { count: cart.length })}
              {customer && ` · ${customer.name}`}
              {discount && ` · ${t('pos.hold.discounted')}`}
            </div>
          </div>
        )}

        <div className="pos-hold-list-hdr">
          {heldCarts.length === 0
            ? t('pos.hold.no_held')
            : t('pos.hold.held_count', { count: heldCarts.length })}
        </div>

        {heldCarts.length === 0 ? (
          <div className="pos-hold-empty">
            <span className="material-symbols-outlined">history</span>
            <div>{t('pos.hold.empty_hint')}</div>
          </div>
        ) : (
          <div className="pos-hold-list">
            {heldCarts.map(h => {
              const holdTotal = h.items.reduce((s, i) => s + i.price * i.qty, 0)
              const ts = new Date(h.timestamp)
              return (
                <div key={h.id} className="pos-hold-row">
                  <div className="pos-hold-row-info">
                    <div className="pos-hold-row-title">
                      {h.note || `${t('pos.hold.cart')} · ${t('pos.hold.items_count', { count: h.items.length })}`}
                    </div>
                    <div className="pos-hold-row-meta">
                      {t('pos.hold.items_count', { count: h.items.length })} · {fmt(holdTotal)}
                      {h.customer?.name && ` · ${h.customer.name}`}
                    </div>
                    <div className="pos-hold-row-time">
                      {ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      &nbsp;·&nbsp;
                      {ts.toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB')}
                    </div>
                  </div>
                  <div className="pos-hold-row-actions">
                    <button className="btn btn-outline btn-sm" onClick={() => onDelete(h.id)}>
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => onRetrieve(h.id)}>
                      {t('pos.hold.retrieve')}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ══ ReturnModal ══════════════════════════════════════════════════════
// Flow: GET /orders/search?q= (best-effort field names — the real search
// response hasn't been observed with a match yet) → pick a result → GET
// /orders/:id for the confirmed full shape (order_item_id per line) →
// POST /orders/:id/return.
const RETURN_REASON_TEXT = {
  defective:        'Item defective',
  wrong_size:       'Wrong size',
  customer_change:  'Customer changed their mind',
  not_as_described: 'Not as described',
  other:            'Other',
}

function ReturnModal({ t, onClose }) {
  const lang = useLangStore(s => s.lang)
  const [search, setSearch]       = useState('')
  const [searching, setSearching] = useState(false)
  const [searched, setSearched]   = useState(false)
  const [results, setResults]     = useState([])
  const [selected, setSelected]   = useState(null)   // full order detail (GET /orders/:id)
  const [loadingOrder, setLoadingOrder] = useState(false)
  const [returnQty, setReturnQty] = useState({})     // { order_item_id: qty }
  const [reason, setReason]       = useState('defective')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState(null)
  const [done, setDone]           = useState(null)
  const debRef = useRef(null)

  useEffect(() => {
    if (!search.trim()) { setResults([]); setSearched(false); return }
    clearTimeout(debRef.current)
    debRef.current = setTimeout(() => {
      setSearching(true)
      apiFetch(`${API}/boutique/orders/search?q=${encodeURIComponent(search.trim())}`)
        .then(r => r.json())
        .then(res => { setResults(res?.data?.orders ?? []); setSearched(true) })
        .catch(err => console.error('[ReturnModal] search failed', err))
        .finally(() => setSearching(false))
    }, 350)
    return () => clearTimeout(debRef.current)
  }, [search])

  function pickOrder(id) {
    setSelected(null); setLoadingOrder(true); setReturnQty({}); setError(null); setDone(null)
    apiFetch(`${API}/boutique/orders/${id}`)
      .then(r => r.json())
      .then(res => {
        if (res?.success) setSelected(res.data)
        else setError(res?.message ?? 'Failed to load order')
      })
      .catch(() => setError('Network error'))
      .finally(() => setLoadingOrder(false))
  }

  function reset() { setSelected(null); setReturnQty({}); setError(null); setDone(null) }

  function toggleQty(item, delta) {
    setReturnQty(m => {
      const cur = m[item.id] || 0
      const next = Math.min(item.qty, Math.max(0, cur + delta))
      return { ...m, [item.id]: next }
    })
  }
  const refundTotal = selected
    ? selected.items.reduce((s, i) => s + (returnQty[i.id] || 0) * Number(i.unit_price), 0)
    : 0

  async function handleProcess() {
    if (!selected || refundTotal === 0) return
    setSubmitting(true); setError(null)
    try {
      const items = selected.items
        .filter(i => (returnQty[i.id] || 0) > 0)
        .map(i => ({ order_item_id: i.id, qty: returnQty[i.id] }))
      const res = await apiFetch(`${API}/boutique/orders/${selected.id}/return`, {
        method: 'POST',
        body: JSON.stringify({ items, reason: RETURN_REASON_TEXT[reason], refund_method: 'store_credit' }),
      }).then(r => r.json())
      if (res?.success) setDone(res.data?.return ?? { total_refund_amount: refundTotal })
      else setError(res?.message ?? 'Failed to process return')
    } catch { setError('Network error') }
    finally { setSubmitting(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal pos-return-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <div className="modal-title">{t('pos.ret.title')} <em>{t('pos.ret.title_em')}</em></div>
          <button className="modal-close" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>

        {done ? (
          <>
            <div className="pos-pay-suc-ic"><span className="material-symbols-outlined">check_circle</span></div>
            <div className="pos-pay-suc-title">{t('pos.ret.done_title', { defaultValue: 'Return processed' })}</div>
            <div className="pos-pay-suc-meta">
              <div><span className="pos-pay-suc-lbl">{t('pos.ret.refund_total')}</span> <span className="pos-pay-suc-val">{fmt(done.total_refund_amount ?? refundTotal)}</span></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={onClose}>{t('common.close')}</button>
            </div>
          </>
        ) : !selected ? (
          <>
            <input
              className="pos-pay-input pos-ret-search"
              placeholder={t('pos.ret.search_placeholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {(searching || loadingOrder) && <div className="pos-ret-empty">{t('pos.cust.searching')}</div>}
            {!searching && !loadingOrder && (
              <div className="pos-ret-list">
                {results.map(o => {
                  const oid   = o.id ?? o.order_id
                  const label = o.customer_name ?? o.name ?? o.email ?? o.phone ?? t('pos.cust.walkin')
                  const when  = o.created_at ?? o.date
                  const amt   = o.gross_amount ?? o.total
                  return (
                    <button key={oid} className="pos-ret-order" onClick={() => pickOrder(oid)}>
                      <div>
                        <div className="pos-ret-order-cust">{label}</div>
                        <div className="pos-ret-order-meta">#{String(oid).slice(0,8)}{when ? ` · ${new Date(when).toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB')}` : ''}</div>
                      </div>
                      {amt != null && <div className="pos-ret-order-total">{fmt(amt)}</div>}
                    </button>
                  )
                })}
                {searched && results.length === 0 && <div className="pos-ret-empty">{t('pos.ret.no_orders')}</div>}
              </div>
            )}
            {error && <div className="alert alert-red pos-cust-alert">{error}</div>}
          </>
        ) : (
          <>
            <div className="pos-ret-sel-hdr">
              <div>
                <div className="pos-ret-sel-cust">{selected.name || selected.email || selected.phone || t('pos.cust.walkin')}</div>
                <div className="pos-ret-sel-meta">#{String(selected.id).slice(0,8)} · {new Date(selected.created_at).toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB')} · {fmt(selected.gross_amount)}</div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={reset}>
                {t('pos.ret.change_order')}
              </button>
            </div>

            <div className="pos-ret-items">
              {selected.items.map(i => (
                <div key={i.id} className="pos-ret-item">
                  <div className="pos-ret-item-info">
                    <div className="pos-ret-item-name">{i.product_name_snapshot}{i.variant_size_snapshot ? ` · ${i.variant_size_snapshot}` : ''}</div>
                    <div className="pos-ret-item-price">{fmt(i.unit_price)} · qty {i.qty}</div>
                  </div>
                  <div className="pos-qty-ctrl">
                    <button className="pos-qty-btn" onClick={() => toggleQty(i, -1)}><span className="material-symbols-outlined">remove</span></button>
                    <span className="pos-qty-val">{returnQty[i.id] || 0}</span>
                    <button className="pos-qty-btn" onClick={() => toggleQty(i, 1)}><span className="material-symbols-outlined">add</span></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pos-ret-reason">
              <div className="pos-pay-field-lbl">{t('pos.ret.reason')}</div>
              <select className="pos-pay-input" value={reason} onChange={e => setReason(e.target.value)}>
                <option value="defective">{t('pos.ret.reason_defective')}</option>
                <option value="wrong_size">{t('pos.ret.reason_wrong_size')}</option>
                <option value="customer_change">{t('pos.ret.reason_changed_mind')}</option>
                <option value="not_as_described">{t('pos.ret.reason_not_described')}</option>
                <option value="other">{t('pos.ret.reason_other')}</option>
              </select>
            </div>

            <div className="pos-ret-refund">
              <span>{t('pos.ret.refund_total')}</span>
              <span className="pos-ret-refund-val">{fmt(refundTotal)}</span>
            </div>

            {error && <div className="alert alert-red pos-cust-alert">{error}</div>}

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
              <button className="btn btn-primary" onClick={handleProcess} disabled={refundTotal === 0 || submitting}>
                {submitting ? t('common.saving') : t('pos.ret.process_refund')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ══ FattureModal ═════════════════════════════════════════════════════
// GET /boutique/fatture?status=&page=&limit= — confirmed status values so
// far: 'issued', 'failed'. No 'pending' observed, so that tab was dropped.
function FattureModal({ t, onClose }) {
  const lang = useLangStore(s => s.lang)
  const [filter, setFilter]         = useState('all')   // 'all' | 'issued' | 'failed'
  const [fatture, setFatture]       = useState([])
  const [pagination, setPagination] = useState(null)
  const [page, setPage]             = useState(1)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)

  useEffect(() => {
    setLoading(true); setError(null)
    const statusQ = filter === 'all' ? '' : `&status=${filter}`
    apiFetch(`${API}/boutique/fatture?page=${page}&limit=20${statusQ}`)
      .then(r => r.json())
      .then(res => {
        if (res?.success) {
          setFatture(res.data?.fatture ?? [])
          setPagination(res.data?.pagination ?? null)
        } else {
          setError(res?.message ?? 'Failed to load fatture')
        }
      })
      .catch(() => setError('Network error'))
      .finally(() => setLoading(false))
  }, [filter, page])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal pos-fatture-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <div className="modal-title">{t('pos.fatt.title')} / <em>{t('pos.fatt.title_em')}</em></div>
          <button className="modal-close" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>

        <div className="pos-fatt-filters">
          {[
            { k:'all',    label: t('pos.fatt.all') },
            { k:'issued', label: t('pos.fatt.delivered') },
            { k:'failed', label: t('pos.fatt.error') },
          ].map(f => (
            <button
              key={f.k}
              className={`pos-fatt-filter${filter === f.k ? ' on' : ''}`}
              onClick={() => { setFilter(f.k); setPage(1) }}>
              <span>{f.label}</span>
            </button>
          ))}
        </div>

        {loading && <div className="pos-fatt-empty">{t('pos.variant.loading')}</div>}
        {error && <div className="alert alert-red pos-cust-alert">{error}</div>}

        {!loading && !error && (
          <div className="pos-fatt-table">
            <div className="pos-fatt-row pos-fatt-row-head">
              <span>{t('pos.fatt.col_invoice')}</span>
              <span>{t('pos.fatt.col_customer')}</span>
              <span className="pos-fatt-num">{t('pos.fatt.col_amount')}</span>
              <span>{t('pos.fatt.col_status')}</span>
              <span>{t('pos.fatt.col_date')}</span>
            </div>
            {fatture.map(f => (
              <div key={f.id} className="pos-fatt-row">
                <span className="pos-fatt-id">{f.fattura_number}</span>
                <span>
                  {f.buyer_name || '—'}
                  <div className="pos-fatt-kind">{f.fattura_kind}</div>
                </span>
                <span className="pos-fatt-num">{fmt(f.amount)}</span>
                <span>
                  <span className={`pos-fatt-badge pos-fatt-badge-${f.status === 'issued' ? 'delivered' : 'error'}`}>{statusLabel(t, f.status)}</span>
                </span>
                <span className="pos-fatt-date">{new Date(f.issued_at ?? f.created_at).toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB')}</span>
              </div>
            ))}
            {fatture.length === 0 && <div className="pos-fatt-empty">{t('pos.fatt.empty')}</div>}
          </div>
        )}

        {pagination && pagination.total_pages > 1 && (
          <div className="modal-footer">
            <button className="btn btn-outline btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>‹</button>
            <span>{page} / {pagination.total_pages}</span>
            <button className="btn btn-outline btn-sm" onClick={() => setPage(p => Math.min(pagination.total_pages, p + 1))} disabled={page >= pagination.total_pages}>›</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ══ FixResendModal ═══════════════════════════════════════════════════
// GET /boutique/fatture?status=failed → pick one → POST /fatture/:id/retry.
// Shows every buyer fiscal field for the fattura's kind (prefilled from
// whatever's already on it) rather than guessing a single field from
// error_message text — more robust than string-matching an error string
// that could be worded differently for other failure causes.
function FixResendModal({ t, onClose }) {
  const [errors, setErrors]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm]         = useState({ buyer_name: '', buyer_codice_fiscale: '', buyer_piva: '', buyer_sdi_code: '', buyer_pec: '' })
  const [processing, setProcessing] = useState(false)
  const [retryError, setRetryError] = useState(null)

  useEffect(() => {
    setLoading(true); setLoadError(null)
    apiFetch(`${API}/boutique/fatture?status=failed&limit=50`)
      .then(r => r.json())
      .then(res => {
        if (res?.success) setErrors(res.data?.fatture ?? [])
        else setLoadError(res?.message ?? 'Failed to load')
      })
      .catch(() => setLoadError('Network error'))
      .finally(() => setLoading(false))
  }, [])

  function pick(f) {
    setSelected(f)
    setForm({
      buyer_name:           f.buyer_name ?? '',
      buyer_codice_fiscale: f.buyer_codice_fiscale ?? '',
      buyer_piva:           f.buyer_piva ?? '',
      buyer_sdi_code:       f.buyer_sdi_code ?? '',
      buyer_pec:            f.buyer_pec ?? '',
    })
    setRetryError(null)
  }

  const canRetry = selected?.fattura_kind === 'privato'
    ? form.buyer_name.trim() && form.buyer_codice_fiscale.trim()
    : form.buyer_name.trim() && form.buyer_piva.trim() && (form.buyer_sdi_code.trim() || form.buyer_pec.trim())

  async function handleRetry() {
    if (!selected || !canRetry) return
    setProcessing(true); setRetryError(null)
    try {
      const body = selected.fattura_kind === 'privato'
        ? { buyer_name: form.buyer_name.trim(), buyer_codice_fiscale: form.buyer_codice_fiscale.trim() }
        : {
            buyer_name: form.buyer_name.trim(),
            buyer_piva: form.buyer_piva.trim(),
            ...(form.buyer_sdi_code.trim() ? { buyer_sdi_code: form.buyer_sdi_code.trim() } : {}),
            ...(form.buyer_pec.trim() ? { buyer_pec: form.buyer_pec.trim() } : {}),
          }
      const res = await apiFetch(`${API}/boutique/fatture/${selected.id}/retry`, {
        method: 'POST',
        body: JSON.stringify(body),
      }).then(r => r.json())
      if (res?.success) {
        setErrors(list => list.filter(e => e.id !== selected.id))
        setSelected(null)
      } else {
        setRetryError(res?.message ?? 'Retry failed')
      }
    } catch { setRetryError('Network error') }
    finally { setProcessing(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal pos-fix-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <div className="modal-title">{t('pos.fix.title')} <em>{t('pos.fix.title_em')}</em></div>
          <button className="modal-close" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>

        {loading && <div className="pos-fix-hdr">{t('pos.variant.loading')}</div>}
        {loadError && <div className="alert alert-red pos-cust-alert">{loadError}</div>}

        {!loading && !loadError && !selected && (
          <>
            <div className="pos-fix-hdr">
              {t('pos.fix.failed_count', { count: errors.length })}
            </div>
            <div className="pos-fix-list">
              {errors.map(e => (
                <button key={e.id} className="pos-fix-row" onClick={() => pick(e)}>
                  <div className="pos-fix-row-hd">
                    <span className="pos-fix-row-id">{e.fattura_number}</span>
                    <span className="pos-fix-row-amt">{fmt(e.amount)}</span>
                  </div>
                  <div className="pos-fix-row-cust">{e.buyer_name || '—'}</div>
                  <div className="pos-fix-row-err">
                    <span className="material-symbols-outlined">error</span>
                    {e.error_message}
                  </div>
                </button>
              ))}
              {errors.length === 0 && <div className="pos-fix-hdr">{t('pos.fatt.empty')}</div>}
            </div>
          </>
        )}

        {selected && (
          <>
            <div className="pos-fix-detail">
              <div className="pos-fix-detail-hd">
                <div>
                  <div className="pos-fix-detail-id">{selected.fattura_number}</div>
                  <div className="pos-fix-detail-cust">{selected.buyer_name || '—'} · {fmt(selected.amount)}</div>
                </div>
                <button className="btn btn-outline btn-sm" onClick={() => setSelected(null)}>{t('common.back')}</button>
              </div>

              <div className="pos-pay-field-lbl">{t('pos.fix.error_label')}</div>
              <div className="pos-fix-err-box">{selected.error_message}</div>

              <div className="pos-pay-field-lbl">{t('pos.fix.suggested', { defaultValue: 'Buyer fiscal details' })}</div>
              {selected.fattura_kind === 'privato' ? (
                <div className="pos-pay-fattura-fields">
                  <input
                    className="pos-pay-input"
                    placeholder={t('pos.pay.buyer_name', { defaultValue: 'Full name' })}
                    value={form.buyer_name}
                    onChange={e => setForm(f => ({ ...f, buyer_name: e.target.value }))}
                  />
                  <input
                    className="pos-pay-input"
                    placeholder={t('pos.pay.buyer_cf', { defaultValue: 'Codice Fiscale (16 chars)' })}
                    value={form.buyer_codice_fiscale}
                    maxLength={16}
                    onChange={e => setForm(f => ({ ...f, buyer_codice_fiscale: e.target.value.toUpperCase() }))}
                  />
                </div>
              ) : (
                <div className="pos-pay-fattura-fields">
                  <input
                    className="pos-pay-input"
                    placeholder={t('pos.pay.buyer_company', { defaultValue: 'Ragione sociale' })}
                    value={form.buyer_name}
                    onChange={e => setForm(f => ({ ...f, buyer_name: e.target.value }))}
                  />
                  <input
                    className="pos-pay-input"
                    placeholder={t('pos.pay.buyer_piva', { defaultValue: 'P.IVA' })}
                    value={form.buyer_piva}
                    onChange={e => setForm(f => ({ ...f, buyer_piva: e.target.value.toUpperCase() }))}
                  />
                  <input
                    className="pos-pay-input"
                    placeholder={t('pos.pay.buyer_sdi', { defaultValue: 'Codice Destinatario (7 chars)' })}
                    value={form.buyer_sdi_code}
                    maxLength={7}
                    onChange={e => setForm(f => ({ ...f, buyer_sdi_code: e.target.value.toUpperCase() }))}
                  />
                  <input
                    className="pos-pay-input"
                    type="email"
                    placeholder={t('pos.pay.buyer_pec', { defaultValue: 'PEC email' })}
                    value={form.buyer_pec}
                    onChange={e => setForm(f => ({ ...f, buyer_pec: e.target.value }))}
                  />
                </div>
              )}
              {retryError && <div className="alert alert-red pos-cust-alert">{retryError}</div>}
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={onClose}>{t('common.close')}</button>
              <button className="btn btn-primary" onClick={handleRetry} disabled={processing || !canRetry}>
                {processing ? t('pos.fix.retrying') : t('pos.fix.retry')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ══ ReceiptModal (print + email stub) ══════════════════════════════════
function ReceiptModal({ t, order, cart, customer, rpPolicies, boutique, onClose }) {
  const lang = useLangStore(s => s.lang)
  const [email, setEmail] = useState(customer?.email || '')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  function handlePrint() {
    const html = buildReceiptHtml(order, cart, customer, rpPolicies, lang, boutique, t)
    const w = window.open('', '', 'width=380,height=800')
    if (!w) { alert('Popup blocked. Please allow popups for this site.'); return }
    w.document.write(html)
    w.document.close()
    setTimeout(() => { try { w.print() } catch { /* popup closed before the dialog opened */ } }, 300)
  }

  const [emailError, setEmailError] = useState(null)
  async function handleEmail() {
    if (!email.trim() || !order?.id) return
    setSending(true); setEmailError(null)
    try {
      const res = await apiFetch(`${API}/boutique/orders/${order.id}/receipt/email`, {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      }).then(r => r.json())
      if (res?.success) {
        setSent(true)
        setTimeout(() => setSent(false), 2500)
      } else {
        setEmailError(res?.message ?? 'Failed to send receipt.')
      }
    } catch { setEmailError('Network error') }
    finally { setSending(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal pos-receipt-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <div className="modal-title">{t('pos.receipt.title')} <em>{t('pos.receipt.title_em')}</em></div>
          <button className="modal-close" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>

        <div className="pos-rec-summary">
          <div><span>{t('pos.receipt.order')}</span> <strong>#{(order?.id ?? '').slice(0, 8) || '—'}</strong></div>
          <div><span>{t('pos.total')}</span> <strong>{fmt(order?.gross_amount ?? 0)}</strong></div>
        </div>

        <button className="pos-rec-btn" onClick={handlePrint}>
          <span className="material-symbols-outlined">print</span>
          <div className="pos-rec-btn-info">
            <div className="pos-rec-btn-title">{t('pos.receipt.print')}</div>
            <div className="pos-rec-btn-sub">{t('pos.receipt.print_sub')}</div>
          </div>
        </button>

        <div className="pos-rec-email">
          <div className="pos-pay-field-lbl">{t('pos.receipt.email')}</div>
          <div className="pos-rec-email-row">
            <input
              className="pos-pay-input"
              type="email"
              placeholder="customer@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={handleEmail}
              disabled={sending || !email.trim() || sent}>
              {sent ? `✓ ${t('pos.receipt.sent')}` : sending ? t('pos.receipt.sending') : t('pos.receipt.send')}
            </button>
          </div>
          {emailError && <div className="alert alert-red pos-cust-alert">{emailError}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>{t('pos.receipt.skip')}</button>
        </div>
      </div>
    </div>
  )
}

// Build a receipt HTML string for the print window
// `boutique` is {name, address, city} from GET /boutique/profile, and `t` is
// passed in so the printed receipt follows the boutique's language.
//
// The header used to be hardcoded to "Neglia" / "Corso Venezia, Milano" — the
// demo boutique from the design source. Every other boutique printed receipts
// carrying someone else's trading name and address, which for an Italian
// receipt is a fiscal document problem, not a cosmetic one.
function buildReceiptHtml(order, cart, customer, rpPolicies, lang = 'en', boutique = null, t = (k, d) => d) {
  const now = new Date().toLocaleString()
  const getPolicy = (pid) => findById(rpPolicies ?? SEED_POLICIES, pid) ?? findById(SEED_POLICIES, BASELINE_POLICY_ID)
  const rows = (cart ?? []).map(i => {
    const policy = getPolicy(i.returnsPolicyId ?? BASELINE_POLICY_ID)
    return `
    <tr>
      <td>${escapeHtml(i.name)}${i.variantLabel ? '<br><small>' + escapeHtml(i.variantLabel) + '</small>' : ''}<br><small class="rt">${escapeHtml(receiptPolicyLine(policy, lang))}</small></td>
      <td class="c">${i.qty}</td>
      <td class="r">€${(i.price * i.qty).toFixed(2)}</td>
    </tr>
  `
  }).join('')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(t('pos.receipt.doc_title', 'Receipt'))}</title>
    <style>
      body{font-family:'Jost',system-ui,sans-serif;padding:16px;color:#0A0A0A;font-size:12px;margin:0;}
      h1{font-family:'Bodoni Moda',Georgia,serif;font-size:22px;font-weight:500;text-align:center;margin:0 0 4px;}
      .sub{text-align:center;color:#6E6E6E;font-size:10px;margin-bottom:14px;}
      table{width:100%;border-collapse:collapse;margin:10px 0;}
      td{padding:4px 0;font-size:11px;vertical-align:top;}
      .c{text-align:center;width:30px;}
      .r{text-align:right;width:70px;}
      small{color:#6E6E6E;font-size:9px;}
      small.rt{color:#0A0A0A;font-weight:500;}
      .tot{border-top:1px solid #0A0A0A;padding-top:6px;margin-top:6px;}
      .tot-row{display:flex;justify-content:space-between;font-size:11px;padding:2px 0;}
      .tot-row.grand{font-weight:700;font-size:13px;padding-top:5px;border-top:1px dashed #6E6E6E;margin-top:4px;}
      .ret{border-top:1px dashed #6E6E6E;margin-top:12px;padding-top:8px;}
      .ret-lbl{font-size:8.5px;letter-spacing:1.5px;text-transform:uppercase;color:#6E6E6E;}
      .ret-note{font-size:9.5px;color:#6E6E6E;margin-top:4px;line-height:1.5;}
      .foot{text-align:center;color:#6E6E6E;font-size:10px;margin-top:16px;}
    </style></head><body>
    <h1>${escapeHtml(boutique?.name ?? '')}</h1>
    <div class="sub">${escapeHtml([boutique?.address, boutique?.city].filter(Boolean).join(', '))}${boutique?.address || boutique?.city ? '<br>' : ''}${now}</div>
    ${customer ? '<div class="sub">' + escapeHtml(customer.name) + '</div>' : ''}
    <table>${rows}</table>
    <div class="tot">
      <div class="tot-row"><span>${escapeHtml(t('pos.receipt.subtotal', 'Subtotal'))}</span><span>€${Number(order?.subtotal ?? 0).toFixed(2)}</span></div>
      ${Number(order?.promo_discount ?? 0) > 0 ? '<div class="tot-row"><span>' + escapeHtml(t('pos.receipt.discount', 'Discount')) + '</span><span>−€' + Number(order.promo_discount).toFixed(2) + '</span></div>' : ''}
      <!-- VAT rate read from the order, not fixed at 22%: order.vat_rate comes
           back as a decimal string ("0.2200"). -->
      <div class="tot-row"><span>${escapeHtml(t('pos.receipt.vat', 'VAT ({{rate}}%)', { rate: (Number(order?.vat_rate ?? 0.22) * 100).toFixed(0) }))}</span><span>€${Number(order?.vat_amount ?? 0).toFixed(2)}</span></div>
      <div class="tot-row grand"><span>${escapeHtml(t('pos.receipt.total', 'Total'))}</span><span>€${Number(order?.gross_amount ?? 0).toFixed(2)}</span></div>
    </div>
    <div class="ret">
      <div class="ret-lbl">${lang === 'it' ? 'Resi' : 'Returns'}</div>
      <div class="ret-note">${escapeHtml(lang === 'it' ? 'Politica di cortesia in negozio.' : 'In-store goodwill policy.')} ${escapeHtml(guaranteeLine(lang))}</div>
    </div>
    <div class="foot">Order #${(order?.id ?? '').slice(0, 8)}<br>Grazie · Thank you</div>
    </body></html>`
}
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))
}

// ══ ZReportModal ═════════════════════════════════════════════════════
// GET /boutique/pos/zreport?date= (live preview if not yet closed) and
// POST /boutique/pos/zreport/close (fiscal day close, one-way).
function ZReportModal({ t, onClose }) {
  const [date] = useState(() => new Date().toISOString().slice(0, 10))
  const [closure, setClosure] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [countedCash, setCountedCash] = useState('')
  const [notes, setNotes] = useState('')
  const [closing, setClosing] = useState(false)
  const [closeError, setCloseError] = useState(null)

  useEffect(() => {
    setLoading(true); setLoadError(null)
    apiFetch(`${API}/boutique/pos/zreport?date=${date}`)
      .then(r => r.json())
      .then(res => {
        if (res?.success) setClosure(res.data?.closure ?? null)
        else setLoadError(res?.message ?? 'Failed to load Z-Report')
      })
      .catch(() => setLoadError('Network error'))
      .finally(() => setLoading(false))
  }, [date])

  async function handleClose() {
    if (!countedCash.trim()) return
    setClosing(true); setCloseError(null)
    try {
      const res = await apiFetch(`${API}/boutique/pos/zreport/close`, {
        method: 'POST',
        body: JSON.stringify({ date, counted_cash: Number(countedCash), notes: notes.trim() || undefined }),
      }).then(r => r.json())
      if (res?.success) setClosure(res.data)
      else setCloseError(res?.message ?? 'Failed to close day')
    } catch { setCloseError('Network error') }
    finally { setClosing(false) }
  }

  const isClosed = closure?.status === 'closed'
  const grossTotal = closure ? Number(closure.cash_total || 0) + Number(closure.card_total || 0) + Number(closure.stripe_total || 0) : 0

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal pos-z-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <div className="modal-title">Z-Report · <em>{date}</em></div>
          <button className="modal-close" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>

        {loading && <div className="pos-fatt-empty">{t('pos.variant.loading')}</div>}
        {loadError && <div className="alert alert-red pos-cust-alert">{loadError}</div>}

        {!loading && !loadError && closure && (
          <>
            <div className="pos-ret-alert">
              <span className="material-symbols-outlined">{isClosed ? 'lock' : 'lock_open'}</span>
              <span>{isClosed ? t('pos.zrep.closed', { defaultValue: 'Day closed' }) : t('pos.zrep.live', { defaultValue: 'Live preview — not yet closed' })}</span>
            </div>

            <div className="pos-z-hero">
              <div className="pos-z-hero-lbl">{t('pos.zrep.gross_today')}</div>
              <div className="pos-z-hero-val">{fmt(grossTotal)}</div>
              <div className="pos-z-hero-sub">{t('pos.zrep.hero_sub', { orders: closure.order_count ?? 0, avg: fmt(closure.order_count ? grossTotal / closure.order_count : 0) })}</div>
            </div>

            <div className="pos-z-grid">
              <div className="pos-z-cell">
                <div className="pos-z-cell-lbl">{t('pos.zrep.cash')}</div>
                <div className="pos-z-cell-val">{fmt(closure.cash_total)}</div>
              </div>
              <div className="pos-z-cell">
                <div className="pos-z-cell-lbl">{t('pos.zrep.card')}</div>
                <div className="pos-z-cell-val">{fmt(Number(closure.card_total || 0) + Number(closure.stripe_total || 0))}</div>
              </div>
              <div className="pos-z-cell">
                <div className="pos-z-cell-lbl">{t('pos.zrep.expected_cash', { defaultValue: 'Expected cash' })}</div>
                <div className="pos-z-cell-val">{fmt(closure.expected_cash)}</div>
              </div>
              <div className="pos-z-cell">
                <div className="pos-z-cell-lbl">{t('pos.zrep.variance', { defaultValue: 'Variance' })}</div>
                <div className="pos-z-cell-val">{closure.variance != null ? fmt(closure.variance) : '—'}</div>
              </div>
            </div>

            {!isClosed ? (
              <div className="pos-hold-save">
                <div className="pos-pay-field-lbl">{t('pos.zrep.close_day', { defaultValue: 'Close the day' })}</div>
                <input
                  className="pos-pay-input"
                  inputMode="decimal"
                  placeholder={t('pos.zrep.counted_cash', { defaultValue: 'Counted cash in drawer' })}
                  value={countedCash}
                  onChange={e => setCountedCash(e.target.value.replace(/[^\d.]/g, ''))}
                />
                <input
                  className="pos-pay-input"
                  placeholder={t('pos.hold.note_placeholder')}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
                {closeError && <div className="alert alert-red pos-cust-alert">{closeError}</div>}
              </div>
            ) : (
              <div className="pos-z-breakdown">
                <div className="pos-z-brow"><span>{t('pos.zrep.counted_cash', { defaultValue: 'Counted cash' })}</span><span>{fmt(closure.counted_cash)}</span></div>
                <div className="pos-z-brow"><span>{t('pos.zrep.variance', { defaultValue: 'Variance' })}</span><span>{fmt(closure.variance)}</span></div>
                {closure.notes && <div className="pos-z-brow"><span>{t('pos.hold.note_placeholder')}</span><span>{closure.notes}</span></div>}
              </div>
            )}

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={onClose}>{t('common.close')}</button>
              {!isClosed && (
                <button className="btn btn-primary" onClick={handleClose} disabled={closing || !countedCash.trim()}>
                  {closing ? t('common.saving') : t('pos.zrep.close_day', { defaultValue: 'Close day' })}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ══ Payment Modal ═════════════════════════════════════════════════════
// Handles method selection (Cash / Card / Split), doc type (DC / Fattura),
// simulated card flow (P10=D), and POST /boutique/orders/pos.
function PaymentModal({ t, cart, customer, discount, discountAmount, total, initialPayMethod, methods = ['cash', 'card', 'split'], onClose, onSuccess, onNewSale, onReceipt }) {
  const [phase, setPhase] = useState('form')   // 'form' | 'processing' | 'success' | 'error'
  // Opens on the boutique's saved default (see defaultPayMethod above), and
  // falls back to Cash when the profile has not loaded or names a method with
  // no tab. The cashier can still switch on any sale.
  const [payMethod, setPayMethod] = useState(initialPayMethod ?? 'cash')   // 'cash' | 'card' | 'split'
  const [cashTendered, setCashTendered] = useState('')
  const [cashPortion, setCashPortion] = useState('')   // for split
  const [docType, setDocType] = useState('dc')         // 'dc' | 'fattura'
  const [fatturaKind, setFatturaKind] = useState('privato')  // 'privato' | 'azienda'
  const [error, setError] = useState(null)
  const [order, setOrder] = useState(null)
  const [fattura, setFattura] = useState(null)

  // Fattura Elettronica buyer fields — required by POST /boutique/orders/pos
  // when doc_type:'fattura' (privato needs codice_fiscale; azienda needs
  // piva + either an SDI code or a PEC email as the delivery channel)
  const [buyerName, setBuyerName] = useState(customer?.name ?? '')
  const [buyerCF, setBuyerCF] = useState('')
  const [buyerPiva, setBuyerPiva] = useState('')
  const [fatturaDelivery, setFatturaDelivery] = useState('sdi')  // 'sdi' | 'pec'
  const [buyerSdi, setBuyerSdi] = useState('')
  const [buyerPec, setBuyerPec] = useState('')

  // Prevent scrolling under the modal
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Derived amounts
  const cashNum       = Number(cashTendered)     || 0
  const cashPortionN  = Number(cashPortion)      || 0
  const change        = payMethod === 'cash'  ? Math.max(0, cashNum - total) : 0
  const cardPortion   = payMethod === 'split' ? Math.max(0, total - cashPortionN) : 0

  // Fattura Elettronica requires buyer info before submit — privato needs a
  // codice fiscale, azienda needs a P.IVA plus either an SDI code or a PEC
  const fiscalValid = docType !== 'fattura' ? true :
    fatturaKind === 'privato'
      ? (buyerName.trim().length > 0 && buyerCF.trim().length === 16)
      : (buyerName.trim().length > 0 && buyerPiva.trim().length > 0 &&
         (fatturaDelivery === 'sdi' ? buyerSdi.trim().length > 0 : buyerPec.trim().length > 0))

  // Can we submit?
  const canSubmit = fiscalValid && (
    payMethod === 'cash'     ? cashNum >= total :
    payMethod === 'card'     ? true :
    // Nothing to validate: the money was taken on the boutique's own terminal
    // before the cashier got here, and Primo is only recording that it happened.
    payMethod === 'external' ? true :
    payMethod === 'split'    ? cashPortionN > 0 && cashPortionN < total :
    false
  )

  // Cash keypad helpers
  function keypadPress(k) {
    setCashTendered(v => {
      if (k === 'del') return v.slice(0, -1)
      if (k === '.' && v.includes('.')) return v
      if (v === '0' && k !== '.') return k
      return v + k
    })
  }
  function quickAmount(n) { setCashTendered(String(n)) }
  function exactAmount()  { setCashTendered(total.toFixed(2)) }

  // Submit — POST /boutique/orders/pos
  async function submitPayment() {
    setPhase('processing'); setError(null)
    try {
      const body = {
        payment_method: payMethod,   // 'cash' | 'card' | 'external' | 'split'
        vat_rate:       0.22,
        promo_code:     discount?.type === 'code' ? discount.code : null,
        promo_discount: discountAmount || 0,
        doc_type:       docType,
        items: cart.map(i => ({
          product_id: i.productId,
          variant_id: i.variantId,
          unit_price: i.price,
          qty:        i.qty,
        })),
      }
      if (payMethod === 'split') {
        body.cash_portion = Math.round(cashPortionN * 100) / 100
        body.card_portion = Math.round(cardPortion * 100) / 100
      }
      if (customer?.boutique_customer_id) body.customer_id = customer.boutique_customer_id
      // `mi_italia_user_id` was sent here as a fallback so an attached account holder
      // wouldn't record as Guest, but the endpoint 500s on it. Removed until the
      // backend either accepts that field or returns boutique_customer_id from the
      // POS customer lookup (which it currently omits, even for existing contacts).
      if (docType === 'fattura') {
        body.fattura_kind = fatturaKind
        body.buyer_name = buyerName.trim()
        if (fatturaKind === 'privato') {
          body.buyer_codice_fiscale = buyerCF.trim()
        } else {
          body.buyer_piva = buyerPiva.trim()
          if (fatturaDelivery === 'sdi') body.buyer_sdi_code = buyerSdi.trim()
          else body.buyer_pec = buyerPec.trim()
        }
      }

      const res = await apiFetch(`${API}/boutique/orders/pos`, {
        method: 'POST',
        body:   JSON.stringify(body),
      }).then(r => r.json())

      if (res?.success) {
        setOrder(res.data?.order ?? null)
        setFattura(res.data?.fattura ?? null)
        setPhase('success')
        onSuccess?.(res.data?.order)
      } else {
        setError(res?.message ?? 'Payment failed')
        setPhase('error')
      }
    } catch (err) {
      console.error('[PaymentModal] submit failed', err)
      setError('Network error')
      setPhase('error')
    }
  }

  // For 'card' — simulate Stripe Terminal success (P10=D)
  const [cardSimStep, setCardSimStep] = useState('waiting')  // 'waiting' | 'simulating'
  async function simulateCardSuccess() {
    setCardSimStep('simulating')
    // Small delay to feel realistic
    await new Promise(r => setTimeout(r, 900))
    submitPayment()
  }

  // ── SUCCESS PHASE ────────────────────────────────────────────────────
  if (phase === 'success') {
    const methodLabel = order?.payment_method === 'card'     ? t('pos.pay.method_card') :
                        order?.payment_method === 'split'    ? t('pos.pay.method_split') :
                        order?.payment_method === 'external' ? t('pos.pay.method_external', 'External') :
                        t('pos.pay.method_cash')
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal pos-pay-modal pos-pay-success" onClick={e => e.stopPropagation()}>
          <div className="pos-pay-suc-ic">
            <span className="material-symbols-outlined">check_circle</span>
          </div>
          <div className="pos-pay-suc-title">{t('pos.pay.complete')}</div>
          <div className="pos-pay-suc-meta">
            <div><span className="pos-pay-suc-lbl">{t('pos.receipt.order')}</span> <span className="pos-pay-suc-val">#{(order?.id ?? '').slice(0, 8) || '—'}</span></div>
            <div><span className="pos-pay-suc-lbl">{t('pos.total')}</span> <span className="pos-pay-suc-val">{fmt(order?.gross_amount ?? total)}</span></div>
            <div><span className="pos-pay-suc-lbl">{t('pos.pay.method')}</span> <span className="pos-pay-suc-val">{methodLabel}</span></div>
            {payMethod === 'cash' && cashNum > total && (
              <div><span className="pos-pay-suc-lbl">{t('pos.pay.change')}</span> <span className="pos-pay-suc-val">{fmt(change)}</span></div>
            )}
          </div>

          {fattura?.status === 'failed' && (
            <div className="alert alert-red pos-pay-note">
              <span className="material-symbols-outlined">error</span>
              <span>{t('pos.pay.fattura_failed', { defaultValue: 'Invoice could not be issued — fix it from Fix & Resend.' })} {fattura.error_message ? `(${fattura.error_message})` : ''}</span>
            </div>
          )}

          <div className="pos-pay-suc-actions">
            <button className="btn btn-outline" onClick={onReceipt}>
              <span className="material-symbols-outlined">receipt</span>
              {t('pos.receipt.options')}
            </button>
            <button className="btn btn-primary" onClick={onNewSale}>
              <span className="material-symbols-outlined">add_shopping_cart</span>
              {t('pos.pay.new_sale')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── ERROR PHASE ──────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal pos-pay-modal pos-pay-error" onClick={e => e.stopPropagation()}>
          <div className="pos-pay-err-ic">
            <span className="material-symbols-outlined">error</span>
          </div>
          <div className="pos-pay-suc-title">{t('pos.pay.failed')}</div>
          <div className="pos-pay-err-msg">{error}</div>
          <div className="pos-pay-suc-actions">
            <button className="btn btn-outline" onClick={onClose}>{t('common.close')}</button>
            <button className="btn btn-primary" onClick={() => setPhase('form')}>{t('pos.pay.try_again')}</button>
          </div>
        </div>
      </div>
    )
  }

  // ── FORM PHASE ───────────────────────────────────────────────────────
  const isProcessing = phase === 'processing'

  return (
    <div className="modal-backdrop" onClick={isProcessing ? undefined : onClose}>
      <div className="modal pos-pay-modal" onClick={e => e.stopPropagation()}>
        <div className="pos-pay-hdr">
          <div>
            <div className="pos-pay-hdr-lbl">{t('pos.pay.payment')}</div>
            <div className="pos-pay-hdr-total">{fmt(total)}</div>
          </div>
          <button className="modal-close" onClick={onClose} disabled={isProcessing}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Method tabs. A method the boutique cannot complete (see
            allowedMethods) is dropped entirely rather than disabled: a
            greyed-out tab still invites a tap and needs explaining at the
            counter, and there is nothing the cashier could do to enable it
            mid-sale anyway. For a cash-only shop one tab is left and the row
            reads as a label, which is accurate. */}
        <div className="pos-pay-tabs">
          {[
            { k: 'cash',     label: t('pos.pay.method_cash'),  ic: 'payments' },
            { k: 'card',     label: t('pos.pay.tab_card'),     ic: 'credit_card' },
            { k: 'external', label: t('pos.pay.method_external', 'External'), ic: 'point_of_sale' },
            { k: 'split',    label: t('pos.pay.tab_split'),    ic: 'call_split' },
          ].filter(m => methods.includes(m.k)).map(t => (
            <button
              key={t.k}
              className={`pos-pay-tab${payMethod === t.k ? ' on' : ''}`}
              onClick={() => setPayMethod(t.k)}
              disabled={isProcessing}>
              <span className="material-symbols-outlined">{t.ic}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* CASH PANEL */}
        {payMethod === 'cash' && (
          <div className="pos-pay-panel">
            <div className="pos-pay-cash-quick">
              {[50, 100, 200].map(n => (
                <button key={n} className="pos-pay-quick-btn" onClick={() => quickAmount(n)}>
                  €{n}
                </button>
              ))}
              <button className="pos-pay-quick-btn" onClick={exactAmount}>{t('pos.pay.exact')}</button>
            </div>

            <div className="pos-pay-cash-row">
              <div className="pos-pay-cash-col">
                <div className="pos-pay-field-lbl">{t('pos.pay.cash_tendered')}</div>
                <input
                  className="pos-pay-input pos-pay-cash-input"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={cashTendered}
                  onChange={e => setCashTendered(e.target.value.replace(/[^\d.]/g, ''))}
                />
              </div>
              <div className="pos-pay-cash-col">
                <div className="pos-pay-field-lbl">{t('pos.pay.change')}</div>
                <div className={`pos-pay-change${change > 0 ? ' has-change' : ''}`}>
                  {fmt(change)}
                </div>
              </div>
            </div>

            <div className="pos-pay-keypad">
              {['7','8','9','4','5','6','1','2','3','.','0','del'].map(k => (
                <button key={k} className="pos-pay-key" onClick={() => keypadPress(k)}>
                  {k === 'del'
                    ? <span className="material-symbols-outlined">backspace</span>
                    : k}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* CARD PANEL */}
        {payMethod === 'card' && (
          <div className="pos-pay-panel pos-pay-card-panel">
            <div className="pos-pay-card-visual">
              <span className="material-symbols-outlined pos-pay-card-ic">contactless</span>
              <div className="pos-pay-card-msg">
                {cardSimStep === 'waiting'
                  ? t('pos.pay.present_card')
                  : t('pos.pay.processing_card')}
              </div>
              <div className="pos-pay-card-sub">
                {t('pos.pay.amount_charge')}: <strong>{fmt(total)}</strong>
              </div>
            </div>
            <button
              className="btn btn-primary pos-pay-simulate"
              onClick={simulateCardSuccess}
              disabled={cardSimStep === 'simulating'}>
              <span className="material-symbols-outlined">science</span>
              {cardSimStep === 'simulating' ? t('pos.pay.simulating') : t('pos.pay.simulate_success')}
            </button>
            <div className="pos-pay-note">
              <span className="material-symbols-outlined">info</span>
              <span>{t('pos.pay.terminal_note')}</span>
            </div>
          </div>
        )}

        {/* EXTERNAL TERMINAL PANEL
            No simulate button and no keypad. The payment has already happened
            on the boutique's own machine; the only thing left is for Primo to
            record it, which the footer's Confirm does. The amount is shown
            large so the cashier can check it against what they keyed into that
            machine before committing. */}
        {payMethod === 'external' && (
          <div className="pos-pay-panel pos-pay-ext-panel">
            <div className="pos-pay-card-visual">
              <span className="material-symbols-outlined pos-pay-card-ic">point_of_sale</span>
              <div className="pos-pay-card-msg">
                {t('pos.pay.ext_take', 'Take the payment on your card terminal')}
              </div>
              <div className="pos-pay-card-sub">
                {t('pos.pay.amount_charge')}: <strong>{fmt(total)}</strong>
              </div>
            </div>
            <div className="pos-pay-note">
              <span className="material-symbols-outlined">info</span>
              <span>{t('pos.pay.ext_note', 'Confirm once the terminal approves it. Primo records the sale — it does not charge the card.')}</span>
            </div>
          </div>
        )}

        {/* SPLIT PANEL */}
        {payMethod === 'split' && (
          <div className="pos-pay-panel">
            <div className="pos-pay-split-row">
              <div className="pos-pay-split-col">
                <div className="pos-pay-field-lbl">{t('pos.pay.cash_portion')}</div>
                <input
                  className="pos-pay-input"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={cashPortion}
                  onChange={e => setCashPortion(e.target.value.replace(/[^\d.]/g, ''))}
                />
              </div>
              <div className="pos-pay-split-plus">+</div>
              <div className="pos-pay-split-col">
                <div className="pos-pay-field-lbl">{t('pos.pay.card_portion')}</div>
                <div className="pos-pay-split-remaining">{fmt(cardPortion)}</div>
              </div>
            </div>
            <div className="pos-pay-note">
              <span className="material-symbols-outlined">info</span>
              <span>
                {t('pos.pay.split_note')}
              </span>
            </div>
          </div>
        )}

        <div className="pos-pay-doc">
          <div className="pos-pay-field-lbl">{t('pos.pay.document')}</div>
          <div className="pos-pay-doc-tabs">
            <button
              className={`pos-pay-doc-tab${docType === 'dc' ? ' on' : ''}`}
              onClick={() => setDocType('dc')}
              disabled={isProcessing}>
              <span>DC</span>
              <span className="pos-pay-doc-sub">Documento commerciale</span>
            </button>
            <button
              className={`pos-pay-doc-tab${docType === 'fattura' ? ' on' : ''}`}
              onClick={() => setDocType('fattura')}
              disabled={isProcessing}>
              <span>Fattura</span>
              <span className="pos-pay-doc-sub">Fattura elettronica</span>
            </button>
          </div>

          {docType === 'fattura' && (
            <div className="pos-pay-fattura">
              <div className="pos-pay-fatt-tabs">
                <button
                  className={`pos-pay-fatt-tab${fatturaKind === 'privato' ? ' on' : ''}`}
                  onClick={() => setFatturaKind('privato')}
                  disabled={isProcessing}>
                  Privato
                </button>
                <button
                  className={`pos-pay-fatt-tab${fatturaKind === 'azienda' ? ' on' : ''}`}
                  onClick={() => setFatturaKind('azienda')}
                  disabled={isProcessing}>
                  Azienda
                </button>
              </div>
              {fatturaKind === 'privato' ? (
                <div className="pos-pay-fattura-fields">
                  <input
                    className="pos-pay-input"
                    placeholder={t('pos.pay.buyer_name', { defaultValue: 'Full name' })}
                    value={buyerName}
                    onChange={e => setBuyerName(e.target.value)}
                    disabled={isProcessing}
                  />
                  <input
                    className="pos-pay-input"
                    placeholder={t('pos.pay.buyer_cf', { defaultValue: 'Codice Fiscale (16 chars)' })}
                    value={buyerCF}
                    maxLength={16}
                    onChange={e => setBuyerCF(e.target.value.toUpperCase())}
                    disabled={isProcessing}
                  />
                </div>
              ) : (
                <div className="pos-pay-fattura-fields">
                  <input
                    className="pos-pay-input"
                    placeholder={t('pos.pay.buyer_company', { defaultValue: 'Ragione sociale' })}
                    value={buyerName}
                    onChange={e => setBuyerName(e.target.value)}
                    disabled={isProcessing}
                  />
                  <input
                    className="pos-pay-input"
                    placeholder={t('pos.pay.buyer_piva', { defaultValue: 'P.IVA' })}
                    value={buyerPiva}
                    onChange={e => setBuyerPiva(e.target.value.toUpperCase())}
                    disabled={isProcessing}
                  />
                  <div className="pos-pay-doc-tabs">
                    <button
                      type="button"
                      className={`pos-pay-doc-tab${fatturaDelivery === 'sdi' ? ' on' : ''}`}
                      onClick={() => setFatturaDelivery('sdi')}
                      disabled={isProcessing}>
                      <span>SDI</span>
                    </button>
                    <button
                      type="button"
                      className={`pos-pay-doc-tab${fatturaDelivery === 'pec' ? ' on' : ''}`}
                      onClick={() => setFatturaDelivery('pec')}
                      disabled={isProcessing}>
                      <span>PEC</span>
                    </button>
                  </div>
                  {fatturaDelivery === 'sdi' ? (
                    <input
                      className="pos-pay-input"
                      placeholder={t('pos.pay.buyer_sdi', { defaultValue: 'Codice Destinatario (7 chars)' })}
                      value={buyerSdi}
                      maxLength={7}
                      onChange={e => setBuyerSdi(e.target.value.toUpperCase())}
                      disabled={isProcessing}
                    />
                  ) : (
                    <input
                      className="pos-pay-input"
                      type="email"
                      placeholder={t('pos.pay.buyer_pec', { defaultValue: 'PEC email' })}
                      value={buyerPec}
                      onChange={e => setBuyerPec(e.target.value)}
                      disabled={isProcessing}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pos-pay-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={isProcessing}>
            {t('common.cancel')}
          </button>
          {payMethod !== 'card' && (
            <button
              className="btn btn-primary pos-pay-confirm"
              onClick={submitPayment}
              disabled={!canSubmit || isProcessing}>
              {isProcessing
                ? <><span className="material-symbols-outlined pos-loading-spin">sync</span> {t('pos.pay.processing')}</>
                : <><span>{t('common.confirm')}</span><span className="pos-pay-confirm-amt">{fmt(total)}</span></>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ══ Main POS ══════════════════════════════════════════════════════════
export default function POS() {
  const navigate = useNavigate()
  const { t }    = useTranslation()
  const lang     = useLangStore(s => s.lang)

  // Auth-adjacent — reads staff name from localStorage for display
  const staff         = useMemo(() => readStaffInfo(), [])
  const staffInitials = useMemo(() => getInitials(staff.name), [staff.name])
  const [staffMenuOpen, setStaffMenuOpen] = useState(false)

  // Live clock
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  // Product catalog
  const [products,    setProducts]    = useState([])
  const [prodLoading, setProdLoading] = useState(true)
  const [prodSearch,  setProdSearch]  = useState('')
  const [activeCat,   setActiveCat]   = useState('all')
  const prodDebRef = useRef(null)

  // Cart + variant picker
  const [cart, setCart] = useState([])
  const [selectedProduct, setSelectedProduct] = useState(null)

  // Cart-attached data
  const [customer, setCustomer] = useState(null)
  const [discount, setDiscount] = useState(null)   // { type: 'pct'|'fixed'|'code', value, code? }

  // Modal control (Stage 3 modals)
  const [activeModal, setActiveModal] = useState(null)
  //   null | 'customer' | 'discount' | 'hold' | 'return'
  //        | 'fatture' | 'fixresend' | 'zreport' | 'receipt'

  // Held carts persisted in localStorage
  const [heldCarts, setHeldCarts] = useState(() => loadHeldCarts())

  // Last completed order (for Receipt modal after payment)
  const [lastOrder, setLastOrder] = useState(null)

  // Payment
  const [showPayment, setShowPayment] = useState(false)

  // Stripe Terminal status — polled every 60s
  const [terminalStatus, setTerminalStatus] = useState('connecting')

  // Store-level returns config (policy library + class map + default) — read-only here
  const [rpPolicies, setRpPolicies]   = useState(SEED_POLICIES)
  const [rpClasses, setRpClasses]     = useState(RETURNS_CLASSES)
  const [rpDefaultId, setRpDefaultId] = useState(BASELINE_POLICY_ID)
  const [boutique, setBoutique]       = useState(null)

  // Drives the returns line printed on the receipt. Read from the dedicated
  // returns endpoints — /boutique/profile does not carry this config, so the
  // receipt was always quoting the built-in defaults rather than the
  // boutique's own policies.
  useEffect(() => {
    let cancelled = false
    fetchPolicies()
      .then(({ policies, defaultPolicyId }) => {
        if (cancelled) return
        if (policies.length) setRpPolicies(policies)
        if (defaultPolicyId) setRpDefaultId(defaultPolicyId)
      })
      .catch(() => {})
    fetchClasses()
      .then(list => { if (!cancelled) setRpClasses(list) })
      .catch(() => {})

    // Trading name and address for the printed receipt and the topbar — both
    // were hardcoded to the design source's demo boutique.
    apiFetch(`${API}/boutique/profile`)
      .then(r => r.json())
      .then(res => { if (!cancelled && res.success) setBoutique(res.data ?? null) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Load products (debounced when searching)
  useEffect(() => {
    setProdLoading(true)
    clearTimeout(prodDebRef.current)
    const delay = prodSearch.trim() ? 350 : 0
    prodDebRef.current = setTimeout(() => {
      const q = prodSearch.trim() ? `&search=${encodeURIComponent(prodSearch.trim())}` : ''
      apiFetch(`${API}/boutique/products?status=active&limit=40${q}`)
        .then(r => r.json())
        .then(res => setProducts(res?.data?.products ?? []))
        .catch(err => console.error('[POS] products fetch failed', err))
        .finally(() => setProdLoading(false))
    }, delay)
    return () => clearTimeout(prodDebRef.current)
  }, [prodSearch, lang])

  // Poll Stripe Terminal status
  useEffect(() => {
    function fetchStatus() {
      apiFetch(`${API}/boutique/stripe/status`)
        .then(r => r.json())
        .then(res => {
          if (!res?.success) { setTerminalStatus('disconnected'); return }
          const d = res.data ?? {}
          const raw = d.status || (d.connected === true ? 'connected' : 'disconnected')
          if (raw === 'connected')   setTerminalStatus('connected')
          else if (raw === 'connecting') setTerminalStatus('connecting')
          else                       setTerminalStatus('disconnected')
        })
        .catch(err => {
          console.warn('[POS] terminal status fetch failed', err)
          setTerminalStatus('disconnected')
        })
    }
    fetchStatus()
    const id = setInterval(fetchStatus, 60000)
    return () => clearInterval(id)
  }, [])

  // Derived — categories + filtered products
  const categories = useMemo(() => extractCategories(products), [products])
  const filteredProducts = useMemo(() => {
    if (activeCat === 'all') return products
    return products.filter(p => {
      const path = p.category_path || p.category || ''
      return path.split(/\s*\/\s*/)[0].trim() === activeCat
    })
  }, [products, activeCat])

  // Cart handlers
  function openProduct(p) { setSelectedProduct(p) }

  function addToCartWithVariant(product, variant) {
    // Resolve now and snapshot the policy id onto the cart item — a POS sale
    // is always in-store, so online-fallback never applies here. The real
    // order-time snapshot (for dispute integrity) is a backend job; this is
    // the frontend's best-effort equivalent until that lands.
    const rpResolved = resolvePolicy({
      overridePolicyId: product.returns_policy_override_id ?? null,
      classId:          product.returns_class ?? DEFAULT_CLASS_ID,
      classMap:         buildClassMap(rpClasses),
      storeDefault:     rpDefaultId,
      online:           false,
      getPolicy:        (pid) => findById(rpPolicies, pid),
    })

    const cartItem = {
      id:              `${product.id}-${variant.id}`,
      productId:       product.id,
      variantId:       variant.id,
      name:            product.name,
      variantLabel:    [variant.size_label ?? variant.size_it, variant.colour].filter(Boolean).join(' · '),
      price:           parseFloat(product.retail_price),
      img:             imgSrc(product.main_photo),
      sku:             product.sku,
      qty:             1,
      stock:           Number(variant.stock_qty ?? 0),
      returnsPolicyId: rpResolved.policyId,
    }
    setCart(prev => {
      const ex = prev.find(i => i.id === cartItem.id)
      if (ex) return prev.map(i => i.id === cartItem.id ? { ...i, qty: Math.min(ex.stock, i.qty + 1) } : i)
      return [...prev, cartItem]
    })
    setSelectedProduct(null)
  }

  function changeQty(id, delta) {
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(1, Math.min(i.stock ?? i.qty, i.qty + delta)) } : i))
  }
  function removeItem(id) { setCart(prev => prev.filter(i => i.id !== id)) }
  function clearCart()    { setCart([]) }

  // Totals — subtotal → discount → VAT on discounted → total
  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart])
  const discountAmount = useMemo(() => {
    if (!discount || !subtotal) return 0
    if (discount.type === 'pct')   return Math.round(subtotal * (discount.value / 100) * 100) / 100
    if (discount.type === 'fixed') return Math.min(Number(discount.value) || 0, subtotal)
    // 'code' — value is the real amount confirmed by POST /orders/pos/quote (see DiscountModal)
    if (discount.type === 'code')  return Math.min(Number(discount.value) || 0, subtotal)
    return 0
  }, [discount, subtotal])
  // Matches the backend's real order-total formula, confirmed via
  // POST /orders/pos/quote (subtotal 100, vat_amount 22, promo_discount 10,
  // gross_amount 112 => 100 + 22 - 10) and by POST /orders/pos itself
  // rejecting a split payment whose cash+card portions summed to the
  // discounted-subtotal-then-VAT total instead of this one: VAT is always
  // computed on the full subtotal, and the discount is subtracted after.
  // Italian standard rate. The cart has to show a total before the order
  // exists, and /boutique/profile carries no vat_rate, so this is fixed here
  // — see docs/backend-gaps-open.md. The RECEIPT uses order.vat_rate, which
  // the API does return, so the printed document is always correct.
  const vat   = subtotal * VAT_RATE
  const total = Math.max(0, subtotal + vat - discountAmount)

  // A barcode scanner is a keyboard device: it types into whatever field has
  // focus. The search box already posts to ?search=, so the only thing the
  // camera button needs to do is put the cursor there. It previously called a
  // no-op stub and did nothing at all.
  const scanInputRef = useRef(null)

  function handleCheckout() {
    if (cart.length === 0) return
    setShowPayment(true)
  }

  function handlePaymentSuccess(order) {
    setLastOrder(order)
    // cart/customer intentionally kept until New Sale — the receipt modal
    // (opened from the payment-success screen) needs the sold items and
    // customer name to print/build correctly.
  }

  function handleNewSale() {
    setShowPayment(false)
    setLastOrder(null)
    setCart([])
    setCustomer(null)
    setDiscount(null)
  }

  // ── Held carts (localStorage) ────────────────────────────────────────
  function saveCurrentCartHold(note) {
    if (cart.length === 0) return
    const entry = {
      id:        `hold-${Date.now()}`,
      timestamp: new Date().toISOString(),
      items:     cart,
      customer,
      discount,
      note:      note || '',
    }
    const next = [entry, ...heldCarts]
    setHeldCarts(next)
    persistHeldCarts(next)
    setCart([]); setCustomer(null); setDiscount(null)
    setActiveModal(null)
  }
  function retrieveHeldCart(id) {
    const entry = heldCarts.find(h => h.id === id)
    if (!entry) return
    setCart(entry.items)
    setCustomer(entry.customer ?? null)
    setDiscount(entry.discount ?? null)
    const next = heldCarts.filter(h => h.id !== id)
    setHeldCarts(next); persistHeldCarts(next)
    setActiveModal(null)
  }
  function deleteHeldCart(id) {
    const next = heldCarts.filter(h => h.id !== id)
    setHeldCarts(next); persistHeldCarts(next)
  }

  return (
    <div className="pos-shell">

      {/* ═══ TOPBAR ═══ */}
      <div className="pos-topbar">
        <div className="pos-tb-left">
          <div className="pos-tb-brand">
            <span className="pos-tb-brand-name">Primo</span>
            <span className="pos-tb-brand-sep">·</span>
            <span className="pos-tb-brand-mode">POS</span>
          </div>
          <div className="pos-tb-store">
            <span className="material-symbols-outlined">store</span>
            <span>{[boutique?.name, [boutique?.address, boutique?.city].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}</span>
          </div>
          <div className={`pos-tb-terminal pos-tb-terminal-${terminalStatus}`}>
            <span className={`pos-ts-dot pos-ts-dot-${terminalStatus}`} />
            <span>
              {t('pos.terminal')} {terminalStatus === 'connected' ? t('pos.terminal_connected')
                       : terminalStatus === 'connecting' ? t('pos.terminal_connecting')
                       : t('pos.terminal_offline')}
            </span>
          </div>
        </div>

        <div className="pos-tb-right">
          <button className="pos-tb-btn" onClick={() => setActiveModal('hold')}>
            <span className="material-symbols-outlined">pause_circle</span>
            <span>{t('pos.hold_btn')}</span>
          </button>
          <button className="pos-tb-btn" onClick={() => setActiveModal('return')}>
            <span className="material-symbols-outlined">undo</span>
            <span>{t('pos.nav.returns')}</span>
          </button>
          <button className="pos-tb-btn" onClick={() => setActiveModal('fatture')}>
            <span className="material-symbols-outlined">receipt_long</span>
            <span>{t('pos.nav.fatture')}</span>
          </button>
          <button className="pos-tb-btn" onClick={() => setActiveModal('fixresend')}>
            <span className="material-symbols-outlined">build</span>
            <span>{t('pos.nav.fix_resend')}</span>
          </button>
          <button className="pos-tb-btn" onClick={() => setActiveModal('zreport')}>
            <span className="material-symbols-outlined">bar_chart</span>
            <span>{t('pos.nav.zreport')}</span>
          </button>

          <div className="pos-tb-staff-wrap">
            <button className="pos-tb-staff" onClick={() => setStaffMenuOpen(v => !v)}>
              <span className="pos-tb-staff-av">{staffInitials}</span>
              <span className="pos-tb-staff-name">{staff.name}</span>
              <span className="material-symbols-outlined pos-tb-staff-chev">expand_more</span>
            </button>
            {staffMenuOpen && (
              <>
                <div className="pos-tb-staff-menu-backdrop" onClick={() => setStaffMenuOpen(false)} />
                <div className="pos-tb-staff-menu">
                  <div className="pos-tb-staff-menu-hd">
                    <div className="pos-tb-staff-menu-name">{staff.name}</div>
                    {staff.role && <div className="pos-tb-staff-menu-role">{statusLabel(t, staff.role)}</div>}
                  </div>
                  <button
                    className="pos-tb-staff-menu-item"
                    onClick={() => { setStaffMenuOpen(false); navigate('/dashboard') }}>
                    <span className="material-symbols-outlined">dashboard</span>
                    <span>{t('pos.nav.exit_pos')}</span>
                  </button>
                  <button
                    className="pos-tb-staff-menu-item"
                    onClick={() => { setStaffMenuOpen(false); clearToken(); navigate('/login') }}>
                    <span className="material-symbols-outlined">logout</span>
                    <span>{t('pos.nav.sign_out')}</span>
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="pos-tb-time">{formatTime(now)}</div>
        </div>
      </div>

      {/* ═══ BODY (2 columns) ═══ */}
      <div className="pos-body">

        {/* ── CATALOG (left) ── */}
        <div className="pos-catalog">
          <div className="pos-cat-hdr">
            <div className="pos-search-wrap">
              <span className="material-symbols-outlined pos-search-ic">search</span>
              <input
                className="pos-search-input"
                ref={scanInputRef}
                placeholder={t('pos.scan_or_search')}
                value={prodSearch}
                onChange={e => setProdSearch(e.target.value)}
              />
              <button className="pos-scan-btn" title={t('pos.scan_focus', 'Click, then scan a barcode')}
                onClick={() => scanInputRef.current?.focus()}>
                <span className="material-symbols-outlined">photo_camera</span>
              </button>
            </div>

            {categories.length > 0 && (
              <div className="pos-cat-chips">
                <button
                  className={`pos-chip${activeCat === 'all' ? ' on' : ''}`}
                  onClick={() => setActiveCat('all')}>
                  {t('pos.all_cats')}
                </button>
                {categories.map(c => (
                  <button
                    key={c}
                    className={`pos-chip${activeCat === c ? ' on' : ''}`}
                    onClick={() => setActiveCat(c)}>
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          {prodLoading && (
            <div className="pos-prod-loading">
              <span className="material-symbols-outlined pos-loading-spin">sync</span>
              <span>{t('pos.catalog_loading')}</span>
            </div>
          )}

          {!prodLoading && filteredProducts.length === 0 && (
            <div className="pos-prod-empty">
              <span className="material-symbols-outlined">inventory_2</span>
              <div>{t('pos.catalog_empty')}{prodSearch ? ` "${prodSearch}"` : ''}</div>
            </div>
          )}

          {!prodLoading && filteredProducts.length > 0 && (
            <div className="pos-product-grid">
              {filteredProducts.map(p => (
                <button key={p.id} className="pos-prod-card" onClick={() => openProduct(p)}>
                  <div className="pos-prod-img">
                    {p.main_photo
                      ? <img src={imgSrc(p.main_photo)} alt={p.name} />
                      : <span className="material-symbols-outlined pos-prod-img-fallback">image</span>
                    }
                  </div>
                  <div className="pos-prod-info">
                    <div className="pos-prod-name">{p.name}</div>
                    <div className="pos-prod-meta">
                      <span className="pos-prod-sku">{p.sku}</span>
                      <span className="pos-prod-price">{fmt(p.retail_price)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── CART (right) ── */}
        <div className="pos-cart-panel">

          {/* Customer attach / display */}
          {customer ? (
            <div className="pos-cust-bar">
              <div className="pos-cust-bar-av">
                {(customer.name || '?').split(/\s+/).slice(0,2).map(n => n[0]).join('').toUpperCase()}
              </div>
              <div className="pos-cust-bar-info">
                <div className="pos-cust-bar-name">{customer.name}</div>
                <div className="pos-cust-bar-meta">
                  {customer.source === 'walkin' ? t('pos.cust.walkin') : t('pos.cust.mi_customer')}
                  {customer.platform_profile?.tier && ` · ${customer.platform_profile.tier}`}
                </div>
              </div>
              <button className="pos-cust-bar-edit" onClick={() => setActiveModal('customer')}>
                <span className="material-symbols-outlined">edit</span>
              </button>
            </div>
          ) : (
            <button className="pos-cust-attach" onClick={() => setActiveModal('customer')}>
              <span className="material-symbols-outlined pos-cust-attach-ic">person_add</span>
              <div className="pos-cust-attach-txt">
                <div className="pos-cust-attach-title">{t('pos.attach_customer')}</div>
                <div className="pos-cust-attach-sub">{t('pos.attach_sub')}</div>
              </div>
              <span className="material-symbols-outlined pos-cust-attach-chev">chevron_right</span>
            </button>
          )}

          {/* Cart items */}
          <div className="pos-cart-list">
            {cart.length === 0 ? (
              <div className="pos-cart-empty">
                <span className="material-symbols-outlined pos-cart-empty-ic">shopping_bag</span>
                <div className="pos-cart-empty-title">{t('pos.cart_empty')}</div>
                <div className="pos-cart-empty-sub">{t('pos.cart_empty_sub')}</div>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.id} className="pos-cart-row">
                  <div className="pos-cart-row-img">
                    {item.img
                      ? <img src={item.img} alt="" />
                      : <span className="material-symbols-outlined">image</span>
                    }
                  </div>
                  <div className="pos-cart-row-info">
                    <div className="pos-cart-row-name">{item.name}</div>
                    {item.variantLabel && <div className="pos-cart-row-variant">{item.variantLabel}</div>}
                    <div className="pos-cart-row-price">{fmt(item.price)}</div>
                  </div>
                  <div className="pos-cart-row-actions">
                    <div className="pos-qty-ctrl">
                      <button className="pos-qty-btn" onClick={() => changeQty(item.id, -1)}>
                        <span className="material-symbols-outlined">remove</span>
                      </button>
                      <span className="pos-qty-val">{item.qty}</span>
                      <button className="pos-qty-btn" onClick={() => changeQty(item.id, 1)} disabled={item.qty >= (item.stock ?? item.qty)}>
                        <span className="material-symbols-outlined">add</span>
                      </button>
                    </div>
                    <div className="pos-cart-row-total">{fmt(item.price * item.qty)}</div>
                    <button className="pos-cart-row-x" onClick={() => removeItem(item.id)}>
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer — totals + actions + checkout */}
          <div className="pos-cart-footer">
            <div className="pos-cart-tot-row">
              <span className="pos-cart-tot-lbl">{t('pos.subtotal')}</span>
              <span className="pos-cart-tot-val">{fmt(subtotal)}</span>
            </div>
            <div className="pos-cart-tot-row">
              <span className="pos-cart-tot-lbl">
                {t('pos.discount')}
                {discount?.type === 'code' && discount.code && <span className="pos-cart-tot-code">({discount.code})</span>}
              </span>
              <span className={`pos-cart-tot-val${discountAmount > 0 ? ' pos-cart-tot-neg' : ' pos-cart-tot-muted'}`}>
                {discountAmount > 0 ? '−' + fmt(discountAmount) : '—'}
              </span>
            </div>
            <div className="pos-cart-tot-row">
              <span className="pos-cart-tot-lbl">{t('pos.vat')}</span>
              <span className="pos-cart-tot-val">{fmt(vat)}</span>
            </div>
            <div className="pos-cart-tot-row pos-cart-tot-total">
              <span className="pos-cart-tot-lbl">{t('pos.total')}</span>
              <span className="pos-cart-tot-val">{fmt(total)}</span>
            </div>

            <div className="pos-cart-actions">
              <button className="pos-ca-btn" onClick={() => setActiveModal('discount')} disabled={cart.length === 0}>
                <span className="material-symbols-outlined">sell</span>
                <span>{discount ? t('pos.edit_discount') : t('pos.discount_btn')}</span>
              </button>
              <button className="pos-ca-btn" onClick={() => setActiveModal('hold')} disabled={cart.length === 0}>
                <span className="material-symbols-outlined">pause_circle</span>
                <span>{t('pos.hold_btn')}</span>
              </button>
              <button className="pos-ca-btn" onClick={clearCart} disabled={cart.length === 0}>
                <span className="material-symbols-outlined">delete</span>
                <span>{t('pos.clear_btn')}</span>
              </button>
            </div>

            <button
              className="pos-checkout"
              onClick={handleCheckout}
              disabled={cart.length === 0}>
              <span>{t('pos.checkout')}</span>
              <span className="pos-checkout-amt">{fmt(total)}</span>
            </button>
          </div>
        </div>
      </div>

      {selectedProduct && (
        <VariantPickerModal
          t={t}
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onPick={addToCartWithVariant}
        />
      )}

      {showPayment && (
        <PaymentModal
          t={t}
          cart={cart}
          customer={customer}
          discount={discount}
          discountAmount={discountAmount}
          total={total}
          initialPayMethod={defaultPayMethod(boutique)}
          methods={allowedMethods(boutique)}
          onClose={() => setShowPayment(false)}
          onSuccess={handlePaymentSuccess}
          onNewSale={handleNewSale}
          onReceipt={() => { setShowPayment(false); setActiveModal('receipt') }}
        />
      )}

      {activeModal === 'customer' && (
        <CustomerModal
          t={t}
          customer={customer}
          onClose={() => setActiveModal(null)}
          onAttach={c => setCustomer(c)}
          onDetach={() => setCustomer(null)}
        />
      )}

      {activeModal === 'discount' && (
        <DiscountModal
          t={t}
          current={discount}
          subtotal={subtotal}
          cart={cart}
          onClose={() => setActiveModal(null)}
          onApply={d => setDiscount(d)}
          onRemove={() => setDiscount(null)}
        />
      )}

      {activeModal === 'hold' && (
        <HoldModal
          t={t}
          cart={cart}
          customer={customer}
          discount={discount}
          heldCarts={heldCarts}
          onClose={() => setActiveModal(null)}
          onSaveNew={saveCurrentCartHold}
          onRetrieve={retrieveHeldCart}
          onDelete={deleteHeldCart}
        />
      )}

      {activeModal === 'return'    && <ReturnModal     t={t} onClose={() => setActiveModal(null)} />}
      {activeModal === 'fatture'   && <FattureModal    t={t} onClose={() => setActiveModal(null)} />}
      {activeModal === 'fixresend' && <FixResendModal  t={t} onClose={() => setActiveModal(null)} />}
      {activeModal === 'zreport'   && <ZReportModal    t={t} onClose={() => setActiveModal(null)} />}

      {activeModal === 'receipt' && (
        <ReceiptModal
          t={t}
          order={lastOrder}
          cart={cart}
          customer={customer}
          rpPolicies={rpPolicies}
          boutique={boutique}
          onClose={() => { setActiveModal(null); handleNewSale() }}
        />
      )}
    </div>
  )
}
