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

const PERIODS = [
  { value:'mtd',        label:'This Month (MTD)'  },
  { value:'last_month', label:'Last Month'         },
  { value:'last_3',     label:'Last 3 Months'      },
  { value:'this_year',  label:'This Year'          },
]

export default function Financials() {
  const navigate    = useNavigate()
  const { t }       = useTranslation()

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

  const channels = [
    {
      label:  'Ship (Ecommerce)',
      orders: revenue.ecommerce?.orders      ?? 0,
      gross:  revenue.ecommerce?.amount      ?? 0,
      rate:   fees.ecommerce_commission?.rate ?? 0,
      comm:   fees.ecommerce_commission?.amount ?? 0,
    },
    {
      label:  'Reserve & Pickup',
      orders: revenue.reserve_pickup?.orders ?? 0,
      gross:  revenue.reserve_pickup?.amount ?? 0,
      rate:   0, // no commission on pickup
      comm:   0,
    },
    {
      label:  'POS (In-Store)',
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
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:14 }}>
        <select className="form-select" style={{ maxWidth:200 }} value={period} onChange={e => setPeriod(e.target.value)}>
          {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>

      {/* ── Stripe + Plan strip ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: 'var(--white)', borderRadius: 0, boxShadow: 'var(--shadow)' }}>
          <div style={{ width: 38, height: 38, borderRadius: 0, background: '#635BFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span className="material-symbols-outlined" style={{ color: 'white', fontSize: 18 }}>
              {stripeConnected ? 'link' : 'link_off'}
            </span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>
              Stripe Connect — {stripeConnected ? 'Active' : 'Not Connected'}
            </div>
            <div style={{ fontSize: 9, color: 'var(--stone)' }}>
              {stripeConnected
                ? 'Sales revenue deposited automatically · commissions deducted'
                : 'Connect your Stripe account to receive payments'}
            </div>
          </div>
          {stripeConnected && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 9, color: 'var(--stone)' }}>Account ID</div>
              <div style={{ fontSize: 11, fontWeight: 600, fontFamily: 'monospace' }}>{stripe.account_id ?? '—'}</div>
            </div>
          )}
          <span className={`status ${stripeConnected ? 'active' : 'cancelled'}`}>
            {loading ? '—' : stripeConnected ? 'Connected' : 'Not Connected'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', background: 'var(--white)', borderRadius: 0, boxShadow: 'var(--shadow)' }}>
          <div style={{ width: 38, height: 38, borderRadius: 0, background: 'linear-gradient(135deg,var(--deep),#2E2112)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--gold)', fontSize: 18 }}>workspace_premium</span>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>
              {kpis.monthly_platform_fee?.plan
                ? kpis.monthly_platform_fee.plan.charAt(0).toUpperCase() + kpis.monthly_platform_fee.plan.slice(1) + ' Plan'
                : 'Connect Plan'}
            </div>
            <div style={{ fontSize: 9, color: 'var(--stone)' }}>
              {kpis.monthly_platform_fee?.amount > 0
                ? `${fmt(kpis.monthly_platform_fee.amount)}/month`
                : 'Commission-based · no monthly fee'}
            </div>
          </div>
          <button className="btn btn-sm btn-outline" onClick={() => navigate('/subscription')}>Manage</button>
        </div>
      </div>

      {/* ── 5 stat cards ── */}
      <div className="stat-row col5">
        <div className="stat-card">
          <div className="stat-lbl">Gross Sales</div>
          <div className="stat-val">{loading ? '—' : fmt(kpis.gross_sales?.amount)}</div>
          {kpis.gross_sales?.change_pct != null && (
            <div className={`stat-change ${kpis.gross_sales.change_pct >= 0 ? 'up' : 'dn'}`}>
              {kpis.gross_sales.change_pct >= 0 ? '↑' : '↓'} {Math.abs(kpis.gross_sales.change_pct).toFixed(0)}%
            </div>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-lbl">Monthly Platform Fee</div>
          <div className="stat-val" style={{ color: 'var(--red)' }}>
            {loading ? '—' : kpis.monthly_platform_fee?.amount > 0 ? `−${fmt(kpis.monthly_platform_fee.amount)}` : '€0'}
          </div>
          <div className="stat-change nu">
            {kpis.monthly_platform_fee?.plan
              ? kpis.monthly_platform_fee.plan.charAt(0).toUpperCase() + kpis.monthly_platform_fee.plan.slice(1) + ' Plan'
              : '—'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">Sales Commission</div>
          <div className="stat-val" style={{ color: 'var(--red)' }}>
            {loading ? '—' : `−${fmt(kpis.sales_commission?.amount)}`}
          </div>
          <div className="stat-change nu">
            Ecom {fmtPct(kpis.sales_commission?.ecom_rate)} · POS {fmtPct(kpis.sales_commission?.pos_rate)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">Net Earnings</div>
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
          <div className="stat-lbl">Pending Payout</div>
          <div className="stat-val" style={{ color: 'var(--gold)' }}>
            {loading ? '—' : fmt(kpis.pending_payout?.amount)}
          </div>
          <div className="stat-change nu">
            {kpis.pending_payout?.next_payout_date
              ? `Next: ${new Date(kpis.pending_payout.next_payout_date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}`
              : 'No payout scheduled'}
          </div>
        </div>
      </div>

      <div className="grid2">

        {/* ── Fee breakdown ── */}
        <div className="card">
          <div className="card-hdr">
            <div className="card-title">Fee <em>Breakdown</em></div>
          </div>

          <div className="fee-breakdown">
            <div className="fin-fee-sec-lbl">Revenue</div>
            <div className="fee-row">
              <div className="fee-label">Ecommerce sales ({revenue.ecommerce?.orders ?? 0} orders)</div>
              <div className="fee-val">{fmt(revenue.ecommerce?.amount)}</div>
            </div>
            <div className="fee-row">
              <div className="fee-label">Reserve & Pickup ({revenue.reserve_pickup?.orders ?? 0} orders)</div>
              <div className="fee-val">{fmt(revenue.reserve_pickup?.amount)}</div>
            </div>
            <div className="fee-row">
              <div className="fee-label">In-store POS ({revenue.in_store_pos?.orders ?? 0} transactions)</div>
              <div className="fee-val">{fmt(revenue.in_store_pos?.amount)}</div>
            </div>
            <div className="fee-row" style={{ borderTop: '2px solid var(--mist)', marginTop: 4, paddingTop: 10 }}>
              <div className="fee-label"><strong>Gross Revenue</strong></div>
              <div className="fee-val total">{fmt(revenue.gross_revenue)}</div>
            </div>
          </div>

          <div className="fee-breakdown">
            <div className="fin-fee-sec-lbl">Mi Italia Fees</div>
            <div className="fee-row">
              <div className="fee-label">
                <strong>Monthly platform fee</strong><br />
                <span style={{ fontSize: 9 }}>
                  {kpis.monthly_platform_fee?.plan ?? 'Connect'} Plan
                  {fees.monthly_platform_fee?.due_date
                    ? ` · due ${new Date(fees.monthly_platform_fee.due_date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}`
                    : ''}
                </span>
              </div>
              <div className="fee-val debit">
                {fees.monthly_platform_fee?.amount > 0 ? `−${fmt(fees.monthly_platform_fee.amount)}` : '€0'}
              </div>
            </div>
            <div className="fee-row">
              <div className="fee-label">
                <strong>Ecommerce commission</strong><br />
                <span style={{ fontSize: 9 }}>
                  {fmtPct(fees.ecommerce_commission?.rate)} on {fmt(fees.ecommerce_commission?.applied_on)}
                </span>
              </div>
              <div className="fee-val debit">−{fmt(fees.ecommerce_commission?.amount)}</div>
            </div>
            <div className="fee-row">
              <div className="fee-label">
                <strong>POS commission</strong><br />
                <span style={{ fontSize: 9 }}>
                  {fmtPct(fees.pos_commission?.rate)} on {fmt(fees.pos_commission?.applied_on)}
                </span>
              </div>
              <div className="fee-val debit">−{fmt(fees.pos_commission?.amount)}</div>
            </div>
            <div className="fee-row" style={{ borderTop: '2px solid var(--mist)', marginTop: 4, paddingTop: 10 }}>
              <div className="fee-label"><strong>Total Fees</strong></div>
              <div className="fee-val debit">−{fmt(fees.total_fees)}</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'linear-gradient(135deg,var(--deep),#2E2112)', borderRadius: 0}}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--cream)' }}>Net Earnings</div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 600, color: 'var(--gold)' }}>
              {fmt(feeBreak.net_earnings)}
            </div>
          </div>
        </div>

        {/* ── Right column ── */}
        <div>

          {/* Sales by channel */}
          <div className="card">
            <div className="card-hdr">
              <div className="card-title">Sales by <em>Channel</em></div>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Channel</th>
                  <th>Orders</th>
                  <th>Gross</th>
                  <th>Rate</th>
                  <th>Comm.</th>
                  <th>Net</th>
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
                <tr style={{ background: 'var(--card)', fontWeight: 600 }}>
                  <td>Total</td>
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
              <div className="card-title">Payout <em>History</em></div>
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
                  <span className="material-symbols-outlined">download</span>Export CSV
                </div>
              )}
            </div>

            {/* Payout summary */}
            {(payoutSummary.pending_payout != null || payoutSummary.total_paid != null) && (
              <div style={{ display:'flex', gap:12, marginBottom:12 }}>
                <div className="stat-card" style={{ flex:1 }}>
                  <div className="stat-lbl">Pending Payout</div>
                  <div className="stat-val" style={{ color:'var(--gold)' }}>{fmt(payoutSummary.pending_payout)}</div>
                </div>
                <div className="stat-card" style={{ flex:1 }}>
                  <div className="stat-lbl">Total Paid Out</div>
                  <div className="stat-val" style={{ color:'var(--green)' }}>{fmt(payoutSummary.total_paid)}</div>
                </div>
              </div>
            )}

            {payoutsLoading ? (
              <div className="empty"><span className="material-symbols-outlined">hourglass_empty</span>Loading…</div>
            ) : payouts.length === 0 ? (
              <div className="empty">
                <span className="material-symbols-outlined">account_balance</span>
                No payouts yet
              </div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Status</th>
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
