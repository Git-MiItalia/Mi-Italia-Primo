import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'
import useLangStore from '../store/langStore'
import Toast, { useToast } from '../components/ui/Toast'

const API      = import.meta.env.VITE_API_URL

function fmtEUR(n) { return '€' + Number(n || 0).toFixed(2) }

/* Thin JSON wrapper around apiFetch, plus the app's known bodyless-POST
   gotcha: the backend rejects a POST that carries Content-Type:json with an
   empty body, so every no-payload POST below passes body:'{}' explicitly. */
function api(url, opts) { return apiFetch(url, opts).then(r => r.json()) }

/* ── ISO-date helpers, local to this view (each view in this app keeps its own — see POS.jsx, Discounts.jsx) ── */
function toDate(iso)      { return new Date(iso + 'T00:00:00') }
function addDays(iso, n)  { return new Date(toDate(iso).getTime() + n * 86400000) }
function isoOf(dt)        { return dt.toISOString().slice(0, 10) }
function todayIso()       { return new Date().toISOString().slice(0, 10) }
function isoToDateOnly(iso) { return iso ? String(iso).slice(0, 10) : '' }
/* Reads the active locale the same way api.js does (useLangStore.getState()) so
   month names follow the UI language — react-i18next re-renders this view on
   language change, so the fresh locale is picked up on the next render. */
function fmtDate(iso) {
  if (!iso) return '—'
  const lang = useLangStore.getState().lang || 'en'
  return toDate(isoToDateOnly(iso)).toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtDateTime(iso) {
  if (!iso) return '—'
  const lang = useLangStore.getState().lang || 'en'
  return new Date(iso).toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function lineSalePrice(retail, saleDiscPct, override) {
  if (override?.price != null) return Math.round(override.price * 100) / 100
  const disc = override?.disc != null ? override.disc : saleDiscPct
  return Math.round(retail * (1 - disc / 100) * 100) / 100
}
function lineDiscPct(retail, price) { return retail ? Math.round((1 - price / retail) * 100) : 0 }

/* Builds the campaign items payload the same way for create and replace calls:
   an explicit salePrice or discountPct per line, mirroring whichever the user
   actually edited, falling back to the sale-level flat discount. */
function buildItemsPayload(selected, overrides, saleDisc) {
  return Object.keys(selected).filter(id => selected[id]).map(id => {
    const ov = overrides[id]
    if (ov?.price != null) return { productId: id, salePrice: ov.price }
    if (ov?.disc != null)  return { productId: id, discountPct: ov.disc }
    return { productId: id, discountPct: saleDisc }
  })
}

/* Normalizes a POST /promotions/suggest-discounts suggestion — the live
   response uses suggestedPrice/suggestedDiscountPct/reasonsText, not the
   salePrice/discountPct/reason fields the original spec described. */
function normalizeSuggestion(s) {
  const price = s.suggestedPrice ?? s.salePrice
  const why   = (s.reasonsText ?? s.reasons)?.filter?.(r => typeof r === 'string').join(' · ') || s.reason || s.note || ''
  return { price, why, unsuggestable: !!s.unsuggestable, note: s.note || why }
}

/* Hydrates the shared per-tab state (selected/overrides) from a fetched
   campaign's items[] — the reverse of buildItemsPayload. */
function hydrateSelection(items) {
  const selected = {}, overrides = {}
  ;(items ?? []).forEach(it => {
    selected[it.productId] = true
    if (it.overridePrice != null) overrides[it.productId] = { price: it.overridePrice }
    else if (it.overrideDiscountPct != null) overrides[it.productId] = { disc: it.overrideDiscountPct }
  })
  return { selected, overrides }
}

/* ── Compliance panel — renders whatever POST /promotions/check returns:
   {ok, findings:[{level,code,message}]} ── */
function CompliancePanel({ t, result, checking }) {
  if (!result) return null
  const cls  = result.ok ? 'ok' : 'blocked'
  const icon = result.ok ? 'verified' : 'gpp_bad'
  return (
    <div className={`prm-compliance ${cls}`} style={checking ? { opacity: 0.6 } : undefined}>
      <div className={`prm-comp-hd ${cls}`}>
        <span className="material-symbols-outlined">{icon}</span>
        {result.ok ? t('promotions.compliance.ok') : t('promotions.compliance.blocked')}
        {checking && <span className="prm-comp-checking"> · {t('promotions.compliance.checking', 'checking…')}</span>}
      </div>
      {result.findings.map((f, i) => (
        <div key={i} className={`prm-finding ${f.level}`}>
          <span className="material-symbols-outlined">{f.level === 'block' ? 'cancel' : f.level === 'warn' ? 'warning' : 'info'}</span>
          <div>{f.message}</div>
        </div>
      ))}
    </div>
  )
}

/* ── Shared item picker + line editor, used by Your Sale and Seasonal Saldi.
   Fields come from GET /promotions/items (productId/currentPrice/refPrice30d/
   agingDays/qtyOnHand/cost/grossMarginPct) — no product photo in this feed. ── */
function SaleItemsTable({ t, products, saleDisc, selected, overrides, costVisible, aiNotes, onToggle, onEdit, onReset, onHistory, onToggleSeasonal }) {
  if (products.length === 0) return <div className="empty">{t('promotions.items.empty')}</div>

  return (
    <div>
      {products.map(p => {
        const id       = p.productId
        const on       = !!selected[id]
        const ov       = overrides[id]
        const ref      = Number(p.refPrice30d ?? p.currentPrice) || 0
        const price    = lineSalePrice(p.currentPrice, saleDisc, ov)
        const discPct  = lineDiscPct(p.currentPrice, price)
        const gm       = on ? p.grossMarginPct : null
        const overridden = !!(ov && (ov.disc != null || ov.price != null))
        const notLawful  = on && price >= ref
        const belowCost  = on && p.cost != null && price < p.cost
        const note       = aiNotes?.[id]
        const days       = p.agingDays
        const ageCls     = days == null ? '' : days >= 180 ? 'prm-datum-hot' : days >= 90 ? 'prm-datum-warm' : ''

        return (
          <div className="prm-sitem" key={id}>
            <div className="prm-sitem-top">
              <div className={`chk${on ? ' on' : ''}`} onClick={() => onToggle(id)} />
              <div className="prm-item-cell">
                <div>
                  <div className="prm-item-name">{p.name}</div>
                  <div className="prm-item-meta">{p.sku}{p.categoryPath ? ` · ${p.categoryPath}` : ''}</div>
                </div>
              </div>
              {onToggleSeasonal && (
                <div className={`prm-seasonal-tag${p.seasonal ? ' on' : ''}`} onClick={() => onToggleSeasonal(p)} title={t('promotions.items.seasonal_toggle_hint', 'Eligible for Seasonal Saldi')}>
                  <span className="material-symbols-outlined">{p.seasonal ? 'toggle_on' : 'toggle_off'}</span>
                  {t('promotions.items.seasonal_label', 'Seasonal')}
                </div>
              )}
            </div>

            <div className="prm-sitem-data">
              <div className="prm-datum"><span>{t('promotions.items.qty')}</span><b>{p.qtyOnHand ?? '—'}</b></div>
              <div className={`prm-datum ${ageCls}`}><span>{t('promotions.items.aging')}</span><b>{days != null ? t('promotions.items.days_short', { days }) : '—'}{ageCls === 'prm-datum-hot' && <span className="material-symbols-outlined prm-datum-warn-ic">warning</span>}</b></div>
              <div className="prm-datum"><span>{t('promotions.items.current')}</span><b>{fmtEUR(p.currentPrice)}</b></div>
              <div className="prm-datum"><span>{t('promotions.items.ref_30d')}</span><b>{fmtEUR(ref)}{p.refPriceProvisional && <span className="prm-provisional" title={t('promotions.items.ref_provisional_hint', 'Provisional — fewer than 2 price observations')}>*</span>}</b></div>
              {costVisible && <div className="prm-datum prm-datum-owner"><span>{t('promotions.items.cost')}</span><b>{p.cost != null ? fmtEUR(p.cost) : '—'}</b></div>}
              {costVisible && <div className="prm-datum prm-datum-owner"><span>{t('promotions.items.gm_label')}</span><b className={gm != null ? (gm < 45 ? 'prm-gm-thin' : gm > 60 ? 'prm-gm-ok' : '') : ''}>{gm != null ? `${gm}%` : '·'}</b></div>}
            </div>

            {on && (
              <div className="prm-sitem-edit">
                <div className="prm-edit-cell">
                  <span className="lbl">{t('promotions.items.discount_pct')}</span>
                  <input className={`prm-edit-input${overridden && ov.disc != null ? ' overridden' : ''}`} type="number" value={discPct} onChange={e => onEdit(id, 'disc', e.target.value)} />
                </div>
                <div className="prm-edit-cell">
                  <span className="lbl">{t('promotions.items.sale_price')}</span>
                  <input className={`prm-edit-input${overridden && ov.price != null ? ' overridden' : ''}`} type="number" step="0.01" value={price} onChange={e => onEdit(id, 'price', e.target.value)} />
                </div>
                <div className="prm-edit-cell">
                  <span className="lbl">{t('promotions.items.final')}</span>
                  <div className="prm-final-price">{fmtEUR(price)}</div>
                </div>
                {overridden && <span className="prm-override-tag">{t('promotions.items.edited')}</span>}
                {overridden && <span className="prm-reset-link" onClick={() => onReset(id)}>{t('promotions.items.reset')}</span>}
                {onHistory && <span className="prm-history-link" onClick={() => onHistory(id)}><span className="material-symbols-outlined">history</span>{t('promotions.items.history', 'History')}</span>}
              </div>
            )}

            {note?.unsuggestable && on && <div className="prm-item-flag"><span className="material-symbols-outlined">block</span>{note.why}</div>}
            {note && !note.unsuggestable && on && <div className="prm-ai-why"><span className="material-symbols-outlined">auto_awesome</span>{t('promotions.items.ai_prefix')} {note.why}</div>}
            {notLawful && <div className="prm-item-flag"><span className="material-symbols-outlined">warning</span>{t('promotions.items.not_below_ref')}</div>}
            {belowCost && costVisible && <div className="prm-item-flag"><span className="material-symbols-outlined">warning</span>{t('promotions.items.below_cost')}</div>}
          </div>
        )
      })}
    </div>
  )
}

/* ── Price-history popover — GET /promotions/items/:id/price-history ── */
function PriceHistoryModal({ t, loading, history, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{t('promotions.history.title', 'Price history')}</div>
        {loading
          ? <div className="dc-loading">{t('promotions.items.loading')}</div>
          : (history.length === 0
            ? <div className="empty">{t('promotions.history.empty', 'No recorded price history')}</div>
            : (
              <table className="tbl">
                <thead><tr><th>{t('promotions.history.col_date', 'Date')}</th><th className="prm-num">{t('promotions.history.col_price', 'Price')}</th><th>{t('promotions.history.col_source', 'Source')}</th><th>{t('promotions.history.col_by', 'Changed by')}</th></tr></thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={i}>
                      <td>{fmtDateTime(h.validFrom)}</td>
                      <td className="prm-num">{fmtEUR(h.price)}</td>
                      <td>{h.source}</td>
                      <td>{h.changedByName ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
        <div className="actions" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn btn-outline" onClick={onClose}>{t('common.close', 'Close')}</button>
        </div>
      </div>
    </div>
  )
}

const MI_STATE_META = {
  pending:   { pill: 'sp-pending', icon: 'hourglass_top',    labelKey: 'promotions.mi.state.pending' },
  opted_in:  { pill: 'sp-in',      icon: 'check_circle',      labelKey: 'promotions.mi.state.opted_in' },
  opted_out: { pill: 'sp-out',     icon: 'do_not_disturb_on', labelKey: 'promotions.mi.state.opted_out' },
  missed:    { pill: 'sp-missed',  icon: 'event_busy',        labelKey: 'promotions.mi.state.missed' },
  live:      { pill: 'sp-live',    icon: 'bolt',               labelKey: 'promotions.mi.state.live' },
  ended:     { pill: 'sp-ended',   icon: 'history',            labelKey: 'promotions.mi.state.ended' },
}

export default function Promotions() {
  const { toasts, show }  = useToast()
  const { t }             = useTranslation()
  const lang              = useLangStore(s => s.lang)

  const [activeTab, setActiveTab] = useState(0)  // 0 self · 1 saldi · 2 mi

  const [profile, setProfile]     = useState(null)
  const [saldiRules, setSaldiRules] = useState(null)

  useEffect(() => {
    api(`${API}/boutique/promotions/profile`).then(res => { if (res.success) setProfile(res.data) })
  }, [])
  useEffect(() => {
    api(`${API}/boutique/saldi-rules?year=${new Date().getFullYear()}`).then(res => { if (res.success) setSaldiRules(res.data) })
  }, [])

  function changeRegion(newRegion) {
    if (!profile) return
    const prev = profile.region
    setProfile(p => ({ ...p, region: newRegion }))
    api(`${API}/boutique/promotions/profile`, { method: 'PUT', body: JSON.stringify({ region: newRegion, tier: profile.tier }) })
      .then(res => {
        if (!res.success) { setProfile(p => ({ ...p, region: prev })); show(res.message ?? t('promotions.region.update_failed', 'Failed to update region'), 'error') }
        else show(t('promotions.region.updated', 'Region updated'), 'success')
      })
  }

  const regionRules = saldiRules?.regions?.[profile?.region]
  const regionOptions = saldiRules?.regionList ?? (profile?.region ? [profile.region] : [])

  const [historyFor, setHistoryFor]     = useState(null)
  const [historyData, setHistoryData]   = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  function openHistory(productId) {
    setHistoryFor(productId); setHistoryData([]); setHistoryLoading(true)
    api(`${API}/boutique/promotions/items/${productId}/price-history?days=120`)
      .then(res => { if (res.success) setHistoryData(res.data.history ?? []) })
      .finally(() => setHistoryLoading(false))
  }

  /* ── Your sale ── */
  const [selfCampaignId, setSelfCampaignId] = useState(null)
  const [selfStatus, setSelfStatus]         = useState('none') // none · paused · active
  const [selfSaving, setSelfSaving]         = useState(false)
  const [selfName, setSelfName]         = useState(() => t('promotions.self.default_name'))
  const [selfDisc, setSelfDisc]         = useState(20)
  const [selfStart, setSelfStart]       = useState(todayIso())
  const [selfEnd, setSelfEnd]           = useState(isoOf(addDays(todayIso(), 14)))
  const [selfSelected, setSelfSelected] = useState({})
  const [selfOverride, setSelfOverride] = useState({})
  const [selfAiNotes, setSelfAiNotes]   = useState({})

  const [selfProducts, setSelfProducts]         = useState([])
  const [selfCostVisible, setSelfCostVisible]   = useState(false)
  const [selfLoading, setSelfLoading]           = useState(true)

  useEffect(() => {
    setSelfLoading(true)
    api(`${API}/boutique/promotions/items?startsAt=${selfStart}&seasonalOnly=false&page=1&limit=100`)
      .then(res => {
        if (!res.success) return
        setSelfProducts(res.data.items ?? [])
        setSelfCostVisible(!!res.data.context?.costVisible)
      })
      .finally(() => setSelfLoading(false))
  }, [selfStart, lang])

  function hydrateSelfCampaign(id) {
    api(`${API}/boutique/promotions/sales/${id}`).then(res => {
      if (!res.success) return
      const c = res.data.campaign
      setSelfCampaignId(c.id)
      setSelfStatus(c.status)
      setSelfName(c.name)
      setSelfDisc(c.discountValue)
      setSelfStart(isoToDateOnly(c.startsAt))
      setSelfEnd(isoToDateOnly(c.endsAt))
      const { selected, overrides } = hydrateSelection(c.items)
      setSelfSelected(selected); setSelfOverride(overrides)
    })
  }

  function toggleSelf(id) { setSelfSelected(s => ({ ...s, [id]: !s[id] })) }
  function editSelfLine(id, kind, val) {
    const v = parseFloat(val); if (isNaN(v)) return
    setSelfOverride(o => ({ ...o, [id]: kind === 'disc' ? { disc: Math.max(0, Math.min(v, 90)) } : { price: Math.max(0, v) } }))
    setSelfAiNotes(n => { const x = { ...n }; delete x[id]; return x })
  }
  function resetSelfLine(id) {
    setSelfOverride(o => { const n = { ...o }; delete n[id]; return n })
    setSelfAiNotes(n => { const x = { ...n }; delete x[id]; return x })
  }
  function toggleSelfSeasonal(p) {
    const next = !p.seasonal
    api(`${API}/boutique/promotions/items/${p.productId}/attrs`, { method: 'PUT', body: JSON.stringify({ seasonal: next }) })
      .then(res => {
        if (res.success) setSelfProducts(ps => ps.map(x => x.productId === p.productId ? { ...x, seasonal: next } : x))
        else show(res.message ?? t('promotions.items.seasonal_update_failed', 'Failed to update'), 'error')
      })
  }
  function aiSuggestSelf() {
    const ids = Object.keys(selfSelected).filter(id => selfSelected[id])
    if (!ids.length) return
    api(`${API}/boutique/promotions/suggest-discounts`, { method: 'POST', body: JSON.stringify({ productIds: ids, refDate: selfStart }) })
      .then(res => {
        if (!res.success) return
        const notes = {}
        res.data.suggestions.forEach(raw => {
          const s = normalizeSuggestion(raw)
          if (s.unsuggestable) { notes[raw.productId] = { unsuggestable: true, why: s.note }; return }
          setSelfOverride(o => ({ ...o, [raw.productId]: { price: s.price } }))
          notes[raw.productId] = { why: s.why }
        })
        setSelfAiNotes(n => ({ ...n, ...notes }))
      })
  }

  const [selfCompliance, setSelfCompliance]   = useState(null)
  const [selfChecking, setSelfChecking]       = useState(false)
  const selfCheckTimer = useRef(null)
  useEffect(() => {
    clearTimeout(selfCheckTimer.current)
    const ids = Object.keys(selfSelected).filter(id => selfSelected[id])
    if (!ids.length) { setSelfCompliance({ ok: false, findings: [{ level: 'warn', code: 'no_items', message: t('promotions.compliance.no_items') }] }); return }
    selfCheckTimer.current = setTimeout(() => {
      setSelfChecking(true)
      const items = ids.map(id => {
        const p = selfProducts.find(x => x.productId === id)
        return { productId: id, salePrice: p ? lineSalePrice(p.currentPrice, selfDisc, selfOverride[id]) : undefined }
      })
      api(`${API}/boutique/promotions/check`, { method: 'POST', body: JSON.stringify({ kind: 'boutique_promo', start: selfStart, end: selfEnd, lang, items }) })
        .then(res => { if (res.success) setSelfCompliance(res.data) })
        .finally(() => setSelfChecking(false))
    }, 350)
    return () => clearTimeout(selfCheckTimer.current)
  }, [selfSelected, selfOverride, selfStart, selfEnd, selfDisc, selfProducts, lang, t])

  async function saveSelfDraft() {
    setSelfSaving(true)
    try {
      const items = buildItemsPayload(selfSelected, selfOverride, selfDisc)
      const startsAt = new Date(selfStart).toISOString(), endsAt = new Date(selfEnd).toISOString()
      if (!selfCampaignId) {
        const res = await api(`${API}/boutique/promotions/sales`, { method: 'POST', body: JSON.stringify({ kind: 'boutique_promo', name: selfName, description: '', discountValue: selfDisc, startsAt, endsAt, items }) })
        if (!res.success) { show(res.message ?? t('promotions.self.save_failed', 'Failed to save'), 'error'); return null }
        setSelfCampaignId(res.data.campaign.id); setSelfStatus(res.data.campaign.status)
        return res.data.campaign.id
      }
      const r1 = await api(`${API}/boutique/promotions/sales/${selfCampaignId}`, { method: 'PUT', body: JSON.stringify({ name: selfName, discountValue: selfDisc, startsAt, endsAt }) })
      if (!r1.success) { show(r1.message ?? t('promotions.self.save_failed', 'Failed to save'), 'error'); return null }
      const r2 = await api(`${API}/boutique/promotions/sales/${selfCampaignId}/items?mode=replace`, { method: 'PUT', body: JSON.stringify({ items }) })
      if (!r2.success) { show(r2.message ?? t('promotions.self.save_failed', 'Failed to save'), 'error'); return null }
      return selfCampaignId
    } finally { setSelfSaving(false) }
  }
  async function startSelfPromo() {
    const id = await saveSelfDraft()
    if (!id) return
    const res = await api(`${API}/boutique/promotions/sales/${id}/start`, { method: 'POST', body: '{}' })
    if (res.success) { setSelfStatus('active'); show(t('promotions.self.toast_started', { name: selfName, count: Object.keys(selfSelected).filter(k => selfSelected[k]).length }), 'success') }
    else { if (res.data) setSelfCompliance(res.data); show(res.message ?? t('promotions.self.start_failed', 'Could not start'), 'error') }
  }
  async function stopSelfPromo() {
    const res = await api(`${API}/boutique/promotions/sales/${selfCampaignId}/stop`, { method: 'POST', body: '{}' })
    if (res.success) { setSelfStatus('paused'); show(t('promotions.self.toast_stopped', 'Sale stopped'), 'success') }
    else show(res.message ?? t('promotions.self.stop_failed', 'Could not stop'), 'error')
  }
  async function discardSelfDraft() {
    if (!selfCampaignId) return
    const res = await api(`${API}/boutique/promotions/sales/${selfCampaignId}`, { method: 'DELETE' })
    if (!res.success) { show(res.message ?? t('promotions.self.discard_failed', 'Could not discard'), 'error'); return }
    setSelfCampaignId(null); setSelfStatus('none')
    setSelfName(t('promotions.self.default_name')); setSelfDisc(20)
    setSelfStart(todayIso()); setSelfEnd(isoOf(addDays(todayIso(), 14)))
    setSelfSelected({}); setSelfOverride({}); setSelfAiNotes({})
    show(t('promotions.self.toast_discarded', 'Draft discarded'), 'success')
  }

  /* ── Seasonal saldi ── */
  const [saldiCampaignId, setSaldiCampaignId] = useState(null)
  const [saldiStatus, setSaldiStatus]         = useState('none')
  const [saldiSaving, setSaldiSaving]         = useState(false)
  const [saldiSeason, setSaldiSeason]     = useState('summer')
  const [saldiDisc, setSaldiDisc]         = useState(30)
  const [saldiSelected, setSaldiSelected] = useState({})
  const [saldiOverride, setSaldiOverride] = useState({})
  const [saldiAiNotes, setSaldiAiNotes]   = useState({})

  const saldiStart     = regionRules ? (saldiSeason === 'summer' ? regionRules.summerStart     : regionRules.winterStart)     : ''
  const saldiEnd       = regionRules ? (saldiSeason === 'summer' ? regionRules.summerMustEndBy  : regionRules.winterMustEndBy) : ''
  const saldiAvailable = regionRules ? !!(saldiSeason === 'summer' ? regionRules.seasonsVerified?.summer : regionRules.seasonsVerified?.winter) : false

  const [saldiProducts, setSaldiProducts]       = useState([])
  const [saldiCostVisible, setSaldiCostVisible] = useState(false)
  const [saldiLoading, setSaldiLoading]         = useState(true)

  useEffect(() => {
    if (!saldiStart) return
    setSaldiLoading(true)
    api(`${API}/boutique/promotions/items?startsAt=${saldiStart}&seasonalOnly=true&page=1&limit=100`)
      .then(res => {
        if (!res.success) return
        setSaldiProducts(res.data.items ?? [])
        setSaldiCostVisible(!!res.data.context?.costVisible)
      })
      .finally(() => setSaldiLoading(false))
  }, [saldiStart, lang])

  function hydrateSaldiCampaign(id) {
    api(`${API}/boutique/promotions/sales/${id}`).then(res => {
      if (!res.success) return
      const c = res.data.campaign
      setSaldiCampaignId(c.id)
      setSaldiStatus(c.status)
      setSaldiDisc(c.discountValue)
      if (c.season) setSaldiSeason(c.season)
      const { selected, overrides } = hydrateSelection(c.items)
      setSaldiSelected(selected); setSaldiOverride(overrides)
    })
  }

  /* ── Resume any in-progress campaign per kind, once, on mount ── */
  useEffect(() => {
    api(`${API}/boutique/promotions/sales?page=1&limit=50`).then(res => {
      if (!res.success) return
      const campaigns = res.data.campaigns ?? []
      const pick = kind => campaigns
        .filter(c => c.kind === kind && c.status !== 'ended')
        .sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt))[0]
      const selfC  = pick('boutique_promo')
      const saldiC = pick('saldi')
      if (selfC)  hydrateSelfCampaign(selfC.id)
      if (saldiC) hydrateSaldiCampaign(saldiC.id)
    })
  }, [])

  function toggleSaldi(id) { setSaldiSelected(s => ({ ...s, [id]: !s[id] })) }
  function editSaldiLine(id, kind, val) {
    const v = parseFloat(val); if (isNaN(v)) return
    setSaldiOverride(o => ({ ...o, [id]: kind === 'disc' ? { disc: Math.max(0, Math.min(v, 90)) } : { price: Math.max(0, v) } }))
    setSaldiAiNotes(n => { const x = { ...n }; delete x[id]; return x })
  }
  function resetSaldiLine(id) {
    setSaldiOverride(o => { const n = { ...o }; delete n[id]; return n })
    setSaldiAiNotes(n => { const x = { ...n }; delete x[id]; return x })
  }
  function aiSuggestSaldi() {
    const ids = Object.keys(saldiSelected).filter(id => saldiSelected[id])
    if (!ids.length) return
    api(`${API}/boutique/promotions/suggest-discounts`, { method: 'POST', body: JSON.stringify({ productIds: ids, refDate: saldiStart }) })
      .then(res => {
        if (!res.success) return
        const notes = {}
        res.data.suggestions.forEach(raw => {
          const s = normalizeSuggestion(raw)
          if (s.unsuggestable) { notes[raw.productId] = { unsuggestable: true, why: s.note }; return }
          setSaldiOverride(o => ({ ...o, [raw.productId]: { price: s.price } }))
          notes[raw.productId] = { why: s.why }
        })
        setSaldiAiNotes(n => ({ ...n, ...notes }))
      })
  }

  const [saldiCompliance, setSaldiCompliance] = useState(null)
  const [saldiChecking, setSaldiChecking]     = useState(false)
  const saldiCheckTimer = useRef(null)
  useEffect(() => {
    clearTimeout(saldiCheckTimer.current)
    if (!saldiStart || !saldiEnd) return
    const ids = Object.keys(saldiSelected).filter(id => saldiSelected[id])
    if (!ids.length) { setSaldiCompliance({ ok: false, findings: [{ level: 'warn', code: 'no_items', message: t('promotions.compliance.no_items') }] }); return }
    saldiCheckTimer.current = setTimeout(() => {
      setSaldiChecking(true)
      const items = ids.map(id => {
        const p = saldiProducts.find(x => x.productId === id)
        return { productId: id, salePrice: p ? lineSalePrice(p.currentPrice, saldiDisc, saldiOverride[id]) : undefined }
      })
      api(`${API}/boutique/promotions/check`, { method: 'POST', body: JSON.stringify({ kind: 'saldi', season: saldiSeason, start: saldiStart, end: saldiEnd, lang, items }) })
        .then(res => { if (res.success) setSaldiCompliance(res.data) })
        .finally(() => setSaldiChecking(false))
    }, 350)
    return () => clearTimeout(saldiCheckTimer.current)
  }, [saldiSelected, saldiOverride, saldiStart, saldiEnd, saldiSeason, saldiDisc, saldiProducts, lang, t])

  async function saveSaldiDraft() {
    setSaldiSaving(true)
    try {
      const items = buildItemsPayload(saldiSelected, saldiOverride, saldiDisc)
      const startsAt = new Date(saldiStart).toISOString(), endsAt = new Date(saldiEnd).toISOString()
      if (!saldiCampaignId) {
        const seasonLabel = saldiSeason === 'summer' ? t('promotions.saldi.summer_title') : t('promotions.saldi.winter_title')
        const res = await api(`${API}/boutique/promotions/sales`, { method: 'POST', body: JSON.stringify({ kind: 'saldi', season: saldiSeason, name: t('promotions.saldi.default_name', { defaultValue: '{{season}} Saldi', season: seasonLabel }), description: '', discountValue: saldiDisc, startsAt, endsAt, items }) })
        if (!res.success) { show(res.message ?? t('promotions.saldi.save_failed', 'Failed to save'), 'error'); return null }
        setSaldiCampaignId(res.data.campaign.id); setSaldiStatus(res.data.campaign.status)
        return res.data.campaign.id
      }
      const r1 = await api(`${API}/boutique/promotions/sales/${saldiCampaignId}`, { method: 'PUT', body: JSON.stringify({ discountValue: saldiDisc, startsAt, endsAt }) })
      if (!r1.success) { show(r1.message ?? t('promotions.saldi.save_failed', 'Failed to save'), 'error'); return null }
      const r2 = await api(`${API}/boutique/promotions/sales/${saldiCampaignId}/items?mode=replace`, { method: 'PUT', body: JSON.stringify({ items }) })
      if (!r2.success) { show(r2.message ?? t('promotions.saldi.save_failed', 'Failed to save'), 'error'); return null }
      return saldiCampaignId
    } finally { setSaldiSaving(false) }
  }
  async function startSaldiPromo() {
    const id = await saveSaldiDraft()
    if (!id) return
    const res = await api(`${API}/boutique/promotions/sales/${id}/start`, { method: 'POST', body: '{}' })
    if (res.success) { setSaldiStatus('active'); show(t('promotions.saldi.toast_started', { count: Object.keys(saldiSelected).filter(k => saldiSelected[k]).length }), 'success') }
    else { if (res.data) setSaldiCompliance(res.data); show(res.message ?? t('promotions.saldi.start_failed', 'Could not start'), 'error') }
  }
  async function stopSaldiPromo() {
    const res = await api(`${API}/boutique/promotions/sales/${saldiCampaignId}/stop`, { method: 'POST', body: '{}' })
    if (res.success) { setSaldiStatus('paused'); show(t('promotions.saldi.toast_stopped', 'Sale stopped'), 'success') }
    else show(res.message ?? t('promotions.saldi.stop_failed', 'Could not stop'), 'error')
  }
  async function discardSaldiDraft() {
    if (!saldiCampaignId) return
    const res = await api(`${API}/boutique/promotions/sales/${saldiCampaignId}`, { method: 'DELETE' })
    if (!res.success) { show(res.message ?? t('promotions.saldi.discard_failed', 'Could not discard'), 'error'); return }
    setSaldiCampaignId(null); setSaldiStatus('none')
    setSaldiDisc(30); setSaldiSelected({}); setSaldiOverride({}); setSaldiAiNotes({})
    show(t('promotions.saldi.toast_discarded', 'Draft discarded'), 'success')
  }

  /* ── Mi Italia platform invitations ── */
  const [invitations, setInvitations] = useState([])
  const [invLoading, setInvLoading]   = useState(true)
  const [invSelected, setInvSelected] = useState({}) // { [invitationId]: { [productId]: true } }

  function refetchInvitations() {
    setInvLoading(true)
    api(`${API}/boutique/promotions/invitations`)
      .then(res => { if (res.success) setInvitations(res.data.invitations ?? []) })
      .finally(() => setInvLoading(false))
  }
  useEffect(() => { refetchInvitations() }, [])

  function toggleInvItem(invId, productId) {
    setInvSelected(s => ({ ...s, [invId]: { ...(s[invId] || {}), [productId]: !s[invId]?.[productId] } }))
  }
  async function optIn(inv) {
    const sel = invSelected[inv.invitationId] || {}
    const items = Object.keys(sel).filter(id => sel[id]).map(id => ({ productId: id }))
    if (!items.length) { show(t('promotions.mi.select_at_least_one', 'Select at least one item'), 'error'); return }
    const res = await api(`${API}/boutique/promotions/invitations/${inv.invitationId}/opt-in`, { method: 'POST', body: JSON.stringify({ items }) })
    if (res.success) { show(t('promotions.mi.toast_joined', { name: inv.name, count: items.length }), 'success'); refetchInvitations() }
    else show(res.message ?? t('promotions.mi.opt_in_failed', 'Failed to opt in'), 'error')
  }
  async function optOut(inv) {
    const res = await api(`${API}/boutique/promotions/invitations/${inv.invitationId}/opt-out`, { method: 'POST', body: '{}' })
    if (res.success) { show(t('promotions.mi.toast_declined', 'Invitation declined'), 'success'); refetchInvitations() }
    else show(res.message ?? t('promotions.mi.opt_out_failed', 'Failed to decline'), 'error')
  }

  const TABS = [t('promotions.tabs.your_sale'), t('promotions.tabs.seasonal_saldi'), t('promotions.tabs.mi_italia_sale')]

  return (
    <>
      <div className="prm-region-row">
        <span className="prm-region-lbl">{t('promotions.region.label')}</span>
        <div className="select-wrap prm-region-select-wrap">
          <select className="form-select" value={profile?.region ?? ''} onChange={e => changeRegion(e.target.value)}>
            {profile?.region && !regionOptions.includes(profile.region) && <option value={profile.region}>{profile.region}</option>}
            {regionOptions.map(r => <option key={r} value={r}>{r}{saldiRules?.regions?.[r]?.verified === false ? ` ${t('promotions.region.unverified')}` : ''}</option>)}
          </select>
          <span className="material-symbols-outlined select-arrow">expand_more</span>
        </div>
        {profile?.tier && <span className="prm-region-tier">{profile.tier}</span>}
        <span className="prm-region-note">{t('promotions.region.note')}</span>
      </div>

      <div className="tabs">
        {TABS.map((tab, i) => (
          <div key={tab} className={`tab${activeTab === i ? ' act' : ''}`} onClick={() => setActiveTab(i)}>{tab}</div>
        ))}
      </div>

      {/* ═══ YOUR SALE ═══ */}
      {activeTab === 0 && (
        <div>
          <div className="card">
            <div className="card-hdr"><div className="card-title">{t('promotions.self.card_title')} <em>{t('promotions.self.card_title_em')}</em></div></div>
            <div className="form-row2">
              <div className="form-group">
                <label className="form-lbl">{t('promotions.self.name_label')}</label>
                <input className="form-input" value={selfName} onChange={e => setSelfName(e.target.value)} disabled={selfStatus === 'active'} />
              </div>
              <div className="form-group">
                <label className="form-lbl">{t('promotions.self.discount_label')}</label>
                <input className="form-input" type="number" value={selfDisc} onChange={e => setSelfDisc(Number(e.target.value) || 0)} disabled={selfStatus === 'active'} />
              </div>
            </div>
            <div className="form-row2">
              <div className="form-group">
                <label className="form-lbl">{t('promotions.self.start_label')}</label>
                <input className="form-input" type="date" value={selfStart} onChange={e => setSelfStart(e.target.value)} disabled={selfStatus === 'active'} />
              </div>
              <div className="form-group">
                <label className="form-lbl">{t('promotions.self.end_label')}</label>
                <input className="form-input" type="date" value={selfEnd} min={selfStart} onChange={e => setSelfEnd(e.target.value)} disabled={selfStatus === 'active'} />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-hdr">
              <div className="card-title">{t('promotions.self.items_title')} <em>{t('promotions.self.items_title_em')}</em></div>
              <button className="btn btn-outline btn-sm" onClick={aiSuggestSelf} disabled={!Object.values(selfSelected).some(Boolean)}>
                <span className="material-symbols-outlined">auto_awesome</span>{t('promotions.self.suggest_btn')}
              </button>
            </div>
            <div className="prm-ref-note">{t('promotions.self.ref_note')}</div>
            {selfLoading
              ? <div className="dc-loading">{t('promotions.items.loading')}</div>
              : <SaleItemsTable t={t} products={selfProducts} saleDisc={selfDisc} selected={selfSelected} overrides={selfOverride} costVisible={selfCostVisible} aiNotes={selfAiNotes}
                  onToggle={toggleSelf} onEdit={editSelfLine} onReset={resetSelfLine} onHistory={openHistory} onToggleSeasonal={toggleSelfSeasonal} />}
          </div>

          <CompliancePanel t={t} result={selfCompliance} checking={selfChecking} />
          <div className="actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
            {selfCampaignId && selfStatus !== 'active' && (
              <span className="prm-discard-link" onClick={discardSelfDraft}>{t('promotions.self.discard_btn', 'Discard draft')}</span>
            )}
            {selfStatus !== 'active' && (
              <button className="btn btn-outline" onClick={saveSelfDraft} disabled={selfSaving}>{t('promotions.self.save_btn', 'Save draft')}</button>
            )}
            {selfStatus === 'active'
              ? <button className="btn btn-primary" onClick={stopSelfPromo}><span className="material-symbols-outlined">stop_circle</span>{t('promotions.self.stop_btn', 'Stop sale')}</button>
              : <button className="btn btn-primary" onClick={startSelfPromo} disabled={!selfCompliance?.ok || selfSaving}>
                  <span className="material-symbols-outlined">rocket_launch</span>{t('promotions.self.start_btn')}
                </button>}
          </div>
        </div>
      )}

      {/* ═══ SEASONAL SALDI ═══ */}
      {activeTab === 1 && (
        <div>
          <div className="prm-saldi-banner">
            <div className="prm-saldi-tag">{t('promotions.saldi.banner_tag')}</div>
            <div className="prm-saldi-ttl">{saldiSeason === 'summer' ? t('promotions.saldi.summer_title') : t('promotions.saldi.winter_title')} <em>saldi</em></div>
            <div className="prm-saldi-sub">{t('promotions.saldi.run_from', { season: saldiSeason === 'summer' ? t('promotions.saldi.summer_title') : t('promotions.saldi.winter_title'), region: profile?.region ?? '—', date: fmtDate(saldiStart), days: regionRules ? (saldiSeason === 'summer' ? regionRules.summerDays : regionRules.winterDays) : '—' })}</div>
          </div>

          {!saldiAvailable ? (
            <div className="alert alert-info">
              <span className="material-symbols-outlined">block</span>
              {t('promotions.saldi.unavailable', 'Saldi dates for this region are not yet confirmed — this season is blocked until verified.')}
            </div>
          ) : (
            <>
              <div className="card">
                <div className="card-hdr"><div className="card-title">{t('promotions.saldi.card_title')} <em>{t('promotions.saldi.card_title_em')}</em></div></div>
                <div className="alert alert-info">
                  <span className="material-symbols-outlined">info</span>
                  {t('promotions.saldi.info_alert')}
                </div>
                <div className="form-row2">
                  <div className="form-group">
                    <label className="form-lbl">{t('promotions.saldi.season_label')}</label>
                    <div className="select-wrap">
                      <select className="form-select" value={saldiSeason} onChange={e => setSaldiSeason(e.target.value)} disabled={saldiStatus === 'active'}>
                        <option value="summer">{t('promotions.saldi.season_summer')}</option>
                        <option value="winter">{t('promotions.saldi.season_winter')}</option>
                      </select>
                      <span className="material-symbols-outlined select-arrow">expand_more</span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-lbl">{t('promotions.saldi.discount_label')}</label>
                    <input className="form-input" type="number" value={saldiDisc} onChange={e => setSaldiDisc(Number(e.target.value) || 0)} disabled={saldiStatus === 'active'} />
                  </div>
                </div>
                <div className="form-row2">
                  <div className="form-group">
                    <label className="form-lbl">{t('promotions.saldi.start_fixed')}</label>
                    <input className="form-input" value={fmtDate(saldiStart)} readOnly />
                  </div>
                  <div className="form-group">
                    <label className="form-lbl">{t('promotions.saldi.end_by')}</label>
                    <input className="form-input" value={fmtDate(saldiEnd)} readOnly />
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-hdr">
                  <div className="card-title">{t('promotions.saldi.items_title')} <em>{t('promotions.saldi.items_title_em')}</em></div>
                  <button className="btn btn-outline btn-sm" onClick={aiSuggestSaldi} disabled={!Object.values(saldiSelected).some(Boolean)}>
                    <span className="material-symbols-outlined">auto_awesome</span>{t('promotions.saldi.suggest_btn')}
                  </button>
                </div>
                {saldiLoading
                  ? <div className="dc-loading">{t('promotions.items.loading')}</div>
                  : <SaleItemsTable t={t} products={saldiProducts} saleDisc={saldiDisc} selected={saldiSelected} overrides={saldiOverride} costVisible={saldiCostVisible} aiNotes={saldiAiNotes}
                      onToggle={toggleSaldi} onEdit={editSaldiLine} onReset={resetSaldiLine} onHistory={openHistory} />}
              </div>

              <CompliancePanel t={t} result={saldiCompliance} checking={saldiChecking} />
              <div className="actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                {saldiCampaignId && saldiStatus !== 'active' && (
                  <span className="prm-discard-link" onClick={discardSaldiDraft}>{t('promotions.saldi.discard_btn', 'Discard draft')}</span>
                )}
                {saldiStatus !== 'active' && (
                  <button className="btn btn-outline" onClick={saveSaldiDraft} disabled={saldiSaving}>{t('promotions.saldi.save_btn', 'Save draft')}</button>
                )}
                {saldiStatus === 'active'
                  ? <button className="btn btn-primary" onClick={stopSaldiPromo}><span className="material-symbols-outlined">stop_circle</span>{t('promotions.saldi.stop_btn', 'Stop sale')}</button>
                  : <button className="btn btn-primary" onClick={startSaldiPromo} disabled={!saldiCompliance?.ok || saldiSaving}>
                      <span className="material-symbols-outlined">rocket_launch</span>{t('promotions.saldi.start_btn')}
                    </button>}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ MI ITALIA SALE ═══ */}
      {activeTab === 2 && (
        <div>
          {invLoading
            ? <div className="dc-loading">{t('promotions.items.loading')}</div>
            : invitations.length === 0
              ? <div className="empty">{t('promotions.mi.empty', 'No platform sale invitations right now.')}</div>
              : invitations.map(inv => {
                  const meta = MI_STATE_META[inv.state] ?? MI_STATE_META.pending
                  const sel  = invSelected[inv.invitationId] || {}
                  return (
                    <div className="prm-mi-card" key={inv.invitationId}>
                      <div className="prm-mi-hd">
                        <div>
                          <div className="prm-mi-eyebrow">{t('promotions.mi.eyebrow')}</div>
                          <div className="prm-mi-ttl">{inv.name}</div>
                        </div>
                        <span className={`prm-state-pill ${meta.pill}`}><span className="material-symbols-outlined">{meta.icon}</span>{t(meta.labelKey)}</span>
                      </div>
                      <div className="prm-mi-body">
                        <div className="prm-mi-meta-row">
                          <div className="prm-mi-meta"><b>{fmtDate(inv.startsAt)} – {fmtDate(inv.endsAt)}</b><span>{t('promotions.mi.sale_window')}</span></div>
                          <div className="prm-mi-meta"><b>{inv.suggestedDepthPct}%</b><span>{t('promotions.mi.suggested_depth')}</span></div>
                          <div className="prm-mi-meta"><b>{fmtDate(inv.respondBy)}</b><span>{t('promotions.mi.respond_by_label', 'Respond by')}</span></div>
                        </div>

                        <div className="prm-why">
                          {t('promotions.mi.invited_because')}
                          <div className="prm-why-tags">
                            <span className="prm-why-tag">{t('promotions.mi.tag_region', { region: inv.targeting?.region })}</span>
                            <span className="prm-why-tag">{t('promotions.mi.tag_tier', { tier: inv.targeting?.tier })}</span>
                            {(inv.targeting?.categories ?? []).map(c => <span className="prm-why-tag" key={c}>{c}</span>)}
                          </div>
                        </div>

                        {inv.canRespond && inv.state === 'pending' && (
                          <>
                            {inv.daysLeftToRespond != null && (
                              <div className="prm-deadline">
                                <span className="material-symbols-outlined">schedule</span>
                                <div>{t('promotions.mi.respond_by', { date: fmtDate(inv.respondBy), days: Math.max(0, inv.daysLeftToRespond) })}</div>
                              </div>
                            )}
                            <div className="prm-mi-select-lbl">{t('promotions.mi.select_items')}</div>
                            {selfLoading
                              ? <div className="dc-loading">{t('promotions.items.loading')}</div>
                              : (
                                <table className="tbl">
                                  <thead><tr><th></th><th>{t('promotions.mi.col_item')}</th><th className="prm-num">{t('promotions.mi.col_retail')}</th><th className="prm-num">{t('promotions.mi.col_sale', { depth: inv.suggestedDepthPct })}</th></tr></thead>
                                  <tbody>
                                    {selfProducts.map(p => (
                                      <tr key={p.productId}>
                                        <td><div className={`chk${sel[p.productId] ? ' on' : ''}`} onClick={() => toggleInvItem(inv.invitationId, p.productId)} /></td>
                                        <td>{p.name}</td>
                                        <td className="prm-num">{fmtEUR(p.currentPrice)}</td>
                                        <td className="prm-num">{fmtEUR(p.currentPrice * (1 - inv.suggestedDepthPct / 100))}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            <div className="actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                              <button className="btn btn-outline" onClick={() => optOut(inv)}>{t('promotions.mi.opt_out_btn', 'Decline')}</button>
                              <button className="btn btn-primary" onClick={() => optIn(inv)}>
                                <span className="material-symbols-outlined">check</span>{t('promotions.mi.confirm_btn')}
                              </button>
                            </div>
                          </>
                        )}

                        {inv.state === 'opted_in' && (
                          <div className="actions" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                            <button className="btn btn-outline" onClick={() => optOut(inv)}>{t('promotions.mi.withdraw_btn', 'Withdraw')}</button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
        </div>
      )}

      {historyFor && (
        <PriceHistoryModal t={t} loading={historyLoading} history={historyData} onClose={() => setHistoryFor(null)} />
      )}

      <Toast toasts={toasts} />
    </>
  )
}
