import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'

const API = import.meta.env.VITE_API_URL

const CHANNEL_LABELS = {
  ship:   'Ship (Ecommerce)',
  pickup: 'Reserve & Pickup',
  pos:    'POS',
}

export default function Analytics() {
  const { t } = useTranslation()
  const [data,    setData]    = useState(null)
  const [days,    setDays]    = useState(30)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiFetch(`${API}/boutique/analytics?days=${days}`)
      .then(r => r.json())
      .then(res => { if (res.success) setData(res.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [days])

  const stats          = data?.stats          ?? {}
  const revenueChart   = data?.revenueChart   ?? []
  const topProducts    = data?.topProducts    ?? []
  const trafficSources = data?.trafficSources ?? []
  const salesByChannel = data?.salesByChannel ?? []

  const maxRevenue = Math.max(...revenueChart.map(d => parseFloat(d.revenue ?? 0)), 1)

  return (
    <>
      {/* Day range selector */}
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:14, gap:6 }}>
        {[7, 30, 90].map(d => (
          <button
            key={d}
            className={`btn btn-sm ${days === d ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setDays(d)}
          >
            {d}d
          </button>
        ))}
      </div>

      <div className="stat-row">
        <div className="stat-card">
          <div className="stat-lbl">{t('analytics.total_views')}</div>
          <div className="stat-val">{loading ? '—' : (stats.totalViews ?? 0).toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">{t('analytics.favorites')}</div>
          <div className="stat-val">{loading ? '—' : (stats.favorites ?? 0).toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">{t('analytics.conversion_rate')}</div>
          <div className="stat-val">{loading ? '—' : stats.conversionRate != null ? `${stats.conversionRate}%` : '—'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">{t('analytics.avg_order_value')}</div>
          <div className="stat-val">{loading ? '—' : stats.avgOrderValue != null ? `€${parseFloat(stats.avgOrderValue).toFixed(2)}` : '—'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">Orders</div>
          <div className="stat-val">{loading ? '—' : (stats.orderCount ?? 0).toLocaleString()}</div>
        </div>
      </div>

      <div className="grid2">
        {/* Revenue chart */}
        <div className="card">
          <div className="card-hdr">
            <div className="card-title">{t('analytics.revenue')} <em>{days} days</em></div>
          </div>
          {revenueChart.length === 0 ? (
            <div className="empty" style={{ padding:'40px 0' }}>
              <span className="material-symbols-outlined">bar_chart</span>
              No revenue data yet
            </div>
          ) : (
            <div className="chart-area">
              {revenueChart.map((d, i) => {
                const pct    = ((parseFloat(d.revenue ?? 0) / maxRevenue) * 100).toFixed(1)
                const isLast = i === revenueChart.length - 1
                const label  = new Date(d.day).toLocaleDateString('en', { month:'short', day:'numeric' })
                return (
                  <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', flex:1, height:'100%', justifyContent:'flex-end', gap:4 }}>
                    <div
                      className={`chart-bar${isLast ? ' accent' : ''}`}
                      style={{ height:`${pct}%`, width:'100%' }}
                      title={`${label} · €${parseFloat(d.revenue).toLocaleString('en', { minimumFractionDigits:2, maximumFractionDigits:2 })}`}
                    />
                    <div style={{ fontSize:9, color:'var(--stone)', whiteSpace:'nowrap', textAlign:'center' }}>{label}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Top products */}
        <div className="card">
          <div className="card-hdr">
            <div className="card-title">{t('analytics.top')} <em>{t('analytics.products')}</em></div>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('analytics.table.product')}</th>
                <th>{t('analytics.table.views')}</th>
                <th>{t('analytics.table.tryons')}</th>
                <th>Units</th>
                <th>{t('analytics.table.revenue')}</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.length === 0 ? (
                <tr><td colSpan={5} className="empty">No product data yet</td></tr>
              ) : topProducts.map((p, i) => (
                <tr key={i}>
                  <td className="an-product-name">{p.name ?? '—'}</td>
                  <td>{p.views ?? '—'}</td>
                  <td>{p.tryOns ?? '—'}</td>
                  <td>{p.units ?? '—'}</td>
                  <td className="an-revenue">{p.sales != null ? `€${parseFloat(p.sales).toLocaleString('en', { minimumFractionDigits:2, maximumFractionDigits:2 })}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Traffic sources */}
        <div className="card">
          <div className="card-hdr">
            <div className="card-title">{t('analytics.traffic')} <em>{t('analytics.sources')}</em></div>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('analytics.table.source')}</th>
                <th>{t('analytics.table.visitors')}</th>
                <th>{t('analytics.table.conv')}</th>
              </tr>
            </thead>
            <tbody>
              {trafficSources.length === 0 ? (
                <tr><td colSpan={3} className="empty">No traffic data yet</td></tr>
              ) : trafficSources.map((s, i) => (
                <tr key={i}>
                  <td>{s.source ?? '—'}</td>
                  <td>{s.visitors != null ? s.visitors.toLocaleString() : '—'}</td>
                  <td className={s.conversionRate >= 4 ? 'an-conv-high' : ''}>
                    {s.conversionRate != null ? `${s.conversionRate}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Sales by channel */}
        <div className="card">
          <div className="card-hdr">
            <div className="card-title">{t('analytics.sales')} <em>{t('analytics.by_channel')}</em></div>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('analytics.table.channel')}</th>
                <th>{t('analytics.table.orders')}</th>
                <th>{t('analytics.table.revenue')}</th>
              </tr>
            </thead>
            <tbody>
              {salesByChannel.length === 0 ? (
                <tr><td colSpan={3} className="empty">No sales data yet</td></tr>
              ) : salesByChannel.map((c, i) => (
                <tr key={i}>
                  <td>{CHANNEL_LABELS[c.channel] ?? c.channel ?? '—'}</td>
                  <td>{c.orders ?? '—'}</td>
                  <td className="an-revenue">
                    {c.revenue != null ? `€${parseFloat(c.revenue).toLocaleString('en', { minimumFractionDigits:2, maximumFractionDigits:2 })}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
