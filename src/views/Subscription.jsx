import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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

// Range labels for the Attribution tab period display
const RANGE_LABELS = {
  mtd:  '1 May — 21 May 2026 · month to date',
  ytd:  '1 Jan — 21 May 2026 · year to date',
  '7d': '15 May — 21 May 2026 · last 7 days',
  '30d':'21 Apr — 21 May 2026 · last 30 days',
  '90d':'21 Feb — 21 May 2026 · last 90 days',
  '12m':'21 May 2025 — 21 May 2026 · last 12 months',
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

function AiSection({ children }) {
  return (
    <div className="sub-ai-section">
      <div className="sub-ai-header">
        <span className="material-symbols-outlined">neurology</span>
        <span>Your AI Assistant</span>
      </div>
      {children}
    </div>
  )
}

function MiniArch({ arch = [] }) {
  if (arch.length === 0) return null
  return (
    <div className="sub-bi-mini-arch">
      <div className="sub-bi-mini-arch-title">Your AI stack</div>
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
function PlanCard({ plan, currentPlan, imagesLeft, onUpgrade, onUpgradeConnect, connectLoading, onBuyMore }) {
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
      {isCurrent && <div className="sub-plan-tag current">CURRENT PLAN</div>}
      {!isCurrent && plan.recommended && <div className="sub-plan-tag recommended">RECOMMENDED FOR YOU</div>}

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
                    <span className="sub-feat-imgleft">Images left: <strong>{imagesLeft}</strong></span>
                  )}
                  <button className="sub-feat-buymore" onClick={onBuyMore}>
                    <span className="material-symbols-outlined">add_shopping_cart</span>
                    Buy more
                  </button>
                </span>
              )}
            </Feat>
          )
        })}

        {(plan.ai_capabilities ?? []).length > 0 && (
          <AiSection>
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

        <MiniArch arch={plan.arch} />
      </div>

      {isUpgradeTo && plan.code === 'connect' && (
        <button
          className="btn btn-primary sub-plan-action"
          onClick={onUpgradeConnect}
          disabled={connectLoading}>
          {connectLoading
            ? <><span className="material-symbols-outlined sub-plan-spin">sync</span> Opening portal…</>
            : <><span className="material-symbols-outlined">north_east</span> Upgrade to Connect</>
          }
        </button>
      )}
      {isUpgradeTo && plan.code === 'pro' && (
        <>
          <button className="btn btn-primary sub-plan-action" onClick={onUpgrade}>
            <span className="material-symbols-outlined">north_east</span>
            Upgrade to Pro
          </button>
          {plan.breakeven_eur && (
            <div className="sub-plan-breakeven">
              Break-even at €{plan.breakeven_eur.toLocaleString()} attributed/mo
            </div>
          )}
        </>
      )}
      {isDowngrade && <div className="sub-plan-downgrade">Downgrade</div>}
    </div>
  )
}

// ══ Topup modal (unchanged from earlier delivery) ══════════════════════
function TopupModal({ onClose }) {
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
    // Backend not wired yet. When endpoint exists, POST here and redirect.
    console.log('[TopupModal] Pay clicked', { pack, cardNo, exp, cvc, name, country, zip })
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal sub-topup-modal" onClick={e => e.stopPropagation()}>
        <div className="sub-topup-hdr">
          <div className="sub-topup-eyebrow">Buy more images</div>
          <button className="modal-close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="sub-topup-title">Top up your <em>images</em></div>
        <div className="sub-topup-sub">
          Buy a pack to keep generating this month. Top-up images never expire while your plan is active.
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
                  <div className="sub-topup-pack-lbl">images</div>
                  <div className="sub-topup-pack-price">€{p.price}</div>
                </button>
              ))}
            </div>
            <div className="sub-topup-note">
              <span className="material-symbols-outlined">info</span>
              <span>Every image is generated at 2K, ready for web, mobile, and social.</span>
            </div>
            <div className="sub-topup-footer">
              <button className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={() => setStep(2)}>Continue to payment</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="sub-pay-testbar">
              <span className="material-symbols-outlined">science</span>
              <span>Test mode, no real payment is taken in this prototype.</span>
            </div>

            <div className="sub-pay-summary">
              <div className="sub-pay-summary-row">
                <span>Mi Italia AI Studio images</span>
                <span>+{pack.images} images</span>
              </div>
              <div className="sub-pay-summary-row sub-pay-summary-vat">
                <span>VAT</span>
                <span>Included / reverse charge</span>
              </div>
              <div className="sub-pay-summary-row sub-pay-summary-total">
                <span>Total due</span>
                <span>€{pack.price}</span>
              </div>
            </div>

            <div className="sub-pay-field-label">Card information</div>
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

            <div className="sub-pay-field-label">Name on card</div>
            <input className="sub-pay-input" placeholder="Full name" autoComplete="cc-name"
              value={name} onChange={e => setName(e.target.value)} />

            <div className="sub-pay-field-label">Country and postal code</div>
            <div className="sub-pay-country-row">
              <select className="sub-pay-input" value={country} onChange={e => setCountry(e.target.value)}>
                <option>Italy</option><option>France</option><option>Spain</option>
                <option>Germany</option><option>United Kingdom</option>
              </select>
              <input className="sub-pay-input" placeholder="Postal code" autoComplete="postal-code"
                value={zip} onChange={e => setZip(e.target.value)} />
            </div>

            <div className="sub-pay-testhint">
              Use Stripe test card <strong>4242 4242 4242 4242</strong>, any future date and CVC. No real card is charged.
            </div>
            <div className="sub-pay-stripe">Powered by <strong>Stripe</strong></div>

            <div className="sub-topup-footer">
              <button className="btn btn-outline btn-sm" onClick={() => setStep(1)}>Back</button>
              <button className="btn btn-primary btn-sm" onClick={handlePay}>Pay €{pack.price}</button>
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
function AttributionTab() {
  const [range, setRange]             = useState('12m')
  const [compare, setCompare]         = useState('none')
  const [customRange, setCustomRange] = useState(null)

  const baseLabel = range === 'custom' && customRange
    ? `custom range applied`
    : (RANGE_LABELS[range] ?? '')

  const periodLabel = (() => {
    if (compare === 'prev')     return `${baseLabel} · vs prev period`
    if (compare === 'prevyear') return `${baseLabel} · vs 2025`
    return baseLabel
  })()

  // Static mockup data — from the mockup HTML
  const TIERS = [
    { key:'base',     tag:'Base',       range:'Below 30%',                                current:false, commission:8, status:'Below buffer', saving:'— baseline' },
    { key:'silver',   tag:'🥈 Silver',  range:'30–49%',                                    current:true,  commission:7, status:'CURRENT',     saving:'€504/yr'   },
    { key:'gold',     tag:'🥇 Gold',    range:'50–64%',                                    current:false, commission:6, status:'16pt away',   saving:'€1,008/yr' },
    { key:'platinum', tag:'💎 Platinum',range:'≥65%',                                      current:false, commission:5, status:'31pt away',   saving:'€1,512/yr' },
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
    { date:'26', avBg:'rgba(99,91,255,0.1)',   avColor:'var(--stripe)',   avInit:'M', cust:'Marco Rossi',           item:'Tailored Jacket',   sale:890,  source:{ type:'walkin',   label:'Identified walk-in' }, rate:7, fee:62.30 },
    { date:'22', avBg:'rgba(217,119,6,0.1)',   avColor:'#B45309',         avInit:'C', cust:'Chiara De Luca',        item:'Cashmere Coat',     sale:1290, source:{ type:'digital',  label:'Email click'        }, rate:7, fee:90.30 },
    { date:'18', avBg:'var(--mist)',            avColor:'var(--stone)',    avInit:'?', cust:'Unidentified walk-in',  item:'Linen Trousers',    sale:380,  source:{ type:'organic',  label:'Organic'            }, rate:0, fee:0     },
    { date:'14', avBg:'rgba(184,149,90,0.15)', avColor:'var(--gold-dk)', avInit:'S', cust:'Sofia Marchetti',      item:'Leather Sandals',   sale:320,  source:{ type:'app',      label:'📱 In-app'          }, rate:8, fee:25.60 },
    { date:'11', avBg:'rgba(0,108,53,0.1)',    avColor:'var(--green)',    avInit:'F', cust:'Francesca Bianchi',    item:'Wool Scarf',        sale:180,  source:{ type:'walkin',   label:'Identified walk-in' }, rate:7, fee:12.60 },
  ]

  return (
    <div>
      {/* Range bar (shared component) */}
      <RangeBar
        range={range}
        compare={compare}
        customRange={customRange}
        periodLabel={periodLabel}
        onRangeChange={setRange}
        onCompareChange={setCompare}
        onCustomApply={r => { setCustomRange(r); setRange('custom') }}
        onExport={() => console.log('[Attribution] Export clicked')}
      />

      {/* Tier hero + Floor status */}
      <div className="grid2">
        <div>
          <div className="sub-attr-section-lbl">Your current tier · Connect plan</div>
          <div className="tier-hero silver">
            <div className="th-top">
              <div>
                <div className="th-tier">🥈 Silver Tier</div>
                <div className="th-tier-sub">30–49% identification rate · 7% attributed commission</div>
              </div>
              <div className="th-right">
                <div className="th-rate">7%</div>
                <div className="th-rate-lbl">Your rate · May</div>
              </div>
            </div>
            <div className="th-progress">
              <div className="th-progress-row">
                <span>Progress to <strong>Gold (6%)</strong></span>
                <span>34% → need 50%</span>
              </div>
              <div className="prog">
                <div className="prog-fill th-prog-fill" style={{ width:'68%' }} />
              </div>
            </div>
            <div className="th-projection">
              16 more percentage points needed. At your current trajectory (+8% last month),
              you'll likely reach Gold next month.
            </div>
          </div>
        </div>

        <div>
          <div className="sub-attr-section-lbl">Minimum floor status</div>
          <div className="floor-strip safe">
            <div className="fs-ico"><span className="material-symbols-outlined">verified</span></div>
            <div className="fs-content">
              <div className="fs-title">Floor not active — you're safe</div>
              <div className="fs-sub">
                Your identification rate (34%) is well above the 15% minimum threshold. The 2% fallback
                commission on unattributed walk-ins is not applied this month. You have a{' '}
                <strong className="fs-buffer-strong">19-point buffer</strong> above the floor.
              </div>
              <div className="fs-bar-wrap">
                <div className="fs-bar-row">
                  <span>Floor 15%</span>
                  <span>You 34%</span>
                </div>
                <div className="prog fs-prog">
                  <div className="prog-fill fs-prog-fill" style={{ width:'34%' }} />
                  <div className="fs-floor-marker" />
                </div>
              </div>
            </div>
            <div className="fs-right">
              <div className="fs-rate">+19pt</div>
              <div className="fs-buffer-lbl">BUFFER</div>
            </div>
          </div>
        </div>
      </div>

      {/* All commission tiers */}
      <div className="card">
        <div className="card-hdr">
          <div>
            <div className="card-title">All <em>commission tiers</em> — Connect Plan</div>
            <div className="sub-card-sub">
              As your identification rate climbs, your commission drops. Tiers reset monthly based on last 30 days.
            </div>
          </div>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Tier</th>
              <th>Identification Rate</th>
              <th>Commission</th>
              <th>Your Status</th>
              <th>Annual saving vs Base</th>
            </tr>
          </thead>
          <tbody>
            {TIERS.map(t => (
              <tr key={t.key} className={t.current ? 'sub-tier-current-row' : ''}>
                <td><span className={`tag tag-${t.key}`}>{t.tag}</span></td>
                <td>
                  <span className={t.key === 'base' ? 'sub-tier-range-mute' : undefined}>{t.range}</span>
                  {t.current && <span className="sub-tier-current-hint"> · You: 34%</span>}
                </td>
                <td>
                  <span className={`sub-tier-commission sub-tier-commission-${t.key}`}>{t.commission}%</span>
                </td>
                <td>
                  {t.current
                    ? <span className="tag tag-active">CURRENT</span>
                    : <span className="sub-tier-status">{t.status}</span>
                  }
                </td>
                <td>
                  <span className={t.key === 'base' ? 'sub-tier-baseline' : 'sub-tier-saving'}>{t.saving}</span>
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
              <div className="card-title">Identification rate — <em>6-month trend</em></div>
              <div className="sub-card-sub">% of walk-in customers identified via Mi Italia POS prompt</div>
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
            <strong className="sub-attr-trend-note-up">↑ 22 points in 6 months.</strong>{' '}
            Strongest growth: April–May, driven by your team adopting the "Add to Mi Italia" POS prompt.
          </div>
        </div>

        <div className="card sub-attr-card-flush">
          <div className="card-hdr">
            <div>
              <div className="card-title">Floor <em>simulator</em></div>
              <div className="sub-card-sub">Project your commission at different identification rates</div>
            </div>
          </div>
          <div className="sub-sim-input-row">
            <div className="sub-sim-input-lbl">
              <span>If your identification rate were</span>
              <div className="sub-sim-input-lbl-sub">Currently 34% · Silver tier</div>
            </div>
            <input className="sub-sim-input" defaultValue="45%" />
          </div>
          <div className="sub-sim-input-row">
            <div className="sub-sim-input-lbl">
              <span>Monthly attributed revenue</span>
              <div className="sub-sim-input-lbl-sub">Your current avg is €4,200</div>
            </div>
            <input className="sub-sim-input" defaultValue="€4,200" />
          </div>
          <div className="sub-sim-result">
            <div className="sub-sim-result-ico"><span className="material-symbols-outlined">calculate</span></div>
            <div className="sub-sim-result-body">
              <div className="sub-sim-result-lbl">Projected Mi Italia Commission</div>
              <div className="sub-sim-result-val">€294 <span className="sub-sim-result-mo">/ month</span></div>
            </div>
          </div>
          <div className="sub-sim-note">
            At <strong className="sub-sim-note-tier">Gold (50–64%)</strong> the same revenue costs €252/mo.<br />
            At <strong className="sub-sim-note-tier">Platinum (≥65%)</strong> it costs €210/mo.
          </div>
        </div>
      </div>

      {/* Attribution transactions */}
      <div className="card">
        <div className="card-hdr">
          <div>
            <div className="card-title">Attribution <em>transactions</em> — May 2026</div>
            <div className="sub-card-sub">Every sale routed through Mi Italia and the commission applied</div>
          </div>
          <button className="btn btn-outline btn-sm">
            <span className="material-symbols-outlined">download</span>Export CSV
          </button>
        </div>

        <div className="sub-tx-header">
          <div>Date</div>
          <div>Customer · Item</div>
          <div>Source</div>
          <div className="sub-tx-num">Sale</div>
          <div className="sub-tx-num">Rate</div>
          <div className="sub-tx-num">Mi Italia</div>
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
          <div className="sub-tx-more">+ 18 more transactions ·</div>
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
function BillingTab() {
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
          <div className="sub-bill-kpi-lbl">Next charge</div>
          <div className="sub-bill-kpi-val"><em>€294</em></div>
          <div className="sub-bill-kpi-sub">1 June · May commission · auto-debit</div>
        </div>
        <div className="sub-bill-kpi-card">
          <div className="sub-bill-kpi-lbl">YTD paid to Mi Italia</div>
          <div className="sub-bill-kpi-val">€1,840</div>
          <div className="sub-bill-kpi-sub">Jan–Apr · 5 invoices</div>
        </div>
        <div className="sub-bill-kpi-card">
          <div className="sub-bill-kpi-lbl">Avg monthly</div>
          <div className="sub-bill-kpi-val">€368</div>
          <div className="sub-bill-kpi-sub sub-bill-kpi-up">↓ €72 vs same period last year</div>
        </div>
      </div>

      {/* Payment method + Billing details */}
      <div className="grid2">
        <div className="card sub-attr-card-flush">
          <div className="card-hdr">
            <div>
              <div className="card-title">Payment <em>method</em></div>
              <div className="sub-card-sub">Auto-debit on the 1st of each month</div>
            </div>
          </div>
          <div className="sub-pm-card">
            <div className="sub-pm-brand">VISA</div>
            <div className="sub-pm-info">
              <div className="sub-pm-num">•••• •••• •••• 4287</div>
              <div className="sub-pm-exp">Expires 09/27 · Giulia Bianchi · BNL</div>
            </div>
            <button className="btn btn-outline btn-sm">
              <span className="material-symbols-outlined">edit</span>Update
            </button>
          </div>
          <div className="alert info sub-pm-alert">
            <span className="material-symbols-outlined">lock</span>
            <div>Payment is processed securely by <strong>Stripe</strong>. Mi Italia never sees your card number.</div>
          </div>
        </div>

        <div className="card sub-attr-card-flush">
          <div className="card-hdr">
            <div>
              <div className="card-title">Billing <em>details</em></div>
              <div className="sub-card-sub">Used on invoices for VAT reporting</div>
            </div>
            <button className="btn btn-outline btn-sm">
              <span className="material-symbols-outlined">edit</span>Edit
            </button>
          </div>
          <div className="sub-bd-body">
            <div className="sub-bd-name">Atelier Bianchi S.r.l.</div>
            <div className="sub-bd-addr">Via Brera 12<br />20121 Milano · Italia</div>
            <div className="sub-bd-vat">
              <div><strong>VAT (P.IVA):</strong> IT12345678901</div>
              <div><strong>Codice fiscale:</strong> BNCGLA82A41F205X</div>
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
            <div className="card-title">Invoice <em>history</em></div>
            <div className="sub-card-sub">
              Italian fattura elettronica · auto-delivered to your SDI on the 1st
            </div>
          </div>
          <select className="sub-inv-filter">
            <option>All invoices</option>
            <option>This year</option>
            <option>Last year</option>
            <option>Refunds only</option>
          </select>
        </div>

        <div className="sub-inv-header">
          <div>Date</div>
          <div>Invoice</div>
          <div className="sub-inv-num">Amount</div>
          <div className="sub-inv-center">Status</div>
          <div className="sub-inv-num">Period</div>
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
              <button className="btn btn-outline btn-xs" title="Download PDF">
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
  }, [])

  const handleUpgradeConnect = async () => {
    setConnectLoading(true); setPortalError('')
    try {
      const res  = await apiFetch(`${BASE_URL}/boutique/subscription/portal-link`, { method: 'POST', body: JSON.stringify({}) })
      const data = await res.json()
      if (data.success && data.data?.portal_url) {
        window.location.href = data.data.portal_url
      } else {
        setPortalError(data.message || 'Could not open billing portal. Please try again.')
        setConnectLoading(false)
      }
    } catch {
      setPortalError('Network error. Please try again.')
      setConnectLoading(false)
    }
  }

  const currentPlan = subData?.effective_plan || 'connect'
  const planLabel   = currentPlan === 'pro' ? 'Pro' : currentPlan === 'starter' ? 'Starter' : 'Connect'
  const planSub     = currentPlan === 'pro'
    ? '€200/mo · 0% commission · No floor'
    : currentPlan === 'starter'
    ? 'No monthly fee · 10% on all attributed sales · No floor'
    : 'No monthly fee · 5–8% tiered commission · 15% floor'

  const aiRendersLeft = subData?.usage?.ai_studio_renders_remaining ?? 17

  const TABS = [
    { key: 'overview',    icon: 'home',         label: 'Overview & Usage'   },
    { key: 'attribution', icon: 'analytics',    label: 'Attribution'        },
    { key: 'billing',     icon: 'receipt_long', label: 'Billing & Invoices' },
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
          <div className="sub-mod-title">Subscription &amp; <em>Billing</em></div>
          <div className="sub-mod-sub">Manage your plan, usage, and attribution</div>
        </div>
      </div>

      <div className="sub-nav">
        {TABS.map(t => (
          <div key={t.key} className={`sub-sni${tab === t.key ? ' act' : ''}`} onClick={() => setTab(t.key)}>
            <span className="material-symbols-outlined">{t.icon}</span>
            {t.label}
          </div>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div>
          <div className="sub-plan-hero">
            <div className="sub-ph-left">
              <div className="sub-ph-eyebrow">Current Plan</div>
              <div className="sub-ph-plan"><em>{planLabel}</em></div>
              <div className="sub-ph-sub">{planSub}</div>
            </div>
            <div className="sub-ph-stat">
              <div className="sub-ph-stat-val">{subData?.identification_rate ?? '—'}%</div>
              <div className="sub-ph-stat-lbl">Identification Rate</div>
            </div>
            <div className="sub-ph-stat">
              <div className="sub-ph-stat-val">€{(subData?.attributed_revenue_month ?? 0).toLocaleString()}</div>
              <div className="sub-ph-stat-lbl">Attributed Revenue · This month</div>
            </div>
            <div className="sub-ph-right">
              {currentPlan !== 'pro' && (
                <button className="btn btn-primary" onClick={() => setCheckoutOpen(true)}>
                  Upgrade to Pro
                  <br />
                  <span className="sub-ph-upgrade-sub">€200/mo · 0% commission</span>
                </button>
              )}
              <button className="btn btn-ghost btn-sm sub-ph-details-btn" onClick={() => setTab('attribution')}>
                View plan details →
              </button>
            </div>
          </div>

          <div className="card sub-usage-card">
            <div className="card-hdr">
              <div>
                <div className="card-title">Usage <em>this month</em></div>
                <div className="sub-card-sub">Resets on the 1st of next month</div>
              </div>
              <span className="sub-tag-active">ACTIVE</span>
            </div>
            <div className="sub-usage-grid">
              <div>
                <div className="sub-sec-lbl sub-sec-lbl-first">Contacts</div>
                <UsageMeter label="Total contacts" display="847 / 1,500"  pct={56}  hint="56% of plan capacity"          level="ok" />
                <UsageMeter label="Item savers"    display="541"          pct={100} unlimited hint="No cap on favorites"  level="ok" />
              </div>
              <div>
                <div className="sub-sec-lbl sub-sec-lbl-first">Campaigns this month</div>
                <UsageMeter label="Email campaigns" display="4 / Unlimited"   pct={100} unlimited hint="Unlimited in Connect"         level="ok" />
                <UsageMeter label="WhatsApp sends"  display="389 / Unlimited" pct={100} unlimited hint="€0.10/msg · €38.90 this month" level="ok" />
              </div>
              <div>
                <div className="sub-sec-lbl sub-sec-lbl-first">AI &amp; Studio</div>
                <div className="sub-um sub-um-with-topup">
                  <div className="sub-um-hdr">
                    <div className="sub-um-lbl">AI Studio renders</div>
                    <div className="sub-um-val">19 / 25</div>
                  </div>
                  <div className="sub-um-track">
                    <div className="sub-um-fill warn" style={{ width: '76%' }} />
                  </div>
                  <div className="sub-um-hint warn">
                    {aiRendersLeft} renders remaining · buy more anytime
                  </div>
                  <button className="sub-um-topup" onClick={() => setShowTopup(true)}>
                    <span className="material-symbols-outlined">add_shopping_cart</span>
                    Buy more images
                  </button>
                </div>
                <UsageMeter label="AI Assistant messages" display="142 / 500" pct={28} hint="Plenty of headroom" level="ok" />
                <UsageMeter label="Translation languages" display="3 / 8"     pct={38} hint="IT · EN · FR active" level="ok" />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-hdr">
              <div>
                <div className="card-title">Compare <em>plans</em></div>
                <div className="sub-card-sub">Choose what fits — change anytime from the 1st of next month</div>
              </div>
            </div>

            <div className="sub-bi-hero">
              <div className="sub-bi-hero-l">
                <div className="sub-bi-eyebrow">
                  <div className="sub-bi-icon"><span className="material-symbols-outlined">neurology</span></div>
                  <div className="sub-bi-eyebrow-lbl">Pro tier · AI built around your boutique</div>
                </div>
                <div className="sub-bi-title">Boutique <em>Intelligence</em></div>
                <div className="sub-bi-body">
                  On Pro, your boutique gets <strong>its own AI assistant</strong> — learning nightly from <em>your tone, your customers, your sales patterns</em>.
                  It works only for you. Starter and Connect use a shared assistant that knows nothing specific about your boutique.
                </div>
                <div className="sub-bi-tags">
                  <div className="sub-bi-tag"><span className="material-symbols-outlined">storefront</span>Learns your boutique's voice</div>
                  <div className="sub-bi-tag"><span className="material-symbols-outlined">groups</span>Knows your customers</div>
                  <div className="sub-bi-tag"><span className="material-symbols-outlined">verified_user</span>Your data stays private</div>
                  <div className="sub-bi-tag"><span className="material-symbols-outlined">schedule</span>30-min translation review</div>
                </div>
              </div>
            </div>

            {plans.length === 0 ? (
              <div className="state-empty">No plans available.</div>
            ) : (
              <div className="sub-plans-grid">
                {plans.map(plan => (
                  <PlanCard
                    key={plan.code}
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
                  Based on your average <strong>€4,200/mo attributed revenue</strong>, you'd save <strong>€136/month</strong> on Pro vs Connect.{' '}
                  <span className="sub-link" onClick={() => setTab('attribution')}>View break-even math →</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ATTRIBUTION ── */}
      {tab === 'attribution' && <AttributionTab />}

      {/* ── BILLING ── */}
      {tab === 'billing' && <BillingTab />}

      {checkoutOpen && (
        <StripeCheckout
          plan="pro"
          onClose={() => setCheckoutOpen(false)}
          onSuccess={() => window.location.reload()}
        />
      )}

      {showTopup && <TopupModal onClose={() => setShowTopup(false)} />}
    </div>
  )
}
