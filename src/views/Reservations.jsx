import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'
import useNotifStore from '../store/notifStore'

const API = import.meta.env.VITE_API_URL

const STATUS_MAP = ['pending', 'confirmed', 'collected', 'expired', 'cancelled']

function fmtDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const y = new Date(now); y.setDate(now.getDate() - 1)
  const tm = new Date(now); tm.setDate(now.getDate() + 1)
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  if (sameDay(d, now)) return `Today, ${time}`
  if (sameDay(d, y))   return `Yesterday, ${time}`
  if (sameDay(d, tm))  return `Tomorrow, ${time}`
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ', ' + time
}

function timeLeft(iso) {
  const diff = new Date(iso) - new Date()
  if (diff <= 0) return 'Expired'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return `${h}:${String(m).padStart(2,'0')}`
}

// Urgent alert / red styling on Expires At — anything within 24h and still active
function isUrgentWithinDay(iso) {
  const diff = new Date(iso) - new Date()
  return diff > 0 && diff < 86400000
}
// Kept for compatibility with existing call sites (list rows use it for red styling)
function isUrgent(iso) { return (new Date(iso) - new Date()) < 7200000 }

// Live countdown in modal header — updates every second while modal is open
function formatCountdown(iso, now) {
  const diff = new Date(iso) - now
  if (diff <= 0) return 'Expired'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

// Status → action-availability gates (pure)
const canMarkCollected = (status) => status === 'confirmed'
const canConfirm       = (status) => status === 'pending'
const canExtend        = (status) => status === 'confirmed'
const canCancel        = (status) => status === 'pending' || status === 'confirmed'

// Open WhatsApp chat for a reservation
function openWhatsApp(reservation) {
  const phone = reservation.phone?.replace(/\D/g, '')
  const name  = reservation.name?.split(' ')[0] ?? ''
  const msg   = encodeURIComponent(`Ciao ${name}, regarding your reservation for ${reservation.product_name} — `)
  window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
}

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

// ══ Shared detail card — used in the side panel AND the detail modal ═══
// Same layout everywhere. Header includes optional live countdown pill and
// modal close button. Body has field rows, stacked action layout, and the
// wired customer-notes textarea.
function ReservationDetailCard({
  reservation: r,
  now,                       // live time (for countdown)
  isModal,
  onClose,                   // modal-only
  onConfirm, onMarkCollected, onExtend, onCancel,
  notesValue,
  onNotesChange, onNotesBlur,
  notesSaving, notesSaved,
  t,
}) {
  if (!r) return null

  const isPendingOrConfirmed = r.status === 'pending' || r.status === 'confirmed'
  const urgent = isPendingOrConfirmed && isUrgentWithinDay(r.expires_at)
  const hasDiscount = parseFloat(r.pickup_discount_pct) > 0

  return (
    <>
      <div className="detail-panel-hdr">
        <div className="detail-panel-icon">
          <span className="material-symbols-outlined">event_available</span>
        </div>
        <div className="detail-panel-hdr-info">
          <div className="detail-panel-title">{r.name ?? '—'}</div>
          <div className="detail-panel-sub">
            {t('reservations.detail.reservation')} #{r.id.slice(0, 8)} · {fmtDateTime(r.created_at)}
          </div>
        </div>
        {urgent && (
          <div className="res-header-timer">
            <span className="material-symbols-outlined">timer</span>
            <span>{formatCountdown(r.expires_at, now)}</span>
          </div>
        )}
        {isModal && (
          <button onClick={onClose} className="modal-close res-hdr-close">
            <span className="material-symbols-outlined">close</span>
          </button>
        )}
      </div>

      <div className="detail-panel-body">
        <div className="detail-row">
          <div className="detail-label">{t('reservations.detail.item')}</div>
          <div className="detail-value">
            <strong>{r.product_name ?? '—'}</strong><br />
            <span className="res-detail-sub">
              {r.sku ? `SKU: ${r.sku} · ` : ''}
              {t('reservations.detail.size')} {r.size_label ?? '—'}
              {r.colour ? ` · ${r.colour}` : ''}
            </span>
          </div>
        </div>

        <div className="detail-row">
          <div className="detail-label">{t('reservations.detail.customer')}</div>
          <div className="detail-value">
            {r.name ?? '—'}<br />
            <span className="res-detail-sub">
              {r.email && (
                <>
                  <a href={`mailto:${r.email}`} className="res-email-link">{r.email}</a> ·{' '}
                </>
              )}
              {r.phone ?? ''}
            </span>
          </div>
        </div>

        <div className="detail-row">
          <div className="detail-label">{t('reservations.detail.pickup_price')}</div>
          <div className={`detail-value${hasDiscount ? ' res-price-val' : ''}`}>
            €{r.pickup_price}
            {hasDiscount && (
              <span className="res-price-sub">
                {' '}−{r.pickup_discount_pct}% ({t('reservations.detail.retail')}: €{r.retail_price})
              </span>
            )}
          </div>
        </div>

        <div className="detail-row">
          <div className="detail-label">{t('reservations.detail.reserved_at')}</div>
          <div className="detail-value">{fmtDateTime(r.confirmed_at)}</div>
        </div>

        <div className="detail-row">
          <div className="detail-label">{t('reservations.detail.expires_at')}</div>
          <div className={`detail-value res-expires${urgent ? ' res-expires-urgent' : ''}`}>
            {fmtDateTime(r.expires_at)}
          </div>
        </div>

        {r.boutique_visit_count != null && (
          <div className="detail-row">
            <div className="detail-label">{t('reservations.detail.visits')}</div>
            <div className="detail-value">
              {r.boutique_visit_count > 1
                ? `${r.boutique_visit_count} ${t('reservations.detail.visits_plural')} · ${t('reservations.detail.repeat')}`
                : t('reservations.detail.first_visit')}
              {r.is_vip && <span className="res-vip-badge">VIP</span>}
            </div>
          </div>
        )}

        <div className="detail-divider" />

        <div className="lbl-section res-actions-lbl">{t('reservations.detail.actions')}</div>
        <div className="res-actions-stack">
          {r.status === 'pending' && (
            <button onClick={() => onConfirm(r)} className="btn btn-primary res-primary-full">
              <span className="material-symbols-outlined">event_available</span>
              {t('reservations.detail.confirm')}
            </button>
          )}
          {r.status === 'confirmed' && (
            <button onClick={() => onMarkCollected(r)} className="btn btn-primary res-primary-full">
              <span className="material-symbols-outlined">check_circle</span>
              {t('reservations.detail.mark_collected')} — Process Payment
            </button>
          )}

          {r.status === 'collected' && r.collected_at && (
            <div className="res-status-note res-status-collected">
              <span className="material-symbols-outlined">verified</span>
              Collected on {fmtDateTime(r.collected_at)}
            </div>
          )}
          {r.status === 'cancelled' && r.cancelled_at && (
            <div className="res-status-note res-status-cancelled">
              <span className="material-symbols-outlined">cancel</span>
              Cancelled {r.cancelled_by ? `by ${r.cancelled_by} ` : ''}on {fmtDateTime(r.cancelled_at)}
            </div>
          )}
          {r.status === 'expired' && (
            <div className="res-status-note res-status-expired">
              <span className="material-symbols-outlined">event_busy</span>
              Expired on {fmtDateTime(r.expires_at)}
            </div>
          )}

          {r.phone && (
            <button className="btn btn-whatsapp res-primary-full" onClick={() => openWhatsApp(r)}>
              <span className="material-symbols-outlined">chat_bubble</span>
              WhatsApp {r.name?.split(' ')[0]} ({r.phone})
            </button>
          )}

          {(canExtend(r.status) || canCancel(r.status)) && (
            <div className="res-action-row">
              <button
                onClick={() => canExtend(r.status) && onExtend(r)}
                className="btn btn-outline"
                disabled={!canExtend(r.status)}>
                <span className="material-symbols-outlined">schedule</span>
                {t('reservations.detail.extend')}
              </button>
              <button
                onClick={() => canCancel(r.status) && onCancel(r)}
                className="btn btn-red"
                disabled={!canCancel(r.status)}>
                <span className="material-symbols-outlined">close</span>
                {t('common.cancel')}
              </button>
            </div>
          )}
        </div>

        <div className="detail-divider" />

        <div className="lbl-section res-notes-lbl">
          <span>{t('reservations.detail.notes')}</span>
          {notesSaving && <span className="res-notes-status res-notes-saving">Saving…</span>}
          {notesSaved  && (
            <span className="res-notes-status res-notes-saved">
              <span className="material-symbols-outlined">check</span>Saved
            </span>
          )}
        </div>
        <textarea
          className="form-textarea res-notes-ta"
          placeholder={t('reservations.detail.notes_placeholder')}
          value={notesValue}
          onChange={e => onNotesChange(r, e.target.value)}
          onBlur={() => onNotesBlur(r)}
        />
      </div>
    </>
  )
}

export default function Reservations() {
  const { t, i18n } = useTranslation()

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

  // Live clock for the detail modal's countdown badge — ticks every second only while the modal is open
  const [nowTick, setNowTick] = useState(new Date())
  useEffect(() => {
    if (!detailModal) return
    if (detailModal.status !== 'pending' && detailModal.status !== 'confirmed') return
    const id = setInterval(() => setNowTick(new Date()), 1000)
    return () => clearInterval(id)
  }, [detailModal])
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
  }, [activeTab, i18n.language])

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
    apiFetch(`${API}/boutique/reservations/${reservation.id}/extend`, {
      method: 'PATCH',
      body:   JSON.stringify({ hours: extendHours }),
    })
      .then(r => r.json())
      .then(res => {
        if (!res?.success) {
          setConfirm({ message: `Failed to extend expiry${res?.message ? ': ' + res.message : ''}` })
          return
        }
        // Backend is source of truth for new expiry (and possibly status).
        // Merge the whole returned object into local state so nothing drifts.
        const updated = res.data
        setReservations(prev => prev.map(r => r.id === reservation.id ? { ...r, ...updated } : r))
        if (selected?.id    === reservation.id) setSelected(s    => s    && { ...s,    ...updated })
        if (detailModal?.id === reservation.id) setDetailModal(m => m    && { ...m,    ...updated })
        setExtendModal(null)
        setConfirm({ message: `The expiry for ${reservation.name ?? 'this reservation'} has been extended.` })
      })
      .catch(err => {
        console.error('[Reservations] extend failed', err)
        setConfirm({ message: 'Failed to extend expiry (network error)' })
      })
  }

  function extendedTime(reservation) {
    if (!reservation?.expires_at) return ''
    const t = new Date(new Date(reservation.expires_at).getTime() + extendHours * 3600000)
    return t.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })
  }

  // ── Notes: draft state + auto-save on blur ─────────────────────────
  const [notesDrafts, setNotesDrafts] = useState({})       // { [id]: string }
  const [notesSaving, setNotesSaving] = useState(null)     // id currently saving
  const [notesSavedFor, setNotesSavedFor] = useState(null) // id whose save just succeeded (drives "✓ Saved" indicator)

  function getNotesValue(reservation) {
    const draft = notesDrafts[reservation.id]
    return draft !== undefined ? draft : (reservation.notes ?? '')
  }

  function handleNotesChange(reservation, val) {
    setNotesDrafts(prev => ({ ...prev, [reservation.id]: val }))
    if (notesSavedFor === reservation.id) setNotesSavedFor(null)
  }

  async function saveNotesOnBlur(reservation) {
    const draft = notesDrafts[reservation.id]
    if (draft === undefined) return              // never edited
    if (draft === (reservation.notes ?? '')) {   // no actual change → clear draft, no PATCH
      setNotesDrafts(prev => { const n = { ...prev }; delete n[reservation.id]; return n })
      return
    }

    setNotesSaving(reservation.id)
    try {
      const res = await apiFetch(`${API}/boutique/reservations/${reservation.id}/notes`, {
        method: 'PATCH',
        body:   JSON.stringify({ notes: draft }),
      }).then(r => r.json())

      if (res?.success) {
        // Sync notes into list + selected + modal
        setReservations(prev => prev.map(r => r.id === reservation.id ? { ...r, notes: draft } : r))
        if (selected?.id    === reservation.id) setSelected(s    => s    && { ...s,    notes: draft })
        if (detailModal?.id === reservation.id) setDetailModal(m => m    && { ...m,    notes: draft })

        // Clear the draft — value is now the "saved" state
        setNotesDrafts(prev => { const n = { ...prev }; delete n[reservation.id]; return n })

        // Show "✓ Saved" for 2s
        setNotesSavedFor(reservation.id)
        setTimeout(() => setNotesSavedFor(curr => curr === reservation.id ? null : curr), 2000)
      } else {
        setConfirm({ message: `Failed to save note${res?.message ? ': ' + res.message : ''}` })
      }
    } catch (err) {
      console.error('[Reservations] saveNotes failed', err)
      setConfirm({ message: 'Failed to save note (network error)' })
    } finally {
      setNotesSaving(null)
    }
  }

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


      {/* ── Right: detail panel (side view when a reservation is selected) ── */}
      {selected && (
        <div className="detail-panel">
          <ReservationDetailCard
            reservation={selected}
            now={nowTick}
            isModal={false}
            onConfirm={confirmReservation}
            onMarkCollected={markCollected}
            onExtend={(r) => { setExtendModal(r); setExtendHours(1); setExtendMsg('') }}
            onCancel={cancelReservation}
            notesValue={getNotesValue(selected)}
            onNotesChange={handleNotesChange}
            onNotesBlur={saveNotesOnBlur}
            notesSaving={notesSaving === selected.id}
            notesSaved={notesSavedFor === selected.id}
            t={t}
          />
        </div>
      )}
      </div>

      {/* ── Detail Modal (opened from the row's detail button) ── */}
      {detailModal && (
        <div className="modal-backdrop" onClick={() => setDetailModal(null)}>
          <div className="modal modal-lg res-detail-modal" onClick={e => e.stopPropagation()}>
            <ReservationDetailCard
              reservation={detailModal}
              now={nowTick}
              isModal={true}
              onClose={() => setDetailModal(null)}
              onConfirm={confirmReservation}
              onMarkCollected={markCollected}
              onExtend={(r) => { setExtendModal(r); setDetailModal(null); setExtendHours(1); setExtendMsg('') }}
              onCancel={cancelReservation}
              notesValue={getNotesValue(detailModal)}
              onNotesChange={handleNotesChange}
              onNotesBlur={saveNotesOnBlur}
              notesSaving={notesSaving === detailModal.id}
              notesSaved={notesSavedFor === detailModal.id}
              t={t}
            />
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
