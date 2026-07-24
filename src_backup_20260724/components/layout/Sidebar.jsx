import { NavLink, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { clearToken } from '../../lib/auth'
import { apiFetch } from '../../lib/api'
import PrimoLogo from '../../assets/PrimoLogo.svg'
import useNotifStore from '../../store/notifStore'

const BASE_URL = import.meta.env.VITE_API_URL
const IMG_BASE = import.meta.env.VITE_IMG_BASE_URL

// Map route paths to notification types that should badge them
const ROUTE_NOTIF_MAP = {
  '/reservations': ['reservation'],
  '/orders':       ['order'],
  '/inventory':    ['stock'],
  '/messages':     ['message', 'enquiry', 'chat'],
}

function getRouteUnread(notifications, route) {
  const types = ROUTE_NOTIF_MAP[route]
  if (!types) return 0
  return notifications.filter(n =>
    !n.read_at && types.some(t => n.type?.toLowerCase().includes(t))
  ).length
}

function SbItem({ to, icon, label, badge }) {
  return (
    <NavLink to={to} className={({ isActive }) => `sb-item${isActive ? ' act' : ''}`}>
      <span className="material-symbols-outlined">{icon}</span>
      {label}
      {badge > 0 && <span className="sb-badge">{badge > 99 ? '99+' : badge}</span>}
    </NavLink>
  )
}

function Sidebar() {
  const [storeOpen,    setStoreOpen]    = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [profile,      setProfile]      = useState(null)
  const navigate = useNavigate()
  const { t }    = useTranslation()

  const notifications = useNotifStore(s => s.notifications)

  const [user] = useState(() => {
    try { return JSON.parse(localStorage.getItem('primo_user')) || {} }
    catch { return {} }
  })

  useEffect(() => {
    apiFetch(`${BASE_URL}/boutique/profile`)
      .then(r => r.json())
      .then(json => { if (json.success) setProfile(json.data) })
      .catch(() => {})
  }, [])

  const boutiqueName = profile?.name || '—'
  const boutiqueCity = [profile?.city, profile?.country].filter(Boolean).join(', ') || '—'
  const coverPhoto   = profile?.cover_photo_url || null

  const rsvBadge = getRouteUnread(notifications, '/reservations')
  const ordBadge = getRouteUnread(notifications, '/orders')
  const invBadge = getRouteUnread(notifications, '/inventory')
  const msgBadge = getRouteUnread(notifications, '/messages')

  return (
    <aside className="sidebar">

      {/* Brand */}
      <div className="sb-brand">
        <img src={PrimoLogo} alt="Primo by Mi Italia" className="sb-logo" />
      </div>

      {/* Store selector */}
      <div className="sb-store" onClick={() => setStoreOpen(!storeOpen)}>
        <div className="sb-store-row">
          <div className="sb-store-av" style={{ backgroundImage: coverPhoto ? `url('${coverPhoto}')` : undefined }} />
          <div>
            <div className="sb-store-name">{boutiqueName}</div>
            <div className="sb-store-loc">{boutiqueCity}</div>
          </div>
        </div>
        <div className="sb-store-switch">
          <span className="material-symbols-outlined">unfold_more</span>
          {t('sidebar.switch_store')}
        </div>
      </div>

      <div className={`sb-dropdown${storeOpen ? ' open' : ''}`}>
        <div className="sb-store-opt act">
          <div className="sb-store-opt-av" />
          <div className="sb-store-opt-name">{boutiqueName}</div>
          <span className="material-symbols-outlined">check</span>
        </div>
        <div className="sb-add-store">
          <span className="material-symbols-outlined">add</span>
          {t('sidebar.add_store')}
        </div>
      </div>

      {/* Nav */}
      <nav className="sb-nav">
        <div className="sb-section"><div className="sb-section-lbl">{t('sidebar.sections.main')}</div></div>

        <SbItem to="/dashboard"    icon="dashboard"       label={t('sidebar.dashboard')} />
        <SbItem to="/products"     icon="inventory_2"     label={t('sidebar.products')} />
        <SbItem to="/inventory"    icon="warehouse"       label={t('sidebar.inventory')}    badge={invBadge} />
        <SbItem to="/reservations" icon="event_available" label={t('sidebar.reservations')} badge={rsvBadge} />
        <SbItem to="/orders"       icon="local_shipping"  label={t('sidebar.orders')}       badge={ordBadge} />
        <SbItem to="/void-cil"     icon="block"           label={t('sidebar.void_cil')} />
        <SbItem to="/pos"          icon="point_of_sale"   label={t('sidebar.pos')} />
        <SbItem to="/messages"     icon="chat_bubble"     label={t('sidebar.messages')}     badge={msgBadge} />

        <div className="sb-section"><div className="sb-section-lbl">{t('sidebar.sections.customers')}</div></div>
        <SbItem to="/customers"    icon="group"           label={t('sidebar.customers')} />
        <SbItem to="/marketing"    icon="campaign"        label={t('sidebar.marketing')} />
        <SbItem to="/discounts"    icon="local_offer"     label={t('sidebar.discounts')} />

        <div className="sb-section"><div className="sb-section-lbl">{t('sidebar.sections.insights')}</div></div>
        <SbItem to="/analytics"    icon="analytics"           label={t('sidebar.analytics')} />
        <SbItem to="/financials"   icon="account_balance"     label={t('sidebar.financials')} />
        <SbItem to="/reports"      icon="summarize"           label={t('sidebar.reports')} />
        <SbItem to="/subscription" icon="workspace_premium"   label={t('sidebar.subscription')} />

        <div className="sb-section"><div className="sb-section-lbl">{t('sidebar.sections.settings')}</div></div>
        <SbItem to="/locations"    icon="store"               label={t('sidebar.locations')} />
        <SbItem to="/staff"        icon="badge"               label={t('sidebar.staff')} />
        <SbItem to="/showroom"     icon="business_center"     label={t('sidebar.showroom')} />
        <SbItem to="/store"        icon="storefront"          label={t('sidebar.store_profile')} />
        <SbItem to="/oro-points"   icon="toll"                label={t('sidebar.oro_royalty')} />
        <SbItem to="/price-tags"   icon="label"               label={t('sidebar.price_tags')} />
        <SbItem to="/notifications" icon="notifications"      label={t('sidebar.notifications')} />
        <SbItem to="/tryon"        icon="person_raised_hand"  label={t('sidebar.tryon')} />
        <SbItem to="/support"      icon="help"                label={t('sidebar.support')} />
      </nav>

      {/* User */}
      <div className="sb-bottom">
        <div className="sb-user">
          {profile?.founder_photo_url ? (
            <div className="sb-user-av" style={{ backgroundImage:`url('${IMG_BASE}${profile.founder_photo_url}')`, backgroundSize:'cover', backgroundPosition:'center' }} />
          ) : (
            <div className="sb-user-av sb-user-av-icon">
              <span className="material-symbols-outlined">person</span>
            </div>
          )}
          <div className="flex-1">
            <div className="sb-user-name">{user.name || '—'}</div>
            <div className="sb-user-role">{user.email || ''}</div>
          </div>
          <div className="sb-user-menu-wrap">
            <span className="material-symbols-outlined sb-user-more"
              onClick={() => setUserMenuOpen(o => !o)}>
              more_vert
            </span>
            {userMenuOpen && (
              <>
                <div className="sb-user-menu-overlay" onClick={() => setUserMenuOpen(false)} />
                <div className="sb-user-menu">
                  <div className="sb-user-menu-item"
                    onClick={() => { setUserMenuOpen(false); navigate('/profile') }}>
                    <span className="material-symbols-outlined">manage_accounts</span>
                    View Profile
                  </div>
                  <div className="sb-user-menu-item sb-user-menu-logout"
                    onClick={() => { clearToken(); localStorage.removeItem('primo_user'); navigate('/login') }}>
                    <span className="material-symbols-outlined">logout</span>
                    Logout
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

    </aside>
  )
}

export default Sidebar
