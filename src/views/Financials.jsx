import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'

const BASE_URL = import.meta.env.VITE_API_URL

function fmt(v) {
  if (v == null) return '—'
  return `€${Number(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtPct(v) {
  if (v == null) return '—'
  return `${(v * 100).toFixed(0)}%`
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en', { day:'numeric', month:'short', year:'numeric' })
}

export default function Financials() {
  const navigate    = useNavigate()
  const { t }       = useTranslation()

  const PERIODS = [
    { value:'mtd',        label: t('financials.period.mtd')        },
    { value:'last_month', label: t('financials.period.last_month') },
    { value:'last_3',     label: t('financials.period.last_3')     },
    { value:'this_year',  label: t('financials.period.this_year')  },
  ]

  const [period,       setPeriod]       = useState('mtd')
  const [data,         setData]         = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [payouts,      setPayouts]      = useState([])
  const [payoutSummary,setPayoutSummary]= useState({})
  const [payoutsLoading, setPayoutsLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiFetch(`${BASE_URL}/boutique/financials/overview?period=${period}`)
      .then(r => r.json())
      .then(res => { if (res.success) setData(res.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [period])

  useEffect(() => {
    setPayoutsLoading(true)
    apiFetch(`${BASE_URL}/boutique/financials/payouts`)
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setPayouts(res.data.payouts ?? [])
          setPayoutSummary(res.data.summary ?? {})
        }
      })
      .catch(() => {})
      .finally(() => setPayoutsLoading(false))
  }, [])

  const kpis     = data?.kpis          ?? {}
  const feeBreak = data?.fee_breakdown ?? {}
  const stripe   = data?.stripe_connect ?? {}
  const revenue  = feeBreak.revenue    ?? {}
  const fees     = feeBreak.fees       ?? {}

  const stripeConnected = stripe.charges_enabled && stripe.payouts_enabled

  const planLabel = kpis.monthly_platform_fee?.plan
    ? kpis.monthly_platform_fee.plan.charAt(0).toUpperCase() + kpis.monthly_platform_fee.plan.slice(1)
    : 'Connect'

  const channels = [
    {
      label:  t('financials.by_channel.ship'),
      orders: revenue.ecommerce?.orders      ?? 0,
      gross:  revenue.ecommerce?.amount      ?? 0,
      rate:   fees.ecommerce_commission?.rate ?? 0,
      comm:   fees.ecommerce_commission?.amount ?? 0,
    },
    {
      label:  t('financials.by_channel.pickup'),
      orders: revenue.reserve_pickup?.orders ?? 0,
      gross:  revenue.reserve_pickup?.amount ?? 0,
      rate:   0,
      comm:   0,
    },
    {
      label:  t('financials.by_channel.pos'),
      orders: revenue.in_store_pos?.orders   ?? 0,
      gross:  revenue.in_store_pos?.amount   ?? 0,
      rate:   fees.pos_commission?.rate      ?? 0,
      comm:   fees.pos_commission?.amount    ?? 0,
    },
  ]

  const totalOrders = channels.reduce((s, c) => s + c.orders, 0)
  const totalComm   = channels.reduce((s, c) => s + c.comm,   0)

  return (
    <div>

      {/* Period selector */}
      <div className="fin-period-row">
        <select className="form-select fin-period-select" value={period} onChange={e => setPeriod(e.target.value)}>
          {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>

      {/* ── Stripe + Plan strip ── */}
      <div className="fin-strip">
        <div className="fin-stripe-card">
          <div className="fin-stripe-icon">
            <span className="material-symbols-outlined fin-icon-white">
              {stripeConnected ? 'link' : 'link_off'}
            </span>
          </div>
          <div className="fin-stripe-body">
            <div className="fin-stripe-title">
              {t('financials.stripe_label')} — {stripeConnected ? t('financials.stripe_active_short') : t('financials.stripe_not_connected')}
            </div>
            <div className="fin-stripe-sub">
              {stripeConnected
                ? t('financials.stripe_sub')
                : t('financials.stripe_connect_prompt')}
            </div>
          </div>
          {stripeConnected && (
            <div className="fin-stripe-acct">
              <div className="fin-stripe-acct-lbl">{t('financials.account_id')}</div>
              <div className="fin-stripe-acct-val">{stripe.account_id ?? '—'}</div>
            </div>
          )}
          <span className={`status ${stripeConnected ? 'active' : 'cancelled'}`}>
            {loading ? '—' : stripeConnected ? t('financials.connected') : t('financials.stripe_not_connected')}
          </span>
        </div>

        <div className="fin-plan-card">
          <div className="fin-plan-icon">
            <span className="material-symbols-outlined fin-icon-gold">workspace_premium</span>
          </div>
          <div>
            <div className="fin-plan-title">
              {t('financials.plan_label', { plan: planLabel })}
            </div>
            <div className="fin-plan-sub">
              {kpis.monthly_platform_fee?.amount > 0
                ? t('financials.plan_monthly', { amount: fmt(kpis.monthly_platform_fee.amount) })
                : t('financials.plan_commission_only')}
            </div>
          </div>
          <button className="btn btn-sm btn-outline" onClick={() => navigate('/subscription')}>{t('financials.manage')}</button>
        </div>
      </div>

      {/* ── 5 stat cards ── */}
      <div className="stat-row col5">
        <div className="stat-card">
          <div className="stat-lbl">{t('financials.stats.gross_sales')}</div>
          <div className="stat-val">{loading ? '—' : fmt(kpis.gross_sales?.amount)}</div>
          {kpis.gross_sales?.change_pct != null && (
            <div className={`stat-change ${kpis.gross_sales.change_pct >= 0 ? 'up' : 'dn'}`}>
              {kpis.gross_sales.change_pct >= 0 ? '↑' : '↓'} {Math.abs(kpis.gross_sales.change_pct).toFixed(0)}%
            </div>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-lbl">{t('financials.stats.platform_fee')}</div>
          <div className="stat-val" style={{ color: 'var(--red)' }}>
            {loading ? '—' : kpis.monthly_platform_fee?.amount > 0 ? `−${fmt(kpis.monthly_platform_fee.amount)}` : '€0'}
          </div>
          <div className="stat-change nu">
            {t('financials.plan_label', { plan: planLabel })}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">{t('financials.stats.commission')}</div>
          <div className="stat-val" style={{ color: 'var(--red)' }}>
            {loading ? '—' : `−${fmt(kpis.sales_commission?.amount)}`}
          </div>
          <div className="stat-change nu">
            {t('financials.commission_summary', {
              ecom: fmtPct(kpis.sales_commission?.ecom_rate),
              pos:  fmtPct(kpis.sales_commission?.pos_rate)
            })}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">{t('financials.stats.net_earnings')}</div>
          <div className="stat-val" style={{ color: 'var(--green)' }}>
            {loading ? '—' : fmt(kpis.net_earnings?.amount)}
          </div>
          {kpis.net_earnings?.change_pct != null && (
            <div className={`stat-change ${kpis.net_earnings.change_pct >= 0 ? 'up' : 'dn'}`}>
              {kpis.net_earnings.change_pct >= 0 ? '↑' : '↓'} {Math.abs(kpis.net_earnings.change_pct).toFixed(0)}%
            </div>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-lbl">{t('financials.stats.pending_payout')}</div>
          <div className="stat-val" style={{ color: 'var(--gold)' }}>
            {loading ? '—' : fmt(kpis.pending_payout?.amount)}
          </div>
          <div className="stat-change nu">
            {kpis.pending_payout?.next_payout_date
              ? t('financials.stats.next_payout', {
                  date: new Date(kpis.pending_payout.next_payout_date).toLocaleDateString('en', { month: 'short', day: 'numeric' })
                })
              : t('financials.no_payout_scheduled')}
          </div>
        </div>
      </div>

      <div className="grid2">

        {/* ── Fee breakdown ── */}
        <div className="card">
          <div className="card-hdr">
            <div className="card-title">{t('financials.fee_breakdown.title')} <em>{t('financials.fee_breakdown.title_em')}</em></div>
          </div>

          <div className="fee-breakdown">
            <div className="fin-fee-sec-lbl">{t('financials.fee_breakdown.revenue')}</div>
            <div className="fee-row">
              <div className="fee-label">{t('financials.ecom_sales', { count: revenue.ecommerce?.orders ?? 0 })}</div>
              <div className="fee-val">{fmt(revenue.ecommerce?.amount)}</div>
            </div>
            <div className="fee-row">
              <div className="fee-label">{t('financials.pickup_sales', { count: revenue.reserve_pickup?.orders ?? 0 })}</div>
              <div className="fee-val">{fmt(revenue.reserve_pickup?.amount)}</div>
            </div>
            <div className="fee-row">
              <div className="fee-label">{t('financials.pos_sales', { count: revenue.in_store_pos?.orders ?? 0 })}</div>
              <div className="fee-val">{fmt(revenue.in_store_pos?.amount)}</div>
            </div>
            <div className="fee-row fin-fee-total-row">
              <div className="fee-label"><strong>{t('financials.fee_breakdown.gross_revenue')}</strong></div>
              <div className="fee-val total">{fmt(revenue.gross_revenue)}</div>
            </div>
          </div>

          <div className="fee-breakdown">
            <div className="fin-fee-sec-lbl">{t('financials.fee_breakdown.mi_fees')}</div>
            <div className="fee-row">
              <div className="fee-label">
                <strong>{t('financials.fee_breakdown.platform_fee')}</strong><br />
                <span className="fin-fee-detail">
                  {t('financials.plan_label', { plan: kpis.monthly_platform_fee?.plan ?? 'Connect' })}
                  {fees.monthly_platform_fee?.due_date
                    ? ` · ${t('financials.due_date', { date: new Date(fees.monthly_platform_fee.due_date).toLocaleDateString('en', { month: 'short', day: 'numeric' }) })}`
                    : ''}
                </span>
              </div>
              <div className="fee-val debit">
                {fees.monthly_platform_fee?.amount > 0 ? `−${fmt(fees.monthly_platform_fee.amount)}` : '€0'}
              </div>
            </div>
            <div className="fee-row">
              <div className="fee-label">
                <strong>{t('financials.fee_breakdown.ecom_commission')}</strong><br />
                <span className="fin-fee-detail">
                  {fmtPct(fees.ecommerce_commission?.rate)} {t('financials.on')} {fmt(fees.ecommerce_commission?.applied_on)}
                </span>
              </div>
              <div className="fee-val debit">−{fmt(fees.ecommerce_commission?.amount)}</div>
            </div>
            <div className="fee-row">
              <div className="fee-label">
                <strong>{t('financials.fee_breakdown.pos_commission')}</strong><br />
                <span className="fin-fee-detail">
                  {fmtPct(fees.pos_commission?.rate)} {t('financials.on')} {fmt(fees.pos_commission?.applied_on)}
                </span>
              </div>
              <div className="fee-val debit">−{fmt(fees.pos_commission?.amount)}</div>
            </div>
            <div className="fee-row fin-fee-total-row">
              <div className="fee-label"><strong>{t('financials.fee_breakdown.total_fees')}</strong></div>
              <div className="fee-val debit">−{fmt(fees.total_fees)}</div>
            </div>
          </div>

          <div className="fin-net-bar">
            <div className="fin-net-label">{t('financials.net_earnings')}</div>
            <div className="fin-net-val">
              {fmt(feeBreak.net_earnings)}
            </div>
          </div>
        </div>

        {/* ── Right column ── */}
        <div>

          {/* Sales by channel */}
          <div className="card">
            <div className="card-hdr">
              <div className="card-title">{t('financials.by_channel.title')} <em>{t('financials.by_channel.title_em')}</em></div>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('financials.by_channel.channel')}</th>
                  <th>{t('financials.by_channel.orders')}</th>
                  <th>{t('financials.by_channel.gross')}</th>
                  <th>{t('financials.by_channel.rate')}</th>
                  <th>{t('financials.by_channel.comm')}</th>
                  <th>{t('financials.by_channel.net')}</th>
                </tr>
              </thead>
              <tbody>
                {channels.map((c, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{c.label}</td>
                    <td>{c.orders}</td>
                    <td>{fmt(c.gross)}</td>
                    <td style={{ color: c.rate > 0 ? 'var(--green)' : 'var(--stone)', fontWeight: 600 }}>
                      {c.rate > 0 ? fmtPct(c.rate) : '—'}
                    </td>
                    <td style={{ color: 'var(--red)' }}>{c.comm > 0 ? `−${fmt(c.comm)}` : '—'}</td>
                    <td style={{ color: 'var(--green)', fontWeight: 600 }}>{fmt(c.gross - c.comm)}</td>
                  </tr>
                ))}
                <tr className="fin-channel-total">
                  <td>{t('financials.by_channel.total')}</td>
                  <td>{totalOrders}</td>
                  <td>{fmt(revenue.gross_revenue)}</td>
                  <td>—</td>
                  <td style={{ color: 'var(--red)' }}>−{fmt(totalComm)}</td>
                  <td style={{ color: 'var(--green)' }}>{fmt(feeBreak.net_earnings)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Payout history — wired to API */}
          <div className="card">
            <div className="card-hdr">
              <div className="card-title">{t('financials.payout.title')} <em>{t('financials.payout.title_em')}</em></div>
              {payouts.length > 0 && (
                <div className="card-action" onClick={() => {
                  const rows = [['Date','Amount','Status']]
                  payouts.forEach(p => rows.push([
                    fmtDate(p.arrival_date ?? p.created_at),
                    fmt(p.amount),
                    p.status ?? '—'
                  ]))
                  const csv = rows.map(r => r.join(',')).join('\n')
                  const a = document.createElement('a')
                  a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv' }))
                  a.download = 'payout-history.csv'
                  a.click()
                }}>
                  <span className="material-symbols-outlined">download</span>{t('financials.payout.export')}
                </div>
              )}
            </div>

            {/* Payout summary */}
            {(payoutSummary.pending_payout != null || payoutSummary.total_paid != null) && (
              <div className="fin-payout-summary">
                <div className="stat-card fin-payout-stat">
                  <div className="stat-lbl">{t('financials.stats.pending_payout')}</div>
                  <div className="stat-val" style={{ color:'var(--gold)' }}>{fmt(payoutSummary.pending_payout)}</div>
                </div>
                <div className="stat-card fin-payout-stat">
                  <div className="stat-lbl">{t('financials.total_paid')}</div>
                  <div className="stat-val" style={{ color:'var(--green)' }}>{fmt(payoutSummary.total_paid)}</div>
                </div>
              </div>
            )}

            {payoutsLoading ? (
              <div className="empty"><span className="material-symbols-outlined">hourglass_empty</span>{t('common.loading')}</div>
            ) : payouts.length === 0 ? (
              <div className="empty">
                <span className="material-symbols-outlined">account_balance</span>
                {t('financials.no_payouts')}
              </div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t('financials.payout.date')}</th>
                    <th>{t('financials.payout.amount')}</th>
                    <th>{t('financials.payout.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{fmtDate(p.arrival_date ?? p.created_at)}</td>
                      <td style={{ color: 'var(--green)', fontWeight: 600 }}>{fmt(p.amount)}</td>
                      <td><span className={`status ${p.status === 'paid' ? 'active' : 'pending'}`}>{p.status ?? '—'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
