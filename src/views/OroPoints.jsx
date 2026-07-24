import { useState } from 'react'
import Toast, { useToast } from '../components/ui/Toast'
import { useTranslation } from 'react-i18next'

const SUBTOTAL = 1010

const ORDER_ITEMS = [
  { ico:'🧥', name:'Cashmere Trench Coat — Camel', sub:'Size 42 · 1 item', price:890 },
  { ico:'👜', name:'Leather Card Holder',           sub:'Tan · 1 item',    price:120 },
]

const CRM_TX = [
  { dir:'earn',  ico:'shopping_bag',   name:'Cashmere Trench Coat — Camel',    sub:'Neglia · POS · 1 May 2026',           pts:+890  },
  { dir:'earn',  ico:'diamond',        name:'Gemme · Osteria dei Fiori',        sub:'Dining experience · 28 Apr 2026',     pts:+200  },
  { dir:'earn',  ico:'star',           name:'Review approved — Neglia',         sub:'4-star boutique review · 20 Apr 2026',pts:+100  },
  { dir:'spend', ico:'percent',        name:'€20 discount redeemed',            sub:'Leather Tote purchase · 15 Apr 2026', pts:-200  },
  { dir:'earn',  ico:'shopping_bag',   name:'Velvet Evening Jacket — Midnight', sub:'Neglia · Online · 3 Apr 2026',        pts:+400  },
  { dir:'earn',  ico:'shopping_bag',   name:'Silk Slip Dress — Ivory',          sub:'Casa Moda · Online · 22 Mar 2026',    pts:+190  },
  { dir:'earn',  ico:'calendar_today', name:'Reserve & Pick Up collected',      sub:'Leather Tote · Neglia · 15 Apr',      pts:+50   },
  { dir:'earn',  ico:'person_add',     name:'Referral bonus',                   sub:'Friend joined via referral link',     pts:+500  },
  { dir:'earn',  ico:'waving_hand',    name:'Welcome bonus',                    sub:'Joined Mi Italia · Jan 2024',         pts:+1500 },
]

const CUSTOMER_BALANCE = 2840

function OroCard({ name, balance }) {
  return (
    <div className="oro-card">
      <div className="oro-card-ring oro-card-ring-1" />
      <div className="oro-card-ring oro-card-ring-2" />
      <div className="oro-card-eyebrow">Oro Points</div>
      <div className="oro-card-name">{name}</div>
      <div className="oro-card-balance-row">
        <span className="oro-card-balance">{balance.toLocaleString()}</span>
        <span className="oro-card-pts">pts</span>
      </div>
      <div className="oro-card-worth">
        Worth <strong className="oro-card-worth-val">€{(balance / 10).toLocaleString()}</strong> in discounts
      </div>
      <div className="oro-card-watermark">Mi Italia</div>
    </div>
  )
}

export default function OroPoints() {
  const { t }                               = useTranslation()
  const [activeView, setActiveView]         = useState('pos')
  const [ptsToApply, setPtsToApply]         = useState(500)
  const [discountApplied, setDiscountApplied] = useState(0)
  const { toasts, show } = useToast()

  const discountEuros = Math.round(ptsToApply / 10)
  const orderTotal    = SUBTOTAL - discountApplied
  const ptsToAward    = Math.round(orderTotal)

  function applyDiscount() {
    if (ptsToApply > CUSTOMER_BALANCE) { show(t('oro.toast.insufficient')); return }
    setDiscountApplied(discountEuros)
    show(t('oro.toast.applied', { amount: discountEuros }))
  }

  function removeDiscount() { setPtsToApply(0); setDiscountApplied(0) }
  function processPayment()  { show(t('oro.toast.payment', { total: orderTotal })) }

  const VIEWS = [
    { key:'pos', icon:'point_of_sale', label:t('oro.views.pos') },
    { key:'crm', icon:'person',        label:t('oro.views.crm') },
  ]

  return (
    <>
      {/* View tabs */}
      <div className="oro-viewtabs">
        {VIEWS.map(v => (
          <div key={v.key} onClick={() => setActiveView(v.key)} className={`oro-viewtab${activeView===v.key?' act':''}`}>
            <span className="material-symbols-outlined oro-viewtab-icon">{v.icon}</span>
            {v.label}
          </div>
        ))}
      </div>

      {/* ══ POS VIEW ══ */}
      {activeView === 'pos' && (
        <div className="oro-pos-grid">

          {/* Left column */}
          <div className="oro-pos-left">

            {/* Identified customer */}
            <div className="card">
              <div className="oro-section-eyebrow">{t('oro.pos.identified_customer')}</div>
              <div className="oro-customer-row">
                <div className="oro-customer-av">VC</div>
                <div>
                  <div className="oro-customer-name">Valentina Conti</div>
                  <div className="oro-customer-sub">{t('oro.pos.member_identified')}</div>
                </div>
                <button className="btn btn-outline btn-sm oro-customer-change" onClick={() => show(t('oro.toast.changed'))}>
                  {t('common.change')}
                </button>
              </div>
              <OroCard name="Valentina Conti" balance={CUSTOMER_BALANCE} />
            </div>

            {/* Apply points discount */}
            <div className="card">
              <div className="oro-apply-title">
                <span className="material-symbols-outlined oro-apply-icon">toll</span>
                {t('oro.pos.apply_title')}
              </div>

              <div className="oro-apply-box">
                <div className="oro-apply-box-title">
                  <span className="material-symbols-outlined">percent</span>
                  {t('oro.pos.offer_discount')}
                </div>
                <div className="oro-apply-box-hint">{t('oro.pos.pts_hint')}</div>

                <div className="oro-pts-row">
                  <div>
                    <div className="oro-input-lbl">{t('oro.pos.pts_to_apply')}</div>
                    <input
                      type="number"
                      className="form-input oro-pts-input"
                      value={ptsToApply}
                      min="0"
                      max={CUSTOMER_BALANCE}
                      step="100"
                      onChange={e => setPtsToApply(parseInt(e.target.value) || 0)}
                      onWheel={e => e.target.blur()}
                    />
                  </div>
                  <div className="oro-equals">=</div>
                  <div>
                    <div className="oro-input-lbl">{t('oro.pos.discount')}</div>
                    <div className="oro-discount-val">€{discountEuros} off</div>
                  </div>
                </div>

                <div className="oro-apply-btns">
                  <button className="btn btn-sm oro-apply-btn-green" onClick={applyDiscount}>
                    <span className="material-symbols-outlined">check</span>{t('oro.pos.apply_btn')}
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={removeDiscount}>{t('common.remove')}</button>
                </div>
              </div>

              <div className="oro-award-box">
                <div className="oro-award-title">{t('oro.pos.award_title')}</div>
                <div className="oro-award-body">
                  {t('oro.pos.award_body_prefix')} <strong className="oro-award-pts">{ptsToAward} pts</strong> {t('oro.pos.award_body_suffix')}
                </div>
              </div>
            </div>
          </div>

          {/* Right column: order summary */}
          <div className="oro-pos-right">
            <div className="card">
              <div className="oro-section-eyebrow">{t('oro.pos.current_order')}</div>

              {ORDER_ITEMS.map((item, i) => (
                <div key={i} className={`oro-order-item${i < ORDER_ITEMS.length - 1 ? ' oro-order-item-border' : ''}`}>
                  <div className="oro-order-item-ico">{item.ico}</div>
                  <div className="oro-order-item-body">
                    <div className="oro-order-item-name">{item.name}</div>
                    <div className="oro-order-item-sub">{item.sub}</div>
                  </div>
                  <div className="oro-order-item-price">€{item.price}</div>
                </div>
              ))}

              <div className="oro-order-totals">
                <div className="oro-order-row">
                  <span>{t('oro.pos.subtotal')}</span><span>€{SUBTOTAL}</span>
                </div>
                {discountApplied > 0 && (
                  <div className="oro-order-row oro-order-discount">
                    <span>{t('oro.pos.oro_discount')}</span><span>−€{discountApplied}</span>
                  </div>
                )}
                <div className="oro-order-row oro-order-total">
                  <span>{t('oro.pos.total')}</span><span>€{orderTotal}</span>
                </div>
              </div>

              <button className="btn oro-pay-btn" onClick={processPayment}>
                <span className="material-symbols-outlined">credit_card</span>{t('oro.pos.process_payment')}
              </button>

              <div className="oro-info-row">
                <span className="material-symbols-outlined oro-info-icon">info</span>
                <div className="oro-info-text">{t('oro.pos.auto_credit')}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ CRM VIEW ══ */}
      {activeView === 'crm' && (
        <div className="oro-crm-wrap">

          {/* Customer search */}
          <div className="card oro-crm-search-card">
            <div className="oro-crm-search-inner">
              <span className="material-symbols-outlined oro-crm-search-icon">search</span>
              <input className="oro-crm-search-input" placeholder={t('oro.crm.search_placeholder')} defaultValue="Valentina Conti" />
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => show(t('oro.crm.search_toast'))}>
              {t('oro.crm.change_customer')}
            </button>
          </div>

          <div className="oro-crm-grid">

            {/* Left: profile */}
            <div className="oro-crm-profile">
              <div className="card">
                <div className="oro-crm-profile-hdr">
                  <div className="oro-crm-av">VC</div>
                  <div>
                    <div className="oro-customer-name">Valentina Conti</div>
                    <div className="oro-customer-sub">valentina@email.com</div>
                    <div className="oro-customer-sub">{t('oro.crm.member_since')}</div>
                  </div>
                </div>

                <OroCard name="Valentina Conti" balance={2840} />

                <div className="oro-crm-stats">
                  {[
                    { val:'7',      lbl:t('oro.crm.stats.visits') },
                    { val:'€2,890', lbl:t('oro.crm.stats.spend') },
                    { val:'12',     lbl:t('oro.crm.stats.reviews') },
                    { val:'3',      lbl:t('oro.crm.stats.gemme') },
                  ].map(s => (
                    <div key={s.lbl} className="oro-crm-stat">
                      <div className="oro-crm-stat-val">{s.val}</div>
                      <div className="oro-crm-stat-lbl">{s.lbl}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card oro-managed-card">
                <div className="oro-managed-title">
                  <span className="material-symbols-outlined oro-managed-icon">lock</span>
                  {t('oro.crm.managed_title')}
                </div>
                <div className="oro-managed-body">{t('oro.crm.managed_body')}</div>
              </div>
            </div>

            {/* Right: transaction history */}
            <div className="card">
              <div className="oro-tx-hdr">
                <div className="oro-tx-title">{t('oro.crm.history_title')}</div>
                <div className="oro-tx-subtitle">{t('oro.crm.history_sub')}</div>
              </div>

              {CRM_TX.map((tx, i) => {
                const isEarn = tx.pts > 0
                return (
                  <div key={i} className={`oro-tx-row${i < CRM_TX.length - 1 ? ' oro-tx-row-border' : ''}`}>
                    <div className={`oro-tx-icon${isEarn ? ' earn' : ' spend'}`}>
                      <span className="material-symbols-outlined" style={{ fontSize:'15px', color: isEarn ? 'var(--green)' : 'var(--red)' }}>{tx.ico}</span>
                    </div>
                    <div className="oro-tx-body">
                      <div className="oro-tx-name">{tx.name}</div>
                      <div className="oro-tx-sub">{tx.sub}</div>
                    </div>
                    <div className={`oro-tx-pts${isEarn ? ' earn' : ' spend'}`}>
                      {isEarn ? '+' : ''}{tx.pts.toLocaleString()}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <Toast toasts={toasts} />
    </>
  )
}
