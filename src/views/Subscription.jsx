import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'
import StripeCheckout from '../components/ui/StripeCheckout'
import RangeBar from '../components/ui/RangeBar'

const BASE_URL = import.meta.env.VITE_API_URL

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
              {t('sub.page.breakeven', { amount: plan.breakeven_eur.toLocaleString() })}
            </div>
          )}
        </>
      )}
      {isDowngrade && <div className="sub-plan-downgrade">{t('sub.page.downgrade')}</div>}
    </div>
  )
}

// ══ Topup modal ══════════════════════════════════════════════════════
function TopupModal({ t, onClose }) {
  const PACKS = [
    { images:  5, price: 10 },
    { images: 15, price: 25 },
    { images: 40, price: 60 },
  ]
  const [step, setStep] = useState(1)
  const [pack, setPack] = useState(PACKS[0])
  const [cardNo, setCardNo]   = useState('')
  const [exp, setExp]         = useState('')
  const [cvc, setCvc]         = useState('')
  const [name, setName]       = useState('')
  const [country, setCountry] = useState('Italy')
  const [zip, setZip]         = useState('')

  function handlePay() {
    // Backend not wired yet
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

        {step === 1 && (
          <>
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
            <div className="sub-topup-note">
              <span className="material-symbols-outlined">info</span>
              <span>{t('sub.topup.quality_note')}</span>
            </div>
            <div className="sub-topup-footer">
              <button className="btn btn-outline btn-sm" onClick={onClose}>{t('common.cancel')}</button>
              <button className="btn btn-primary btn-sm" onClick={() => setStep(2)}>{t('sub.topup.continue_pay')}</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="sub-pay-testbar">
              <span className="material-symbols-outlined">science</span>
              <span>{t('sub.topup.test_mode')}</span>
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

            <div className="sub-pay-field-label">{t('sub.topup.card_info')}</div>
            <div className="sub-pay-card-group">
              <div className="sub-pay-card-number">
                <input inputMode="numeric" autoComplete="cc-number" placeholder="1234 1234 1234 1234" maxLength={19}
                  value={cardNo} onChange={e => setCardNo(e.target.value)} />
                <span className="sub-pay-card-brands">
                  <span className="sub-pay-brand">VISA</span>
                  <span className="sub-pay-brand">MC</span>
                  <span className="sub-pay-brand">AMEX</span>
                </span>
              </div>
              <div className="sub-pay-card-split">
                <input autoComplete="cc-exp" placeholder="MM / YY" maxLength={7}
                  value={exp} onChange={e => setExp(e.target.value)} />
                <input inputMode="numeric" autoComplete="cc-csc" placeholder="CVC" maxLength={4}
                  value={cvc} onChange={e => setCvc(e.target.value)} />
              </div>
            </div>

            <div className="sub-pay-field-label">{t('sub.topup.name_on_card')}</div>
            <input className="sub-pay-input" placeholder={t('sub.topup.full_name')} autoComplete="cc-name"
              value={name} onChange={e => setName(e.target.value)} />

            <div className="sub-pay-field-label">{t('sub.topup.country_postal')}</div>
            <div className="sub-pay-country-row">
              <select className="sub-pay-input" value={country} onChange={e => setCountry(e.target.value)}>
                <option>Italy</option><option>France</option><option>Spain</option>
                <option>Germany</option><option>United Kingdom</option>
              </select>
              <input className="sub-pay-input" placeholder={t('sub.topup.postal_code')} autoComplete="postal-code"
                value={zip} onChange={e => setZip(e.target.value)} />
            </div>

            <div className="sub-pay-testhint" dangerouslySetInnerHTML={{ __html: t('sub.topup.test_hint') }} />
            <div className="sub-pay-stripe" dangerouslySetInnerHTML={{ __html: t('sub.topup.powered_stripe') }} />

            <div className="sub-topup-footer">
              <button className="btn btn-outline btn-sm" onClick={() => setStep(1)}>{t('common.back')}</button>
              <button className="btn btn-primary btn-sm" onClick={handlePay}>{t('sub.topup.pay', { amount: pack.price })}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// ATTRIBUTION TAB — UI-only mockup (no endpoints wired yet)
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

  // Static mockup data
  const TIERS = [
    { key:'base',     tag: t('sub.attr.tier_base'),     range: t('sub.attr.tier_base_range'),     current:false, commission:8, status: t('sub.attr.below_buffer'),  saving: t('sub.attr.baseline') },
    { key:'silver',   tag: t('sub.attr.tier_silver'),   range:'30–49%',                           current:true,  commission:7, status: t('sub.badge.current'),      saving:'€504/yr'   },
    { key:'gold',     tag: t('sub.attr.tier_gold'),     range:'50–64%',                           current:false, commission:6, status: t('sub.attr.pts_away', { count: 16 }), saving:'€1,008/yr' },
    { key:'platinum', tag: t('sub.attr.tier_platinum'), range:'≥65%',                             current:false, commission:5, status: t('sub.attr.pts_away', { count: 31 }), saving:'€1,512/yr' },
  ]

  const TREND_MONTHS = [
    { key:'dec', label:'DEC', pct:12, color:'var(--mist)',              textColor:'var(--stone)' },
    { key:'jan', label:'JAN', pct:14, color:'rgba(217,119,6,0.4)',      textColor:'#B45309' },
    { key:'feb', label:'FEB', pct:18, color:'rgba(217,119,6,0.6)',      textColor:'#B45309' },
    { key:'mar', label:'MAR', pct:22, color:'rgba(107,33,200,0.45)',    textColor:'var(--purple)' },
    { key:'apr', label:'APR', pct:26, color:'rgba(107,33,200,0.65)',    textColor:'var(--purple)' },
    { key:'may', label:'MAY', pct:34, color:'linear-gradient(180deg,var(--gold),var(--gold-dk))', textColor:'var(--gold-dk)', current:true },
  ]

  const TRANSACTIONS = [
    { date:'28', avBg:'rgba(184,149,90,0.15)', avColor:'var(--gold-dk)', avInit:'S', cust:'Sofia Marchetti',      item:'Silk Blouse',       sale:420,  source:{ type:'app',      label:'📱 In-app'          }, rate:8, fee:33.60 },
    { date:'26', avBg:'rgba(99,91,255,0.1)',   avColor:'var(--stripe)',   avInit:'M', cust:'Marco Rossi',           item:'Tailored Jacket',   sale:890,  source:{ type:'walkin',   label: t('sub.attr.src_walkin') }, rate:7, fee:62.30 },
    { date:'22', avBg:'rgba(217,119,6,0.1)',   avColor:'#B45309',         avInit:'C', cust:'Chiara De Luca',        item:'Cashmere Coat',     sale:1290, source:{ type:'digital',  label: t('sub.attr.src_email')  }, rate:7, fee:90.30 },
    { date:'18', avBg:'var(--mist)',            avColor:'var(--stone)',    avInit:'?', cust: t('sub.attr.unidentified'), item:'Linen Trousers',    sale:380,  source:{ type:'organic',  label: t('sub.attr.src_organic') }, rate:0, fee:0     },
    { date:'14', avBg:'rgba(184,149,90,0.15)', avColor:'var(--gold-dk)', avInit:'S', cust:'Sofia Marchetti',      item:'Leather Sandals',   sale:320,  source:{ type:'app',      label:'📱 In-app'          }, rate:8, fee:25.60 },
    { date:'11', avBg:'rgba(0,108,53,0.1)',    avColor:'var(--green)',    avInit:'F', cust:'Francesca Bianchi',    item:'Wool Scarf',        sale:180,  source:{ type:'walkin',   label: t('sub.attr.src_walkin') }, rate:7, fee:12.60 },
  ]

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

      {/* Tier hero + Floor status */}
      <div className="grid2">
        <div>
          <div className="sub-attr-section-lbl">{t('sub.attr.current_tier')}</div>
          <div className="tier-hero silver">
            <div className="th-top">
              <div>
                <div className="th-tier">{t('sub.attr.tier_silver')}</div>
                <div className="th-tier-sub">{t('sub.attr.silver_desc')}</div>
              </div>
              <div className="th-right">
                <div className="th-rate">7%</div>
                <div className="th-rate-lbl">{t('sub.attr.your_rate_month')}</div>
              </div>
            </div>
            <div className="th-progress">
              <div className="th-progress-row">
                <span dangerouslySetInnerHTML={{ __html: t('sub.attr.progress_to_gold') }} />
                <span>{t('sub.attr.progress_pct')}</span>
              </div>
              <div className="prog">
                <div className="prog-fill th-prog-fill" style={{ width:'68%' }} />
              </div>
            </div>
            <div className="th-projection">
              {t('sub.attr.projection')}
            </div>
          </div>
        </div>

        <div>
          <div className="sub-attr-section-lbl">{t('sub.attr.floor_status')}</div>
          <div className="floor-strip safe">
            <div className="fs-ico"><span className="material-symbols-outlined">verified</span></div>
            <div className="fs-content">
              <div className="fs-title">{t('sub.attr.floor_safe')}</div>
              <div className="fs-sub" dangerouslySetInnerHTML={{ __html: t('sub.attr.floor_safe_desc') }} />
              <div className="fs-bar-wrap">
                <div className="fs-bar-row">
                  <span>{t('sub.attr.floor_pct')}</span>
                  <span>{t('sub.attr.you_pct')}</span>
                </div>
                <div className="prog fs-prog">
                  <div className="prog-fill fs-prog-fill" style={{ width:'34%' }} />
                  <div className="fs-floor-marker" />
                </div>
              </div>
            </div>
            <div className="fs-right">
              <div className="fs-rate">+19pt</div>
              <div className="fs-buffer-lbl">{t('sub.attr.buffer')}</div>
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
            {TIERS.map(ti => (
              <tr key={ti.key} className={ti.current ? 'sub-tier-current-row' : ''}>
                <td><span className={`tag tag-${ti.key}`}>{ti.tag}</span></td>
                <td>
                  <span className={ti.key === 'base' ? 'sub-tier-range-mute' : undefined}>{ti.range}</span>
                  {ti.current && <span className="sub-tier-current-hint"> · {t('sub.attr.you_34')}</span>}
                </td>
                <td>
                  <span className={`sub-tier-commission sub-tier-commission-${ti.key}`}>{ti.commission}%</span>
                </td>
                <td>
                  {ti.current
                    ? <span className="tag tag-active">{t('sub.badge.current')}</span>
                    : <span className="sub-tier-status">{ti.status}</span>
                  }
                </td>
                <td>
                  <span className={ti.key === 'base' ? 'sub-tier-baseline' : 'sub-tier-saving'}>{ti.saving}</span>
                </td>
              </tr>
            ))}
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
          <div className="sub-attr-trend-chart">
            {TREND_MONTHS.map(m => (
              <div key={m.key} className="sub-attr-trend-col">
                <div className="sub-attr-trend-val" style={{ color: m.textColor, fontWeight: m.current ? 700 : 600 }}>
                  {m.pct}%
                </div>
                <div
                  className={`sub-attr-trend-bar${m.current ? ' current' : ''}`}
                  style={{ height: `${m.pct * 3.2}px`, background: m.color }}
                />
                <div className={`sub-attr-trend-lbl${m.current ? ' current' : ''}`}>{m.label}</div>
              </div>
            ))}
          </div>
          <div className="sub-attr-trend-note">
            <strong className="sub-attr-trend-note-up">{t('sub.attr.trend_growth')}</strong>{' '}
            {t('sub.attr.trend_driver')}
          </div>
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
              <div className="sub-sim-input-lbl-sub">{t('sub.attr.sim_currently')}</div>
            </div>
            <input className="sub-sim-input" defaultValue="45%" />
          </div>
          <div className="sub-sim-input-row">
            <div className="sub-sim-input-lbl">
              <span>{t('sub.attr.sim_monthly_rev')}</span>
              <div className="sub-sim-input-lbl-sub">{t('sub.attr.sim_current_avg')}</div>
            </div>
            <input className="sub-sim-input" defaultValue="€4,200" />
          </div>
          <div className="sub-sim-result">
            <div className="sub-sim-result-ico"><span className="material-symbols-outlined">calculate</span></div>
            <div className="sub-sim-result-body">
              <div className="sub-sim-result-lbl">{t('sub.attr.sim_projected')}</div>
              <div className="sub-sim-result-val">€294 <span className="sub-sim-result-mo">/ {t('sub.attr.month')}</span></div>
            </div>
          </div>
          <div className="sub-sim-note">
            <span dangerouslySetInnerHTML={{ __html: t('sub.attr.sim_gold_note') }} /><br />
            <span dangerouslySetInnerHTML={{ __html: t('sub.attr.sim_platinum_note') }} />
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
          <button className="btn btn-outline btn-sm">
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

        {TRANSACTIONS.map((tx, i) => (
          <div key={i} className="sub-tx-row">
            <div className="sub-tx-date">{tx.date} <span className="sub-tx-date-month">May</span></div>
            <div className="sub-tx-customer">
              <div className="sub-tx-cust-av" style={{ background: tx.avBg, color: tx.avColor }}>{tx.avInit}</div>
              <div>
                <div className="sub-tx-cust-name">{tx.cust}</div>
                <div className="sub-tx-cust-sub">{tx.item} · €{tx.sale}</div>
              </div>
            </div>
            <div><span className={`sub-tx-source sub-tx-source-${tx.source.type}`}>{tx.source.label}</span></div>
            <div className="sub-tx-amount">€{tx.sale}</div>
            <div className="sub-tx-rate">{tx.rate}%</div>
            <div className="sub-tx-fee">€{tx.fee.toFixed(2)}</div>
          </div>
        ))}

        <div className="sub-tx-row sub-tx-summary">
          <div />
          <div className="sub-tx-more">{t('sub.attr.tx_more', { count: 18 })}</div>
          <div />
          <div className="sub-tx-amount">€4,200</div>
          <div className="sub-tx-rate sub-tx-total-rate">7%</div>
          <div className="sub-tx-fee sub-tx-total-fee">€294.00</div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// BILLING TAB — UI-only mockup (no endpoints wired yet)
// ══════════════════════════════════════════════════════════════════════
function BillingTab({ t }) {
  const INVOICES = [
    { date:'1 May',  ref:'MI-2026-05', amount:294, status:'pending',  period:'May 2026' },
    { date:'1 Apr',  ref:'MI-2026-04', amount:382, status:'paid',     period:'Apr 2026' },
    { date:'1 Mar',  ref:'MI-2026-03', amount:418, status:'paid',     period:'Mar 2026' },
    { date:'1 Feb',  ref:'MI-2026-02', amount:352, status:'paid',     period:'Feb 2026' },
    { date:'1 Jan',  ref:'MI-2026-01', amount:394, status:'paid',     period:'Jan 2026' },
  ]

  return (
    <div>
      {/* KPI row */}
      <div className="sub-bill-kpi-row">
        <div className="sub-bill-kpi-card">
          <div className="sub-bill-kpi-lbl">{t('sub.bill.next_charge')}</div>
          <div className="sub-bill-kpi-val"><em>€294</em></div>
          <div className="sub-bill-kpi-sub">{t('sub.bill.next_charge_sub')}</div>
        </div>
        <div className="sub-bill-kpi-card">
          <div className="sub-bill-kpi-lbl">{t('sub.bill.ytd_paid')}</div>
          <div className="sub-bill-kpi-val">€1,840</div>
          <div className="sub-bill-kpi-sub">{t('sub.bill.ytd_paid_sub')}</div>
        </div>
        <div className="sub-bill-kpi-card">
          <div className="sub-bill-kpi-lbl">{t('sub.bill.avg_monthly')}</div>
          <div className="sub-bill-kpi-val">€368</div>
          <div className="sub-bill-kpi-sub sub-bill-kpi-up">{t('sub.bill.avg_monthly_sub')}</div>
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
          <div className="sub-pm-card">
            <div className="sub-pm-brand">VISA</div>
            <div className="sub-pm-info">
              <div className="sub-pm-num">{t('sub.payment.card_number')}</div>
              <div className="sub-pm-exp">{t('sub.bill.card_expiry')}</div>
            </div>
            <button className="btn btn-outline btn-sm">
              <span className="material-symbols-outlined">edit</span>{t('sub.bill.update')}
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
            <button className="btn btn-outline btn-sm">
              <span className="material-symbols-outlined">edit</span>{t('common.edit')}
            </button>
          </div>
          <div className="sub-bd-body">
            <div className="sub-bd-name">Atelier Bianchi S.r.l.</div>
            <div className="sub-bd-addr">Via Brera 12<br />20121 Milano · Italia</div>
            <div className="sub-bd-vat">
              <div><strong>{t('sub.bill.vat_piva')}:</strong> IT12345678901</div>
              <div><strong>{t('sub.bill.codice_fiscale')}:</strong> BNCGLA82A41F205X</div>
              <div><strong>SDI:</strong> 0000000</div>
              <div><strong>PEC:</strong> atelierbianchi@pec.it</div>
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
          <select className="sub-inv-filter">
            <option>{t('sub.bill.filter_all')}</option>
            <option>{t('sub.bill.filter_year')}</option>
            <option>{t('sub.bill.filter_last_year')}</option>
            <option>{t('sub.bill.filter_refunds')}</option>
          </select>
        </div>

        <div className="sub-inv-header">
          <div>{t('sub.bill.col_date')}</div>
          <div>{t('sub.bill.col_invoice')}</div>
          <div className="sub-inv-num">{t('sub.bill.col_amount')}</div>
          <div className="sub-inv-center">{t('sub.bill.col_status')}</div>
          <div className="sub-inv-num">{t('sub.bill.col_period')}</div>
          <div />
        </div>

        {INVOICES.map(inv => (
          <div key={inv.ref} className="sub-inv-row">
            <div className="sub-inv-date">{inv.date}</div>
            <div className="sub-inv-ref">{inv.ref}</div>
            <div className="sub-inv-num sub-inv-amt">€{inv.amount}</div>
            <div className="sub-inv-center">
              <span className={`sub-inv-status sub-inv-status-${inv.status}`}>{inv.status.toUpperCase()}</span>
            </div>
            <div className="sub-inv-num sub-inv-period">{inv.period}</div>
            <div className="sub-inv-actions">
              <button className="btn btn-outline btn-xs" title={t('sub.bill.download_pdf')}>
                <span className="material-symbols-outlined">download</span>
              </button>
            </div>
          </div>
        ))}
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
  const [loading,       setLoading]       = useState(true)
  const [checkoutOpen,  setCheckoutOpen]  = useState(false)
  const [showTopup,     setShowTopup]     = useState(false)
  const [connectLoading, setConnectLoading] = useState(false)
  const [portalError,   setPortalError]   = useState('')

  useEffect(() => {
    Promise.all([
      apiFetch(`${BASE_URL}/boutique/subscription`).then(r => r.json()).catch(() => null),
      apiFetch(`${BASE_URL}/boutique/subscription/plans`).then(r => r.json()).catch(() => null),
    ])
      .then(([sub, plansRes]) => {
        if (sub?.success)      setSubData(sub.data)
        if (plansRes?.success) setPlans(plansRes.data?.plans ?? [])
      })
      .finally(() => setLoading(false))
  }, [i18n.language])

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

  const aiRendersLeft = subData?.usage?.ai_studio_renders_remaining ?? 17

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
              <div className="sub-ph-stat-val">€{(subData?.attributed_revenue_month ?? 0).toLocaleString()}</div>
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
                <UsageMeter label={t('sub.page.total_contacts')} display="847 / 1,500"  pct={56}  hint={t('sub.page.contacts_hint')}     level="ok" />
                <UsageMeter label={t('sub.page.item_savers')}    display="541"          pct={100} unlimited hint={t('sub.page.savers_hint')} level="ok" />
              </div>
              <div>
                <div className="sub-sec-lbl sub-sec-lbl-first">{t('sub.page.sec_campaigns')}</div>
                <UsageMeter label={t('sub.page.email_campaigns')} display={`4 / ${t('sub.page.unlimited')}`}   pct={100} unlimited hint={t('sub.page.email_hint')}    level="ok" />
                <UsageMeter label={t('sub.page.wa_sends')}        display={`389 / ${t('sub.page.unlimited')}`} pct={100} unlimited hint={t('sub.page.wa_hint')} level="ok" />
              </div>
              <div>
                <div className="sub-sec-lbl sub-sec-lbl-first">{t('sub.page.sec_ai')}</div>
                <div className="sub-um sub-um-with-topup">
                  <div className="sub-um-hdr">
                    <div className="sub-um-lbl">{t('sub.page.ai_renders')}</div>
                    <div className="sub-um-val">19 / 25</div>
                  </div>
                  <div className="sub-um-track">
                    <div className="sub-um-fill warn" style={{ width: '76%' }} />
                  </div>
                  <div className="sub-um-hint warn">
                    {t('sub.page.renders_hint', { count: aiRendersLeft })}
                  </div>
                  <button className="sub-um-topup" onClick={() => setShowTopup(true)}>
                    <span className="material-symbols-outlined">add_shopping_cart</span>
                    {t('sub.page.buy_more_images')}
                  </button>
                </div>
                <UsageMeter label={t('sub.page.ai_messages')} display="142 / 500" pct={28} hint={t('sub.page.ai_msg_hint')} level="ok" />
                <UsageMeter label={t('sub.page.translation_langs')} display="3 / 8" pct={38} hint={t('sub.page.langs_hint')} level="ok" />
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
      {tab === 'billing' && <BillingTab t={t} />}

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
