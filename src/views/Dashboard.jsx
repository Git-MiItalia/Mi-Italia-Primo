import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'
import { statusLabel } from '../lib/statusLabel'
import useLangStore from '../store/langStore'

const API = import.meta.env.VITE_API_URL

// Weekday abbreviations in the viewer's language, Monday first. The browser
// supplies these, so they need no translation keys — 1 Jan 2024 was a Monday.
function weekdayLabels(locale) {
  return Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' })
  )
}

export default function Dashboard() {
  const navigate    = useNavigate()
  const { t }       = useTranslation()
  const lang        = useLangStore(s => s.lang)
  // A failed request used to be indistinguishable from a genuinely quiet day —
  // both rendered em-dashes. Each result is now stamped with the request it
  // answered, so "still loading" is simply "the answer I hold isn't for the
  // request I'm on" — no setState in the effect body to flip a loading flag.
  const [reloadTick, setReloadTick] = useState(0)
  const reload = () => setReloadTick(n => n + 1)
  const reqKey = `${lang}:${reloadTick}`

  const [statsReq, setStatsReq] = useState({ key: null, data: null, failed: false })
  const [resReq,   setResReq]   = useState({ key: null, list: [], total: 0, expiringSoon: 0, failed: false })

  const statsLoading = statsReq.key !== reqKey
  const resLoading   = resReq.key   !== reqKey
  // Either load failing raises the same banner. The reservations call used to
  // fall back to an empty list with no flag, so a failure was indistinguishable
  // from a genuinely quiet day — the exact bug the stats call already guards.
  const failed       = (statsReq.failed && statsReq.key === reqKey) ||
                       (resReq.failed   && resReq.key   === reqKey)
  const data         = statsReq.key === reqKey ? statsReq.data : null
  const activeRes    = resReq

  useEffect(() => {
    let cancelled = false
    apiFetch(`${API}/boutique/dashboard/stats`)
      .then(r => r.json())
      .then(res => {
        // Every other view checks `success` before trusting `data`; this one
        // didn't, so an error payload silently became an empty dashboard.
        if (!res.success) throw new Error(res.message || 'dashboard/stats failed')
        if (!cancelled) setStatsReq({ key: reqKey, data: res.data, failed: false })
      })
      .catch(() => {
        if (!cancelled) setStatsReq({ key: reqKey, data: null, failed: true })
      })
    return () => { cancelled = true }
  }, [reqKey])

  // The dashboard-stats endpoint's activeReservations/expiringSoon only counts
  // 'confirmed' reservations. "Active" should mean anything not yet collected,
  // expired, or cancelled — i.e. 'pending' + 'confirmed' — so pull those directly.
  //
  // The two list calls are capped at limit=100 each, so they can't be trusted for
  // the headline count. /boutique/reservations/stats returns exact per-status
  // totals ('active' is what the API calls 'confirmed'), so the tile reads from
  // there and the lists are used only for the five rows shown and the 2-hour
  // countdown. expiringSoon is still derived from the capped lists — there is no
  // endpoint exposing it, which is why it's on the backend list.
  useEffect(() => {
    let cancelled = false
    Promise.all([
      apiFetch(`${API}/boutique/reservations/stats`).then(r => r.json()),
      apiFetch(`${API}/boutique/reservations?status=pending&limit=100`).then(r => r.json()),
      apiFetch(`${API}/boutique/reservations?status=confirmed&limit=100`).then(r => r.json()),
    ]).then(([statsRes, pendingRes, confirmedRes]) => {
      const merged = [
        ...(pendingRes.data?.reservations ?? []),
        ...(confirmedRes.data?.reservations ?? []),
      ].sort((a, b) => new Date(a.expires_at) - new Date(b.expires_at))
      const expiringSoon = merged.filter(r => (new Date(r.expires_at) - new Date()) < 7200000).length
      const exactTotal = statsRes?.success
        ? (parseInt(statsRes.data?.pending ?? 0) + parseInt(statsRes.data?.active ?? 0))
        : null
      // An error payload has no .data, so the lists silently became empty.
      const anyFailed = ![statsRes, pendingRes, confirmedRes].every(r => r?.success)
      if (!cancelled) setResReq({
        key: reqKey,
        list: merged.slice(0, 5),
        total: exactTotal ?? merged.length,
        expiringSoon,
        failed: anyFailed,
      })
    })
      .catch(() => {
        if (!cancelled) setResReq({ key: reqKey, list: [], total: 0, expiringSoon: 0, failed: true })
      })
    return () => { cancelled = true }
  }, [reqKey])

  // Ticking clock for the Active Reservations countdown. Only runs while there
  // is something to count down, so an idle dashboard does no work.
  const [nowTick, setNowTick] = useState(new Date())
  const hasCountdown = activeRes.list.some(r => r.expires_at)
  useEffect(() => {
    if (!hasCountdown) return
    const id = setInterval(() => setNowTick(new Date()), 1000)
    return () => clearInterval(id)
  }, [hasCountdown])

  const dayLabels = weekdayLabels(lang)

  // Calendar day in the viewer's own timezone. toISOString() converts to UTC
  // first, so east of Greenwich it returns *yesterday* between local midnight and
  // the UTC offset — which pushed today's bucket out of the 7-day window
  // entirely (today's revenue vanished) and moved the "today" accent bar.
  function localDayKey(d) {
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${d.getFullYear()}-${mm}-${dd}`
  }

  // 'YYYY-MM-DD' parses as UTC midnight, so building a Date from one and reading
  // it back locally can shift the weekday. Construct from the parts instead.
  function dayKeyToDate(key) {
    const [y, m, d] = key.split('-').map(Number)
    return new Date(y, m - 1, d)
  }

  // The endpoint only returns days that HAD revenue, so a quiet Saturday is
  // omitted rather than sent as zero. Plotting that raw drew 4 bars for a
  // 7-day week and made the gaps invisible. Pad to a full week ending today so
  // every day has a bar and a zero day reads as zero.
  function lastSevenDays(rows) {
    const byDay = new Map()
    for (const r of rows) {
      if (!r.day) continue
      // A bare 'YYYY-MM-DD' is already a calendar day — round-tripping it through
      // Date would re-introduce the same UTC shift the keys above avoid.
      const key = typeof r.day === 'string' && /^\d{4}-\d{2}-\d{2}/.test(r.day)
        ? r.day.slice(0, 10)
        : localDayKey(new Date(r.day))
      byDay.set(key, parseFloat(r.revenue ?? 0))
    }
    const today = new Date()
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today)
      d.setDate(today.getDate() - (6 - i))
      const key = localDayKey(d)
      return { day: key, revenue: byDay.get(key) ?? 0, isToday: i === 6 }
    })
  }

  const stats              = data?.stats              ?? {}
  const recentOrders       = data?.recentOrders       ?? []
  const rawChart           = data?.revenueChart       ?? []
  const looksActivity      = data?.looksActivity      ?? {}

  const revenueChart = rawChart.length ? lastSevenDays(rawChart) : []
  const maxRevenue = Math.max(...revenueChart.map(d => d.revenue), 1)

  // The API sends one alert per variant, and one banner each pushed the KPI
  // cards below the fold — three sizes of one jacket meant three near-identical
  // rows. Collapse to one banner per product per state, so a six-size product
  // costs two lines instead of six. Nothing is hidden: every size still appears.
  const stockAlertGroups = useMemo(() => {
    const groups = new Map()
    // Read from `data` rather than the `lowStockAlerts` fallback above: that
    // expression builds a new [] each render, which would defeat the memo.
    for (const a of (data?.lowStockAlerts ?? [])) {
      const outOfStock = Number(a.stock_qty) === 0
      const key = `${a.product_name}::${outOfStock}`
      if (!groups.has(key)) {
        groups.set(key, { product: a.product_name, outOfStock, sizes: [] })
      }
      groups.get(key).sizes.push({ size: a.size, qty: Number(a.stock_qty) })
    }
    return [...groups.values()]
  }, [data?.lowStockAlerts])

  // `now` comes from the ticking clock above. Reading new Date() in here left
  // the Expires column frozen at whatever it said when the page last rendered.
  function timeLeft(isoDate, now) {
    const diff = new Date(isoDate) - now
    if (diff <= 0) return t('dashboard.expired')
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    // Confirmed pickup windows run for days; "51h 59m" is needlessly long.
    if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`
    return `${h}h ${m}m`
  }

  return (
    <>
      {/* Alerts */}
      {failed && (
        <div className="alert alert-warn">
          <span className="material-symbols-outlined">cloud_off</span>
          <strong>{t('common.error_generic')}</strong>{' '}
          <span className="db-alert-link" onClick={reload}>{t('common.refresh')}</span>
        </div>
      )}
      {activeRes.expiringSoon > 0 && (
        <div className="alert alert-urgent">
          <span className="material-symbols-outlined">priority_high</span>
          <strong>{activeRes.expiringSoon} {t('dashboard.reservations_expiring')}</strong> —{' '}
          <span className="db-alert-link" onClick={() => navigate('/reservations')}>{t('dashboard.view_now')}</span>
        </div>
      )}
      {stockAlertGroups.map((g, i) => (
        <div key={i} className="alert alert-warn">
          <span className="material-symbols-outlined">inventory_2</span>
          <strong>{g.product}</strong> —{' '}
          {g.outOfStock
            ? t('dashboard.out_of_stock_sizes', 'out of stock in {{sizes}}',
                { sizes: g.sizes.map(s => s.size).join(', ') })
            : t('dashboard.low_stock_sizes', 'low stock: {{sizes}}',
                { sizes: g.sizes.map(s => `${s.size} (${s.qty})`).join(', ') })}
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
              {statsLoading ? (
                <tr><td colSpan={4} className="empty">{t('common.loading')}</td></tr>
              ) : recentOrders.length === 0 ? (
                <tr><td colSpan={4} className="empty">{t('dashboard.no_orders')}</td></tr>
              ) : recentOrders.map((o, i) => (
                <tr key={i}>
                  <td className="db-order-id">#{String(o.id).slice(0, 8)}</td>
                  {/* A dash reads as missing data. These are till sales with no
                      customer attached, so say so — same wording as Orders. */}
                  <td>{o.customer_name ?? o.name ?? <span className="db-guest">{t('dashboard.table.guest', 'Guest')}</span>}</td>
                  <td>€{o.gross_amount}</td>
                  <td><span className={`status ${o.status}`}>{statusLabel(t, o.status)}</span></td>
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
              {resLoading ? (
                <tr><td colSpan={5} className="empty">{t('common.loading')}</td></tr>
              ) : activeRes.list.length === 0 ? (
                <tr><td colSpan={5} className="empty">{t('dashboard.no_reservations')}</td></tr>
              ) : activeRes.list.map((r) => {
                const urgent = (new Date(r.expires_at) - nowTick) < 7200000
                return (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>{r.product_name}{r.size_label ? ` · ${r.size_label}` : ''}{r.colour ? ` · ${r.colour}` : ''}</td>
                    <td className={urgent ? 'db-urgent' : ''}>{timeLeft(r.expires_at, nowTick)}</td>
                    <td><span className={`status ${r.status}`}>{statusLabel(t, r.status)}</span></td>
                    <td>
                      {/* Pass the id, not the bare tab. Reservations already
                          resolves /reservations/:id by searching every status
                          list and switching to whichever tab holds it — so a
                          confirmed reservation lands on Confirmed instead of
                          always dumping the user on the default tab. */}
                      <button className="btn btn-sm btn-outline" onClick={() => navigate(`/reservations/${r.id}`)}>
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
                {dayLabels.map((_, i) => (
                  <div key={i} className="db-chart-bar-wrap">
                    <div className="db-chart-bar" style={{ height:'20%', opacity:0.15 }} />
                  </div>
                ))}
              </div>
              <div className="db-chart-labels">
                {dayLabels.map((d, i) => <span key={i}>{d}</span>)}
              </div>
              <div className="db-chart-no-data">
                {statsLoading ? t('common.loading') : t('dashboard.no_revenue', 'No revenue data yet')}
              </div>
            </div>
          ) : (
            <>
              <div className="db-chart-bars">
                {revenueChart.map((d) => {
                  const pct = ((d.revenue / maxRevenue) * 100).toFixed(1)
                  return (
                    <div key={d.day} className="db-chart-bar-wrap" title={`€${d.revenue.toFixed(2)}`}>
                      <div className={`db-chart-bar${d.isToday ? ' accent' : ''}`} style={{ height:`${pct}%` }} />
                    </div>
                  )
                })}
              </div>
              <div className="db-chart-labels">
                {revenueChart.map((d) => (
                  <span key={d.day}>{dayKeyToDate(d.day).toLocaleDateString(lang, { weekday:'short' })}</span>
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
