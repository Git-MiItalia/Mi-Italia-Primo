import { useState,useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { statusLabel } from '../lib/statusLabel'
import { isWhatsappEnabled } from '../lib/auth'
import Toast, { useToast } from '../components/ui/Toast'
import useNotifStore from '../store/notifStore'
import useLangStore from '../store/langStore'
import { generatePackingSlip } from '../lib/packingSlip'
import i18n from '../lib/i18n'

const API = import.meta.env.VITE_API_URL
const STATUS_TABS = ['all', 'pending', 'processing', 'shipped', 'delivered', 'cancelled']

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' }) +
    ' · ' + new Date(iso).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })
}

/* ── Status confirm modal ── */
function StatusConfirmModal({ open, onClose, onConfirm, currentStatus, newStatus, submitting }) {
  const { t } = useTranslation()
  if (!open) return null
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <div className="modal-title">{t('orders.confirm_status.title')}</div>
          <button className="modal-close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="modal-intro">
          {t('orders.confirm_status.from', 'Change order status from')}{' '}
          <span className={`status ${currentStatus}`}>{statusLabel(t, currentStatus)}</span>
          {' '}{t('orders.confirm_status.to', 'to')}{' '}
          <span className={`status ${newStatus}`}>{statusLabel(t, newStatus)}</span>?
        </div>
        <div className="modal-footer">
          <button className="btn btn-dark" onClick={onClose} disabled={submitting}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={onConfirm} disabled={submitting}>
            <span className="material-symbols-outlined">check_circle</span>
            {submitting ? t('orders.confirm_status.updating', 'Updating…') : t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Order timeline ── */
function OrderTimeline({ order }) {
  const { t } = useTranslation()
  const status = order?.status ?? ''
  const tracked = !!order?.dhl_tracking_number
  const done = t('orders.timeline.done', 'Done')

  const STEPS = [
    {
      key:   'placed',
      title: t('orders.timeline.placed', 'Order Placed'),
      sub:   order
        ? t('orders.timeline.placed_sub', '{{method}} confirmed · €{{amount}}', {
            method: order.payment_method ?? t('orders.timeline.payment', 'Payment'),
            amount: order.gross_amount,
          })
        : '',
      icon:  'check_circle',
      time:  fmtDateTime(order?.created_at),
      done:  true,
    },
    {
      key:   'processing',
      title: t('orders.timeline.processing', 'Processing'),
      sub:   t('orders.timeline.processing_sub', 'Boutique notified · preparing your order'),
      icon:  'inventory_2',
      time:  ['processing','shipped','delivered'].includes(status) ? done : '—',
      done:  ['processing','shipped','delivered'].includes(status),
      pending: status === 'pending',
    },
    {
      key:   'dhl',
      title: tracked
        ? t('orders.timeline.dhl_tracked', 'DHL · {{tracking}}', { tracking: order.dhl_tracking_number })
        : t('orders.timeline.dhl_pending', 'DHL Label — Pending'),
      sub:   tracked
        ? t('orders.timeline.dhl_status', 'Status: {{status}}', {
            status: order.dhl_status ?? t('orders.timeline.in_transit', 'In transit'),
          })
        : t('orders.timeline.dhl_generate', 'Generate label to continue'),
      icon:  'local_shipping',
      time:  tracked ? t('orders.timeline.generated', 'Generated') : t('orders.timeline.now', 'Now'),
      done:  tracked,
      pending: !tracked && ['processing','shipped'].includes(status),
    },
    {
      key:   'shipped',
      title: t('orders.timeline.shipped', 'Shipped'),
      sub:   t('orders.timeline.shipped_sub', 'DHL pickup or drop-off'),
      icon:  'local_shipping',
      time:  ['shipped','delivered'].includes(status) ? done : '—',
      done:  ['shipped','delivered'].includes(status),
    },
    {
      key:   'delivered',
      title: t('orders.timeline.delivered', 'Delivered'),
      sub:   t('orders.timeline.delivered_sub', 'Order completed'),
      icon:  'inventory',
      time:  status === 'delivered' ? done : '—',
      done:  status === 'delivered',
    },
  ]

  return (
    <ul className="timeline">
      {STEPS.map((s, i) => {
        const dotCls = s.done ? 'done' : s.pending ? 'pending' : 'todo'
        return (
          <li key={i} className="timeline-item">
            <div className={`timeline-dot ${dotCls}`}>
              <span className="material-symbols-outlined"
                style={s.done ? { fontVariationSettings: "'FILL' 1" } : {}}>
                {s.icon}
              </span>
            </div>
            <div className="timeline-content">
              <div className="timeline-title">{s.title}</div>
              <div className="timeline-sub">{s.sub}</div>
            </div>
            <div className="timeline-time">{s.time}</div>
          </li>
        )
      })}
    </ul>
  )
}

export default function Orders() {
  const { t } = useTranslation()
  const lang  = useLangStore(s => s.lang)
  // Set when arriving from a notification link (/orders/:id) — that order is
  // opened in the detail panel instead of the first row of the list.
  const { id: routeOrderId } = useParams()
  const navigate = useNavigate()
  const handledRouteIdRef = useRef(null)

  const notifications = useNotifStore(s => s.notifications)
  const markRead      = useNotifStore(s => s.markRead)
  const hasMarkedRead = useRef(false)

  // Unread order notifications — drives the All tab badge
  const unreadOrderNotifs = notifications.filter(n =>
    !n.read_at && !n.is_read && n.type?.toLowerCase() === 'order'
  )
  const totalUnreadOrders = unreadOrderNotifs.length

  const [activeTab,     setActiveTab]     = useState(0)
  const [summary,       setSummary]       = useState({})
  const [orders,        setOrders]        = useState([])
  const [ordersPage,       setOrdersPage]       = useState(1)
  const [ordersTotalPages, setOrdersTotalPages] = useState(1)
  const [selected,      setSelected]      = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [loadFailed,    setLoadFailed]    = useState(false)
  const [trackingInput, setTrackingInput] = useState('')
  const { toasts, show: showToast }       = useToast()

  const [confirmOpen,   setConfirmOpen]   = useState(false)
  const [pendingStatus, setPendingStatus] = useState(null)
  const [submitting,    setSubmitting]    = useState(false)
  const [visitedTabs,   setVisitedTabs]   = useState(new Set([0]))

  // Mark order notifications as read on mount
  useEffect(() => {
    if (hasMarkedRead.current) return
    if (notifications.length === 0) return
    hasMarkedRead.current = true
    notifications
      .filter(n => !n.read_at && !n.is_read && n.type?.toLowerCase().includes('order'))
      .forEach(n => {
        apiFetch(`${API}/boutique/notifications/${n.id}/read`, { method:'PUT', body: JSON.stringify({}) })
        markRead(n.id)
      })
  }, [notifications.length])

  useEffect(() => {
    // Fetch stats for accurate tab counts (full dataset, not paginated)
    apiFetch(`${API}/boutique/orders/stats`)
      .then(r => r.json())
      .then(res => {
        // `res.data.summary` threw outright on an error payload, and nothing
        // checked success — an unhandled rejection that left every tab count
        // at zero with no sign anything had failed.
        if (!res.success || !res.data) throw new Error(res.message || 'orders/stats failed')
        const s        = res.data.summary   ?? {}
        const byStatus = res.data.by_status ?? []
        const count    = st => parseInt(byStatus.find(b => b.status === st)?.count ?? 0)
        setSummary({
          total_orders: parseInt(s.total_orders ?? 0),
          pending:      parseInt(s.pending      ?? 0),
          processing:   parseInt(s.processing   ?? 0),
          shipped:      parseInt(s.shipped      ?? 0),
          delivered:    count('delivered'),
          cancelled:    count('cancelled'),
        })
      })
      // Kept quiet on purpose: the order list below reports the real failure,
      // and two banners for one dead backend is noise. This exists so the
      // rejection is handled rather than escaping.
      .catch(() => {})

  }, [lang])

  function refetchOrders(tabIndex, targetPage) {
    setLoading(true)
    const params = new URLSearchParams({ page: String(targetPage), limit: '20' })
    const status = STATUS_TABS[tabIndex]
    if (status !== 'all') params.set('status', status)
    setLoadFailed(false)
    apiFetch(`${API}/boutique/orders?${params.toString()}`)
      .then(r => r.json())
      .then(res => {
        // `res.data.orders` threw on an error payload, nothing checked
        // success, and setLoading(false) lived inside this .then — so a failed
        // request left the tab on "Loading…" permanently.
        if (!res.success || !res.data) throw new Error(res.message || 'orders request failed')
        const list = res.data.orders ?? []
        setOrders(list)
        setOrdersPage(targetPage)
        setOrdersTotalPages(res.data.pagination?.total_pages ?? 1)
        // With an order id in the URL the detail panel is driven by the route
        // effect below, so don't override it with the first row.
        if (routeOrderId) { /* handled by the route effect */ }
        else if (list.length > 0) fetchDetail(list[0].id)
        else setSelected(null)
      })
      .catch(() => {
        setOrders([])
        setSelected(null)
        setOrdersTotalPages(1)
        setLoadFailed(true)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    refetchOrders(activeTab, 1)
  }, [lang, activeTab])

  // Open the order named in the URL. Runs on arrival and again if a second
  // notification is clicked while this page is already open.
  useEffect(() => {
    if (!routeOrderId || handledRouteIdRef.current === routeOrderId) return
    handledRouteIdRef.current = routeOrderId
    fetchDetail(routeOrderId)
  }, [routeOrderId])

  // Any list interaction drops back to /orders so the URL stops pinning one
  // order and normal first-row selection resumes.
  function clearRouteOrderId() {
    if (routeOrderId) navigate('/orders', { replace: true })
  }

  function goToOrdersPage(p) {
    if (p < 1 || p > ordersTotalPages) return
    clearRouteOrderId()
    refetchOrders(activeTab, p)
  }

  function handleTabClick(i) {
    clearRouteOrderId()
    setActiveTab(i)
    setVisitedTabs(prev => new Set([...prev, i]))
    // Mark all unread order notifications as read when All tab is opened
    if (i === 0) {
      unreadOrderNotifs.forEach(n => {
        apiFetch(`${API}/boutique/notifications/${n.id}/read`, { method:'PUT', body: JSON.stringify({}) })
        markRead(n.id)
      })
    }
  }

  function fetchDetail(id) {
    apiFetch(`${API}/boutique/orders/${id}`)
      .then(r => r.json())
      .then(res => {
        const order = res.data
        setSelected(order)
        setTrackingInput(order.dhl_tracking_number ?? '')

        // POS sales link the shopper through `customer_id`, but the order
        // endpoint fills name/email/phone from `user_id` only — so a walk-in
        // with a customer attached still arrives nameless and reads "Guest".
        // Look the customer up directly rather than lose the name. One extra
        // request, and only when there is genuinely a customer to resolve.
        // (The list keeps showing "Guest" until the join is fixed server-side;
        //  resolving it per row would be one request per order.)
        if (!order?.name && order?.customer_id) {
          apiFetch(`${API}/boutique/customers/${order.customer_id}`)
            .then(r => r.json())
            .then(cres => {
              if (!cres?.success) return
              const c = cres.data?.customer ?? cres.data ?? {}
              if (!c.name && !c.email && !c.phone) return
              setSelected(prev => (prev?.id === order.id
                ? { ...prev, name: c.name ?? prev.name, email: c.email ?? prev.email, phone: c.phone ?? prev.phone }
                : prev))
            })
            .catch(() => { /* keep "Guest" — the order is still usable */ })
        }
      })
  }

  function requestStatusChange(newStatus) {
    if (!selected || selected.status === newStatus) return
    setPendingStatus(newStatus)
    setConfirmOpen(true)
  }

  async function confirmStatusChange() {
    if (!selected || !pendingStatus) return
    setSubmitting(true)
    const fromStatus = selected.status
    try {
      const res  = await apiFetch(`${API}/boutique/orders/${selected.id}/status`, {
        method: 'PATCH',
        body:   JSON.stringify({ status: pendingStatus }),
      })
      const data = await res.json()
      if (!data.success) {
        showToast(data.message || t('orders.toast.cannot_transition', "Cannot transition from '{{from}}' to '{{to}}'", { from: statusLabel(t, fromStatus), to: statusLabel(t, pendingStatus) }), 'error')
        setConfirmOpen(false); setSubmitting(false); return
      }
      setOrders(prev => prev.map(o => o.id === selected.id ? { ...o, status: pendingStatus } : o))
      setSelected(prev => prev ? { ...prev, status: pendingStatus } : prev)
      showToast(t('orders.toast.status_updated', 'Status updated to {{status}}', { status: statusLabel(t, pendingStatus) }), 'success')
    } catch {
      showToast(t('orders.toast.cannot_transition', "Cannot transition from '{{from}}' to '{{to}}'", { from: statusLabel(t, fromStatus), to: statusLabel(t, pendingStatus) }), 'error')
    } finally {
      setSubmitting(false); setConfirmOpen(false); setPendingStatus(null)
    }
  }

  function updateShipping(id) {
    apiFetch(`${API}/boutique/orders/${id}/shipping`, {
      method: 'PATCH',
      body:   JSON.stringify({ dhl_tracking_number: trackingInput }),
    })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setOrders(prev => prev.map(o => o.id === id ? { ...o, dhl_tracking_number: trackingInput } : o))
          setSelected(prev => prev?.id === id ? { ...prev, dhl_tracking_number: trackingInput } : prev)
          showToast(t('orders.toast.tracking_saved', 'Tracking number saved'), 'success')
          return
        }
        // No else and no catch before this: a rejected save did nothing at
        // all, so the number stayed in the box and looked saved until the
        // next reload dropped it.
        showToast(res.message || t('orders.toast.tracking_error', 'Could not save the tracking number. Please try again.'), 'error')
      })
      .catch(() => showToast(t('common.error_network'), 'error'))
  }

  function dhlCell(o) {
    if (o.dhl_tracking_number) {
      const done = o.status === 'delivered'
      return <span style={{ fontSize: 9, color: done ? 'var(--green)' : 'var(--stripe)', fontWeight: 600 }}>{o.dhl_tracking_number}</span>
    }
    if (o.channel === 'ship') return <span style={{ fontSize: 9, color: 'var(--stone)' }}>{t('orders.awaiting_label')}</span>
    return <span style={{ fontSize: 9, color: 'var(--stone)' }}>—</span>
  }

  // Filtering by status now happens server-side (see refetchOrders) — orders
  // already only contains the current tab's page.
  const visibleOrders = orders

  // Use summary for tab counts (accurate full-dataset counts from API)
  const TABS = [
    `${t('orders.tabs.all')} (${summary.total_orders ?? 0})`,
    `${t('orders.tabs.pending')} (${summary.pending ?? 0})`,
    `${t('orders.tabs.processing')} (${summary.processing ?? 0})`,
    `${t('orders.tabs.shipped')} (${summary.shipped ?? 0})`,
    `${t('orders.tabs.delivered')} (${summary.delivered ?? 0})`,
    `${t('orders.tabs.cancelled')} (${summary.cancelled ?? 0})`,
  ]

  const snap = selected?.shipping_address_snapshot ?? {}

  return (
    <>
      <Toast toasts={toasts} />

      <div className="tabs">
        {TABS.map((tab, i) => (
          <div key={i} className={`tab${activeTab === i ? ' act' : ''}`} onClick={() => handleTabClick(i)}>
            {tab}
            {/* Badge only on All tab, only when there are unread order notifs, only until visited */}
            {i === 0 && !visitedTabs.has(0) && totalUnreadOrders > 0 &&
              <span className="tab-badge">{totalUnreadOrders}</span>}
          </div>
        ))}
      </div>

      <div className="grid2 ord-grid">

        {/* ── Order list ── */}
        <div>
          <div className="card ord-table-card">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('orders.table.order')}</th>
                  <th>{t('orders.table.customer')}</th>
                  <th>{t('orders.table.items')}</th>
                  <th>{t('orders.table.total')}</th>
                  <th>DHL</th>
                  <th>{t('orders.table.date')}</th>
                  <th>{t('orders.table.status')}</th>
                </tr>
              </thead>
              <tbody>
                {!loading && visibleOrders.map(o => (
                  <tr key={o.id} className={selected?.id === o.id ? 'ord-row-selected' : ''}>
                    <td>
                      <span className="ord-id-link" onClick={() => { clearRouteOrderId(); fetchDetail(o.id) }}>
                        #{String(o.id).slice(0, 8)}
                      </span>
                    </td>
                    <td>{o.name ?? <span className="ord-guest">{t('orders.guest')}</span>}</td>
                    <td>{o.item_count}</td>
                    <td>€{o.gross_amount}</td>
                    <td>{dhlCell(o)}</td>
                    <td>{fmtDate(o.created_at)}</td>
                    <td><span className={`status ${o.status}`}>{statusLabel(t, o.status)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {loading && (
              <div className="empty">
                <span className="material-symbols-outlined">hourglass_empty</span>
                {t('orders.loading')}
              </div>
            )}
            {/* A failed load used to render as an empty tab. */}
            {!loading && loadFailed && (
              <div className="empty">
                <span className="material-symbols-outlined">cloud_off</span>
                {t('orders.err_load', 'Could not load orders.')}{' '}
                <span className="db-alert-link" onClick={() => refetchOrders(activeTab, 1)}>
                  {t('common.retry', 'Retry')}
                </span>
              </div>
            )}
            {!loading && !loadFailed && visibleOrders.length === 0 && (
              <div className="empty">
                <span className="material-symbols-outlined">local_shipping</span>
                {t('orders.empty', { status: STATUS_TABS[activeTab] })}
              </div>
            )}
            {!loading && ordersTotalPages > 1 && (
              <div className="ord-table-footer" style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:12, padding:'10px 0' }}>
                <button className="btn btn-outline btn-xs" disabled={ordersPage <= 1} onClick={() => goToOrdersPage(ordersPage - 1)}>{t('orders.prev', '← Prev')}</button>
                <span>{t('orders.page_n', { page: ordersPage, total: ordersTotalPages, defaultValue: 'Page {{page}} of {{total}}' })}</span>
                <button className="btn btn-outline btn-xs" disabled={ordersPage >= ordersTotalPages} onClick={() => goToOrdersPage(ordersPage + 1)}>{t('orders.next', 'Next →')}</button>
              </div>
            )}
          </div>
        </div>

        {/* ── Detail panel ── */}
        {selected && (
          <div className="detail-panel">
            <div className="detail-panel-hdr">
              <div className="detail-panel-icon">
                <span className="material-symbols-outlined">package_2</span>
              </div>
              <div>
                <div className="detail-panel-title">{t('orders.order_id', { id: String(selected.id).slice(0, 8) })}</div>
                <div className="detail-panel-sub">
                  {selected.name ?? t('orders.guest')} · {fmtDate(selected.created_at)}
                  {selected.dhl_tracking_number
                    ? ` · ${selected.dhl_tracking_number}`
                    : selected.channel === 'ship' ? ` · ${t('orders.awaiting_shipment', 'Awaiting shipment')}` : ''}
                </div>
              </div>
              <span className={`status ${selected.status} ord-status-ml`}>{statusLabel(t, selected.status)}</span>
            </div>

            <div className="detail-panel-body">

              {/* Items */}
              <div className="ord-section-hdr">{t('orders.detail.items')}</div>
              {selected.items?.length > 0 ? selected.items.map((item, i) => (
                <div key={i} className="ord-item-row">
                  <div className="ord-item-img" style={{
                    backgroundImage: item.product_photo
                      ? `url('${item.product_photo.startsWith('http')
                          ? item.product_photo
                          : `${import.meta.env.VITE_IMG_BASE_URL}${item.product_photo}`}')`
                      : 'none',
                    backgroundColor: 'var(--mist)'
                  }} />
                  <div className="ord-item-body">
                    <div className="ord-item-name">{item.product_name_snapshot ?? item.name ?? '—'}</div>
                    <div className="ord-item-variant">
                      {item.variant_size_snapshot ?? item.size} · {item.variant_colour_snapshot ?? item.colour}
                      {item.sku_snapshot ? ` · SKU: ${item.sku_snapshot}` : ''}
                      {' · '}{t('orders.detail.qty')}: {item.qty ?? 1}
                    </div>
                  </div>
                  <div className="ord-item-price">€{item.unit_price}</div>
                </div>
              )) : (
                <div className="ord-empty-text">{t('orders.detail.no_items')}</div>
              )}

              <div className="detail-divider" />

              {/* Ship To */}
              <div className="ord-section-hdr">{t('orders.detail.ship_to')}</div>
              <div className="ord-customer-block">
                {snap.name ?? selected.name ?? t('orders.guest')}
                {snap.address_line1 && <><br /><span className="ord-customer-sub">{snap.address_line1}</span></>}
                {(snap.city || snap.postal_code) && (
                  <><br /><span className="ord-customer-sub">{[snap.postal_code, snap.city].filter(Boolean).join(', ')}</span></>
                )}
                {snap.country_code && <><br /><span className="ord-customer-sub">{snap.country_code}</span></>}
                {snap.email && <><br /><span className="ord-customer-sub">{snap.email}</span></>}
                {snap.phone && <><br /><span className="ord-customer-sub">{snap.phone}</span></>}
              </div>

              <div className="detail-divider" />

              {/* Financials */}
              <div className="ord-section-hdr">{t('orders.detail.financials')}</div>
              <div className="ord-financials">
                <div className="ord-fin-row"><span>{t('orders.detail.subtotal')}</span><span>€{selected.subtotal}</span></div>
                <div className="ord-fin-row"><span>{t('orders.detail.shipping')}</span><span>€{selected.shipping_price}</span></div>
                <div className="ord-fin-row"><span>{t('orders.detail.vat')}</span><span>€{selected.vat_amount}</span></div>
                {/* Without this row a discounted order doesn't add up on screen —
                    subtotal + shipping + VAT wouldn't match the total. */}
                {parseFloat(selected.promo_discount) > 0 && (
                  <div className="ord-fin-row">
                    <span>
                      {t('orders.detail.discount', 'Discount')}
                      {selected.promo_code ? ` (${selected.promo_code})` : ''}
                    </span>
                    <span>−€{parseFloat(selected.promo_discount).toFixed(2)}</span>
                  </div>
                )}
                <div className="ord-fin-row ord-fin-total"><span>{t('orders.detail.total')}</span><span>€{selected.gross_amount}</span></div>
                {selected.commission_amount != null && (
                  <div className="ord-fin-row">
                    <span>{t('orders.detail.commission', { pct: (parseFloat(selected.commission_rate || 0) * 100).toFixed(0), defaultValue: 'Commission ({{pct}}%)' })}</span>
                    <span>−€{selected.commission_amount}</span>
                  </div>
                )}
                <div className="ord-fin-row ord-fin-net"><span>{t('orders.detail.net')}</span><span>€{selected.net_to_boutique}</span></div>
              </div>

              <div className="detail-divider" />

              {/* Shipping / DHL */}
              {selected.channel === 'ship' && (
                <>
                  <div className="ord-section-hdr">{t('orders.detail.shipping_section')}</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <button className="btn btn-dhl" style={{ flex: 1, justifyContent: 'center' }}>
                      <span className="material-symbols-outlined">local_shipping</span>
                      {t('orders.detail.generate_dhl')}
                    </button>
                    <button className="btn btn-outline" style={{ flex: 1, justifyContent: 'center' }}
                      onClick={() => generatePackingSlip(selected.id)}>
                      <span className="material-symbols-outlined">print</span>
                      {t('orders.detail.packing_slip')}
                    </button>
                  </div>
                  <div className="ord-tracking-row" style={{ marginBottom: 8 }}>
                    <input
                      className="form-input ord-tracking-input"
                      placeholder={t('orders.detail.tracking_placeholder')}
                      value={trackingInput}
                      onChange={e => setTrackingInput(e.target.value)}
                    />
                    <button
                      className={`btn btn-sm ${trackingInput !== (selected.dhl_tracking_number ?? '') ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => updateShipping(selected.id)}
                    >
                      {t('common.save')}
                    </button>
                  </div>
                  {selected.dhl_status && (
                    <div className="ord-dhl-status">
                      {t('orders.detail.dhl_status')}: <strong>{selected.dhl_status}</strong>
                    </div>
                  )}
                  <div className="detail-divider" />
                </>
              )}

              {/* Message Customer — WhatsApp, and its no-phone fallback sends
                  the user to /messages, which does not exist for a boutique
                  without the entitlement. Hidden entirely in that case. */}
              {isWhatsappEnabled() && <button
                className="btn btn-outline"
                style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }}
                onClick={() => {
                  const phone = snap.phone?.replace(/\D/g, '') ?? ''
                  const name  = snap.name?.split(' ')[0] ?? selected.name?.split(' ')[0] ?? ''
                  // Goes to the customer, so it follows the boutique's language.
                  const msg   = encodeURIComponent(t(
                    'orders.whatsapp_msg',
                    'Ciao {{name}}, regarding your order #{{order}} — ',
                    { name, order: String(selected.id).slice(0, 8) },
                  ))
                  if (phone) {
                    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
                  } else {
                    window.location.href = '/messages'
                  }
                }}
              >
                <span className="material-symbols-outlined">chat_bubble</span>
                {t('orders.detail.message_customer', 'Message Customer')}
              </button>}

              {/* Update Status */}
              <div className="ord-section-hdr">{t('orders.detail.update_status')}</div>
              <div className="ord-status-btns">
                {['pending', 'processing', 'shipped', 'delivered', 'cancelled'].map(s => {
                  const current    = selected.status
                  const ORDER      = ['pending', 'processing', 'shipped', 'delivered']
                  const isFinal    = current === 'delivered' || current === 'cancelled'
                  const isCurrent  = current === s
                  let disabled     = false
                  let tooltip      = ''

                  if (isCurrent) {
                    disabled = true
                  } else if (isFinal) {
                    disabled = true
                    tooltip  = t('orders.tooltip.final', 'This order is already {{status}} — no further changes allowed', { status: statusLabel(t, current) })
                  } else if (s === 'cancelled') {
                    if (current !== 'pending') {
                      disabled = true
                      tooltip  = t('orders.tooltip.cancel_window', 'Orders can only be cancelled before processing begins')
                    }
                  } else {
                    const currentIdx = ORDER.indexOf(current)
                    const targetIdx  = ORDER.indexOf(s)
                    if (targetIdx < currentIdx) {
                      disabled = true
                      tooltip  = 'Cannot revert to a previous status'
                    } else if (targetIdx > currentIdx + 1) {
                      disabled = true
                      tooltip  = 'The current status must be completed first'
                    }
                  }

                  return (
                    <div key={s} className="ord-status-btn-wrap" {...(tooltip ? { 'data-tooltip': tooltip } : {})}>
                      <button
                        className={`btn btn-sm ${isCurrent ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => !disabled && requestStatusChange(s)}
                        disabled={disabled}
                        style={disabled && !isCurrent ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                      >
                        {s}
                      </button>
                    </div>
                  )
                })}
              </div>

              <div className="detail-divider" />

              {/* Order Timeline */}
              <div className="ord-section-hdr">{t('orders.detail.timeline')}</div>
              <OrderTimeline order={selected} />

            </div>
          </div>
        )}
      </div>

      <StatusConfirmModal
        open={confirmOpen}
        onClose={() => { setConfirmOpen(false); setPendingStatus(null) }}
        onConfirm={confirmStatusChange}
        currentStatus={selected?.status ?? ''}
        newStatus={pendingStatus ?? ''}
        submitting={submitting}
      />
    </>
  )
}
