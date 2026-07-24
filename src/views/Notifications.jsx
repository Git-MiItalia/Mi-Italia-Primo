import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import useNotifStore from '../store/notifStore'

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

function getNavRoute(type, link) {
  if (link) return link
  if (!type) return null
  const t = type.toLowerCase()
  if (t.includes('reservation')) return '/reservations'
  if (t.includes('order'))       return '/orders'
  if (t.includes('stock'))       return '/inventory'
  if (t.includes('message') || t.includes('enquiry')) return '/messages'
  return null
}

function timeAgo(isoDate) {
  if (!isoDate) return ''
  const diff = Date.now() - new Date(isoDate).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)   return 'just now'
  if (m < 60)  return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d === 1) return 'Yesterday'
  return `${d}d ago`
}

export default function Notifications() {
  const { t }    = useTranslation()
  const navigate = useNavigate()

  const TABS  = [t('notifications.tabs.all'), t('notifications.tabs.reservations'), t('notifications.tabs.orders'), t('notifications.tabs.stock'), t('notifications.tabs.messages')]
  const prefs = [
    { label: t('notifications.prefs.expiry'),    sub: t('notifications.prefs.expiry_sub')    },
    { label: t('notifications.prefs.orders'),     sub: t('notifications.prefs.orders_sub')    },
    { label: t('notifications.prefs.low_stock'),  sub: t('notifications.prefs.low_stock_sub') },
    { label: t('notifications.prefs.tryon'),      sub: t('notifications.prefs.tryon_sub')     },
  ]

  const notifications    = useNotifStore(s => s.notifications)
  const unreadCount      = useNotifStore(s => s.unreadCount)
  const markReadFn       = useNotifStore(s => s.markRead)
  const markAllReadFn    = useNotifStore(s => s.markAllRead)
  const setNotifications = useNotifStore(s => s.setNotifications)

  const [activeTab, setActiveTab] = useState(0)
  const [loading,   setLoading]   = useState(false)
  const [toggles,   setToggles]   = useState(prefs.map(() => true))

  function flipToggle(i) {
    setToggles(prev => prev.map((v, idx) => idx === i ? !v : v))
  }

  useEffect(() => {
    if (notifications.length > 0) return
    setLoading(true)
    apiFetch(`${API}/boutique/notifications`)
      .then(r => r.json())
      .then(res => {
        if (res.success) setNotifications(res.data.notifications ?? [], res.data.unread_count ?? 0)
      })
      .finally(() => setLoading(false))
  }, [])

  function handleNotifClick(n) {
    if (!n.read_at && !n.is_read) {
      apiFetch(`${API}/boutique/notifications/${n.id}/read`, { method: 'PUT', body: JSON.stringify({}) })
      markReadFn(n.id)
    }
    const route = getNavRoute(n.type, n.link)
    if (route) navigate(route)
  }

  function markAllRead() {
    apiFetch(`${API}/boutique/notifications/read-all`, { method: 'PUT', body: JSON.stringify({}) })
      .then(r => r.json())
      .then(res => { if (res.success) markAllReadFn() })
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
          <div className="notif-time">{timeAgo(n.created_at)}</div>
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
          <div className="card-title">{t('notifications.recent')} <em>{t('notifications.recent_em')}</em></div>
          <div className="card-action" onClick={markAllRead}>{t('notifications.mark_all_read')}</div>
        </div>

        {loading && (
          <div className="notif-state">
            <span className="material-symbols-outlined notif-state-icon">hourglass_empty</span>
            {t('notifications.loading')}
          </div>
        )}

        {!loading && notifications.length === 0 && (
          <div className="notif-state">
            <span className="material-symbols-outlined notif-state-icon">notifications_none</span>
            {t('notifications.empty')}
          </div>
        )}

        {/* Unread section */}
        {!loading && unread.length > 0 && (
          <>
            <div className="notif-section-hdr">
              <div className="notif-unread-dot" />
              <div className="notif-section-lbl">{t('notifications.unread')} · {unread.length}</div>
            </div>
            {unread.map(n => (
              <NotifItem key={n.id} n={n} isUnreadItem={true} isLast={false} />
            ))}
          </>
        )}

        {/* Read / Earlier section */}
        {!loading && read.length > 0 && (
          <div className={`notif-read-section${unread.length > 0 ? ' notif-read-section-mt' : ''}`}>
            <div className="notif-section-lbl notif-section-lbl-mb">{t('notifications.earlier')}</div>
            {read.map((n, i) => (
              <NotifItem key={n.id} n={n} isUnreadItem={false} isLast={i === read.length - 1} />
            ))}
          </div>
        )}

        {!loading && notifications.length > 0 && filtered.length === 0 && (
          <div className="notif-tab-empty">
            {t('notifications.tab_empty', { tab: TABS[activeTab].toLowerCase() })}
          </div>
        )}

        {/* Preferences */}
        <div className="detail-divider" />
        <div className="notif-prefs-lbl">{t('notifications.prefs.title')}</div>
        <div className="notif-prefs-list">
          {prefs.map((p, i) => (
            <div key={p.label} className="notif-pref-row">
              <div>
                <div className="notif-pref-title">{p.label}</div>
                <div className="notif-pref-sub">{p.sub}</div>
              </div>
              <div className={`toggle${toggles[i] ? ' on' : ''}`} onClick={() => flipToggle(i)}>
                <div className="toggle-knob" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
