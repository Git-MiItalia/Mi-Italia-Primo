import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'
import useNotifStore from '../store/notifStore'

const API = import.meta.env.VITE_API_URL

const STATUS_MAP = ['pending', 'confirmed', 'collected', 'expired', 'cancelled']

function fmtDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const isToday = d.toDateString() === new Date().toDateString()
  if (isToday) return `Today, ${d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}`
  return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short' }) + ', ' + d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })
}

function timeLeft(iso) {
  const diff = new Date(iso) - new Date()
  if (diff <= 0) return 'Expired'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return `${h}:${String(m).padStart(2,'0')}`
}

function isUrgent(iso) { return (new Date(iso) - new Date()) < 7200000 }

function ConfirmModal({ message, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex:300 }}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()} style={{ textAlign:'center' }}>
        <div style={{ fontSize:44, marginBottom:12 }}>✅</div>
        <div className="modal-success-title">{message}</div>
        <button onClick={onClose} className="btn btn-primary modal-success-btn" style={{ marginTop:16, width:'100%', justifyContent:'center' }}>Done</button>
      </div>
    </div>
  )
}

export default function Reservations() {
  const { t } = useTranslation()

  const notifications = useNotifStore(s => s.notifications)
  const markRead      = useNotifStore(s => s.markRead)

  // Ref to ensure mark-as-read only runs once on mount
  const hasMarkedRead = useRef(false)

  const [activeTab,    setActiveTab]    = useState(0)
  const [stats,        setStats]        = useState({ active:0, confirmed:0, collected:0, expired:0, cancelled:0 })
  const [reservations, setReservations] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [selected,     setSelected]     = useState(null)
  const [detailModal,  setDetailModal]  = useState(null)
  const [extendModal,  setExtendModal]  = useState(null)
  const [extendHours,  setExtendHours]  = useState(1)
  const [extendMsg,    setExtendMsg]    = useState('')
  const [confirm,      setConfirm]      = useState(null)

  // Mark unread reservation notifications as read — runs once only
  useEffect(() => {
    if (hasMarkedRead.current) return
    if (notifications.length === 0) return
    hasMarkedRead.current = true
    notifications
      .filter(n => !n.read_at && !n.is_read && n.type?.toLowerCase().includes('reservation'))
      .forEach(n => {
        apiFetch(`${API}/boutique/notifications/${n.id}/read`, { method: 'PUT', body: JSON.stringify({}) })
        .then(r => r.json())
        .then(res => console.log('[markRead response]', n.id, res))
        markRead(n.id)
      })
  }, [notifications.length])

  // Load stats once
  useEffect(() => {
    apiFetch(`${API}/boutique/reservations/stats`)
      .then(r => r.json())
      .then(res => {
        if (res.success) setStats({
          active:    parseInt(res.data.pending   ?? 0), // Tab 0 = status:pending
          confirmed: parseInt(res.data.active    ?? 0), // Tab 1 = status:confirmed (API calls these 'active')
          collected: parseInt(res.data.collected ?? 0),
          expired:   parseInt(res.data.expired   ?? 0),
          cancelled: parseInt(res.data.cancelled ?? 0),
        })
      })
  }, [])

  // Load reservations per tab
  useEffect(() => {
    setLoading(true)
    setSelected(null)
    apiFetch(`${API}/boutique/reservations?status=${STATUS_MAP[activeTab]}&limit=100`)
      .then(r => r.json())
      .then(res => {
        const list = res.data?.reservations ?? []
        setReservations(list)
        if (list.length > 0) setSelected(list[0])
        setLoading(false)
      })
  }, [activeTab])

  function markCollected(reservation) {
    apiFetch(`${API}/boutique/reservations/${reservation.id}/collect`, { method: 'PATCH', body: JSON.stringify({}) })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setReservations(prev => prev.filter(r => r.id !== reservation.id))
          setStats(prev => ({ ...prev, confirmed: Math.max(0, prev.confirmed - 1), collected: prev.collected + 1 }))
          if (selected?.id === reservation.id) setSelected(null)
          setDetailModal(null)
          setConfirm({ message: `${reservation.name ?? 'Reservation'} has been marked as collected.` })
        }
      })
  }

  function confirmReservation(reservation) {
    apiFetch(`${API}/boutique/reservations/${reservation.id}/approve`, { method: 'POST', body: JSON.stringify({}) })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setReservations(prev => prev.filter(r => r.id !== reservation.id))
          setStats(prev => ({ ...prev, active: Math.max(0, prev.active-1), confirmed: prev.confirmed+1 }))
          if (selected?.id === reservation.id) setSelected(null)
          setDetailModal(null)
          setConfirm({ message: `Reservation for ${reservation.name ?? 'this reservation'} has been confirmed.` })
        }
      })
  }

  function cancelReservation(reservation) {
    apiFetch(`${API}/boutique/reservations/${reservation.id}/cancel`, { method: 'PATCH', body: JSON.stringify({}) })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setReservations(prev => prev.filter(r => r.id !== reservation.id))
          setStats(prev => ({ ...prev, active: Math.max(0, prev.active-1), cancelled: prev.cancelled+1 }))
          if (selected?.id === reservation.id) setSelected(null)
          setDetailModal(null)
        }
      })
  }

  function extendExpiry(reservation) {
    const newExpiry = new Date(new Date(reservation.expires_at).getTime() + extendHours * 3600000).toISOString()
    apiFetch(`${API}/boutique/reservations/${reservation.id}/extend`, { method: 'PATCH', body: JSON.stringify({ expires_at: newExpiry, message: extendMsg }) })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setReservations(prev => prev.map(r => r.id === reservation.id ? { ...r, expires_at: newExpiry } : r))
          if (selected?.id === reservation.id) setSelected(prev => ({ ...prev, expires_at: newExpiry }))
          setExtendModal(null)
          setConfirm({ message: `The expiry for ${reservation.name ?? 'this reservation'} has been extended.` })
        }
      })
  }

  function extendedTime(reservation) {
    if (!reservation?.expires_at) return ''
    const t = new Date(new Date(reservation.expires_at).getTime() + extendHours * 3600000)
    return t.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })
  }

  const canMarkCollected = (status) => status === 'confirmed'
  const canConfirm       = (status) => status === 'pending'
  const canExtend        = (status) => status === 'confirmed'
  const canCancel        = (status) => status === 'pending' || status === 'confirmed'

  return (
    <>
      {/* Tabs with counts */}
      <div className="tabs">
        {[
          [t('reservations.tabs.active'),    stats.active],
          [t('reservations.tabs.confirmed'), stats.confirmed],
          [t('reservations.tabs.completed'), stats.collected],
          [t('reservations.tabs.expired'),   stats.expired],
          [t('reservations.tabs.cancelled'), stats.cancelled],
        ].map(([label, count], i) => (
          <div key={label} className={`tab${activeTab===i?' act':''}`} onClick={() => setActiveTab(i)}>
            {label} ({count})
          </div>
        ))}
      </div>

      <div className="grid2 res-grid">

        {/* ── Left: table ── */}
        <div>
          <div className="card res-table-card">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('reservations.table.customer')}</th>
                  <th>{t('reservations.table.item')}</th>
                  <th>{t('reservations.table.size')}</th>
                  <th>{t('reservations.table.pickup_price')}</th>
                  <th>{t('reservations.table.expires_in')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {!loading && reservations.map(r => {
                  const urgent = isUrgent(r.expires_at) && r.status === 'pending'
                  return (
                    <tr key={r.id} onClick={() => setSelected(r)}
                      className={`res-row${urgent?' res-row-urgent':''}`}>
                      <td>
                        <div className="res-customer-name">{r.name ?? '—'}</div>
                        <div className="res-customer-phone">{r.phone ?? ''}</div>
                      </td>
                      <td>{r.product_name ?? '—'}</td>
                      <td>{r.size_label ?? '—'}{r.colour ? ` · ${r.colour}` : ''}</td>
                      <td className="res-pickup-price">€{r.pickup_price}</td>
                      <td>
                        {r.status === 'pending' ? (
                          <span className={`timer-badge ${urgent?'urgent':'normal'}`}>
                            <span className="material-symbols-outlined">timer</span>
                            {timeLeft(r.expires_at)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="res-actions-cell">
                        <button
                          className={`btn btn-sm ${selected?.id===r.id?'btn-primary':'btn-outline'}`}
                          onClick={e => { e.stopPropagation(); setDetailModal(r); setSelected(r) }}
                        >{t('reservations.detail_btn')}</button>
                        {' '}
                        <button className="btn btn-sm btn-whatsapp" onClick={e => {
                          e.stopPropagation()
                          const phone = r.phone?.replace(/\D/g, '')
                          const name  = r.name?.split(' ')[0] ?? ''
                          const msg   = encodeURIComponent(`Ciao ${name}, regarding your reservation for ${r.product_name} — `)
                          window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
                        }}>
                          <span className="material-symbols-outlined">chat_bubble</span>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {loading && <div className="state-loading">{t('reservations.loading')}</div>}
            {!loading && reservations.length === 0 && (
              <div className="state-empty">{t('reservations.empty')}</div>
            )}
          </div>
        </div>

        {/* ── Right: detail panel ── */}
        {selected && (
          <div className="detail-panel">
            <div className="detail-panel-hdr">
              <div className="detail-panel-icon">
                <span className="material-symbols-outlined">event_available</span>
              </div>
              <div style={{ flex:1 }}>
                <div className="detail-panel-title">{selected.name ?? '—'}</div>
                <div className="detail-panel-sub">{t('reservations.detail.reservation')} · {fmtDateTime(selected.confirmed_at)}</div>
              </div>
              {selected.status === 'pending' && (
                <span className={`timer-badge ${isUrgent(selected.expires_at)?'urgent':'normal'}`}>
                  <span className="material-symbols-outlined">timer</span>
                  {timeLeft(selected.expires_at)}
                </span>
              )}
            </div>

            <div className="detail-panel-body">
              <div className="detail-row">
                <div className="detail-label">{t('reservations.detail.item')}</div>
                <div className="detail-value">
                  <strong>{selected.product_name ?? '—'}</strong><br />
                  <span className="res-detail-sub">
                    {selected.sku ? `SKU: ${selected.sku} · ` : ''}{t('reservations.detail.size')} {selected.size_label ?? '—'} · {selected.colour ?? '—'}
                  </span>
                </div>
              </div>

              <div className="detail-row">
                <div className="detail-label">{t('reservations.detail.customer')}</div>
                <div className="detail-value">
                  {selected.name ?? '—'}<br />
                  <span className="res-detail-sub">
                    {selected.email ? <><a href={`mailto:${selected.email}`} className="res-email-link">{selected.email}</a> · </> : ''}{selected.phone ?? ''}
                  </span>
                </div>
              </div>

              <div className="detail-row">
                <div className="detail-label">{t('reservations.detail.pickup_price')}</div>
                <div className="detail-value res-price-val">
                  €{selected.pickup_price}
                  {selected.pickup_discount_pct && (
                    <span className="res-price-sub"> –{selected.pickup_discount_pct}% ({t('reservations.detail.retail')}: €{selected.retail_price})</span>
                  )}
                </div>
              </div>

              <div className="detail-row">
                <div className="detail-label">{t('reservations.detail.reserved_at')}</div>
                <div className="detail-value">{fmtDateTime(selected.confirmed_at)}</div>
              </div>

              <div className="detail-row">
                <div className="detail-label">{t('reservations.detail.expires_at')}</div>
                <div className={`detail-value res-expires${isUrgent(selected.expires_at) && selected.status==='pending'?' res-expires-urgent':''}`}>
                  {fmtDateTime(selected.expires_at)}
                </div>
              </div>

              <div className="detail-row">
                <div className="detail-label">{t('reservations.detail.visits')}</div>
                <div className="detail-value">
                  {selected.boutique_visit_count
                    ? `${selected.boutique_visit_count} visit${selected.boutique_visit_count>1?'s':''} · ${t('reservations.detail.repeat')}`
                    : t('reservations.detail.first_visit')}
                </div>
              </div>

              <div className="detail-divider" />

              {(['pending','confirmed','collected','expired','cancelled'].includes(selected.status)) && (
                <>
                  <div className="lbl-section res-actions-lbl">{t('reservations.detail.actions')}</div>
                  <div className="res-action-btns">
                    <div className="res-action-grid">
                      <button onClick={() => canMarkCollected(selected.status) ? markCollected(selected) : null}
                        className="btn btn-primary res-grid-btn"
                        disabled={!canMarkCollected(selected.status)}
                        style={{ opacity: !canMarkCollected(selected.status) ? 0.4 : 1, cursor: !canMarkCollected(selected.status) ? 'not-allowed' : 'pointer' }}>
                        <span className="material-symbols-outlined">check_circle</span>
                        {t('reservations.detail.mark_collected')}
                      </button>
                      <button onClick={() => canConfirm(selected.status) ? confirmReservation(selected) : null}
                        className="btn btn-primary res-grid-btn"
                        disabled={!canConfirm(selected.status)}
                        style={{ opacity: !canConfirm(selected.status) ? 0.4 : 1, cursor: !canConfirm(selected.status) ? 'not-allowed' : 'pointer' }}>
                        <span className="material-symbols-outlined">event_available</span>
                        {t('reservations.detail.confirm')}
                      </button>
                      <button onClick={() => canExtend(selected.status) ? (setExtendModal(selected), setExtendHours(1), setExtendMsg('')) : null}
                        className="btn btn-outline res-grid-btn"
                        disabled={!canExtend(selected.status)}
                        style={{ opacity: !canExtend(selected.status) ? 0.4 : 1, cursor: !canExtend(selected.status) ? 'not-allowed' : 'pointer' }}>
                        <span className="material-symbols-outlined">schedule</span>
                        {t('reservations.detail.extend')}
                      </button>
                      <button onClick={() => canCancel(selected.status) ? cancelReservation(selected) : null}
                        className="btn btn-red res-grid-btn"
                        disabled={!canCancel(selected.status)}
                        style={{ opacity: !canCancel(selected.status) ? 0.4 : 1, cursor: !canCancel(selected.status) ? 'not-allowed' : 'pointer' }}>
                        <span className="material-symbols-outlined">close</span>
                        {t('common.cancel')}
                      </button>
                    </div>
                    <button className="btn btn-whatsapp res-full-btn" onClick={() => {
                      const phone = selected.phone?.replace(/\D/g, '')
                      const name  = selected.name?.split(' ')[0] ?? ''
                      const msg   = encodeURIComponent(`Ciao ${name}, regarding your reservation for ${selected.product_name} — `)
                      window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
                    }}>
                      <span className="material-symbols-outlined">chat_bubble</span>
                      WhatsApp {selected.name?.split(' ')[0]} ({selected.phone ?? ''})
                    </button>
                  </div>
                </>
              )}

              <div className="detail-divider" />
              <div className="lbl-section res-notes-lbl">{t('reservations.detail.notes')}</div>
              <textarea className="form-textarea res-notes-ta" placeholder={t('reservations.detail.notes_placeholder')} />
            </div>
          </div>
        )}
      </div>

      {/* ── Detail Modal ── */}
      {detailModal && (
        <div className="modal-backdrop" onClick={() => setDetailModal(null)}>
          <div className="modal modal-lg res-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <div className="modal-title">{t('reservations.modal.title')} <em className="modal-em-gold">{t('reservations.modal.title_em')}</em></div>
              <button onClick={() => setDetailModal(null)} className="modal-close">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {isUrgent(detailModal.expires_at) && detailModal.status === 'pending' && (
              <div className="res-urgent-alert">
                <span className="material-symbols-outlined res-urgent-icon">timer</span>
                <strong>{t('reservations.modal.expiring_in')} {timeLeft(detailModal.expires_at)}</strong>
                <span className="res-urgent-sub">{detailModal.name} {t('reservations.modal.not_arrived')}</span>
              </div>
            )}

            <div className="res-modal-grid">
              {[
                { lbl: t('reservations.detail.customer'),    val: detailModal.name ?? '—',             sub: `${detailModal.email ?? ''} · ${detailModal.phone ?? ''}` },
                { lbl: t('reservations.detail.reserved_at'), val: fmtDateTime(detailModal.confirmed_at) },
                { lbl: t('reservations.detail.item'),        val: detailModal.product_name ?? '—',     sub: `${t('reservations.detail.size')} ${detailModal.size_label ?? '—'} · ${detailModal.colour ?? '—'}` },
                { lbl: t('reservations.detail.expires_at'),  val: fmtDateTime(detailModal.expires_at), red: isUrgent(detailModal.expires_at) && detailModal.status==='pending' },
                { lbl: t('reservations.detail.pickup_price'),val: `€${detailModal.pickup_price}`,      green: true },
                { lbl: t('reservations.detail.visits'),      val: detailModal.boutique_visit_count ? `${detailModal.boutique_visit_count} visits` : t('reservations.detail.first_visit') },
              ].map(d => (
                <div key={d.lbl} className="res-modal-field">
                  <div className="res-modal-field-lbl">{d.lbl}</div>
                  <div className={`res-modal-field-val${d.green?' res-green':d.red?' res-red':''}`}>{d.val}</div>
                  {d.sub && <div className="res-modal-field-sub">{d.sub}</div>}
                </div>
              ))}
            </div>

            <div className="modal-footer" style={{ flexDirection:'column', gap:'8px' }}>
              <div className="res-action-grid">
                <button onClick={() => canMarkCollected(detailModal.status) ? markCollected(detailModal) : null}
                  className="btn btn-primary res-grid-btn"
                  disabled={!canMarkCollected(detailModal.status)}
                  style={{ opacity: !canMarkCollected(detailModal.status) ? 0.4 : 1, cursor: !canMarkCollected(detailModal.status) ? 'not-allowed' : 'pointer' }}>
                  <span className="material-symbols-outlined">check_circle</span>
                  {t('reservations.detail.mark_collected')}
                </button>
                <button onClick={() => canConfirm(detailModal.status) ? confirmReservation(detailModal) : null}
                  className="btn btn-primary res-grid-btn"
                  disabled={!canConfirm(detailModal.status)}
                  style={{ opacity: !canConfirm(detailModal.status) ? 0.4 : 1, cursor: !canConfirm(detailModal.status) ? 'not-allowed' : 'pointer' }}>
                  <span className="material-symbols-outlined">event_available</span>
                  {t('reservations.detail.confirm')}
                </button>
                <button onClick={() => canExtend(detailModal.status) ? (setExtendModal(detailModal), setDetailModal(null), setExtendHours(1), setExtendMsg('')) : null}
                  className="btn btn-outline res-grid-btn"
                  disabled={!canExtend(detailModal.status)}
                  style={{ opacity: !canExtend(detailModal.status) ? 0.4 : 1, cursor: !canExtend(detailModal.status) ? 'not-allowed' : 'pointer' }}>
                  <span className="material-symbols-outlined">schedule</span>
                  {t('reservations.detail.extend')}
                </button>
                <button onClick={() => canCancel(detailModal.status) ? cancelReservation(detailModal) : null}
                  className="btn btn-red res-grid-btn"
                  disabled={!canCancel(detailModal.status)}
                  style={{ opacity: !canCancel(detailModal.status) ? 0.4 : 1, cursor: !canCancel(detailModal.status) ? 'not-allowed' : 'pointer' }}>
                  <span className="material-symbols-outlined">close</span>
                  {t('common.cancel')}
                </button>
              </div>
              <button className="btn btn-whatsapp res-full-btn" onClick={() => {
                const phone = detailModal.phone?.replace(/\D/g, '')
                const name  = detailModal.name?.split(' ')[0] ?? ''
                const msg   = encodeURIComponent(`Ciao ${name}, regarding your reservation for ${detailModal.product_name} — `)
                window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
              }}>
                <span className="material-symbols-outlined">chat_bubble</span>
                WhatsApp {detailModal.name?.split(' ')[0]} ({detailModal.phone ?? ''})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Extend Expiry Modal ── */}
      {extendModal && (
        <div className="modal-backdrop" onClick={() => setExtendModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <div className="modal-title">{t('reservations.extend.title')} <em className="modal-em-gold">{t('reservations.extend.title_em')}</em></div>
              <button onClick={() => setExtendModal(null)} className="modal-close">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div style={{ padding:'0 4px' }}>
              <p className="res-extend-desc">
                {t('reservations.extend.extending')} <strong>{extendModal.name}</strong> — <strong>{extendModal.product_name} · {t('reservations.detail.size')} {extendModal.size_label}</strong>
              </p>
              <div className="form-group">
                <label className="form-lbl">{t('reservations.extend.new_expiry')}</label>
                <select className="form-select" value={extendHours} onChange={e => setExtendHours(Number(e.target.value))}>
                  <option value={1}>+1 {t('reservations.extend.hour')} ({t('reservations.extend.until')} {extendedTime(extendModal)})</option>
                  <option value={2}>+2 {t('reservations.extend.hours')}</option>
                  <option value={3}>+3 {t('reservations.extend.hours')}</option>
                  <option value={6}>+6 {t('reservations.extend.hours')}</option>
                  <option value={24}>+24 {t('reservations.extend.hours')} ({t('reservations.extend.next_day')})</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-lbl">{t('reservations.extend.message_label')}</label>
                <textarea className="form-textarea res-extend-ta"
                  placeholder={t('reservations.extend.message_placeholder')}
                  value={extendMsg} onChange={e => setExtendMsg(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setExtendModal(null)} className="btn btn-outline">{t('common.cancel')}</button>
              <button onClick={() => extendExpiry(extendModal)} className="btn btn-primary">
                <span className="material-symbols-outlined">schedule</span>
                {t('reservations.extend.submit')}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirm && <ConfirmModal message={confirm.message} onClose={() => setConfirm(null)} />}
    </>
  )
}
