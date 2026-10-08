import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../../lib/api'
import { activeLocale } from '../../lib/dateHelpers'
import { WS_FLOW, WS_PILL, wsMoney as money } from '../../lib/wholesaleOrders'
import Loading from '../ui/Loading'

const API = import.meta.env.VITE_API_URL

/* Detail panel for a Showroom (wholesale) order, shown in the Orders tab's
 * right-hand column in place of the consumer order panel.
 *
 * Built from sir's Showroom Postman collection (Oct 2026):
 *   GET  /boutique/showroom/orders/:id         → this boutique's slice
 *   POST /boutique/showroom/orders/:id/status  → one step forward
 * The boutique only ever sees its own sub-order: its items, its subtotal,
 * commission and payout. Deposit and balance are recorded by Mi Italia's
 * admin, never here — the panel only reports them.
 *
 * NOT YET CHECKED AGAINST A REAL RESPONSE: there was no wholesale order on dev
 * when this was written. Field names follow the collection; `timeline` and
 * `line_items` are only described loosely there, so both are read defensively.
 */

const STEP_ICON = {
  submitted: 'send', confirmed: 'check_circle', in_production: 'inventory_2',
  dispatched: 'local_shipping', delivered: 'inventory',
}

function fmtDate(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString(activeLocale(), { day: 'numeric', month: 'short', year: 'numeric' })
}

// sizes may be a { "42": 1, "44": 2 } map (that is how the buyer submits
// them) or already a string; anything else is skipped.
function fmtSizes(sizes) {
  if (!sizes) return ''
  if (typeof sizes === 'string') return sizes
  if (typeof sizes === 'object') {
    return Object.entries(sizes).filter(([, q]) => Number(q) > 0).map(([s, q]) => `${s}×${q}`).join(' · ')
  }
  return ''
}

export default function WholesaleOrderPanel({ orderId, onUpdated, showToast }) {
  const { t, i18n } = useTranslation()
  const [order, setOrder]       = useState(null)
  const [failed, setFailed]     = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy]         = useState(false)
  const [carrier, setCarrier]   = useState('DHL')
  const [tracking, setTracking] = useState('')

  // A status or payment word the backend sends that has no label yet is shown
  // as sent, rather than as a raw key name.
  const label = (group, value) => {
    const key = `orders.ws.${group}.${value}`
    return i18n.exists(key) ? t(key) : String(value ?? '—')
  }

  function fetchOrder() {
    return apiFetch(`${API}/boutique/showroom/orders/${orderId}`)
      .then(r => r.json())
      .then(res => {
        if (!res?.success || !res.data) throw new Error(res?.message || 'showroom order request failed')
        setOrder(res.data)
        setFailed(false)
        return res.data
      })
      .catch(() => { setFailed(true); return null })
  }

  // The parent renders this panel with key={orderId}, so a different order is
  // a fresh mount — nothing here has to be reset by hand.
  // Runs once per mount on purpose; fetchOrder is re-created every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchOrder() }, [])

  const next    = order?.next_action ?? null
  const target  = next?.status ?? null
  const blocked = next?.blocked_reason ?? null

  // Moving a step emails the buyer (and dispatch sends tracking), so every
  // move is confirmed first. A 409 comes back with a message naming what is
  // missing — "Waiting for the buyer deposit" — which is shown as is.
  function advance() {
    if (!target || blocked) return
    const body = { status: target }
    if (target === 'dispatched') {
      if (carrier.trim())  body.carrier = carrier.trim()
      if (tracking.trim()) body.tracking_number = tracking.trim()
    }
    setBusy(true)
    apiFetch(`${API}/boutique/showroom/orders/${orderId}/status`, { method: 'POST', body: JSON.stringify(body) })
      .then(r => r.json())
      .then(res => {
        if (!res?.success) {
          showToast?.(res?.message || t('orders.ws.err_update'), 'error')
          return
        }
        setConfirming(false)
        showToast?.(t('orders.ws.updated', { status: label('status', res.data?.status ?? target) }), 'success')
        // Re-read the order: next_action, payment state and timeline all move
        // together, and the list row needs the new status.
        fetchOrder().then(fresh => { if (fresh) onUpdated?.(fresh) })
      })
      .catch(() => showToast?.(t('common.error_network'), 'error'))
      .finally(() => setBusy(false))
  }

  if (failed) {
    return (
      <div className="detail-panel">
        <div className="detail-panel-body">
          <div className="empty">
            <span className="material-symbols-outlined">cloud_off</span>
            {t('orders.ws.err_load')}{' '}
            <span className="db-alert-link" onClick={fetchOrder}>{t('common.retry')}</span>
          </div>
        </div>
      </div>
    )
  }
  if (!order) return <div className="detail-panel"><Loading /></div>

  const buyer    = order.buyer ?? {}
  const totals   = order.totals ?? {}
  const payment  = order.payment ?? {}
  const payout   = order.payout ?? {}
  const shipment = order.shipment ?? {}
  const timeline = order.timeline ?? {}
  const items    = Array.isArray(order.line_items) ? order.line_items : []
  const ratePct  = totals.commission_rate != null ? Math.round(Number(totals.commission_rate) * 1000) / 10 : null
  const curIdx   = WS_FLOW.indexOf(order.status)
  const at       = s => fmtDate(timeline[`${s}_at`])
  // "Paid 5 Oct 2026" once paid (it read "Paid · paid 5 Oct 2026"); otherwise
  // the state, with the due date when there is one.
  const payState = (status, paidAt, dueAt) => paidAt
    ? t('orders.ws.paid_on', { date: fmtDate(paidAt) })
    : `${label('pay', status)}${dueAt ? ` · ${t('orders.ws.due', { date: fmtDate(dueAt) })}` : ''}`

  return (
    <div className="detail-panel">
      <div className="detail-panel-hdr">
        <div className="detail-panel-icon">
          <span className="material-symbols-outlined">business_center</span>
        </div>
        <div>
          <div className="detail-panel-title">{order.po_number ?? String(order.id).slice(0, 8)}</div>
          <div className="detail-panel-sub">
            {t('orders.ws.received_via', { date: at('submitted') ?? '—' })}
          </div>
        </div>
        <span className={`status ${WS_PILL[order.status] ?? 'pending'} ord-status-ml`}>{label('status', order.status)}</span>
      </div>

      <div className="detail-panel-body">

        {/* Next step — the one thing the boutique has to do */}
        <div className="ord-section-hdr">{t('orders.ws.next_step')}</div>
        {target ? (
          <div className="ws-action">
            {blocked && (
              <div className="ws-blocked">
                <span className="material-symbols-outlined">lock</span>{blocked}
              </div>
            )}
            {target === 'dispatched' && !blocked && (
              <div className="form-row2 ws-dispatch">
                <div className="form-group">
                  <label className="form-lbl">{t('orders.ws.carrier')}</label>
                  <input className="form-input" value={carrier} onChange={e => setCarrier(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-lbl">{t('orders.ws.tracking')}</label>
                  <input className="form-input" value={tracking} onChange={e => setTracking(e.target.value)} />
                </div>
                <div className="form-hint ws-dispatch-hint">{t('orders.ws.dispatch_hint')}</div>
              </div>
            )}
            {confirming && !blocked ? (
              <div className="ws-confirm">
                <div className="ws-confirm-q">{t('orders.ws.confirm_q', { action: label('action', target) })}</div>
                <div className="ws-confirm-btns">
                  <button className="btn btn-sm btn-outline" onClick={() => setConfirming(false)} disabled={busy}>{t('common.cancel')}</button>
                  <button className="btn btn-sm btn-primary" onClick={advance} disabled={busy}>
                    {busy ? t('orders.confirm_status.updating') : t('common.confirm')}
                  </button>
                </div>
              </div>
            ) : (
              <button className="btn btn-primary ws-action-btn" disabled={!!blocked} onClick={() => setConfirming(true)}>
                <span className="material-symbols-outlined">{STEP_ICON[target] ?? 'check_circle'}</span>
                {label('action', target)}
              </button>
            )}
          </div>
        ) : (
          <div className="ord-empty-text">{t('orders.ws.no_action')}</div>
        )}

        <div className="detail-divider" />

        {/* Buyer */}
        <div className="ord-section-hdr">{t('orders.ws.buyer')}</div>
        <div className="ord-customer-block">
          <strong>{buyer.company_name ?? '—'}</strong>
          {(buyer.contact_name || buyer.country) && (
            <><br /><span className="ord-customer-sub">{[buyer.contact_name, buyer.country].filter(Boolean).join(' · ')}</span></>
          )}
          {buyer.email && <><br /><span className="ord-customer-sub">{buyer.email}</span></>}
          {buyer.phone && <><br /><span className="ord-customer-sub">{buyer.phone}</span></>}
          <br /><span className="ws-verified"><span className="material-symbols-outlined">verified</span>{t('orders.ws.verified')}</span>
        </div>

        <div className="detail-divider" />

        {/* Items */}
        <div className="ord-section-hdr">{t('orders.ws.items')}</div>
        {items.length > 0 ? items.map((it, i) => (
          <div key={i} className="ord-item-row">
            <div className="ord-item-body">
              <div className="ord-item-name">{it.name ?? '—'}</div>
              <div className="ord-item-variant">
                {[it.sku, fmtSizes(it.sizes)].filter(Boolean).join(' · ')}
                {it.units != null && <>{' · '}{t('orders.ws.units', { count: Number(it.units) })}</>}
                {it.unit_price != null && <>{' · '}{money(it.unit_price)}</>}
              </div>
            </div>
            <div className="ord-item-price">{money(it.line_total)}</div>
          </div>
        )) : (
          <div className="ord-empty-text">{t('orders.detail.no_items')}</div>
        )}

        <div className="detail-divider" />

        {/* Money — this boutique's slice only */}
        <div className="ord-section-hdr">{t('orders.ws.payment')}</div>
        <div className="ord-financials">
          <div className="ord-fin-row"><span>{t('orders.ws.subtotal')}</span><span>{money(totals.subtotal)}</span></div>
          {totals.commission != null && (
            <div className="ord-fin-row">
              <span>{t('orders.ws.commission', { pct: ratePct ?? '—' })}</span>
              <span>−{money(totals.commission)}</span>
            </div>
          )}
          <div className="ord-fin-row ord-fin-total"><span>{t('orders.ws.payout')}</span><span>{money(totals.payout)}</span></div>
          <div className="ord-fin-row">
            <span>{t('orders.ws.deposit')}</span>
            <span>{payState(payment.deposit_status, payment.deposit_paid_at)}</span>
          </div>
          <div className="ord-fin-row">
            <span>{t('orders.ws.balance')}</span>
            <span>{payState(payment.balance_status, payment.balance_paid_at, payment.balance_due_at)}</span>
          </div>
          {payout.status && (
            <div className="ord-fin-row">
              <span>{t('orders.ws.payout_status')}</span>
              <span>{payState(payout.status, payout.paid_at)}</span>
            </div>
          )}
        </div>

        {(shipment.carrier || shipment.tracking_number) && (
          <>
            <div className="detail-divider" />
            <div className="ord-section-hdr">{t('orders.ws.shipment')}</div>
            <div className="ord-customer-block">
              {[shipment.carrier, shipment.tracking_number].filter(Boolean).join(' · ')}
            </div>
          </>
        )}

        <div className="detail-divider" />

        {/* Timeline */}
        <div className="ord-section-hdr">{t('orders.ws.timeline')}</div>
        <ul className="timeline">
          {order.status === 'cancelled' ? (
            <li className="timeline-item">
              <div className="timeline-dot todo"><span className="material-symbols-outlined">cancel</span></div>
              <div className="timeline-content"><div className="timeline-title">{label('status', 'cancelled')}</div></div>
              <div className="timeline-time">{at('cancelled') ?? ''}</div>
            </li>
          ) : WS_FLOW.map((s, i) => {
            const done = curIdx >= i
            const dot  = done ? 'done' : s === target ? 'pending' : 'todo'
            return (
              <li key={s} className="timeline-item">
                <div className={`timeline-dot ${dot}`}>
                  <span className="material-symbols-outlined" style={done ? { fontVariationSettings: "'FILL' 1" } : {}}>{STEP_ICON[s]}</span>
                </div>
                <div className="timeline-content"><div className="timeline-title">{label('status', s)}</div></div>
                <div className="timeline-time">{at(s) ?? (done ? '' : '—')}</div>
              </li>
            )
          })}
        </ul>

      </div>
    </div>
  )
}
