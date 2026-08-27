import { useState,useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'
import Toast, { useToast } from '../components/ui/Toast'
import useNotifStore from '../store/notifStore'
import useLangStore from '../store/langStore'
import { generatePackingSlip } from '../lib/packingSlip'

const API = import.meta.env.VITE_API_URL
const STATUS_TABS = ['all', 'pending', 'processing', 'shipped', 'delivered', 'cancelled']

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric' }) +
    ' · ' + new Date(iso).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })
}

/* ── Status confirm modal ── */
function StatusConfirmModal({ open, onClose, onConfirm, currentStatus, newStatus, submitting }) {
  if (!open) return null
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <div className="modal-title">Confirm status change</div>
          <button className="modal-close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="modal-intro">
          Change order status from{' '}
          <span className={`status ${currentStatus}`}>{currentStatus}</span>
          {' '}to{' '}
          <span className={`status ${newStatus}`}>{newStatus}</span>?
        </div>
        <div className="modal-footer">
          <button className="btn btn-dark" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="btn btn-primary" onClick={onConfirm} disabled={submitting}>
            <span className="material-symbols-outlined">check_circle</span>
            {submitting ? 'Updating…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Order timeline ── */
function OrderTimeline({ order }) {
  const status = order?.status ?? ''

  const STEPS = [
    {
      key:   'placed',
      title: 'Order Placed',
      sub:   order ? `${order.payment_method ?? 'Payment'} confirmed · €${order.gross_amount}` : '',
      icon:  'check_circle',
      time:  fmtDateTime(order?.created_at),
      done:  true,
    },
    {
      key:   'processing',
      title: 'Processing',
      sub:   'Boutique notified · preparing your order',
      icon:  'inventory_2',
      time:  ['processing','shipped','delivered'].includes(status) ? 'Done' : '—',
      done:  ['processing','shipped','delivered'].includes(status),
      pending: status === 'pending',
    },
    {
      key:   'dhl',
      title: order?.dhl_tracking_number ? `DHL · ${order.dhl_tracking_number}` : 'DHL Label — Pending',
      sub:   order?.dhl_tracking_number ? `Status: ${order.dhl_status ?? 'In transit'}` : 'Generate label to continue',
      icon:  'local_shipping',
      time:  order?.dhl_tracking_number ? 'Generated' : 'Now',
      done:  !!order?.dhl_tracking_number,
      pending: !order?.dhl_tracking_number && ['processing','shipped'].includes(status),
    },
    {
      key:   'shipped',
      title: 'Shipped',
      sub:   'DHL pickup or drop-off',
      icon:  'local_shipping',
      time:  ['shipped','delivered'].includes(status) ? 'Done' : '—',
      done:  ['shipped','delivered'].includes(status),
    },
    {
      key:   'delivered',
      title: 'Delivered',
      sub:   'Order completed',
      icon:  'inventory',
      time:  status === 'delivered' ? 'Done' : '—',
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
  const [selected,      setSelected]      = useState(null)
  const [loading,       setLoading]       = useState(true)
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

    setLoading(true)
    apiFetch(`${API}/boutique/orders`)
      .then(r => r.json())
      .then(res => {
        const list = res.data.orders ?? []
        setOrders(list)
        if (list.length > 0) fetchDetail(list[0].id)
        setLoading(false)
      })
  }, [lang])

  function handleTabClick(i) {
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
        setSelected(res.data)
        setTrackingInput(res.data.dhl_tracking_number ?? '')
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
        showToast(data.message || `Cannot transition from '${fromStatus}' to '${pendingStatus}'`, 'error')
        setConfirmOpen(false); setSubmitting(false); return
      }
      setOrders(prev => prev.map(o => o.id === selected.id ? { ...o, status: pendingStatus } : o))
      setSelected(prev => prev ? { ...prev, status: pendingStatus } : prev)
      showToast(`Status updated to ${pendingStatus}`, 'success')
    } catch {
      showToast(`Cannot transition from '${fromStatus}' to '${pendingStatus}'`, 'error')
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
          showToast('Tracking number saved', 'success')
        }
      })
  }

  function dhlCell(o) {
    if (o.dhl_tracking_number) {
      const done = o.status === 'delivered'
      return <span style={{ fontSize: 9, color: done ? 'var(--green)' : 'var(--stripe)', fontWeight: 600 }}>{o.dhl_tracking_number}</span>
    }
    if (o.channel === 'ship') return <span style={{ fontSize: 9, color: 'var(--stone)' }}>Awaiting label</span>
    return <span style={{ fontSize: 9, color: 'var(--stone)' }}>—</span>
  }

  const visibleOrders = orders.filter(o =>
    activeTab === 0 ? true : o.status === STATUS_TABS[activeTab]
  )

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
                      <span className="ord-id-link" onClick={() => fetchDetail(o.id)}>
                        #{String(o.id).slice(0, 8)}
                      </span>
                    </td>
                    <td>{o.name ?? <span className="ord-guest">{t('orders.guest')}</span>}</td>
                    <td>{o.item_count}</td>
                    <td>€{o.gross_amount}</td>
                    <td>{dhlCell(o)}</td>
                    <td>{fmtDate(o.created_at)}</td>
                    <td><span className={`status ${o.status}`}>{o.status}</span></td>
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
            {!loading && visibleOrders.length === 0 && (
              <div className="empty">
                <span className="material-symbols-outlined">local_shipping</span>
                {t('orders.empty', { status: STATUS_TABS[activeTab] })}
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
                  {selected.dhl_tracking_number ? ` · ${selected.dhl_tracking_number}` : selected.channel === 'ship' ? ' · Awaiting shipment' : ''}
                </div>
              </div>
              <span className={`status ${selected.status} ord-status-ml`}>{selected.status}</span>
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
              <div className="ord-section-hdr">Ship To</div>
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
                <div className="ord-fin-row ord-fin-total"><span>{t('orders.detail.total')}</span><span>€{selected.gross_amount}</span></div>
                <div className="ord-fin-row ord-fin-net"><span>{t('orders.detail.net')}</span><span>€{selected.net_to_boutique}</span></div>
              </div>

              <div className="detail-divider" />

              {/* Shipping / DHL */}
              {selected.channel === 'ship' && (
                <>
                  <div className="ord-section-hdr">Shipping</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <button className="btn btn-dhl" style={{ flex: 1, justifyContent: 'center' }}>
                      <span className="material-symbols-outlined">local_shipping</span>
                      Generate DHL Label
                    </button>
                    <button className="btn btn-outline" style={{ flex: 1, justifyContent: 'center' }}
                      onClick={() => generatePackingSlip(selected.id)}>
                      <span className="material-symbols-outlined">print</span>
                      Packing Slip
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

              {/* Message Customer */}
              <button
                className="btn btn-outline"
                style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }}
                onClick={() => {
                  const phone = snap.phone?.replace(/\D/g, '') ?? ''
                  const name  = snap.name?.split(' ')[0] ?? selected.name?.split(' ')[0] ?? ''
                  const msg   = encodeURIComponent(`Ciao ${name}, regarding your order #${String(selected.id).slice(0, 8)} — `)
                  if (phone) {
                    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
                  } else {
                    window.location.href = '/messages'
                  }
                }}
              >
                <span className="material-symbols-outlined">chat_bubble</span>
                Message Customer
              </button>

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
                    tooltip  = `This order is already ${current} — no further changes allowed`
                  } else if (s === 'cancelled') {
                    if (current !== 'pending') {
                      disabled = true
                      tooltip  = 'Orders can only be cancelled before processing begins'
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
              <div className="ord-section-hdr">Order Timeline</div>
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
