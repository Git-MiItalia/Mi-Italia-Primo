import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'
import useLangStore from '../store/langStore'

const API = import.meta.env.VITE_API_URL

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function Dashboard() {
  const navigate    = useNavigate()
  const { t }       = useTranslation()
  const lang        = useLangStore(s => s.lang)
  const [data, setData] = useState(null)
  const [activeRes, setActiveRes] = useState({ list: [], total: 0, expiringSoon: 0 })

  useEffect(() => {
    apiFetch(`${API}/boutique/dashboard/stats`)
      .then(r => r.json())
      .then(res => setData(res.data))
  }, [lang])

  // The dashboard-stats endpoint's activeReservations/expiringSoon only counts
  // 'confirmed' reservations. "Active" should mean anything not yet collected,
  // expired, or cancelled — i.e. 'pending' + 'confirmed' — so pull those directly.
  useEffect(() => {
    Promise.all([
      apiFetch(`${API}/boutique/reservations?status=pending&limit=100`).then(r => r.json()),
      apiFetch(`${API}/boutique/reservations?status=confirmed&limit=100`).then(r => r.json()),
    ]).then(([pendingRes, confirmedRes]) => {
      const merged = [
        ...(pendingRes.data?.reservations ?? []),
        ...(confirmedRes.data?.reservations ?? []),
      ].sort((a, b) => new Date(a.expires_at) - new Date(b.expires_at))
      const expiringSoon = merged.filter(r => (new Date(r.expires_at) - new Date()) < 7200000).length
      setActiveRes({ list: merged.slice(0, 5), total: merged.length, expiringSoon })
    })
  }, [lang])

  const stats              = data?.stats              ?? {}
  const recentOrders       = data?.recentOrders       ?? []
  const lowStockAlerts     = data?.lowStockAlerts     ?? []
  const revenueChart       = data?.revenueChart       ?? []
  const looksActivity      = data?.looksActivity      ?? {}

  const maxRevenue = Math.max(...revenueChart.map(d => parseFloat(d.revenue ?? 0)), 1)

  function timeLeft(isoDate) {
    const diff = new Date(isoDate) - new Date()
    if (diff <= 0) return t('dashboard.expired')
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    return `${h}h ${m}m`
  }

  return (
    <>
      {/* Alerts */}
      {activeRes.expiringSoon > 0 && (
        <div className="alert alert-urgent">
          <span className="material-symbols-outlined">priority_high</span>
          <strong>{activeRes.expiringSoon} {t('dashboard.reservations_expiring')}</strong> —{' '}
          <span className="db-alert-link" onClick={() => navigate('/reservations')}>{t('dashboard.view_now')}</span>
        </div>
      )}
      {lowStockAlerts.map((item, i) => (
        <div key={i} className="alert alert-warn">
          <span className="material-symbols-outlined">inventory_2</span>
          <strong>{item.product_name} · Size {item.size}</strong> —{' '}
          {item.stock_qty === 0 ? t('dashboard.out_of_stock') : t('dashboard.units_remaining', { count: item.stock_qty })}
        </div>
      ))}

      {/* Stats row */}
      <div className="stat-row">
        <div className="stat-card">
          <div className="stat-lbl">{t('dashboard.todays_revenue')}</div>
          <div className="stat-val">€{stats.todayRevenue ?? '—'}</div>
          {/* Today's Revenue change */}
          {stats.todayRevenueChangePct != null && (
            <div className={`stat-change ${stats.todayRevenueChangePct >= 0 ? 'up' : 'dn'}`}>
              {stats.todayRevenueChangePct >= 0 ? '↑' : '↓'} {Math.abs(stats.todayRevenueChangePct)}% {t('dashboard.vs_yesterday', 'vs yesterday')}
            </div>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-lbl">{t('dashboard.active_reservations')}</div>
          <div className="stat-val">{activeRes.total}</div>
          <div className="stat-change">{activeRes.expiringSoon} {t('dashboard.expiring_soon')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">{t('dashboard.products_listed')}</div>
          <div className="stat-val">{stats.totalProducts ?? '—'}</div>
          {/* Products change */}
          {stats.productsAddedThisWeek != null && (
            <div className={`stat-change ${stats.productsAddedThisWeek >= 0 ? 'up' : 'dn'}`}>
              {stats.productsAddedThisWeek >= 0 ? '↑' : '↓'} {Math.abs(stats.productsAddedThisWeek)} {t('dashboard.this_week', 'this week')}
            </div>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-lbl">{t('dashboard.pickup_rate')}</div>
          <div className="stat-val">{stats.pickupRate != null ? `${stats.pickupRate}%` : '—'}</div>
          {/* Pickup rate change */}
          {stats.pickupRateChangePts != null && (
            <div className={`stat-change ${stats.pickupRateChangePts >= 0 ? 'up' : 'dn'}`}>
              {stats.pickupRateChangePts >= 0 ? '↑' : '↓'} {Math.abs(stats.pickupRateChangePts)}pts {t('dashboard.this_month', 'this month')}
            </div>
          )}
        </div>
      </div>

      {/* Recent orders + active reservations */}
      <div className="grid2">
        <div className="card">
          <div className="card-hdr">
            <div className="card-title">{t('dashboard.recent')} <em>{t('dashboard.orders')}</em></div>
            <div className="card-action" onClick={() => navigate('/orders')}>
              {t('dashboard.view_all')} <span className="material-symbols-outlined">arrow_forward</span>
            </div>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('dashboard.table.order')}</th>
                <th>{t('dashboard.table.customer')}</th>
                <th>{t('dashboard.table.amount')}</th>
                <th>{t('dashboard.table.status')}</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr><td colSpan={4} className="empty">{t('dashboard.no_orders')}</td></tr>
              ) : recentOrders.map((o, i) => (
                <tr key={i}>
                  <td className="db-order-id">#{String(o.id).slice(0, 8)}</td>
                  <td>{o.customer_name ?? '—'}</td>
                  <td>€{o.gross_amount}</td>
                  <td><span className={`status ${o.status}`}>{o.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-hdr">
            <div className="card-title">{t('dashboard.active')} <em>{t('dashboard.reservations')}</em></div>
            <div className="card-action" onClick={() => navigate('/reservations')}>
              {t('dashboard.view_all')} <span className="material-symbols-outlined">arrow_forward</span>
            </div>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('dashboard.table.customer')}</th>
                <th>{t('dashboard.table.item')}</th>
                <th>{t('dashboard.table.expires')}</th>
                <th>{t('dashboard.table.status')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {activeRes.list.length === 0 ? (
                <tr><td colSpan={5} className="empty">{t('dashboard.no_reservations')}</td></tr>
              ) : activeRes.list.map((r) => {
                const urgent = (new Date(r.expires_at) - new Date()) < 7200000
                return (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>{r.product_name}{r.size_label ? ` · ${r.size_label}` : ''}{r.colour ? ` · ${r.colour}` : ''}</td>
                    <td className={urgent ? 'db-urgent' : ''}>{timeLeft(r.expires_at)}</td>
                    <td><span className={`status ${r.status}`}>{r.status}</span></td>
                    <td>
                      <button className="btn btn-sm btn-outline" onClick={() => navigate('/reservations')}>
                        {t('dashboard.view')}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revenue chart + Looks Feed */}
      <div className="grid2">
        <div className="card">
          <div className="card-hdr">
            <div className="card-title">{t('dashboard.revenue', 'Revenue')} <em>{t('dashboard.this_week', 'this week')}</em></div>
          </div>
          {revenueChart.length === 0 ? (
            <div className="db-chart-empty">
              <div className="db-chart-bars">
                {DAYS.map(d => (
                  <div key={d} className="db-chart-bar-wrap">
                    <div className="db-chart-bar" style={{ height:'20%', opacity:0.15 }} />
                  </div>
                ))}
              </div>
              <div className="db-chart-labels">
                {DAYS.map(d => <span key={d}>{d}</span>)}
              </div>
              <div className="db-chart-no-data">{t('dashboard.no_revenue', 'No revenue data yet')}</div>
            </div>
          ) : (
            <>
              <div className="db-chart-bars">
                {revenueChart.map((d, i) => {
                  const pct     = ((parseFloat(d.revenue ?? 0) / maxRevenue) * 100).toFixed(1)
                  const isToday = i === revenueChart.length - 1
                  return (
                    <div key={i} className="db-chart-bar-wrap" title={`€${d.revenue}`}>
                      <div className={`db-chart-bar${isToday ? ' accent' : ''}`} style={{ height:`${pct}%` }} />
                    </div>
                  )
                })}
              </div>
              <div className="db-chart-labels">
                {revenueChart.map((d, i) => (
                  <span key={i}>{d.day ? new Date(d.day).toLocaleDateString('en', { weekday:'short' }) : DAYS[i]}</span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="card">
          <div className="card-hdr">
            <div className="card-title">{t('dashboard.looks_feed', 'Looks Feed')} <em>{t('dashboard.looks_feed_em', 'activity')}</em></div>
          </div>
          <div className="grid2" style={{ gap:10, marginBottom:0 }}>
            {[
              { val: looksActivity.communityLooks ?? '—', label:t('dashboard.community_looks', 'Community Looks'),  color:'var(--deep)'  },
              { val: looksActivity.salesFromLooks ?? '—', label:t('dashboard.sales_from_looks', 'Sales from Looks'), color:'var(--green)' },
              { val: looksActivity.tryOns30d      ?? '—', label:t('dashboard.tryons_30d', 'Try-Ons (30d)'),    color:'var(--deep)'  },
              { val: looksActivity.looksRevenue != null ? `€${looksActivity.looksRevenue}` : '—', label:t('dashboard.looks_revenue', 'Looks Revenue'), color:'var(--gold)' },
            ].map(item => (
              <div key={item.label} className="db-looks-tile">
                <div className="db-looks-val" style={{ color:item.color }}>{item.val}</div>
                <div className="db-looks-lbl">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
