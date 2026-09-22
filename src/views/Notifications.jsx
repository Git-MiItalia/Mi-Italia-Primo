import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import Loading from '../components/ui/Loading'
import useNotifStore from '../store/notifStore'
import { timeAgo } from '../lib/timeAgo'

const API = import.meta.env.VITE_API_URL

function getTabIndex(type) {
  if (!type) return 0
  const t = type.toLowerCase()
  if (t.includes('reservation'))                               return 1
  if (t.includes('order'))                                     return 2
  if (t.includes('stock'))                                     return 3
  if (t.includes('message') || t.includes('enquiry') || t.includes('chat')) return 4
  return 0
}

function getNotifIcon(type) {
  if (!type) return { icon:'notifications', cls:'reservation' }
  const t = type.toLowerCase()
  if (t.includes('reservation'))                      return { icon:'event_available',    cls:'reservation' }
  if (t.includes('order'))                            return { icon:'shopping_bag',       cls:'order'       }
  if (t.includes('stock'))                            return { icon:'inventory_2',        cls:'stock'       }
  if (t.includes('tryon') || t.includes('try_on'))    return { icon:'person_raised_hand', cls:'tryon'       }
  if (t.includes('message') || t.includes('enquiry')) return { icon:'chat_bubble',       cls:'message'     }
  return { icon:'notifications', cls:'reservation' }
}

// Routes that accept a record id (/orders/:id, /reservations/:id) and open that
// record directly. Anything else keeps only the list path, since navigating to
// a route that doesn't exist would land on a blank page.
const DEEP_LINKABLE = ['/orders/', '/reservations/']
const UUID_SUFFIX   = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function getNavRoute(type, link) {
  if (link) {
    if (DEEP_LINKABLE.some(prefix => link.startsWith(prefix))) return link
    return link.replace(UUID_SUFFIX, '')
  }
  if (!type) return null
  const t = type.toLowerCase()
  if (t.includes('reservation')) return '/reservations'
  if (t.includes('order'))       return '/orders'
  if (t.includes('stock'))       return '/inventory'
  if (t.includes('message') || t.includes('enquiry')) return '/messages'
  return null
}

// Was a local copy returning English literals ('just now', 'Yesterday'), so
// every notification timestamp stayed English on an Italian page. Now the
// shared helper — see lib/timeAgo.js.

export default function Notifications() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  const TABS  = [
    t('notifications.tabs.all',          'All'),
    t('notifications.tabs.reservations', 'Reservations'),
    t('notifications.tabs.orders',       'Orders'),
    t('notifications.tabs.stock',        'Stock'),
    t('notifications.tabs.messages',     'Messages'),
  ]
  // `field` maps each row to its key in the preferences payload.
  const prefs = [
    { field: 'reservation_expiry', label: t('notifications.prefs.expiry',    'Reservation expiry'), sub: t('notifications.prefs.expiry_sub',    'Alert me before a reservation expires') },
    { field: 'new_orders',         label: t('notifications.prefs.orders',    'New orders'),         sub: t('notifications.prefs.orders_sub',    'Alert me when an order comes in')       },
    { field: 'low_stock',          label: t('notifications.prefs.low_stock', 'Low stock'),          sub: t('notifications.prefs.low_stock_sub', 'Alert me when a size is running out')   },
    { field: 'tryon_requests',     label: t('notifications.prefs.tryon',     'Try-on requests'),    sub: t('notifications.prefs.tryon_sub',     'Alert me when a customer books a try-on') },
  ]

  const notifications    = useNotifStore(s => s.notifications)
  const unreadCount      = useNotifStore(s => s.unreadCount)
  const markReadFn       = useNotifStore(s => s.markRead)
  const markAllReadFn    = useNotifStore(s => s.markAllRead)
  const setNotifications = useNotifStore(s => s.setNotifications)

  const [activeTab, setActiveTab] = useState(0)
  const [loading,   setLoading]   = useState(false)
  const [listFailed, setListFailed] = useState(false)

  // null until the preferences endpoint answers — the toggles stay disabled
  // until then rather than showing a guessed state the boutique might trust.
  const [prefValues,  setPrefValues]  = useState(null)
  const [prefSaving,  setPrefSaving]  = useState(false)
  const [prefError,   setPrefError]   = useState(null)

  // prefValues stays null until this answers, and the toggles are disabled
  // while it is null — so a swallowed failure left every switch permanently
  // greyed out with nothing saying why.
  const [prefLoadFailed, setPrefLoadFailed] = useState(false)
  useEffect(() => {
    apiFetch(`${API}/boutique/notifications/preferences`)
      .then(r => r.json())
      .then(res => {
        if (res?.success) { setPrefValues(res.data ?? {}); setPrefLoadFailed(false) }
        else setPrefLoadFailed(true)
      })
      .catch(() => setPrefLoadFailed(true))
  }, [])

  function togglePref(field) {
    if (!prefValues || prefSaving) return
    const next = { ...prefValues, [field]: !prefValues[field] }
    const previous = prefValues
    setPrefValues(next)          // optimistic — the switch should feel instant
    setPrefSaving(true)
    setPrefError(null)
    apiFetch(`${API}/boutique/notifications/preferences`, {
      method: 'PUT',
      body: JSON.stringify(next),
    })
      .then(r => r.json())
      .then(res => {
        if (res?.success) { if (res.data) setPrefValues(res.data) }
        else { setPrefValues(previous); setPrefError(res?.message ?? t('common.error_generic', 'Something went wrong. Please try again.')) }
      })
      .catch(() => {
        setPrefValues(previous)  // put the switch back rather than lie about it
        setPrefError(t('common.error_network', 'Network error. Please check your connection.'))
      })
      .finally(() => setPrefSaving(false))
  }

  // Skip refetching if the global store already has notifications for the
  // language we're currently rendering in — but a language switch must still
  // force a fresh fetch, since we can't know what locale pre-existing
  // (e.g. websocket-populated) notifications were fetched in.
  const fetchedLangRef = useRef(null)
  useEffect(() => {
    if (notifications.length > 0 && fetchedLangRef.current === i18n.language) return
    setLoading(true)
    apiFetch(`${API}/boutique/notifications`)
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setNotifications(res.data.notifications ?? [], res.data.unread_count ?? 0)
          fetchedLangRef.current = i18n.language
          setListFailed(false)
        } else {
          // An empty list and a failed list looked the same, and the empty
          // state reads "You're all caught up" — actively reassuring when we
          // simply have no idea what is waiting. `fetchedLangRef` is left
          // alone so the next render retries rather than caching the failure.
          setListFailed(true)
        }
      })
      .catch(() => setListFailed(true))
      .finally(() => setLoading(false))
  }, [i18n.language])

  function handleNotifClick(n) {
    if (!n.read_at && !n.is_read) {
      // Marked read locally either way — the click did happen, and blocking
      // navigation on this would make the list feel broken. The catch is here
      // only so a failure doesn't surface as an unhandled rejection; the row
      // reappearing unread after a refresh is the honest outcome.
      apiFetch(`${API}/boutique/notifications/${n.id}/read`, { method: 'PUT', body: JSON.stringify({}) })
        .catch(() => {})
      markReadFn(n.id)
    }
    const route = getNavRoute(n.type, n.link)
    if (route) navigate(route)
  }

  function markAllRead() {
    apiFetch(`${API}/boutique/notifications/read-all`, { method: 'PUT', body: JSON.stringify({}) })
      .then(r => r.json())
      .then(res => {
        if (res.success) markAllReadFn()
        // Nothing clearing on a refused call looked like a dead button.
        else setListFailed(true)
      })
      .catch(() => setListFailed(true))
  }

  const isUnread = (n) => !n.read_at && !n.is_read

  const filtered = notifications.filter(n => activeTab === 0 ? true : getTabIndex(n.type) === activeTab)
  const unread   = filtered.filter(n =>  isUnread(n))
  const read     = filtered.filter(n => !isUnread(n))

  function NotifItem({ n, isUnreadItem, isLast }) {
    const { icon, cls } = getNotifIcon(n.type)
    const route = getNavRoute(n.type, n.link)
    return (
      <div
        className={`notif-item${isLast ? ' notif-item-last' : ''}`}
        style={{ cursor: route ? 'pointer' : 'default' }}
        onClick={() => handleNotifClick(n)}
      >
        {isUnreadItem
          ? <div className="notif-unread-dot" />
          : <div className="notif-spacer" />
        }
        <div className={`notif-icon ${cls}`}>
          <span className="material-symbols-outlined">{icon}</span>
        </div>
        <div className="notif-body">
          <div className="notif-title">{n.title ?? n.type}</div>
          <div className="notif-sub">{n.body ?? n.message ?? '—'}</div>
        </div>
        <div className="notif-item-right">
          <div className="notif-time">{timeAgo(t, n.created_at)}</div>
          {route && (
            <span className="material-symbols-outlined notif-arrow">arrow_forward</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="tabs">
        {TABS.map((tab, i) => (
          <div key={tab} className={`tab${activeTab === i ? ' act' : ''}`} onClick={() => setActiveTab(i)}>
            {tab}
            {i === 0 && unreadCount > 0 && <span className="tab-badge">{unreadCount}</span>}
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-hdr">
          <div className="card-title">{t('notifications.recent', 'Recent')} <em>{t('notifications.recent_em', 'Activity')}</em></div>
          <div className="card-action" onClick={markAllRead}>{t('notifications.mark_all_read', 'Mark all as read')}</div>
        </div>

        {/* The shared indicator, but the in-card one rather than the page-level
            spinner the data-heavy tabs use. Two reasons. The list is usually
            already in the store — Layout fetches it at startup, and the effect
            above returns without fetching when it is there, so `loading` never
            turns true and no spinner is wanted at all. And `loading` starts
            false, so a page-level gate would paint the real tab for a frame
            before replacing it, which reads as a flicker rather than a load. */}
        {loading && <Loading className="ld-cell" />}

        {!loading && notifications.length === 0 && (
          <div className="notif-state">
            <span className="material-symbols-outlined notif-state-icon">notifications_none</span>
            {t('notifications.empty', 'No notifications yet')}
          </div>
        )}

        {/* Unread section */}
        {!loading && unread.length > 0 && (
          <>
            <div className="notif-section-hdr">
              <div className="notif-unread-dot" />
              <div className="notif-section-lbl">{t('notifications.unread', 'Unread')} · {unread.length}</div>
            </div>
            {unread.map(n => (
              <NotifItem key={n.id} n={n} isUnreadItem={true} isLast={false} />
            ))}
          </>
        )}

        {/* Read / Earlier section */}
        {!loading && read.length > 0 && (
          <div className={`notif-read-section${unread.length > 0 ? ' notif-read-section-mt' : ''}`}>
            <div className="notif-section-lbl notif-section-lbl-mb">{t('notifications.earlier', 'Earlier')}</div>
            {read.map((n, i) => (
              <NotifItem key={n.id} n={n} isUnreadItem={false} isLast={i === read.length - 1} />
            ))}
          </div>
        )}

        {!loading && listFailed && (
          <div className="alert alert-urgent notif-prefs-pending">
            {t('notifications.err_load', 'Could not load your notifications — this list may be incomplete or out of date.')}
          </div>
        )}

        {!loading && !listFailed && notifications.length > 0 && filtered.length === 0 && (
          <div className="notif-tab-empty">
            {t('notifications.tab_empty', { tab: TABS[activeTab].toLowerCase(), defaultValue: 'No {{tab}} notifications' })}
          </div>
        )}

        {/* Preferences */}
        <div className="detail-divider" />
        <div className="notif-prefs-lbl">{t('notifications.prefs.title', 'Notification Preferences')}</div>
        {prefError && (
          <div className="alert alert-urgent notif-prefs-pending">{prefError}</div>
        )}
        {prefLoadFailed && (
          <div className="alert alert-urgent notif-prefs-pending">
            {t('notifications.prefs.err_load', 'Could not load your notification preferences, so these switches are disabled. Reload the page to try again.')}
          </div>
        )}
        <div className="notif-prefs-list">
          {/* Disabled only while the current state is unknown — a switch that
              silently does nothing is worse than one that can't be pressed. */}
          {prefs.map(p => {
            const ready = prefValues !== null
            const on    = ready ? !!prefValues[p.field] : false
            return (
              <div key={p.field} className={`notif-pref-row${ready ? '' : ' notif-pref-row-disabled'}`}>
                <div>
                  <div className="notif-pref-title">{p.label}</div>
                  <div className="notif-pref-sub">{p.sub}</div>
                </div>
                <div
                  className={`toggle${on ? ' on' : ''}${ready && !prefSaving ? '' : ' toggle-disabled'}`}
                  onClick={() => togglePref(p.field)}
                >
                  <div className="toggle-knob" />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
