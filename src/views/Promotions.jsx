import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'
import useLangStore from '../store/langStore'
import Toast, { useToast } from '../components/ui/Toast'

const API      = import.meta.env.VITE_API_URL
const IMG_BASE = import.meta.env.VITE_IMG_BASE_URL

function imgSrc(url) { return !url ? null : url.startsWith('http') ? url : `${IMG_BASE}${url}` }
function fmtEUR(n) { return '€' + Number(n || 0).toFixed(2) }

/* ── ISO-date helpers, local to this view (each view in this app keeps its own — see POS.jsx, Discounts.jsx) ── */
function toDate(iso)      { return new Date(iso + 'T00:00:00') }
function addDays(iso, n)  { return new Date(toDate(iso).getTime() + n * 86400000) }
function isoOf(dt)        { return dt.toISOString().slice(0, 10) }
function todayIso()       { return new Date().toISOString().slice(0, 10) }
/* Reads the active locale the same way api.js does (useLangStore.getState()) so
   month names follow the UI language — react-i18next re-renders this view on
   language change, so the fresh locale is picked up on the next render. */
function fmtDate(iso) {
  if (!iso) return '—'
  const lang = useLangStore.getState().lang || 'en'
  return toDate(iso).toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function daysUntil(iso)   { return Math.ceil((toDate(iso).getTime() - Date.now()) / 86400000) }
function daysInStock(p)   { return p.days_in_stock ?? (p.created_at ? Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000) : null) }

/* ── Regional seasonal-saldi rules — a working client-side reference table.
   There is no backend compliance service yet, so this ships the same way
   Discounts.jsx's Seasonal Sales tab ships without one: fully interactive,
   flagged here as pending real verification/backend wiring. ── */
const REGION_RULES = {
  Lombardia: { summerStart: '2026-07-04', summerDays: 60, winterStart: '2027-01-07', winterDays: 60, presaleBanDays: 30, verified: true },
  Toscana:   { summerStart: '2026-07-04', summerDays: 60, winterStart: '2027-01-07', winterDays: 60, presaleBanDays: 30, verified: true },
  Sicilia:   { summerStart: '2026-07-04', summerDays: 73, winterStart: '2027-01-07', winterDays: 60, presaleBanDays: 0,  verified: true },
  Puglia:    { summerStart: '2026-07-04', summerDays: 73, winterStart: '2027-01-07', winterDays: 60, presaleBanDays: 15, verified: true },
  Lazio:     { summerStart: '2026-07-04', summerDays: 42, winterStart: '2027-01-07', winterDays: 42, presaleBanDays: 30, verified: true },
  Veneto:    { summerStart: '2026-07-04', summerDays: 60, winterStart: '2027-01-07', winterDays: 60, presaleBanDays: null, verified: false },
}
const REGIONS = Object.keys(REGION_RULES)

function grossMarginPct(retail, cost) {
  if (cost == null || !retail) return null
  return Math.round((retail - cost) / retail * 100)
}
function lineSalePrice(retail, saleDiscPct, override) {
  if (override?.price != null) return Math.round(override.price * 100) / 100
  const disc = override?.disc != null ? override.disc : saleDiscPct
  return Math.round(retail * (1 - disc / 100) * 100) / 100
}
function lineDiscPct(retail, price) { return retail ? Math.round((1 - price / retail) * 100) : 0 }

/* AI heuristic — a transparent, explainable stand-in for a real recommender
   service. It never proposes a price at/above the reference price and never
   proposes below cost. */
function aiSuggestLine(p, refPrice, t) {
  let disc = 10
  const reasons = []
  const days = daysInStock(p)
  if (days != null && days >= 180)      { disc += 25; reasons.push(t('promotions.ai.stock_180')) }
  else if (days != null && days >= 90)  { disc += 12; reasons.push(t('promotions.ai.stock_90')) }
  const gm = grossMarginPct(p.retail_price, p.cost_price)
  if (gm != null && gm < 45)      { disc = Math.min(disc, 15); reasons.push(t('promotions.ai.thin_margin')) }
  else if (gm != null && gm > 65) { disc += 5; reasons.push(t('promotions.ai.healthy_margin')) }
  disc = Math.max(5, Math.min(disc, 50))
  let price = Math.round(p.retail_price * (1 - disc / 100) * 100) / 100
  if (price >= refPrice) price = Math.round((refPrice - 0.01) * 100) / 100
  if (p.cost_price != null && price < p.cost_price) { price = p.cost_price; reasons.push(t('promotions.ai.floored_cost')) }
  return { price, why: reasons.join(' · ') }
}

/* Findings carry a stable `code` alongside the localized `msg` — callers must
   branch on `code`, never on the message text, which changes with the locale. */
function checkCompliance({ kind, region, start, end, items, t }) {
  const findings = []
  const reg = REGION_RULES[region]
  if (!reg) return { ok: false, findings: [{ level: 'block', code: 'no_rules', msg: t('promotions.compliance.no_rules', { region }) }] }

  if (kind === 'saldi' && !reg.verified)
    findings.push({ level: 'block', code: 'unverified_region', msg: t('promotions.compliance.unverified_region', { region }) })

  if ((kind === 'boutique_promo' || kind === 'mi_italia_optin') && reg.presaleBanDays) {
    ;[['summer', reg.summerStart], ['winter', reg.winterStart]].forEach(([season, sk]) => {
      if (!sk) return
      const banOpen = isoOf(addDays(sk, -reg.presaleBanDays))
      if (start < sk && end >= banOpen)
        findings.push({
          level: 'block',
          code: 'presale_ban',
          msg: t('promotions.compliance.presale_ban', {
            region,
            days: reg.presaleBanDays,
            season: season === 'summer' ? t('promotions.saldi.summer_title') : t('promotions.saldi.winter_title'),
            from: fmtDate(banOpen),
            to: fmtDate(sk),
          }),
        })
    })
  }

  if (!items.length) findings.push({ level: 'warn', code: 'no_items', msg: t('promotions.compliance.no_items') })
  items.forEach(it => {
    if (it.salePrice >= it.refPrice) findings.push({ level: 'warn', code: 'item_not_below_ref', msg: t('promotions.compliance.item_not_below_ref', { name: it.name, ref: fmtEUR(it.refPrice) }) })
    if (it.costPrice != null && it.salePrice < it.costPrice) findings.push({ level: 'warn', code: 'item_below_cost', msg: t('promotions.compliance.item_below_cost', { name: it.name, cost: fmtEUR(it.costPrice) }) })
  })

  findings.push({ level: 'info', code: 'show_original', msg: t('promotions.compliance.show_original') })

  return { ok: !findings.some(f => f.level === 'block'), findings }
}

/* ── Compliance panel ── */
function CompliancePanel({ t, result }) {
  const cls  = result.ok ? 'ok' : 'blocked'
  const icon = result.ok ? 'verified' : 'gpp_bad'
  return (
    <div className={`prm-compliance ${cls}`}>
      <div className={`prm-comp-hd ${cls}`}>
        <span className="material-symbols-outlined">{icon}</span>
        {result.ok ? t('promotions.compliance.ok') : t('promotions.compliance.blocked')}
      </div>
      {result.findings.map((f, i) => (
        <div key={i} className={`prm-finding ${f.level}`}>
          <span className="material-symbols-outlined">{f.level === 'block' ? 'cancel' : f.level === 'warn' ? 'warning' : 'info'}</span>
          <div>{f.msg}</div>
        </div>
      ))}
    </div>
  )
}

/* ── Shared item picker + line editor, used by Your Sale and Seasonal Saldi.
   Mirrors the design source's rich per-item layout: a data row of stock/aging/
   cost/margin stats always shown, and an edit row (discount %/price/final)
   only for selected items. ── */
function SaleItemsTable({ t, products, saleDisc, selected, overrides, isOwner, onToggle, onEdit, onReset }) {
  if (products.length === 0) return <div className="empty">{t('promotions.items.empty')}</div>

  return (
    <div>
      {products.map(p => {
        const on       = !!selected[p.id]
        const ov       = overrides[p.id]
        const ref      = Number(p.retail_price) || 0   // no price-history feed yet — see note above the list
        const price    = lineSalePrice(p.retail_price, saleDisc, ov)
        const discPct  = lineDiscPct(p.retail_price, price)
        const gm       = on ? grossMarginPct(price, p.cost_price) : null
        const overridden = !!(ov && (ov.disc != null || ov.price != null))
        const notLawful  = on && price >= ref
        const belowCost  = on && p.cost_price != null && price < p.cost_price
        const ai         = p._ai
        const qty        = p.stock_qty ?? p.total_stock ?? null
        const days       = daysInStock(p)
        const ageCls     = days == null ? '' : days >= 180 ? 'prm-datum-hot' : days >= 90 ? 'prm-datum-warm' : ''

        return (
          <div className="prm-sitem" key={p.id}>
            <div className="prm-sitem-top">
              <div className={`chk${on ? ' on' : ''}`} onClick={() => onToggle(p.id)} />
              <div className="prm-item-cell">
                <div className="prm-item-img" style={{ backgroundImage: imgSrc(p.main_photo) ? `url('${imgSrc(p.main_photo)}')` : undefined }} />
                <div>
                  <div className="prm-item-name">{p.name}</div>
                  <div className="prm-item-meta">{p.sku}{p.category_path ? ` · ${p.category_path}` : ''}</div>
                </div>
              </div>
            </div>

            <div className="prm-sitem-data">
              <div className="prm-datum"><span>{t('promotions.items.qty')}</span><b>{qty ?? '—'}</b></div>
              <div className={`prm-datum ${ageCls}`}><span>{t('promotions.items.aging')}</span><b>{days != null ? t('promotions.items.days_short', { days }) : '—'}{ageCls === 'prm-datum-hot' && <span className="material-symbols-outlined prm-datum-warn-ic">warning</span>}</b></div>
              <div className="prm-datum"><span>{t('promotions.items.current')}</span><b>{fmtEUR(p.retail_price)}</b></div>
              <div className="prm-datum"><span>{t('promotions.items.ref_30d')}</span><b>{fmtEUR(ref)}</b></div>
              {isOwner && <div className="prm-datum prm-datum-owner"><span>{t('promotions.items.cost')}</span><b>{p.cost_price != null ? fmtEUR(p.cost_price) : '—'}</b></div>}
              {isOwner && <div className="prm-datum prm-datum-owner"><span>{t('promotions.items.gm_label')}</span><b className={gm != null ? (gm < 45 ? 'prm-gm-thin' : gm > 60 ? 'prm-gm-ok' : '') : ''}>{gm != null ? `${gm}%` : '·'}</b></div>}
            </div>

            {on && (
              <div className="prm-sitem-edit">
                <div className="prm-edit-cell">
                  <span className="lbl">{t('promotions.items.discount_pct')}</span>
                  <input className={`prm-edit-input${overridden && ov.disc != null ? ' overridden' : ''}`} type="number" value={discPct} onChange={e => onEdit(p.id, 'disc', e.target.value)} />
                </div>
                <div className="prm-edit-cell">
                  <span className="lbl">{t('promotions.items.sale_price')}</span>
                  <input className={`prm-edit-input${overridden && ov.price != null ? ' overridden' : ''}`} type="number" step="0.01" value={price} onChange={e => onEdit(p.id, 'price', e.target.value)} />
                </div>
                <div className="prm-edit-cell">
                  <span className="lbl">{t('promotions.items.final')}</span>
                  <div className="prm-final-price">{fmtEUR(price)}</div>
                </div>
                {overridden && <span className="prm-override-tag">{t('promotions.items.edited')}</span>}
                {overridden && <span className="prm-reset-link" onClick={() => onReset(p.id)}>{t('promotions.items.reset')}</span>}
              </div>
            )}

            {ai?.why && on && <div className="prm-ai-why"><span className="material-symbols-outlined">auto_awesome</span>{t('promotions.items.ai_prefix')} {ai.why}</div>}
            {notLawful && <div className="prm-item-flag"><span className="material-symbols-outlined">warning</span>{t('promotions.items.not_below_ref')}</div>}
            {belowCost && isOwner && <div className="prm-item-flag"><span className="material-symbols-outlined">warning</span>{t('promotions.items.below_cost')}</div>}
          </div>
        )
      })}
    </div>
  )
}

const MI_SALE = {
  name: 'The Autumn Edit', start: '2026-10-03', end: '2026-10-17', depth: 15,
  deadline: '2026-09-26', targeting: { region: 'Lombardia', tier: 'Maison', category: 'Outerwear' },
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
  // Optimistically true (most Promotions users are owners) until the real
  // role — read from GET /boutique/profile, the same call Sidebar.jsx and
  // ViewProfile.jsx already make — resolves; there is no role in localStorage
  // anywhere in this app (Login.jsx only ever stores the token).
  const [isOwner, setIsOwner] = useState(true)

  const [activeTab, setActiveTab] = useState(0)  // 0 self · 1 saldi · 2 mi
  const [region, setRegion]       = useState('Lombardia')

  const [products, setProducts] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    apiFetch(`${API}/boutique/products?status=active&limit=100`)
      .then(r => r.json())
      .then(res => { if (res.success) setProducts(res.data?.products ?? []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [lang])

  useEffect(() => {
    apiFetch(`${API}/boutique/profile`)
      .then(r => r.json())
      .then(res => { if (res.success && res.data?.role) setIsOwner(res.data.role === 'owner') })
      .catch(() => {})
  }, [])

  /* ── Your sale ── */
  const [selfName, setSelfName]         = useState(() => t('promotions.self.default_name'))
  const [selfDisc, setSelfDisc]         = useState(20)
  const [selfStart, setSelfStart]       = useState(todayIso())
  const [selfEnd, setSelfEnd]           = useState(isoOf(addDays(todayIso(), 14)))
  const [selfSelected, setSelfSelected] = useState({})
  const [selfOverride, setSelfOverride] = useState({})

  function toggleSelf(id) { setSelfSelected(s => ({ ...s, [id]: !s[id] })) }
  function editSelfLine(id, kind, val) {
    const v = parseFloat(val); if (isNaN(v)) return
    setSelfOverride(o => ({ ...o, [id]: kind === 'disc' ? { disc: Math.max(0, Math.min(v, 90)) } : { price: Math.max(0, v) } }))
    setProducts(ps => ps.map(p => p.id === id ? { ...p, _ai: undefined } : p))
  }
  function resetSelfLine(id) {
    setSelfOverride(o => { const n = { ...o }; delete n[id]; return n })
    setProducts(ps => ps.map(p => p.id === id ? { ...p, _ai: undefined } : p))
  }
  function aiSuggestSelf() {
    setProducts(ps => ps.map(p => {
      if (!selfSelected[p.id]) return p
      const ref = Number(p.retail_price) || 0
      const s = aiSuggestLine(p, ref, t)
      setSelfOverride(o => ({ ...o, [p.id]: { price: s.price } }))
      return { ...p, _ai: s }
    }))
  }

  const selfItems = useMemo(() => products.filter(p => selfSelected[p.id]).map(p => {
    const ref = Number(p.retail_price) || 0
    return { name: p.name, refPrice: ref, salePrice: lineSalePrice(p.retail_price, selfDisc, selfOverride[p.id]), costPrice: p.cost_price ?? null }
  }), [products, selfSelected, selfOverride, selfDisc])

  const selfCompliance = useMemo(() => checkCompliance({ kind: 'boutique_promo', region, start: selfStart, end: selfEnd, items: selfItems, t }),
    [region, selfStart, selfEnd, selfItems, t])

  function startSelfPromo() {
    if (!selfCompliance.ok) return
    show(t('promotions.self.toast_started', { name: selfName, count: selfItems.length }), 'success')
  }

  /* ── Seasonal saldi ── */
  const [saldiSeason, setSaldiSeason]     = useState('summer')
  const [saldiDisc, setSaldiDisc]         = useState(30)
  const [saldiSelected, setSaldiSelected] = useState({})
  const [saldiOverride, setSaldiOverride] = useState({})

  const reg        = REGION_RULES[region]
  const saldiStart = saldiSeason === 'summer' ? reg.summerStart : reg.winterStart
  const saldiDays  = saldiSeason === 'summer' ? reg.summerDays  : reg.winterDays
  const saldiEnd   = saldiStart && saldiDays ? isoOf(addDays(saldiStart, saldiDays)) : ''

  function toggleSaldi(id) { setSaldiSelected(s => ({ ...s, [id]: !s[id] })) }
  function editSaldiLine(id, kind, val) {
    const v = parseFloat(val); if (isNaN(v)) return
    setSaldiOverride(o => ({ ...o, [id]: kind === 'disc' ? { disc: Math.max(0, Math.min(v, 90)) } : { price: Math.max(0, v) } }))
    setProducts(ps => ps.map(p => p.id === id ? { ...p, _ai: undefined } : p))
  }
  function resetSaldiLine(id) {
    setSaldiOverride(o => { const n = { ...o }; delete n[id]; return n })
    setProducts(ps => ps.map(p => p.id === id ? { ...p, _ai: undefined } : p))
  }
  function aiSuggestSaldi() {
    setProducts(ps => ps.map(p => {
      if (!saldiSelected[p.id]) return p
      const ref = Number(p.retail_price) || 0
      const s = aiSuggestLine(p, ref, t)
      setSaldiOverride(o => ({ ...o, [p.id]: { price: s.price } }))
      return { ...p, _ai: s }
    }))
  }

  const saldiItems = useMemo(() => products.filter(p => saldiSelected[p.id]).map(p => {
    const ref = Number(p.retail_price) || 0
    return { name: p.name, refPrice: ref, salePrice: lineSalePrice(p.retail_price, saldiDisc, saldiOverride[p.id]), costPrice: p.cost_price ?? null }
  }), [products, saldiSelected, saldiOverride, saldiDisc])

  const saldiCompliance = useMemo(() => checkCompliance({ kind: 'saldi', region, start: saldiStart, end: saldiEnd, items: saldiItems, t }),
    [region, saldiStart, saldiEnd, saldiItems, t])

  function startSaldiPromo() {
    if (!saldiCompliance.ok) return
    show(t('promotions.saldi.toast_started', { count: saldiItems.length }), 'success')
  }

  /* ── Mi Italia platform sale ── */
  const [miState, setMiState]         = useState('pending')
  const [miOptedIn, setMiOptedIn]     = useState(false)
  const [miSelected, setMiSelected]   = useState({})

  function toggleMi() {
    const next = !miOptedIn
    setMiOptedIn(next)
    setMiState(next ? 'opted_in' : 'opted_out')
  }
  function toggleMiItem(id) { setMiSelected(s => ({ ...s, [id]: !s[id] })) }

  const miItems = useMemo(() => products.filter(p => miSelected[p.id]).map(p => {
    const ref = Number(p.retail_price) || 0
    return { name: p.name, refPrice: ref, salePrice: Math.round(p.retail_price * (1 - MI_SALE.depth / 100) * 100) / 100, costPrice: p.cost_price ?? null }
  }), [products, miSelected])

  const miCompliance = useMemo(() => checkCompliance({ kind: 'mi_italia_optin', region, start: MI_SALE.start, end: MI_SALE.end, items: miItems, t }),
    [region, miItems, t])
  // Match on the stable finding code, not the message text — the message is localized.
  const miLegal = !miCompliance.findings.some(f => f.code === 'presale_ban')

  function confirmMi() {
    if (!(miCompliance.ok && miOptedIn)) return
    show(t('promotions.mi.toast_joined', { name: MI_SALE.name, count: miItems.length }), 'success')
  }

  const miMeta   = MI_STATE_META[miState]
  const showMiOptin = miState !== 'missed' && miState !== 'live' && miState !== 'ended'

  const TABS = [t('promotions.tabs.your_sale'), t('promotions.tabs.seasonal_saldi'), t('promotions.tabs.mi_italia_sale')]

  return (
    <>
      <div className="prm-region-row">
        <span className="prm-region-lbl">{t('promotions.region.label')}</span>
        <div className="select-wrap prm-region-select-wrap">
          <select className="form-select" value={region} onChange={e => setRegion(e.target.value)}>
            {REGIONS.map(r => <option key={r} value={r}>{r}{!REGION_RULES[r].verified ? ` ${t('promotions.region.unverified')}` : ''}</option>)}
          </select>
          <span className="material-symbols-outlined select-arrow">expand_more</span>
        </div>
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
                <input className="form-input" value={selfName} onChange={e => setSelfName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-lbl">{t('promotions.self.discount_label')}</label>
                <input className="form-input" type="number" value={selfDisc} onChange={e => setSelfDisc(Number(e.target.value) || 0)} />
              </div>
            </div>
            <div className="form-row2">
              <div className="form-group">
                <label className="form-lbl">{t('promotions.self.start_label')}</label>
                <input className="form-input" type="date" value={selfStart} onChange={e => setSelfStart(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-lbl">{t('promotions.self.end_label')}</label>
                <input className="form-input" type="date" value={selfEnd} min={selfStart} onChange={e => setSelfEnd(e.target.value)} />
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
            {loading
              ? <div className="dc-loading">{t('promotions.items.loading')}</div>
              : <SaleItemsTable t={t} products={products} saleDisc={selfDisc} selected={selfSelected} overrides={selfOverride} isOwner={isOwner}
                  onToggle={toggleSelf} onEdit={editSelfLine} onReset={resetSelfLine} />}
          </div>

          <CompliancePanel t={t} result={selfCompliance} />
          <div className="actions" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button className="btn btn-primary" onClick={startSelfPromo} disabled={!selfCompliance.ok}>
              <span className="material-symbols-outlined">rocket_launch</span>{t('promotions.self.start_btn')}
            </button>
          </div>
        </div>
      )}

      {/* ═══ SEASONAL SALDI ═══ */}
      {activeTab === 1 && (
        <div>
          <div className="prm-saldi-banner">
            <div className="prm-saldi-tag">{t('promotions.saldi.banner_tag')}</div>
            <div className="prm-saldi-ttl">{saldiSeason === 'summer' ? t('promotions.saldi.summer_title') : t('promotions.saldi.winter_title')} <em>saldi</em></div>
            <div className="prm-saldi-sub">{t('promotions.saldi.run_from', { season: saldiSeason === 'summer' ? t('promotions.saldi.summer_title') : t('promotions.saldi.winter_title'), region, date: fmtDate(saldiStart), days: saldiDays })}</div>
          </div>

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
                  <select className="form-select" value={saldiSeason} onChange={e => setSaldiSeason(e.target.value)}>
                    <option value="summer">{t('promotions.saldi.season_summer')}</option>
                    <option value="winter">{t('promotions.saldi.season_winter')}</option>
                  </select>
                  <span className="material-symbols-outlined select-arrow">expand_more</span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-lbl">{t('promotions.saldi.discount_label')}</label>
                <input className="form-input" type="number" value={saldiDisc} onChange={e => setSaldiDisc(Number(e.target.value) || 0)} />
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
            {loading
              ? <div className="dc-loading">{t('promotions.items.loading')}</div>
              : <SaleItemsTable t={t} products={products} saleDisc={saldiDisc} selected={saldiSelected} overrides={saldiOverride} isOwner={isOwner}
                  onToggle={toggleSaldi} onEdit={editSaldiLine} onReset={resetSaldiLine} />}
          </div>

          <CompliancePanel t={t} result={saldiCompliance} />
          <div className="actions" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button className="btn btn-primary" onClick={startSaldiPromo} disabled={!saldiCompliance.ok}>
              <span className="material-symbols-outlined">rocket_launch</span>{t('promotions.saldi.start_btn')}
            </button>
          </div>
        </div>
      )}

      {/* ═══ MI ITALIA SALE ═══ */}
      {activeTab === 2 && (
        <div>
          <div className="prm-demo-switch">
            <span className="prm-demo-lbl">{t('promotions.mi.demo_label')}</span>
            {Object.keys(MI_STATE_META).map(st => (
              <button key={st} className={`prm-demo-btn${miState === st ? ' act' : ''}`} onClick={() => { setMiState(st); setMiOptedIn(st === 'opted_in') }}>
                {t(MI_STATE_META[st].labelKey)}
              </button>
            ))}
          </div>

          <div className="alert alert-info">
            <span className="material-symbols-outlined">construction</span>
            {t('promotions.mi.backend_note')}
          </div>

          <div className="prm-mi-card">
            <div className="prm-mi-hd">
              <div>
                <div className="prm-mi-eyebrow">{t('promotions.mi.eyebrow')}</div>
                <div className="prm-mi-ttl">{t('promotions.mi.title_pre')} <em>{MI_SALE.name.replace('The ', '')}</em> {t('promotions.mi.title_suffix')}</div>
              </div>
              <span className={`prm-state-pill ${miMeta.pill}`}><span className="material-symbols-outlined">{miMeta.icon}</span>{t(miMeta.labelKey)}</span>
            </div>
            <div className="prm-mi-body">
              <div className="prm-mi-meta-row">
                <div className="prm-mi-meta"><b>{fmtDate(MI_SALE.start)} – {fmtDate(MI_SALE.end)}</b><span>{t('promotions.mi.sale_window')}</span></div>
                <div className="prm-mi-meta"><b>{MI_SALE.depth}%</b><span>{t('promotions.mi.suggested_depth')}</span></div>
                <div className="prm-mi-meta"><b style={{ color: miLegal ? 'var(--green)' : 'var(--red)' }}>{miLegal ? t('promotions.mi.legal_yes') : t('promotions.mi.legal_check')}</b><span>{t('promotions.mi.legal_label')}</span></div>
              </div>

              <div className="prm-why">
                {t('promotions.mi.invited_because')}
                <div className="prm-why-tags">
                  <span className="prm-why-tag">{t('promotions.mi.tag_region', { region: MI_SALE.targeting.region })}</span>
                  <span className="prm-why-tag">{t('promotions.mi.tag_tier', { tier: MI_SALE.targeting.tier })}</span>
                  <span className="prm-why-tag">{t('promotions.mi.tag_category', { category: MI_SALE.targeting.category })}</span>
                </div>
              </div>

              {miState !== 'missed' && miState !== 'live' && miState !== 'ended' && (
                <div className="prm-deadline">
                  <span className="material-symbols-outlined">schedule</span>
                  <div>{t('promotions.mi.respond_by', { date: fmtDate(MI_SALE.deadline), days: Math.max(0, daysUntil(MI_SALE.deadline)) })}</div>
                </div>
              )}
              {miState === 'missed' && (
                <div className="prm-deadline past">
                  <span className="material-symbols-outlined">schedule</span>
                  <div>{t('promotions.mi.missed_msg')}</div>
                </div>
              )}

              <p className="prm-mi-desc">{t('promotions.mi.description', { name: MI_SALE.name })}</p>

              {showMiOptin && (
                <>
                  <div className="prm-optin-row">
                    <div className={`toggle${miOptedIn ? ' on' : ''}`} onClick={toggleMi}><div className="toggle-knob" /></div>
                    <div><div className="prm-optin-lbl">{t('promotions.mi.opt_in')}</div><div className="prm-optin-sub">{t('promotions.mi.opt_in_sub')}</div></div>
                  </div>

                  {miOptedIn && (
                    <div>
                      <div className="prm-mi-select-lbl">{t('promotions.mi.select_items')}</div>
                      {loading
                        ? <div className="dc-loading">{t('promotions.items.loading')}</div>
                        : (
                          <table className="tbl">
                            <thead><tr><th></th><th>{t('promotions.mi.col_item')}</th><th className="prm-num">{t('promotions.mi.col_retail')}</th><th className="prm-num">{t('promotions.mi.col_sale', { depth: MI_SALE.depth })}</th></tr></thead>
                            <tbody>
                              {products.map(p => (
                                <tr key={p.id}>
                                  <td><div className={`chk${miSelected[p.id] ? ' on' : ''}`} onClick={() => toggleMiItem(p.id)} /></td>
                                  <td>{p.name}</td>
                                  <td className="prm-num">{fmtEUR(p.retail_price)}</td>
                                  <td className="prm-num">{fmtEUR(p.retail_price * (1 - MI_SALE.depth / 100))}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <CompliancePanel t={t} result={miCompliance} />
          {showMiOptin && (
            <div className="actions" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button className="btn btn-primary" onClick={confirmMi} disabled={!(miCompliance.ok && miOptedIn)}>
                <span className="material-symbols-outlined">check</span>{t('promotions.mi.confirm_btn')}
              </button>
            </div>
          )}

          <div className="prm-surfaces">
            <div className="prm-surfaces-lbl">{t('promotions.mi.surfaces_label')}</div>
            <div className="prm-surf-grid">
              <div className="prm-surf">
                <div className="prm-surf-cap"><span className="material-symbols-outlined">dashboard</span>{t('promotions.mi.surf_dashboard')}</div>
                <div className="prm-surf-body">
                  <div className="prm-dash-card">
                    <div className="prm-dash-card-eyebrow">{t('promotions.mi.eyebrow')}</div>
                    <div className="prm-dash-card-ttl">{t('promotions.mi.title_pre')} <em>{MI_SALE.name.replace('The ', '')}</em> {t('promotions.mi.title_suffix')}</div>
                    <div className="prm-dash-card-meta">{t('promotions.mi.dash_invitation', { date: fmtDate(MI_SALE.deadline) })}</div>
                    <div className="prm-dash-card-cta">{t('promotions.mi.dash_cta')}</div>
                  </div>
                </div>
              </div>
              <div className="prm-surf">
                <div className="prm-surf-cap"><span className="material-symbols-outlined">mail</span>{t('promotions.mi.surf_email')}</div>
                <div className="prm-surf-body">
                  <div className="prm-email-mock">
                    <div className="prm-email-from">{t('promotions.mi.email_from')}</div>
                    <div className="prm-email-subj">{t('promotions.mi.email_subj', { name: MI_SALE.name.replace('The ', '') })}</div>
                    <div>{t('promotions.mi.email_body')}</div>
                    <span className="prm-email-cta">{t('promotions.mi.email_cta')}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="prm-surf-note">{t('promotions.mi.surf_note')}</div>
          </div>
        </div>
      )}

      <Toast toasts={toasts} />
    </>
  )
}
