import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { isWhatsappEnabled } from '../lib/auth'
import useNotifStore from '../store/notifStore'
import i18n from '../lib/i18n'
import Loading from '../components/ui/Loading'

const API = import.meta.env.VITE_API_URL

const STATUS_MAP = ['pending', 'confirmed', 'collected', 'expired', 'cancelled']

// The endpoint now takes page/limit, so this is a real page size rather than
// the old "ask for 100 and hope that is all of them".
const PAGE_SIZE = 20

function fmtDateTime(iso, t) {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const y = new Date(now); y.setDate(now.getDate() - 1)
  const tm = new Date(now); tm.setDate(now.getDate() + 1)
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  const time = d.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })
  if (sameDay(d, now)) return t('reservations.date.today',     'Today, {{time}}',     { time })
  if (sameDay(d, y))   return t('reservations.date.yesterday', 'Yesterday, {{time}}', { time })
  if (sameDay(d, tm))  return t('reservations.date.tomorrow',  'Tomorrow, {{time}}',  { time })
  return d.toLocaleDateString(i18n.language, { day: '2-digit', month: 'short' }) + ', ' + time
}

// `now` is passed in so the table column ticks off the page's shared clock.
// Reading new Date() internally would freeze the value until the next render.
function timeLeft(iso, now, t) {
  const diff = new Date(iso) - now
  if (diff <= 0) return t('common.expired')
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  // Confirmed pickup windows run for days, and "51:59" in h:mm reads like
  // minutes:seconds. Past a day, show days and hours instead.
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`
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
function formatCountdown(iso, now, t) {
  const diff = new Date(iso) - now
  if (diff <= 0) return t('common.expired')
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

// Status → action-availability gates (pure)
const canMarkCollected = (status) => status === 'confirmed'
const canConfirm       = (status) => status === 'pending'
// Confirmed only — a pending reservation must be confirmed before its expiry
// can be extended. The Extend button is deliberately disabled while pending.
const canExtend        = (status) => status === 'confirmed'
const canCancel        = (status) => status === 'pending' || status === 'confirmed'

// Open WhatsApp chat for a reservation. The message goes to the customer, so
// it follows the boutique's language rather than staying English.
function openWhatsApp(reservation, t) {
  const phone = reservation.phone?.replace(/\D/g, '')
  const name  = reservation.name?.split(' ')[0] ?? ''
  const msg   = encodeURIComponent(t(
    'reservations.whatsapp_msg',
    'Ciao {{name}}, regarding your reservation for {{product}} — ',
    { name, product: reservation.product_name },
  ))
  window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
}

function ConfirmModal({ message, onClose }) {
  const { t } = useTranslation()
  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex:300 }}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()} style={{ textAlign:'center' }}>
        <div style={{ fontSize:44, marginBottom:12 }}>✅</div>
        <div className="modal-success-title">{message}</div>
        <button onClick={onClose} className="btn btn-primary modal-success-btn" style={{ marginTop:16, width:'100%', justifyContent:'center' }}>{t('reservations.done')}</button>
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
            {t('reservations.detail.reservation')} #{r.id.slice(0, 8)} · {fmtDateTime(r.created_at, t)}
          </div>
        </div>
        {urgent && (
          <div className="res-header-timer">
            <span className="material-symbols-outlined">timer</span>
            <span>{formatCountdown(r.expires_at, now, t)}</span>
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
          <div className="detail-value">{fmtDateTime(r.confirmed_at, t)}</div>
        </div>

        <div className="detail-row">
          <div className="detail-label">{t('reservations.detail.expires_at')}</div>
          <div className={`detail-value res-expires${urgent ? ' res-expires-urgent' : ''}`}>
            {fmtDateTime(r.expires_at, t)}
          </div>
        </div>

        {r.boutique_visit_count != null && (
          <div className="detail-row">
            <div className="detail-label">{t('reservations.detail.visits')}</div>
            <div className="detail-value">
              {r.boutique_visit_count > 1
                ? `${r.boutique_visit_count} ${t('reservations.detail.visits_plural', 'visits')} · ${t('reservations.detail.repeat')}`
                : t('reservations.detail.first_visit')}
              {r.is_vip && <span className="res-vip-badge">VIP</span>}
            </div>
          </div>
        )}

        <div className="detail-divider" />

        <div className="lbl-section res-actions-lbl">{t('reservations.detail.actions')}</div>
        <div className="res-actions-stack">
          {canConfirm(r.status) && (
            <button onClick={() => onConfirm(r)} className="btn btn-primary res-primary-full">
              <span className="material-symbols-outlined">event_available</span>
              {t('reservations.detail.confirm')}
            </button>
          )}
          {canMarkCollected(r.status) && (
            <button onClick={() => onMarkCollected(r)} className="btn btn-primary res-primary-full">
              <span className="material-symbols-outlined">check_circle</span>
              {/* the key's value already ends in "— Process Payment" */}
              {t('reservations.detail.mark_collected')}
            </button>
          )}

          {r.status === 'collected' && r.collected_at && (
            <div className="res-status-note res-status-collected">
              <span className="material-symbols-outlined">verified</span>
              {t('reservations.status_note.collected', 'Collected on {{date}}', { date: fmtDateTime(r.collected_at, t) })}
            </div>
          )}
          {r.status === 'cancelled' && r.cancelled_at && (
            <div className="res-status-note res-status-cancelled">
              <span className="material-symbols-outlined">cancel</span>
              {r.cancelled_by
                ? t('reservations.status_note.cancelled_by', 'Cancelled by {{who}} on {{date}}', { who: r.cancelled_by, date: fmtDateTime(r.cancelled_at, t) })
                : t('reservations.status_note.cancelled',    'Cancelled on {{date}}',            { date: fmtDateTime(r.cancelled_at, t) })}
            </div>
          )}
          {r.status === 'expired' && (
            <div className="res-status-note res-status-expired">
              <span className="material-symbols-outlined">event_busy</span>
              {t('reservations.status_note.expired', 'Expired on {{date}}', { date: fmtDateTime(r.expires_at, t) })}
            </div>
          )}

          {r.phone && isWhatsappEnabled() && (
            <button className="btn btn-whatsapp res-primary-full" onClick={() => openWhatsApp(r, t)}>
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
          {notesSaving && <span className="res-notes-status res-notes-saving">{t('reservations.notes_saving')}</span>}
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

  // Set when arriving from a notification link (/reservations/:id). The list is
  // fetched one status at a time and the notification doesn't say which status
  // the reservation has, so the id is held here until the tab holding it loads.
  const { id: routeReservationId } = useParams()
  const navigate = useNavigate()
  const routeTargetIdRef  = useRef(routeReservationId ?? null)
  const routeLocatedIdRef = useRef(null)

  const [activeTab,    setActiveTab]    = useState(0)
  const [stats,        setStats]        = useState({ active:0, confirmed:0, collected:0, expired:0, cancelled:0 })
  const [reservations, setReservations] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [reloadTick, setReloadTick] = useState(0)
  const [page,       setPage]       = useState(1)
  const [totalPages, setTotalPages] = useState(null)
  const [totalCount, setTotalCount] = useState(null)
  const [selected,     setSelected]     = useState(null)
  const [detailModal,  setDetailModal]  = useState(null)
  const [extendModal,  setExtendModal]  = useState(null)
  const [extendHours,  setExtendHours]  = useState(1)

  // One clock for every countdown on the page: the table's "Expires In" column,
  // the side panel's badge and the modal's badge all read from this tick. It
  // used to run only while the detail modal was open, which left the table and
  // the side panel frozen until the next reload.
  const [nowTick, setNowTick] = useState(new Date())
  const countsDown = s => s === 'pending' || s === 'confirmed'
  // Derived to a boolean so a refetch of `reservations` doesn't restart the
  // interval — only a change in whether anything is counting down does.
  const needsClock =
    reservations.some(r => countsDown(r.status)) ||
    countsDown(selected?.status) ||
    countsDown(detailModal?.status)
  useEffect(() => {
    if (!needsClock) return
    const id = setInterval(() => setNowTick(new Date()), 1000)
    return () => clearInterval(id)
  }, [needsClock])
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
        if (!res.success) return
        setStats({
          active:    parseInt(res.data.pending   ?? 0), // Tab 0 = status:pending
          confirmed: parseInt(res.data.active    ?? 0), // Tab 1 = status:confirmed (API calls these 'active')
          collected: parseInt(res.data.collected ?? 0),
          expired:   parseInt(res.data.expired   ?? 0),
          cancelled: parseInt(res.data.cancelled ?? 0),
        })
      })
      // No catch at all before this — a failed stats call was an unhandled
      // rejection. The tab counts simply stay at 0; the per-tab list load
      // below reports the real failure, so this stays quiet on purpose.
      .catch(() => {})
  }, [])

  // Load reservations per tab.
  //
  // This asked for limit=100 with no paging, because the endpoint had no page
  // parameter. It does now, and returns
  //   pagination: { page, limit, total, total_pages }
  // so the list is properly paged. That mattered more here than elsewhere: the
  // tab counts come from /reservations/stats and are the true totals, so a tab
  // could read "Collected (137)" above exactly 100 rows with nothing
  // explaining the gap.
  useEffect(() => {
    setLoading(true)
    setSelected(null)
    setLoadFailed(false)
    apiFetch(`${API}/boutique/reservations?status=${STATUS_MAP[activeTab]}&page=${page}&limit=${PAGE_SIZE}`)
      .then(r => r.json())
      .then(res => {
        // Nothing checked `success` and there was no catch: an error payload
        // has no `.data`, so the tab rendered as empty, and because
        // setLoading(false) lives inside this .then a thrown request left the
        // page on "Loading…" for good.
        if (res.success === false || !res.data) throw new Error(res.message || 'reservations request failed')
        const list = res.data?.reservations ?? []
        setReservations(list)
        const pg = res.data?.pagination
        setTotalPages(pg?.total_pages ?? (list.length < PAGE_SIZE ? 1 : null))
        setTotalCount(pg?.total ?? null)
        const target = routeTargetIdRef.current
        if (target) {
          // Only select once the tab actually holding it has loaded — otherwise
          // leave the panel closed so the locator below can switch tabs.
          const found = list.find(r => r.id === target)
          if (found) { routeTargetIdRef.current = null; setSelected(found) }
        } else if (list.length > 0) {
          setSelected(list[0])
        }
      })
      .catch(() => {
        setReservations([])
        setSelected(null)
        setLoadFailed(true)
        setTotalPages(null)
        setTotalCount(null)
      })
      .finally(() => setLoading(false))
  }, [activeTab, i18n.language, reloadTick, page])

  // Find which status tab holds the reservation from the URL. The notification
  // payload carries only the id, so all five statuses are asked at once and
  // whichever one has it becomes the active tab.
  useEffect(() => {
    if (!routeReservationId) return
    if (routeLocatedIdRef.current === routeReservationId) return
    routeLocatedIdRef.current = routeReservationId
    routeTargetIdRef.current  = routeReservationId

    Promise.all(STATUS_MAP.map(status =>
      apiFetch(`${API}/boutique/reservations?status=${status}&limit=100`)
        .then(r => r.json())
        .catch(() => null)
    )).then(results => {
      // The tab effect may already have found it (it was on the open tab).
      if (routeTargetIdRef.current !== routeReservationId) return
      const idx = results.findIndex(res =>
        (res?.data?.reservations ?? []).some(r => r.id === routeReservationId)
      )
      if (idx === -1) { routeTargetIdRef.current = null; return }
      // Selection happens in the tab effect once this tab's list arrives.
      setActiveTab(idx)
    })
  }, [routeReservationId])

  // Any tab change by the user drops the pinned id from the URL.
  function handleTabClick(i) {
    if (routeReservationId) {
      routeTargetIdRef.current = null
      navigate('/reservations', { replace: true })
    }
    setActiveTab(i)
    setPage(1)   // each tab is its own list; carrying page 3 across shows nothing
  }

  function markCollected(reservation) {
    apiFetch(`${API}/boutique/reservations/${reservation.id}/collect`, { method: 'PATCH', body: JSON.stringify({}) })
      .then(r => r.json())
      .then(res => {
        if (!res.success) {
          setConfirm({ message: res.message || t('common.error_generic') })
          return
        }
        setReservations(prev => prev.filter(r => r.id !== reservation.id))
        setStats(prev => ({ ...prev, confirmed: Math.max(0, prev.confirmed - 1), collected: prev.collected + 1 }))
        if (selected?.id === reservation.id) setSelected(null)
        setDetailModal(null)
        // reservations.collected_success already existed in the bundle and went
        // unused while this line hardcoded the English.
        setConfirm({ message: t('reservations.collected_success', { name: whoFor(reservation) }) })
      })
      .catch(() => setConfirm({ message: t('common.error_network') }))
  }

  // All three status writes below shared the same hole: `if (res.success)` with
  // no else and no .catch. A rejected request did nothing at all — the row
  // stayed, no message appeared, and the button read as dead. A network error
  // additionally became an unhandled rejection.
  function whoFor(reservation) {
    return reservation.name ?? t('reservations.this_one', 'this reservation')
  }

  function confirmReservation(reservation) {
    apiFetch(`${API}/boutique/reservations/${reservation.id}/approve`, { method: 'POST', body: JSON.stringify({}) })
      .then(r => r.json())
      .then(res => {
        if (!res.success) {
          setConfirm({ message: res.message || t('common.error_generic') })
          return
        }
        setReservations(prev => prev.filter(r => r.id !== reservation.id))
        setStats(prev => ({ ...prev, active: Math.max(0, prev.active-1), confirmed: prev.confirmed+1 }))
        if (selected?.id === reservation.id) setSelected(null)
        setDetailModal(null)
        setConfirm({ message: t('reservations.confirmed_success', { name: whoFor(reservation) }) })
      })
      .catch(() => setConfirm({ message: t('common.error_network') }))
  }

  function cancelReservation(reservation) {
    apiFetch(`${API}/boutique/reservations/${reservation.id}/cancel`, { method: 'PATCH', body: JSON.stringify({}) })
      .then(r => r.json())
      .then(res => {
        if (!res.success) {
          setConfirm({ message: res.message || t('common.error_generic') })
          return
        }
        setReservations(prev => prev.filter(r => r.id !== reservation.id))
        setStats(prev => ({ ...prev, active: Math.max(0, prev.active-1), cancelled: prev.cancelled+1 }))
        if (selected?.id === reservation.id) setSelected(null)
        setDetailModal(null)
        // Confirm and Collect both acknowledged; Cancel silently did not, so
        // the only feedback was the row vanishing.
        setConfirm({ message: t('reservations.cancelled_success', '{{name}} has been cancelled.', { name: whoFor(reservation) }) })
      })
      .catch(() => setConfirm({ message: t('common.error_network') }))
  }

  function extendExpiry(reservation) {
    apiFetch(`${API}/boutique/reservations/${reservation.id}/extend`, {
      method: 'PATCH',
      body:   JSON.stringify({ hours: extendHours }),
    })
      .then(r => r.json())
      .then(res => {
        if (!res?.success) {
          setConfirm({ message: t('reservations.extend_error') + (res?.message ? ': ' + res.message : '') })
          return
        }
        // Backend is source of truth for new expiry (and possibly status).
        // Merge the whole returned object into local state so nothing drifts.
        const updated = res.data
        setReservations(prev => prev.map(r => r.id === reservation.id ? { ...r, ...updated } : r))
        if (selected?.id    === reservation.id) setSelected(s    => s    && { ...s,    ...updated })
        if (detailModal?.id === reservation.id) setDetailModal(m => m    && { ...m,    ...updated })
        setExtendModal(null)
        setConfirm({ message: t('reservations.extended_success', { name: reservation.name ?? t('reservations.this_one', 'this reservation') }) })
      })
      .catch(err => {
        console.error('[Reservations] extend failed', err)
        setConfirm({ message: t('reservations.extend_error') + ' — ' + t('common.error_network') })
      })
  }

  // Target time for a given option. `hours` is the option's own value, not the
  // selected one — reading extendHours here made every option render the
  // selected option's time, so "+1 hour" showed the +2 time once +2 was picked.
  function extendedTime(reservation, hours) {
    if (!reservation?.expires_at) return ''
    const at = new Date(new Date(reservation.expires_at).getTime() + hours * 3600000)
    const sameDay = at.toDateString() === new Date(reservation.expires_at).toDateString()
    const time = at.toLocaleTimeString(i18n.language, { hour:'2-digit', minute:'2-digit' })
    // Past midnight the bare time is ambiguous, so name the day too.
    return sameDay ? time : `${at.toLocaleDateString(i18n.language, { day:'2-digit', month:'short' })} ${time}`
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
        setConfirm({ message: t('reservations.notes_error') + (res?.message ? ': ' + res.message : '') })
      }
    } catch (err) {
      console.error('[Reservations] saveNotes failed', err)
      setConfirm({ message: t('reservations.notes_error') + ' — ' + t('common.error_network') })
    } finally {
      setNotesSaving(null)
    }
  }

  /* Page-level wait, like Subscription: this tab is driven by one fetch, so
     until it lands there is nothing truthful to draw. Safe as an early return
     because every hook in this component is declared above it. */
  if (loading) return <Loading page />

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
          <div key={label} className={`tab${activeTab===i?' act':''}`} onClick={() => handleTabClick(i)}>
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
                  // Confirmed reservations expire too — expires_at is the pickup
                  // deadline, which is exactly what Extend moves. The detail
                  // panel already counts down for both statuses; the row used to
                  // show "—" for confirmed, which hid the deadline Extend acts on.
                  const showsTimer = !!r.expires_at && countsDown(r.status)
                  const urgent = showsTimer && isUrgent(r.expires_at)
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
                        {showsTimer ? (
                          <span className={`timer-badge ${urgent?'urgent':'normal'}`}>
                            <span className="material-symbols-outlined">timer</span>
                            {timeLeft(r.expires_at, nowTick, t)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="res-actions-cell">
                        <button
                          className={`btn btn-sm ${selected?.id===r.id?'btn-primary':'btn-outline'}`}
                          onClick={e => { e.stopPropagation(); setDetailModal(r); setSelected(r) }}
                        >{t('reservations.detail_btn')}</button>
                        {' '}
                        {isWhatsappEnabled() && (
                          <button className="btn btn-sm btn-whatsapp" onClick={e => {
                            e.stopPropagation()
                            openWhatsApp(r, t)
                          }}>
                            <span className="material-symbols-outlined">chat_bubble</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* A failed load used to be indistinguishable from an empty tab. */}
            {!loading && loadFailed && (
              <div className="state-empty">
                {t('reservations.err_load', 'Could not load reservations.')}{' '}
                <span className="db-alert-link" onClick={() => setReloadTick(n => n + 1)}>
                  {t('common.retry', 'Retry')}
                </span>
              </div>
            )}
            {!loading && !loadFailed && reservations.length === 0 && (
              <div className="state-empty">{t('reservations.empty')}</div>
            )}

            {/* Only shown when there is more than one page, so a boutique with
                a handful of reservations sees no extra chrome. */}
            {!loading && !loadFailed && (totalPages ?? 1) > 1 && (
              <div className="res-pager">
                <button className="btn btn-outline btn-xs" disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}>
                  {t('reservations.prev', '← Prev')}
                </button>
                <span className="res-pager-lbl">
                  {t('reservations.page_of', { page, pages: totalPages, defaultValue: 'Page {{page}} of {{pages}}' })}
                  {totalCount != null ? ` · ${t('reservations.total_count', { count: totalCount, defaultValue: '{{count}} total' })}` : ''}
                </span>
                <button className="btn btn-outline btn-xs" disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}>
                  {t('reservations.next', 'Next →')}
                </button>
              </div>
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
            onExtend={(r) => { setExtendModal(r); setExtendHours(1) }}
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
              onExtend={(r) => { setExtendModal(r); setDetailModal(null); setExtendHours(1) }}
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
                  <option value={1}>+1 {t('reservations.extend.hour')} ({t('reservations.extend.until')} {extendedTime(extendModal, 1)})</option>
                  <option value={2}>+2 {t('reservations.extend.hours')} ({t('reservations.extend.until')} {extendedTime(extendModal, 2)})</option>
                  <option value={3}>+3 {t('reservations.extend.hours')} ({t('reservations.extend.until')} {extendedTime(extendModal, 3)})</option>
                  <option value={6}>+6 {t('reservations.extend.hours')} ({t('reservations.extend.until')} {extendedTime(extendModal, 6)})</option>
                  <option value={24}>+24 {t('reservations.extend.hours')} ({t('reservations.extend.until')} {extendedTime(extendModal, 24)})</option>
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
