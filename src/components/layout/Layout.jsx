import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { getToken } from '../../lib/auth'
import useLangStore from '../../store/langStore'
import StripeConnect from '../ui/StripeConnect'
import { apiFetch } from '../../lib/api'
import { openNotificationStream, closeNotificationStream, subscribeToNotifications } from '../../lib/NotificationsStream'
import useNotifStore from '../../store/notifStore'
import NotifToast from '../ui/NotifToast'
import useSidebarStore from '../../store/sidebarStore'

const BASE_URL = import.meta.env.VITE_API_URL
const PLAN_EXEMPT = ['/subscription/return']

function Layout() {
  const navigate          = useNavigate()
  const location          = useLocation()
  const fetchTranslations = useLangStore(state => state.fetchTranslations)
  const [stripeConnected, setStripeConnected] = useState(true)
  const addNotification   = useNotifStore(s => s.addNotification)
  const setNotifications  = useNotifStore(s => s.setNotifications)
  const sidebarCollapsed  = useSidebarStore(s => s.collapsed)

  useEffect(() => {
    const token = getToken()
    if (!token) { navigate('/login'); return }
    fetchTranslations()

    // Load existing notifications into store
    apiFetch(`${BASE_URL}/boutique/notifications`)
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setNotifications(res.data.notifications ?? [], res.data.unread_count ?? 0)
        }
      })
      .catch(() => {})

    // Open SSE stream
    openNotificationStream(token)

    // Subscribe to incoming notifications
    const unsub = subscribeToNotifications((payload) => {
     
      if (payload.kind !== 'notification') return
      addNotification(payload.notification)
    })

    // Skip plan check for exempt routes
    if (!PLAN_EXEMPT.includes(location.pathname)) {
      apiFetch(`${BASE_URL}/boutique/subscription`)
        .then(r => r.json())
        .then(data => {
          if (data.success && data.data.must_select_plan) {
            navigate('/subscription-setup')
            return
          }
          return apiFetch(`${BASE_URL}/boutique/stripe/status`)
            .then(r => r.json())
            .then(data => {
              if (data.success) {
                const { charges_enabled, payouts_enabled } = data.data
                setStripeConnected(charges_enabled && payouts_enabled)
              }
            })
        })
        .catch(() => {})
    }

    return () => {
      unsub()
      closeNotificationStream()
    }
  }, [])

  return (
    <>
      {!stripeConnected && (
        <StripeConnect
          onConnected={() => setStripeConnected(true)}
          onSkip={() => setStripeConnected(true)}
        />
      )}
      <Sidebar />
      <div className={`main${sidebarCollapsed ? ' sb-collapsed' : ''}`}>
        <Header />
        <div className="content">
          <Outlet />
        </div>
      </div>
      <NotifToast />
    </>
  )
}

export default Layout
