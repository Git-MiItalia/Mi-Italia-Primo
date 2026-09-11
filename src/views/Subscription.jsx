import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'
import { activeLocale } from '../lib/dateHelpers'
import StripeCheckout from '../components/ui/StripeCheckout'
import RangeBar from '../components/ui/RangeBar'

const BASE_URL = import.meta.env.VITE_API_URL

/* Numbers and dates on this page were a mix of bare toLocaleString() — which
   follows the BROWSER's locale, not the portal's — plain toFixed(2), which has
   no locale at all, and dates pinned to 'en' / 'en-GB'. So a boutique reading
   its own bill in Italian saw English thousands separators and English month
   names. Grouping is forced on because Italian leaves four-digit amounts
   ungrouped by default, which made columns read "€5311" above "€11.087". */
const num  = (v) => (v == null ? '—' : Number(v).toLocaleString(activeLocale(), { useGrouping: true }))
const num0 = (v) => (v == null ? '—' : Number(v).toLocaleString(activeLocale(), { maximumFractionDigits: 0, useGrouping: true }))
const amt2 = (v) => Number(v ?? 0).toLocaleString(activeLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true })
const monthShort = (d) => new Date(d).toLocaleDateString(activeLocale(), { month: 'short' })

// Ranking used to decide upgrade/downgrade direction for the action button
const PLAN_RANK = { starter: 0, connect: 1, pro: 2 }
function rank(code) { return PLAN_RANK[code] ?? 0 }

// Detect the "AI Studio renders/images" feature row within a plan's features
function isImagesFeature(text) {
  const s = (text ?? '').toLowerCase()
  return s.includes('ai studio') && (s.includes('render') || s.includes('image'))
}

// ══ Reusable UI components ═════════════════════════════════════════════
function Feat({ icon = 'check', locked, highlight, soon, children }) {
  let cls = 'sub-plan-feat'
  if (locked)    cls += ' locked'
  if (highlight) cls += ' highlight'
  if (soon)      cls += ' soon'
  const iconColor = highlight
    ? undefined
    : soon
    ? 'var(--gold-dk, #9C7F45)'
    : (icon === 'close' || icon === 'schedule')
    ? 'var(--stone)'
    : icon === 'check' && !locked
    ? 'var(--green)'
    : 'var(--stone)'
  return (
    <div className={cls}>
      <span className="material-symbols-outlined" style={iconColor ? { color: iconColor } : undefined}>{icon}</span>
      <span className="sub-plan-feat-text">{children}</span>
    </div>
  )
}

function AiSection({ t, children }) {
  return (
    <div className="sub-ai-section">
      <div className="sub-ai-header">
        <span className="material-symbols-outlined">neurology</span>
        <span>{t('sub.page.ai_assistant')}</span>
      </div>
      {children}
    </div>
  )
}

function MiniArch({ t, arch = [] }) {
  if (arch.length === 0) return null
  return (
    <div className="sub-bi-mini-arch">
      <div className="sub-bi-mini-arch-title">{t('sub.page.ai_stack')}</div>
      {arch.map(row => (
        <div key={row.layer} className={`sub-bi-mini-arch-row sub-bi-mini-arch-${row.state}`}>
          <div className={`sub-bi-mini-arch-num sub-bi-mini-arch-num-${row.state}`}>{row.layer}</div>
          <div className="sub-bi-mini-arch-info">
            <div className="sub-bi-mini-arch-name">{row.name}</div>
          </div>
          <div className="sub-bi-mini-arch-tag">{row.tag}</div>
        </div>
      ))}
    </div>
  )
}

// Turns one `usage` entry — { used, limit } — into the props UsageMeter wants.
//
// Three distinct meanings have to survive here:
//   limit null      → unlimited on this plan: show the count, faded full bar
//   limit 0         → not included on this plan (e.g. WhatsApp on Starter)
//   used null       → the backend doesn't measure it yet: show '—', never 0,
//                     so a missing field can't be mistaken for a real zero
// `used` above `limit` is left visible rather than clamped — a boutique over
// its allowance should see 4 / 2, not a tidy 2 / 2.
function meter(entry, t) {
  const used  = entry?.used
  const limit = entry?.limit
  const has   = used !== null && used !== undefined
  const n     = has ? Number(used) : null
  const cap   = limit === null || limit === undefined ? null : Number(limit)

  if (!has) return { display: '—', pct: 0, level: 'ok' }
  if (cap === null || !Number.isFinite(cap)) {
    return { display: num(n), pct: 100, unlimited: true, level: 'ok' }
  }
  if (cap === 0) {
    return { display: t ? t('sub.page.not_included', 'Not included') : '0', pct: 0, level: 'ok' }
  }
  const pct = Math.min(100, Math.round((n / cap) * 100))
  return {
    display: `${num(n)} / ${num(cap)}`,
    pct,
    level: n > cap ? 'crit' : pct >= 90 ? 'crit' : pct >= 75 ? 'warn' : 'ok',
  }
}

function UsageMeter({ label, display, hint, pct, unlimited, level = 'ok' }) {
  return (
    <div className="sub-um">
      <div className="sub-um-hdr">
        <div className="sub-um-lbl">{label}</div>
        <div className="sub-um-val">{display}</div>
      </div>
      <div className="sub-um-track">
        <div
          className={`sub-um-fill ${level}`}
          style={{ width: unlimited ? '100%' : `${pct}%`, opacity: unlimited ? 0.3 : 1 }}
        />
      </div>
      {hint && <div className={`sub-um-hint ${level}`}>{hint}</div>}
    </div>
  )
}

// ══ Plan card — driven by /plans endpoint ══════════════════════════════
function PlanCard({ t, plan, currentPlan, imagesLeft, onUpgrade, onUpgradeConnect, connectLoading, onBuyMore }) {
  const isCurrent    = plan.code === currentPlan
  const isUpgradeTo  = rank(plan.code) > rank(currentPlan)
  const isDowngrade  = rank(plan.code) < rank(currentPlan)
  const showBuyMore  = plan.code === 'connect'
  const showImgsLeft = plan.code === 'connect' && currentPlan === 'connect' && imagesLeft != null

  let cardClass = 'sub-plan-card'
  if (isCurrent)              cardClass += ' current'
  else if (plan.recommended)  cardClass += ' recommended'

  return (
    <div className={cardClass}>
      {isCurrent && <div className="sub-plan-tag current">{t('sub.badge.current')}</div>}
      {!isCurrent && plan.recommended && <div className="sub-plan-tag recommended">{t('sub.badge.popular')}</div>}

      <div className="sub-plan-name"><em>{plan.name}</em></div>
      <div className="sub-plan-tagline">{plan.tagline}</div>

      <div className="sub-plan-price">
        {plan.price_label?.split('/')[0] ?? `€${plan.price_eur ?? 0}`}
        <span className="sub-plan-price-mo">/mo</span>
      </div>
      <div className="sub-plan-price-sub">{plan.commission_label}</div>

      <div className="sub-plan-feats">
        {(plan.features ?? []).map((f, i) => {
          const isImages = isImagesFeature(f.text)
          const iconName = f.soon ? 'schedule' : (f.included ? 'check' : 'close')
          return (
            <Feat key={i} icon={iconName} locked={!f.included || f.soon} soon={f.soon}>
              {f.text}
              {isImages && showBuyMore && (
                <span className="sub-feat-images-actions">
                  {showImgsLeft && (
                    <span className="sub-feat-imgleft">{t('sub.page.images_left')}: <strong>{imagesLeft}</strong></span>
                  )}
                  <button className="sub-feat-buymore" onClick={onBuyMore}>
                    <span className="material-symbols-outlined">add_shopping_cart</span>
                    {t('sub.page.buy_more')}
                  </button>
                </span>
              )}
            </Feat>
          )
        })}

        {(plan.ai_capabilities ?? []).length > 0 && (
          <AiSection t={t}>
            {plan.ai_capabilities.map((c, i) => (
              <Feat
                key={i}
                icon={c.highlight ? 'workspace_premium' : (c.included ? 'check' : 'close')}
                locked={!c.included}
                highlight={c.highlight}>
                {c.text}
              </Feat>
            ))}
          </AiSection>
        )}

        <MiniArch t={t} arch={plan.arch} />
      </div>

      {isUpgradeTo && plan.code === 'connect' && (
        <button
          className="btn btn-primary sub-plan-action"
          onClick={onUpgradeConnect}
          disabled={connectLoading}>
          {connectLoading
            ? <><span className="material-symbols-outlined sub-plan-spin">sync</span> {t('sub.page.opening_portal')}</>
            : <><span className="material-symbols-outlined">north_east</span> {t('sub.page.upgrade_connect')}</>
          }
        </button>
      )}
      {isUpgradeTo && plan.code === 'pro' && (
        <>
          <button className="btn btn-primary sub-plan-action" onClick={onUpgrade}>
            <span className="material-symbols-outlined">north_east</span>
            {t('sub.page.upgrade_pro')}
          </button>
          {plan.breakeven_eur && (
            <div className="sub-plan-breakeven">
              {t('sub.page.breakeven', { amount: num(plan.breakeven_eur) })}
            </div>
          )}
        </>
      )}
      {isDowngrade && <div className="sub-plan-downgrade">{t('sub.page.downgrade')}</div>}
    </div>
  )
}

// ══ Topup modal ══════════════════════════════════════════════════════
// Card details are deliberately NOT collected here. Taking a raw card number,
// expiry and CVC through our own form would put card data through our page and
// server, which is a PCI obligation we don't want and don't need — the boutique
// is redirected to Stripe's hosted checkout instead, so the card never touches
// Primo. This replaced an earlier two-step mockup that had those fields.
function TopupModal({ t, onClose }) {
  const PACKS = [
    { images:  5, price: 10 },
    { images: 15, price: 25 },
    { images: 40, price: 60 },
  ]
  const [pack, setPack]       = useState(PACKS[0])
  const [redirecting, setRedirecting] = useState(false)
  const [error, setError]     = useState(null)

  async function handlePay() {
    setRedirecting(true)
    setError(null)
    try {
      const res = await apiFetch(`${BASE_URL}/boutique/subscription/topup`, {
        method: 'POST',
        body: JSON.stringify({ pack: String(pack.images) }),
      }).then(r => r.json())

      const url = res?.data?.checkout_url ?? res?.checkout_url
      if (res?.success && url) {
        window.location.href = url          // hand off to Stripe
        return                              // keep the spinner while the browser navigates
      }
      setError(res?.message ?? t('sub.topup.err_checkout', 'Could not start checkout. Please try again.'))
    } catch {
      setError(t('common.error_network', 'Network error. Please check your connection.'))
    }
    setRedirecting(false)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal sub-topup-modal" onClick={e => e.stopPropagation()}>
        <div className="sub-topup-hdr">
          <div className="sub-topup-eyebrow">{t('sub.topup.eyebrow')}</div>
          <button className="modal-close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="sub-topup-title">{t('sub.topup.title')} <em>{t('sub.topup.title_em')}</em></div>
        <div className="sub-topup-sub">
          {t('sub.topup.subtitle')}
        </div>

        <div className="sub-topup-grid">
          {PACKS.map(p => (
            <button
              key={p.images}
              className={`sub-topup-pack${pack.images === p.images ? ' on' : ''}`}
              onClick={() => setPack(p)}>
              <div className="sub-topup-pack-r">+{p.images}</div>
              <div className="sub-topup-pack-lbl">{t('sub.topup.images')}</div>
              <div className="sub-topup-pack-price">€{p.price}</div>
            </button>
          ))}
        </div>

        <div className="sub-pay-summary">
          <div className="sub-pay-summary-row">
            <span>{t('sub.topup.line_item')}</span>
            <span>+{pack.images} {t('sub.topup.images')}</span>
          </div>
          <div className="sub-pay-summary-row sub-pay-summary-vat">
            <span>{t('sub.topup.vat')}</span>
            <span>{t('sub.topup.vat_included')}</span>
          </div>
          <div className="sub-pay-summary-row sub-pay-summary-total">
            <span>{t('sub.topup.total_due')}</span>
            <span>€{pack.price}</span>
          </div>
        </div>

        <div className="sub-topup-note">
          <span className="material-symbols-outlined">info</span>
          <span>{t('sub.topup.quality_note')}</span>
        </div>

        <div className="sub-topup-note">
          <span className="material-symbols-outlined">lock</span>
          <span>{t('sub.topup.stripe_redirect_note', 'You will be taken to Stripe to pay securely. Your card details are never entered in Primo.')}</span>
        </div>

        {error && <div className="alert alert-urgent">{error}</div>}

        <div className="sub-topup-footer">
          <button className="btn btn-outline btn-sm" onClick={onClose} disabled={redirecting}>{t('common.cancel')}</button>
          <button className="btn btn-primary btn-sm" onClick={handlePay} disabled={redirecting}>
            {redirecting
              ? t('sub.topup.redirecting', 'Opening Stripe') + '…'
              : t('sub.topup.pay', { amount: pack.price })}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// ATTRIBUTION TAB
//
// Also no longer a mockup, despite what this header used to claim — it reads
// GET /boutique/subscription/attribution below.
// ══════════════════════════════════════════════════════════════════════
function AttributionTab({ t }) {
  // Range labels for the Attribution tab period display
  const RANGE_LABELS = {
    mtd:  t('sub.attr.range_mtd'),
    ytd:  t('sub.attr.range_ytd'),
    '7d': t('sub.attr.range_7d'),
    '30d': t('sub.attr.range_30d'),
    '90d': t('sub.attr.range_90d'),
    '12m': t('sub.attr.range_12m'),
  }

  const [range, setRange]             = useState('12m')
  const [compare, setCompare]         = useState('none')
  const [customRange, setCustomRange] = useState(null)

  const baseLabel = range === 'custom' && customRange
    ? t('sub.attr.custom_applied')
    : (RANGE_LABELS[range] ?? '')

  const periodLabel = (() => {
    if (compare === 'prev')     return `${baseLabel} · ${t('sub.attr.vs_prev')}`
    if (compare === 'prevyear') return `${baseLabel} · ${t('sub.attr.vs_2025')}`
    return baseLabel
  })()

  // ── GET /boutique/subscription/attribution ──────────────────────────────
  const [attr, setAttr]         = useState(null)
  const [attrLoading, setLoad]  = useState(true)
  const [attrError, setAttrErr] = useState(null)

  useEffect(() => {
    let cancelled = false
    // Flagging the request as in-flight is precisely what this effect is for —
    // the rule targets state derived from props, which this isn't.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoad(true)
    setAttrErr(null)
    const params = new URLSearchParams({ range, compare })
    if (range === 'custom' && customRange?.from && customRange?.to) {
      params.set('from', customRange.from)
      params.set('to', customRange.to)
    }
    apiFetch(`${BASE_URL}/boutique/subscription/attribution?${params}`)
      .then(r => r.json())
      .then(res => {
        if (cancelled) return
        if (res?.success) setAttr(res.data)
        else setAttrErr(res?.message ?? t('common.error_generic', 'Something went wrong. Please try again.'))
      })
      .catch(() => { if (!cancelled) setAttrErr(t('common.error_network', 'Network error. Please check your connection.')) })
      .finally(() => { if (!cancelled) setLoad(false) })
    return () => { cancelled = true }
  }, [range, compare, customRange, t])

  const idRate    = attr?.identification_rate ?? null
  const tierInfo  = attr?.commission_tier ?? null
  const ladder    = tierInfo?.ladder ?? []
  const trend     = attr?.identification_rate_trend ?? []
  const txs       = attr?.attributed_transactions ?? []

  const baseRate  = ladder.find(l => l.tier === 'base')?.rate_pct ?? null
  const tierNames = {
    base:     t('sub.attr.tier_base',     'Base'),
    silver:   t('sub.attr.tier_silver',   'Silver'),
    gold:     t('sub.attr.tier_gold',     'Gold'),
    platinum: t('sub.attr.tier_platinum', 'Platinum'),
  }
  const tierName = key => tierNames[key] ?? key

  // The ladder gives only each tier's floor, so a band's top is the next
  // tier's floor minus one; the last tier is open-ended.
  function tierBand(i) {
    const min = ladder[i]?.min_pct ?? 0
    const next = ladder[i + 1]?.min_pct
    return next == null ? `≥${min}%` : `${min}–${next - 1}%`
  }

  // Attributed revenue = sales that were matched to a customer. Unidentified
  // walk-ins carry no commission, so they're excluded from the total.
  const attributed      = txs.filter(x => x.attribution_source && x.attribution_source !== 'unidentified')
  const attributedTotal = attributed.reduce((s, x) => s + Number(x.sale_amount || 0), 0)
  const feesTotal       = txs.reduce((s, x) => s + Number(x.fee_charged || 0), 0)
  const blendedRate     = attributedTotal > 0 ? (feesTotal / attributedTotal) * 100 : null

  // Only meaningful over a full year — any shorter range would need annualising,
  // which would be a guess rather than a figure.
  const annualSaving = (tierRate) =>
    range === '12m' && baseRate != null && attributedTotal > 0
      ? `€${num(Math.round(((baseRate - tierRate) / 100) * attributedTotal))}/yr`
      : '—'

  const SOURCE_CLASS = { 'in-app': 'app', app: 'app', walkin: 'walkin', 'walk-in': 'walkin', email: 'digital', digital: 'digital', unidentified: 'organic', organic: 'organic' }
  const SOURCE_LABEL = {
    'in-app':       t('sub.attr.src_app',     'In-app'),
    app:            t('sub.attr.src_app',     'In-app'),
    walkin:         t('sub.attr.src_walkin',  'Identified walk-in'),
    'walk-in':      t('sub.attr.src_walkin',  'Identified walk-in'),
    email:          t('sub.attr.src_email',   'Email click'),
    unidentified:   t('sub.attr.unidentified','Unidentified walk-in'),
    organic:        t('sub.attr.src_organic', 'Organic'),
  }

  // Floor simulator — pure arithmetic against the ladder the API returned, so
  // it needs no endpoint of its own.
  // Empty state means "untouched", so the field falls back to the live figure.
  // Derived rather than seeded in an effect, which would fight the user's typing
  // and cause an extra render on every load.
  const [simRateRaw, setSimRate]       = useState('')
  const [simRevenueRaw, setSimRevenue] = useState('')
  const simRate    = simRateRaw    !== '' ? simRateRaw    : (idRate != null ? String(idRate) : '')
  const simRevenue = simRevenueRaw !== '' ? simRevenueRaw : (attributedTotal > 0 ? String(Math.round(attributedTotal)) : '')

  // Highest tier whose floor the simulated rate clears.
  const simTier = ladder.length
    ? [...ladder].reverse().find(l => (Number(simRate) || 0) >= l.min_pct) ?? ladder[0]
    : null
  const simFee = simTier ? ((Number(simRevenue) || 0) * simTier.rate_pct) / 100 : 0

  function exportCsv() {
    const rows = [
      ['Date', 'Customer', 'Item', 'Sale', 'Source', 'Rate %', 'Fee'],
      ...txs.map(x => [
        new Date(x.date).toISOString().slice(0, 10),
        x.customer_name ?? '',
        x.item ?? '',
        x.sale_amount ?? '',
        x.attribution_source ?? '',
        x.commission_rate_pct ?? '',
        x.fee_charged ?? '',
      ]),
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `attribution-${range}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <RangeBar
        range={range}
        compare={compare}
        customRange={customRange}
        periodLabel={periodLabel}
        onRangeChange={setRange}
        onCompareChange={setCompare}
        onCustomApply={r => { setCustomRange(r); setRange('custom') }}
        onExport={() => {}}
      />

      {attrLoading && <div className="dc-loading">{t('common.loading', 'Loading') + '…'}</div>}
      {attrError && <div className="alert alert-urgent">{attrError}</div>}

      {!attrLoading && !attrError && attr && (
      <>
      {/* Tier hero + identification rate */}
      <div className="grid2">
        <div>
          <div className="sub-attr-section-lbl">{t('sub.attr.current_tier')}</div>
          <div className={`tier-hero ${tierInfo?.tier ?? 'base'}`}>
            <div className="th-top">
              <div>
                <div className="th-tier">{tierName(tierInfo?.tier)}</div>
                <div className="th-tier-sub">
                  {tierInfo?.tier
                    ? `${tierBand(ladder.findIndex(l => l.tier === tierInfo.tier))} ${t('sub.attr.tier_band_sub', 'identification rate')} · ${tierInfo.rate_pct}% ${t('sub.attr.tier_band_commission', 'attributed commission')}`
                    : '—'}
                </div>
              </div>
              <div className="th-right">
                <div className="th-rate">{tierInfo?.rate_pct != null ? `${tierInfo.rate_pct}%` : '—'}</div>
                <div className="th-rate-lbl">{t('sub.attr.your_rate_month')}</div>
              </div>
            </div>
            {tierInfo?.next_tier ? (
              <>
                <div className="th-progress">
                  <div className="th-progress-row">
                    <span>
                      {t('sub.attr.progress_to', 'Progress to')} <strong>{tierName(tierInfo.next_tier)} ({tierInfo.next_rate_pct}%)</strong>
                    </span>
                    <span>
                      {idRate}% → {t('sub.attr.need', 'need')} {ladder.find(l => l.tier === tierInfo.next_tier)?.min_pct}%
                    </span>
                  </div>
                  <div className="prog">
                    <div className="prog-fill th-prog-fill" style={{
                      width: `${Math.min(100, Math.round((idRate / (ladder.find(l => l.tier === tierInfo.next_tier)?.min_pct || 100)) * 100))}%`,
                    }} />
                  </div>
                </div>
                <div className="th-projection">
                  {t('sub.attr.points_to_next', '{{count}} more percentage points to reach {{tier}}.', {
                    count: tierInfo.points_to_next_tier,
                    tier: tierName(tierInfo.next_tier),
                  })}
                </div>
              </>
            ) : (
              <div className="th-projection">
                {t('sub.attr.top_tier', 'You are on the highest tier — this is the lowest commission rate available.')}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="sub-attr-section-lbl">{t('sub.attr.id_rate_status', 'Identification rate')}</div>
          <div className="floor-strip safe">
            <div className="fs-ico"><span className="material-symbols-outlined">badge</span></div>
            <div className="fs-content">
              <div className="fs-title">{idRate != null ? `${idRate}%` : '—'}</div>
              <div className="fs-sub">
                {t('sub.attr.id_rate_desc', 'Share of sales matched to a Mi Italia customer over this period. The higher it goes, the lower your commission rate.')}
              </div>
              <div className="fs-bar-wrap">
                <div className="fs-bar-row">
                  <span>0%</span>
                  <span>{tierInfo?.next_tier ? `${tierName(tierInfo.next_tier)} ${ladder.find(l => l.tier === tierInfo.next_tier)?.min_pct}%` : '100%'}</span>
                </div>
                <div className="prog fs-prog">
                  <div className="prog-fill fs-prog-fill" style={{ width: `${Math.min(100, idRate ?? 0)}%` }} />
                </div>
              </div>
            </div>
            <div className="fs-right">
              <div className="fs-rate">{attributed.length}/{txs.length}</div>
              <div className="fs-buffer-lbl">{t('sub.attr.identified_sales', 'identified')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* All commission tiers */}
      <div className="card">
        <div className="card-hdr">
          <div>
            <div className="card-title">{t('sub.attr.all_tiers_title')} <em>{t('sub.attr.all_tiers_em')}</em></div>
            <div className="sub-card-sub">
              {t('sub.attr.all_tiers_desc')}
            </div>
          </div>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>{t('sub.attr.col_tier')}</th>
              <th>{t('sub.attr.col_id_rate')}</th>
              <th>{t('sub.attr.col_commission')}</th>
              <th>{t('sub.attr.col_status')}</th>
              <th>{t('sub.attr.col_saving')}</th>
            </tr>
          </thead>
          <tbody>
            {ladder.map((ti, i) => {
              const current = ti.tier === tierInfo?.tier
              const gap     = idRate != null ? Math.round((ti.min_pct - idRate) * 10) / 10 : null
              return (
                <tr key={ti.tier} className={current ? 'sub-tier-current-row' : ''}>
                  <td><span className={`tag tag-${ti.tier}`}>{tierName(ti.tier)}</span></td>
                  <td>
                    <span className={ti.tier === 'base' ? 'sub-tier-range-mute' : undefined}>{tierBand(i)}</span>
                    {current && <span className="sub-tier-current-hint"> · {t('sub.attr.you_at', 'You: {{pct}}%', { pct: idRate })}</span>}
                  </td>
                  <td>
                    <span className={`sub-tier-commission sub-tier-commission-${ti.tier}`}>{ti.rate_pct}%</span>
                  </td>
                  <td>
                    {current
                      ? <span className="tag tag-active">{t('sub.badge.current')}</span>
                      : gap != null && gap > 0
                        ? <span className="sub-tier-status">{t('sub.attr.pts_away', { count: gap })}</span>
                        : <span className="sub-tier-status">{t('sub.attr.reached', 'Reached')}</span>
                    }
                  </td>
                  <td>
                    <span className={ti.tier === 'base' ? 'sub-tier-baseline' : 'sub-tier-saving'}>
                      {ti.tier === 'base' ? t('sub.attr.baseline', '— baseline') : annualSaving(ti.rate_pct)}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ID rate trend + Floor simulator */}
      <div className="grid2">
        <div className="card sub-attr-card-flush">
          <div className="card-hdr">
            <div>
              <div className="card-title">{t('sub.attr.trend_title')} — <em>{t('sub.attr.trend_em')}</em></div>
              <div className="sub-card-sub">{t('sub.attr.trend_desc')}</div>
            </div>
          </div>
          {trend.length === 0 ? (
            <div className="state-empty">{t('sub.attr.no_trend', 'No identification data for this period yet.')}</div>
          ) : (
            <>
              <div className="sub-attr-trend-chart">
                {trend.map((m, i) => {
                  const pct     = Number(m.id_rate_pct ?? 0)
                  const current = i === trend.length - 1
                  const label   = monthShort(m.month).toUpperCase()
                  return (
                    <div key={m.month} className="sub-attr-trend-col">
                      <div className="sub-attr-trend-val" style={{ fontWeight: current ? 700 : 600 }}>{pct}%</div>
                      <div
                        className={`sub-attr-trend-bar${current ? ' current' : ''}`}
                        // Scaled against the tallest month so a short series
                        // still fills the chart rather than sitting flat.
                        style={{ height: `${Math.max(4, (pct / Math.max(...trend.map(x => Number(x.id_rate_pct ?? 0)), 1)) * 150)}px` }}
                        title={t('sub.attr.trend_tooltip', '{{identified}} of {{total}} orders identified', { identified: m.identified_orders, total: m.total_orders })}
                      />
                      <div className={`sub-attr-trend-lbl${current ? ' current' : ''}`}>{label}</div>
                    </div>
                  )
                })}
              </div>
              {trend.length > 1 && (() => {
                const first = Number(trend[0].id_rate_pct ?? 0)
                const last  = Number(trend[trend.length - 1].id_rate_pct ?? 0)
                const delta = Math.round((last - first) * 10) / 10
                return (
                  <div className="sub-attr-trend-note">
                    <strong className={delta >= 0 ? 'sub-attr-trend-note-up' : undefined}>
                      {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)} {t('sub.attr.points_over', 'points over')} {trend.length} {t('sub.attr.months', 'months')}.
                    </strong>
                  </div>
                )
              })()}
            </>
          )}
        </div>

        <div className="card sub-attr-card-flush">
          <div className="card-hdr">
            <div>
              <div className="card-title">{t('sub.attr.sim_title')} <em>{t('sub.attr.sim_em')}</em></div>
              <div className="sub-card-sub">{t('sub.attr.sim_desc')}</div>
            </div>
          </div>
          <div className="sub-sim-input-row">
            <div className="sub-sim-input-lbl">
              <span>{t('sub.attr.sim_if_rate')}</span>
              <div className="sub-sim-input-lbl-sub">
                {t('sub.attr.sim_current_is', 'Currently {{pct}}% · {{tier}}', { pct: idRate ?? 0, tier: tierName(tierInfo?.tier) })}
              </div>
            </div>
            <input className="sub-sim-input" type="number" min="0" max="100"
              value={simRate} onChange={e => setSimRate(e.target.value)} />
          </div>
          <div className="sub-sim-input-row">
            <div className="sub-sim-input-lbl">
              <span>{t('sub.attr.sim_monthly_rev')}</span>
              <div className="sub-sim-input-lbl-sub">
                {t('sub.attr.sim_avg_is', 'Your attributed total this period: €{{amount}}', { amount: num(Math.round(attributedTotal)) })}
              </div>
            </div>
            <input className="sub-sim-input" type="number" min="0"
              value={simRevenue} onChange={e => setSimRevenue(e.target.value)} />
          </div>
          <div className="sub-sim-result">
            <div className="sub-sim-result-ico"><span className="material-symbols-outlined">calculate</span></div>
            <div className="sub-sim-result-body">
              <div className="sub-sim-result-lbl">{t('sub.attr.sim_projected')}</div>
              <div className="sub-sim-result-val">
                €{num0(simFee)}
                <span className="sub-sim-result-mo"> / {t('sub.attr.month')}</span>
              </div>
            </div>
          </div>
          <div className="sub-sim-note">
            {simTier
              ? t('sub.attr.sim_at_tier', 'At {{pct}}% you would be on {{tier}}, paying {{rate}}% commission.', {
                  pct: Number(simRate) || 0, tier: tierName(simTier.tier), rate: simTier.rate_pct,
                })
              : t('sub.attr.sim_no_ladder', 'Commission tiers are not available for this plan.')}
          </div>
        </div>
      </div>

      {/* Attribution transactions */}
      <div className="card">
        <div className="card-hdr">
          <div>
            <div className="card-title">{t('sub.attr.tx_title')} <em>{t('sub.attr.tx_em')}</em></div>
            <div className="sub-card-sub">{t('sub.attr.tx_desc')}</div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={exportCsv} disabled={txs.length === 0}>
            <span className="material-symbols-outlined">download</span>{t('common.export')} CSV
          </button>
        </div>

        <div className="sub-tx-header">
          <div>{t('sub.attr.col_date')}</div>
          <div>{t('sub.attr.col_customer_item')}</div>
          <div>{t('sub.attr.col_source')}</div>
          <div className="sub-tx-num">{t('sub.attr.col_sale')}</div>
          <div className="sub-tx-num">{t('sub.attr.col_rate')}</div>
          <div className="sub-tx-num">{t('sub.attr.col_mi_fee')}</div>
        </div>

        {txs.length === 0 && (
          <div className="state-empty">{t('sub.attr.no_transactions', 'No transactions in this period.')}</div>
        )}

        {txs.map((tx, i) => {
          const d      = new Date(tx.date)
          const src    = tx.attribution_source ?? 'unidentified'
          const sale   = Number(tx.sale_amount || 0)
          const fee    = Number(tx.fee_charged || 0)
          const name   = tx.customer_name || t('sub.attr.unidentified', 'Unidentified walk-in')
          const isAnon = src === 'unidentified'
          return (
            <div key={`${tx.date}-${i}`} className="sub-tx-row">
              <div className="sub-tx-date">
                {d.getDate()} <span className="sub-tx-date-month">{monthShort(d)}</span>
              </div>
              <div className="sub-tx-customer">
                <div className="sub-tx-cust-av" style={isAnon ? { background: 'var(--mist)', color: 'var(--stone)' } : undefined}>
                  {isAnon ? '?' : name.trim().charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="sub-tx-cust-name">{name}</div>
                  <div className="sub-tx-cust-sub">{tx.item ?? '—'}</div>
                </div>
              </div>
              <div><span className={`sub-tx-source sub-tx-source-${SOURCE_CLASS[src] ?? 'organic'}`}>{SOURCE_LABEL[src] ?? src}</span></div>
              {/* `undefined` here meant the browser's own locale, not the
                  portal's — an Italian boutique on an English-configured
                  machine saw "€1,234.50" while the rest of the page was in
                  Italian. useGrouping is forced on for the same reason as
                  Financials: Italian leaves four-digit amounts ungrouped. */}
              <div className="sub-tx-amount">€{sale.toLocaleString(activeLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true })}</div>
              <div className="sub-tx-rate">{tx.commission_rate_pct ?? 0}%</div>
              <div className="sub-tx-fee">€{amt2(fee)}</div>
            </div>
          )
        })}

        {txs.length > 0 && (
          <div className="sub-tx-row sub-tx-summary">
            <div />
            <div className="sub-tx-more">
              {t('sub.attr.tx_total_count', '{{count}} transactions · {{identified}} identified', { count: txs.length, identified: attributed.length })}
            </div>
            <div />
            <div className="sub-tx-amount">€{num(Math.round(attributedTotal))}</div>
            <div className="sub-tx-rate sub-tx-total-rate">{blendedRate != null ? `${blendedRate.toFixed(1)}%` : '—'}</div>
            <div className="sub-tx-fee sub-tx-total-fee">€{amt2(feesTotal)}</div>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// BILLING TAB
//
// The header used to say "UI-only mockup (no endpoints wired yet)", which is no
// longer true and is worth correcting: everything here is real. It has no fetch
// of its own by design — the KPIs and billing details come from the parent's
// /boutique/subscription and /boutique/profile calls, and invoices are
// deliberately left to Stripe (see the note further down).
// ══════════════════════════════════════════════════════════════════════
function BillingTab({ t, onOpenPortal, portalLoading, portalError, subData, profile, navigate }) {
  // Next charge is derivable: the plan's monthly price, due at the end of the
  // current billing period. The other two need a backend figure, so they show
  // '—' rather than an invented number.
  const period      = subData?.subscription?.current_period
  const nextChargeAt = period?.ends_at ? new Date(period.ends_at) : null
  const planPrice   = subData?.plan_price_eur ?? subData?.subscription?.price_eur ?? null
  const ytdPaid     = subData?.billing?.ytd_paid_eur ?? null
  const avgMonthly  = subData?.billing?.avg_monthly_eur ?? null

  const fmtEur = v => (v == null ? '—' : `€${num(v)}`)

  return (
    <div>
      {/* KPI row */}
      <div className="sub-bill-kpi-row">
        <div className="sub-bill-kpi-card">
          <div className="sub-bill-kpi-lbl">{t('sub.bill.next_charge')}</div>
          <div className="sub-bill-kpi-val"><em>{fmtEur(planPrice)}</em></div>
          <div className="sub-bill-kpi-sub">
            {nextChargeAt
              ? t('sub.bill.next_charge_on', 'Due {{date}}', { date: nextChargeAt.toLocaleDateString(activeLocale(), { day: 'numeric', month: 'long' }) })
              : t('sub.bill.next_charge_unknown', 'No renewal date on file')}
          </div>
        </div>
        <div className="sub-bill-kpi-card">
          <div className="sub-bill-kpi-lbl">{t('sub.bill.ytd_paid')}</div>
          <div className="sub-bill-kpi-val">{fmtEur(ytdPaid)}</div>
          <div className="sub-bill-kpi-sub">
            {ytdPaid == null ? t('sub.bill.not_available', 'Not available yet') : t('sub.bill.ytd_paid_sub')}
          </div>
        </div>
        <div className="sub-bill-kpi-card">
          <div className="sub-bill-kpi-lbl">{t('sub.bill.avg_monthly')}</div>
          <div className="sub-bill-kpi-val">{fmtEur(avgMonthly)}</div>
          <div className="sub-bill-kpi-sub">
            {avgMonthly == null ? t('sub.bill.not_available', 'Not available yet') : t('sub.bill.avg_monthly_sub')}
          </div>
        </div>
      </div>

      {/* Payment method + Billing details */}
      <div className="grid2">
        <div className="card sub-attr-card-flush">
          <div className="card-hdr">
            <div>
              <div className="card-title">{t('sub.payment.title')} <em>{t('sub.payment.title_em')}</em></div>
              <div className="sub-card-sub">{t('sub.bill.auto_debit')}</div>
            </div>
          </div>
          {/* Stripe holds the card, so it's also where it gets changed. Showing
              a card here would mean either duplicating Stripe's data or, as
              before, inventing one. */}
          <div className="sub-pm-card">
            <div className="sub-pm-info">
              <div className="sub-pm-num">{t('sub.bill.pm_in_stripe', 'Your card is held securely by Stripe')}</div>
              <div className="sub-pm-exp">{t('sub.bill.pm_in_stripe_sub', 'Add, replace or remove a payment method in the billing portal.')}</div>
            </div>
            <button className="btn btn-outline btn-sm" onClick={onOpenPortal} disabled={portalLoading}>
              <span className="material-symbols-outlined">credit_card</span>
              {portalLoading ? t('sub.page.opening_portal') : t('sub.bill.update')}
            </button>
          </div>
          <div className="alert info sub-pm-alert">
            <span className="material-symbols-outlined">lock</span>
            <div dangerouslySetInnerHTML={{ __html: t('sub.bill.stripe_secure') }} />
          </div>
        </div>

        <div className="card sub-attr-card-flush">
          <div className="card-hdr">
            <div>
              <div className="card-title">{t('sub.bill.details_title')} <em>{t('sub.bill.details_em')}</em></div>
              <div className="sub-card-sub">{t('sub.bill.details_desc')}</div>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/store')}>
              <span className="material-symbols-outlined">edit</span>{t('common.edit')}
            </button>
          </div>
          {/* Read from the boutique's own profile. This previously showed a
              different company's name, address, VAT number and codice fiscale —
              legal identifiers a boutique could reasonably have copied out. */}
          <div className="sub-bd-body">
            <div className="sub-bd-name">{profile?.name ?? '—'}</div>
            <div className="sub-bd-addr">
              {profile?.address_line1 ?? '—'}
              {profile?.address_line2 ? <><br />{profile.address_line2}</> : null}
              <br />
              {[profile?.postcode, profile?.city].filter(Boolean).join(' ') || '—'}
              {profile?.country ? ` · ${profile.country}` : ''}
            </div>
            <div className="sub-bd-vat">
              <div><strong>{t('sub.bill.vat_piva')}:</strong> {profile?.vat_number ?? '—'}</div>
              <div><strong>{t('sub.bill.codice_fiscale')}:</strong> {profile?.codice_fiscale ?? '—'}</div>
              <div><strong>SDI:</strong> {profile?.sdi_code ?? '—'}</div>
              <div><strong>PEC:</strong> {profile?.pec ?? '—'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice history */}
      <div className="card">
        <div className="card-hdr">
          <div>
            <div className="card-title">{t('sub.bill.invoice_title')} <em>{t('sub.bill.invoice_em')}</em></div>
            <div className="sub-card-sub">
              {t('sub.bill.invoice_desc')}
            </div>
          </div>
        </div>

        {/* Stripe is the system of record for invoices — it already holds each
            one with the correct VAT, a PDF and its payment status, and
            portal-link opens it. Rebuilding a table here would mean duplicating
            those documents and keeping them in sync forever. */}
        <div className="sub-inv-portal">
          <div>
            <div className="sub-inv-portal-title">
              {t('sub.bill.portal_title', 'Invoices are kept in Stripe')}
            </div>
            <div className="sub-inv-portal-sub">
              {t('sub.bill.portal_sub', 'Your full invoice history, PDF downloads and payment methods are available in the Stripe billing portal.')}
            </div>
          </div>
          <button className="btn btn-primary" onClick={onOpenPortal} disabled={portalLoading}>
            <span className="material-symbols-outlined">receipt_long</span>
            {portalLoading
              ? t('sub.page.opening_portal')
              : t('sub.bill.open_portal_btn', 'View invoices in Stripe')}
          </button>
        </div>
        {portalError && <div className="alert alert-urgent">{portalError}</div>}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════
export default function Subscription() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const [tab,           setTab]           = useState('overview')
  const [subData,       setSubData]       = useState(null)
  const [plans,         setPlans]         = useState([])
  const [subFailed,     setSubFailed]     = useState(false)
  const [plansFailed,   setPlansFailed]   = useState(false)
  const [loading,       setLoading]       = useState(true)
  const [checkoutOpen,  setCheckoutOpen]  = useState(false)
  const [showTopup,     setShowTopup]     = useState(false)
  const [connectLoading, setConnectLoading] = useState(false)
  const [portalError,   setPortalError]   = useState('')

  // Billing details (name, address, VAT) come from the boutique's own profile
  // rather than being restated here.
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    Promise.all([
      apiFetch(`${BASE_URL}/boutique/subscription`).then(r => r.json()).catch(() => null),
      apiFetch(`${BASE_URL}/boutique/subscription/plans`).then(r => r.json()).catch(() => null),
      apiFetch(`${BASE_URL}/boutique/profile`).then(r => r.json()).catch(() => null),
    ])
      .then(([sub, plansRes, profRes]) => {
        if (sub?.success)      setSubData(sub.data)
        if (plansRes?.success) setPlans(plansRes.data?.plans ?? [])
        if (profRes?.success)  setProfile(profRes.data)
        // All three failures were swallowed. The subscription one is the
        // serious case: `currentPlan` falls back to 'connect', so a boutique
        // actually on Pro would be told it is on Connect — wrong plan, wrong
        // allowances, wrong price, and nothing on screen to doubt.
        setSubFailed(!sub?.success)
        setPlansFailed(!plansRes?.success)
      })
      .finally(() => setLoading(false))
  }, [i18n.language])

  // Clicking "Upgrade to connect" full-page-navigates to Stripe; if the user hits
  // the browser back button, the page can be restored from bfcache with the
  // spinner still stuck in its pre-navigation "loading" state — reset it here.
  useEffect(() => {
    const handlePageShow = (e) => { if (e.persisted) setConnectLoading(false) }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])

  const handleUpgradeConnect = async () => {
    setConnectLoading(true); setPortalError('')
    try {
      const res  = await apiFetch(`${BASE_URL}/boutique/subscription/portal-link`, { method: 'POST', body: JSON.stringify({}) })
      const data = await res.json()
      if (data.success && data.data?.portal_url) {
        window.location.href = data.data.portal_url
      } else {
        setPortalError(data.message || t('sub.page.portal_error'))
        setConnectLoading(false)
      }
    } catch {
      setPortalError(t('common.error_network'))
      setConnectLoading(false)
    }
  }

  const currentPlan = subData?.effective_plan || 'connect'
  const planLabel   = currentPlan === 'pro' ? 'Pro' : currentPlan === 'starter' ? 'Starter' : 'Connect'
  const planSub     = currentPlan === 'pro'
    ? t('sub.page.plan_sub_pro')
    : currentPlan === 'starter'
    ? t('sub.page.plan_sub_starter')
    : t('sub.page.plan_sub_connect')

  const usage = subData?.usage ?? {}
  // `remaining` is returned both nested and flat; fall back to limit − used so
  // the figure is either real or absent. A hardcoded default here read as a
  // plausible real number.
  const renders = usage.ai_studio_renders ?? {}
  const aiRendersLeft = renders.remaining
    ?? usage.ai_studio_renders_remaining
    ?? (renders.limit != null && renders.used != null
      ? Math.max(0, Number(renders.limit) - Number(renders.used))
      : '—')

  const TABS = [
    { key: 'overview',    icon: 'home',         label: t('sub.page.tab_overview')    },
    { key: 'attribution', icon: 'analytics',    label: t('sub.page.tab_attribution') },
    { key: 'billing',     icon: 'receipt_long', label: t('sub.page.tab_billing')     },
  ]

  if (loading) return (
    <div className="sub-loading">
      <span className="material-symbols-outlined sub-loading-icon">sync</span>
    </div>
  )

  return (
    <div className="sub-wrap">

      <div className="sub-mod-head">
        <div>
          <div className="sub-mod-title">{t('sub.page.title')} <em>{t('sub.page.title_em')}</em></div>
          <div className="sub-mod-sub">{t('sub.page.subtitle')}</div>
        </div>
      </div>

      {subFailed && (
        <div className="sub-load-error">
          {t('sub.page.err_load', 'Could not load your subscription. The plan, allowances and prices shown below are defaults and may not be yours — reload before acting on them.')}
        </div>
      )}
      {!subFailed && plansFailed && (
        <div className="sub-load-error">{t('sub.page.err_plans', 'Could not load the available plans.')}</div>
      )}

      <div className="sub-nav">
        {TABS.map(tb => (
          <div key={tb.key} className={`sub-sni${tab === tb.key ? ' act' : ''}`} onClick={() => setTab(tb.key)}>
            <span className="material-symbols-outlined">{tb.icon}</span>
            {tb.label}
          </div>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div>
          <div className="sub-plan-hero">
            <div className="sub-ph-left">
              <div className="sub-ph-eyebrow">{t('sub.badge.current')}</div>
              <div className="sub-ph-plan"><em>{planLabel}</em></div>
              <div className="sub-ph-sub">{planSub}</div>
            </div>
            <div className="sub-ph-stat">
              <div className="sub-ph-stat-val">{subData?.identification_rate ?? '—'}%</div>
              <div className="sub-ph-stat-lbl">{t('sub.page.id_rate')}</div>
            </div>
            <div className="sub-ph-stat">
              <div className="sub-ph-stat-val">€{num(subData?.attributed_revenue_month ?? 0)}</div>
              <div className="sub-ph-stat-lbl">{t('sub.page.attr_rev_month')}</div>
            </div>
            <div className="sub-ph-right">
              {currentPlan !== 'pro' && (
                <button className="btn btn-primary" onClick={() => setCheckoutOpen(true)}>
                  {t('sub.page.upgrade_pro')}
                  <br />
                  <span className="sub-ph-upgrade-sub">{t('sub.page.pro_price_line')}</span>
                </button>
              )}
              <button className="btn btn-ghost btn-sm sub-ph-details-btn" onClick={() => setTab('attribution')}>
                {t('sub.page.view_details')}
              </button>
            </div>
          </div>

          <div className="card sub-usage-card">
            <div className="card-hdr">
              <div>
                <div className="card-title">{t('sub.page.usage_title')} <em>{t('sub.page.usage_em')}</em></div>
                <div className="sub-card-sub">{t('sub.page.usage_resets')}</div>
              </div>
              <span className="sub-tag-active">{t('common.active')}</span>
            </div>
            <div className="sub-usage-grid">
              <div>
                <div className="sub-sec-lbl sub-sec-lbl-first">{t('sub.page.sec_contacts')}</div>
                <UsageMeter label={t('sub.page.total_contacts')} {...meter(usage.contacts, t)}    hint={t('sub.page.contacts_hint')} />
                <UsageMeter label={t('sub.page.item_savers')}    {...meter(usage.item_savers, t)} hint={t('sub.page.savers_hint')} />
              </div>
              <div>
                <div className="sub-sec-lbl sub-sec-lbl-first">{t('sub.page.sec_campaigns')}</div>
                <UsageMeter label={t('sub.page.email_campaigns')} {...meter(usage.email_campaigns, t)} hint={t('sub.page.email_hint')} />
                <UsageMeter label={t('sub.page.wa_sends')}        {...meter(usage.whatsapp_sends, t)}  hint={t('sub.page.wa_hint')} />
              </div>
              <div>
                <div className="sub-sec-lbl sub-sec-lbl-first">{t('sub.page.sec_ai')}</div>
                {(() => {
                  const m = meter(usage.ai_studio_renders, t)
                  return (
                    <div className="sub-um sub-um-with-topup">
                      <div className="sub-um-hdr">
                        <div className="sub-um-lbl">{t('sub.page.ai_renders')}</div>
                        <div className="sub-um-val">{m.display}</div>
                      </div>
                      <div className="sub-um-track">
                        <div className={`sub-um-fill ${m.level}`} style={{ width: `${m.pct}%` }} />
                      </div>
                      <div className={`sub-um-hint ${m.level}`}>
                        {t('sub.page.renders_hint', { count: aiRendersLeft })}
                      </div>
                      <button className="sub-um-topup" onClick={() => setShowTopup(true)}>
                        <span className="material-symbols-outlined">add_shopping_cart</span>
                        {t('sub.page.buy_more_images')}
                      </button>
                    </div>
                  )
                })()}
                <UsageMeter label={t('sub.page.ai_messages')}      {...meter(usage.ai_messages, t)}           hint={t('sub.page.ai_msg_hint')} />
                <UsageMeter label={t('sub.page.translation_langs')} {...meter(usage.translation_languages, t)} hint={t('sub.page.langs_hint')} />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-hdr">
              <div>
                <div className="card-title">{t('sub.page.compare_title')} <em>{t('sub.page.compare_em')}</em></div>
                <div className="sub-card-sub">{t('sub.page.compare_desc')}</div>
              </div>
            </div>

            <div className="sub-bi-hero">
              <div className="sub-bi-hero-l">
                <div className="sub-bi-eyebrow">
                  <div className="sub-bi-icon"><span className="material-symbols-outlined">neurology</span></div>
                  <div className="sub-bi-eyebrow-lbl">{t('sub.page.bi_eyebrow')}</div>
                </div>
                <div className="sub-bi-title">{t('sub.page.bi_title')} <em>{t('sub.page.bi_em')}</em></div>
                <div className="sub-bi-body" dangerouslySetInnerHTML={{ __html: t('sub.page.bi_body') }} />
                <div className="sub-bi-tags">
                  <div className="sub-bi-tag"><span className="material-symbols-outlined">storefront</span>{t('sub.page.bi_voice')}</div>
                  <div className="sub-bi-tag"><span className="material-symbols-outlined">groups</span>{t('sub.page.bi_customers')}</div>
                  <div className="sub-bi-tag"><span className="material-symbols-outlined">verified_user</span>{t('sub.page.bi_private')}</div>
                  <div className="sub-bi-tag"><span className="material-symbols-outlined">schedule</span>{t('sub.page.bi_translation')}</div>
                </div>
              </div>
            </div>

            {plans.length === 0 ? (
              <div className="state-empty">{t('sub.page.no_plans')}</div>
            ) : (
              <div className="sub-plans-grid">
                {plans.map(plan => (
                  <PlanCard
                    key={plan.code}
                    t={t}
                    plan={plan}
                    currentPlan={currentPlan}
                    imagesLeft={aiRendersLeft}
                    onUpgrade={() => setCheckoutOpen(true)}
                    onUpgradeConnect={handleUpgradeConnect}
                    connectLoading={connectLoading}
                    onBuyMore={() => setShowTopup(true)}
                  />
                ))}
              </div>
            )}

            {portalError && (
              <div className="alert alert-red sub-portal-error">
                <span className="material-symbols-outlined">error</span>{portalError}
              </div>
            )}
            {currentPlan !== 'pro' && (
              <div className="alert info sub-cmp-alert">
                <span className="material-symbols-outlined">tips_and_updates</span>
                <div>
                  <span dangerouslySetInnerHTML={{ __html: t('sub.page.savings_alert') }} />{' '}
                  <span className="sub-link" onClick={() => setTab('attribution')}>{t('sub.page.view_breakeven')}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ATTRIBUTION ── */}
      {tab === 'attribution' && <AttributionTab t={t} />}

      {/* ── BILLING ── */}
      {tab === 'billing' && (
        <BillingTab
          t={t}
          onOpenPortal={handleUpgradeConnect}
          portalLoading={connectLoading}
          portalError={portalError}
          subData={subData}
          profile={profile}
          navigate={navigate}
        />
      )}

      {checkoutOpen && (
        <StripeCheckout
          plan="pro"
          onClose={() => setCheckoutOpen(false)}
          onSuccess={() => window.location.reload()}
        />
      )}

      {showTopup && <TopupModal t={t} onClose={() => setShowTopup(false)} />}
    </div>
  )
}
