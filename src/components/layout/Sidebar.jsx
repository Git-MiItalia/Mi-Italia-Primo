import { NavLink, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { clearToken, getStaff } from '../../lib/auth'
import { apiFetch } from '../../lib/api'
import PrimoLogo from '../../assets/PrimoLogo.svg'
import useNotifStore from '../../store/notifStore'
import useSidebarStore from '../../store/sidebarStore'

const BASE_URL = import.meta.env.VITE_API_URL
const IMG_BASE = import.meta.env.VITE_IMG_BASE_URL

// Matches ViewProfile.jsx's MY_PHOTO_UPDATED_EVENT — fired after a successful
// photo upload so this avatar updates immediately without a page reload.
const MY_PHOTO_UPDATED_EVENT = 'primo:my-photo-updated'

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

function SbItem({ to, icon, label, badge, onClick }) {
  return (
    <NavLink to={to} className={({ isActive }) => `sb-item${isActive ? ' act' : ''}`} onClick={onClick}>
      <span className="material-symbols-outlined">{icon}</span>
      {label}
      {badge > 0 && <span className="sb-badge">{badge > 99 ? '99+' : badge}</span>}
    </NavLink>
  )
}

function NavSection({ sectionKey, label, icon, items, collapsed, isOpen, onToggle, flyoutOpen, flyoutTop, onOpenFlyout, onCloseFlyout }) {
  const sectionBadge = items.reduce((sum, item) => sum + (item.badge || 0), 0)

  if (collapsed) {
    return (
      <div className="sb-rail-item"
        onClick={(e) => (flyoutOpen ? onCloseFlyout() : onOpenFlyout(e))}
        title={label}>
        <span className="material-symbols-outlined">{icon}</span>
        {sectionBadge > 0 && <span className="sb-badge">{sectionBadge > 99 ? '99+' : sectionBadge}</span>}
        {flyoutOpen && (
          <>
            <div className="sb-flyout-overlay" onClick={onCloseFlyout} />
            <div className="sb-flyout" style={{ top: `${flyoutTop}px` }}>
              <div className="sb-flyout-lbl">{label}</div>
              {items.map(item => (
                <SbItem key={item.to} {...item} onClick={onCloseFlyout} />
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="sb-section" onClick={onToggle}>
        <div className="sb-section-lbl">{label}</div>
        <span className="material-symbols-outlined sb-section-chev">
          {isOpen ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
        </span>
      </div>
      <div className={`sb-section-body${isOpen ? ' open' : ''}`}>
        {items.map(item => (
          <SbItem key={item.to} {...item} />
        ))}
      </div>
    </>
  )
}

function Sidebar() {
  const [storeOpen,    setStoreOpen]    = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [profile,      setProfile]      = useState(null)
  const [myPhotoUrl,   setMyPhotoUrl]   = useState(null)
  const [openFlyout,   setOpenFlyout]   = useState(null) // { key, top } | null
  const navigate = useNavigate()
  const { t }    = useTranslation()

  const collapsed       = useSidebarStore(s => s.collapsed)
  const toggleCollapsed = useSidebarStore(s => s.toggleCollapsed)
  const openSections    = useSidebarStore(s => s.openSections)
  const toggleSection   = useSidebarStore(s => s.toggleSection)

  const notifications = useNotifStore(s => s.notifications)

  useEffect(() => {
    apiFetch(`${BASE_URL}/boutique/profile`)
      .then(r => r.json())
      .then(json => { if (json.success) { setProfile(json.data); setMyPhotoUrl(json.data.my_photo_url) } })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const onPhotoUpdated = (e) => setMyPhotoUrl(e.detail)
    window.addEventListener(MY_PHOTO_UPDATED_EVENT, onPhotoUpdated)
    return () => window.removeEventListener(MY_PHOTO_UPDATED_EVENT, onPhotoUpdated)
  }, [])

  const boutiqueName = profile?.name || '—'
  const boutiqueCity = [profile?.city, profile?.country].filter(Boolean).join(', ') || '—'
  const coverPhoto   = profile?.cover_photo_url ? `${IMG_BASE}${profile.cover_photo_url}` : null

  // Sidebar bottom widget: owner sees the boutique's Founder Card identity;
  // non-owner staff see their own name/role from the login-time snapshot.
  const staff       = getStaff()
  const isOwner     = !staff || staff.role === 'owner'
  const userName    = isOwner ? (profile?.founder_name || profile?.name || '—') : (staff.name || '—')
  const userRole    = isOwner ? (profile?.founder_title || '') : (staff.role ? staff.role[0].toUpperCase() + staff.role.slice(1) : '')

  const rsvBadge = getRouteUnread(notifications, '/reservations')
  const ordBadge = getRouteUnread(notifications, '/orders')
  const invBadge = getRouteUnread(notifications, '/inventory')
  const msgBadge = getRouteUnread(notifications, '/messages')

  const NAV_SECTIONS = [
    {
      key: 'main',
      label: t('sidebar.sections.main'),
      icon: 'dashboard',
      items: [
        { to: '/dashboard',    icon: 'dashboard',       label: t('sidebar.dashboard') },
        { to: '/products',     icon: 'inventory_2',     label: t('sidebar.products') },
        { to: '/inventory',    icon: 'warehouse',       label: t('sidebar.inventory'),    badge: invBadge },
        { to: '/reservations', icon: 'event_available', label: t('sidebar.reservations'), badge: rsvBadge },
        { to: '/orders',       icon: 'local_shipping',  label: t('sidebar.orders'),       badge: ordBadge },
        { to: '/void-cil',     icon: 'block',           label: t('sidebar.void_cil') },
        { to: '/pos',          icon: 'point_of_sale',   label: t('sidebar.pos') },
        { to: '/messages',     icon: 'chat_bubble',     label: t('sidebar.messages'),     badge: msgBadge },
      ],
    },
    {
      key: 'customers',
      label: t('sidebar.sections.customers'),
      icon: 'group',
      items: [
        { to: '/customers',  icon: 'group',    label: t('sidebar.customers') },
        { to: '/engagement', icon: 'campaign', label: t('sidebar.engagement') },
        { to: '/discounts',  icon: 'local_offer', label: t('sidebar.discounts') },
        { to: '/promotions', icon: 'sell',     label: t('sidebar.promotions') },
      ],
    },
    {
      key: 'insights',
      label: t('sidebar.sections.insights'),
      icon: 'insights',
      items: [
        { to: '/analytics',    icon: 'travel_explore',    label: t('sidebar.analytics') },
        { to: '/financials',   icon: 'account_balance',   label: t('sidebar.financials') },
        { to: '/reports',      icon: 'summarize',         label: t('sidebar.reports') },
        { to: '/subscription', icon: 'workspace_premium', label: t('sidebar.subscription') },
      ],
    },
    {
      key: 'settings',
      label: t('sidebar.sections.settings'),
      icon: 'settings',
      items: [
        { to: '/locations',     icon: 'store',              label: t('sidebar.locations') },
        { to: '/showroom',      icon: 'business_center',    label: t('sidebar.showroom') },
        { to: '/store',         icon: 'storefront',         label: t('sidebar.store_profile') },
        { to: '/integrations',  icon: 'cable',               label: t('sidebar.integrations', 'Integrations') },
        { to: '/oro-points',    icon: 'toll',                label: t('sidebar.oro_royalty') },
        { to: '/price-tags',    icon: 'label',               label: t('sidebar.price_tags') },
        { to: '/notifications', icon: 'notifications',      label: t('sidebar.notifications') },
        { to: '/tryon',         icon: 'person_raised_hand', label: t('sidebar.ai_model_studio', 'AI Model Studio') },
        { to: '/support',       icon: 'help',                label: t('sidebar.support') },
      ],
    },
  ]

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>

      {/* Brand */}
      <div className="sb-brand">
        <img src={PrimoLogo} alt="Primo by Mi Italia" className="sb-logo" />
        <span className="material-symbols-outlined sb-collapse-btn" onClick={() => { setOpenFlyout(null); toggleCollapsed() }}
          title={collapsed ? t('sidebar.expand', 'Expand') : t('sidebar.collapse', 'Collapse')}>
          {collapsed ? 'chevron_right' : 'chevron_left'}
        </span>
      </div>

      {/* Store selector */}
      <div className="sb-store" onClick={() => setStoreOpen(!storeOpen)}>
        <div className="sb-store-row">
          <div className="sb-store-av" style={{ backgroundImage: coverPhoto ? `url('${coverPhoto}')` : undefined }} />
          {!collapsed && (
            <div>
              <div className="sb-store-name">{boutiqueName}</div>
              <div className="sb-store-loc">{boutiqueCity}</div>
            </div>
          )}
        </div>
        {!collapsed && (
          <div className="sb-store-switch">
            <span className="material-symbols-outlined">unfold_more</span>
            {t('sidebar.switch_store')}
          </div>
        )}
      </div>

      <div className={`sb-dropdown${storeOpen && !collapsed ? ' open' : ''}`}>
        <div className="sb-store-opt act">
          <div className="sb-store-opt-av" />
          <div className="sb-store-opt-name">{boutiqueName}</div>
          <span className="material-symbols-outlined">check</span>
        </div>
        <div className="sb-add-store" onClick={() => { setStoreOpen(false); navigate('/locations/new') }}>
          <span className="material-symbols-outlined">add</span>
          {t('sidebar.add_store')}
        </div>
      </div>

      {/* Nav */}
      <nav className="sb-nav">
        {NAV_SECTIONS.map(section => (
          <NavSection
            key={section.key}
            sectionKey={section.key}
            label={section.label}
            icon={section.icon}
            items={section.items}
            collapsed={collapsed}
            isOpen={openSections[section.key] !== false}
            onToggle={() => toggleSection(section.key)}
            flyoutOpen={openFlyout?.key === section.key}
            flyoutTop={openFlyout?.top}
            onOpenFlyout={(e) => setOpenFlyout({ key: section.key, top: e.currentTarget.getBoundingClientRect().top })}
            onCloseFlyout={() => setOpenFlyout(null)}
          />
        ))}
      </nav>

      {/* User */}
      <div className="sb-bottom">
        <div className="sb-user">
          {myPhotoUrl ? (
            <div className="sb-user-av" style={{ backgroundImage:`url('${IMG_BASE}${myPhotoUrl}')`, backgroundSize:'cover', backgroundPosition:'center' }}
              onClick={collapsed ? () => setUserMenuOpen(o => !o) : undefined} />
          ) : (
            <div className="sb-user-av sb-user-av-icon" onClick={collapsed ? () => setUserMenuOpen(o => !o) : undefined}>
              <span className="material-symbols-outlined">person</span>
            </div>
          )}
          {!collapsed && (
            <div className="flex-1">
              <div className="sb-user-name">{userName}</div>
              <div className="sb-user-role">{userRole}</div>
            </div>
          )}
          <div className="sb-user-menu-wrap">
            {!collapsed && (
              <span className="material-symbols-outlined sb-user-more"
                onClick={() => setUserMenuOpen(o => !o)}>
                more_vert
              </span>
            )}
            {userMenuOpen && (
              <>
                <div className="sb-user-menu-overlay" onClick={() => setUserMenuOpen(false)} />
                <div className={`sb-user-menu${collapsed ? ' rail' : ''}`}>
                  <div className="sb-user-menu-item"
                    onClick={() => { setUserMenuOpen(false); navigate('/profile') }}>
                    <span className="material-symbols-outlined">manage_accounts</span>
                    View Profile
                  </div>
                  <div className="sb-user-menu-item sb-user-menu-logout"
                    onClick={() => { clearToken(); navigate('/login') }}>
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
