import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Loading from './components/ui/Loading'
import { isWhatsappEnabled } from './lib/auth'

/* Every screen is loaded on demand.
 *
 * All of them used to be imported eagerly, which put the whole portal — POS,
 * Engagement, AI Model Studio and the rest — into a single 1.7 MB bundle that
 * a boutique had to download in full before the login page could paint. Vite
 * warned about the chunk size on every build. Each lazy() below becomes its own
 * file, fetched the first time someone opens that route, so the initial load
 * carries the shell and nothing else.
 *
 * Login stays eager on purpose: it is where an unauthenticated visitor lands,
 * and splitting it would mean two round trips before the first screen appears.
 * Layout is eager for the same reason — every protected route renders inside it.
 */
import Login from './views/Login'

const Dashboard          = lazy(() => import('./views/Dashboard'))
const Products           = lazy(() => import('./views/Products'))
const AddProduct         = lazy(() => import('./views/AddProduct'))
const Inventory          = lazy(() => import('./views/Inventory'))
const Reservations       = lazy(() => import('./views/Reservations'))
const Orders             = lazy(() => import('./views/Orders'))
const POS                = lazy(() => import('./views/POS'))
const Messages           = lazy(() => import('./views/Messages'))
const Customers          = lazy(() => import('./views/Customers'))
const Engagement         = lazy(() => import('./views/Engagement'))
const Discounts          = lazy(() => import('./views/Discounts'))
const Promotions         = lazy(() => import('./views/Promotions'))
const Analytics          = lazy(() => import('./views/Analytics'))
const Financials         = lazy(() => import('./views/Financials'))
const Markdowns          = lazy(() => import('./views/Markdowns'))
const Reports            = lazy(() => import('./views/Reports'))
const Subscription       = lazy(() => import('./views/Subscription'))
const SubscriptionSetup  = lazy(() => import('./views/SubscriptionSetup'))
const SubscriptionReturn = lazy(() => import('./views/SubscriptionReturn'))
const StoreProfile       = lazy(() => import('./views/StoreProfile'))
const Showroom           = lazy(() => import('./views/Showroom'))
const Notifications      = lazy(() => import('./views/Notifications'))
const ForgotPassword     = lazy(() => import('./views/forgot-password'))
const ResetPassword      = lazy(() => import('./views/reset-password'))
const SetPassword        = lazy(() => import('./views/set-password'))
const Support            = lazy(() => import('./views/Support'))
const VoidCIL            = lazy(() => import('./views/VoidCIL'))
const Locations          = lazy(() => import('./views/Locations'))
const AddLocation        = lazy(() => import('./views/AddLocation'))
const OroPoints          = lazy(() => import('./views/OroPoints'))
const PriceTags          = lazy(() => import('./views/PriceTags'))
const ViewProfile        = lazy(() => import('./views/ViewProfile'))
const AIModelStudio      = lazy(() => import('./views/AIModelStudio'))
const Integrations       = lazy(() => import('./views/Integrations'))

function App() {
  return (
    <BrowserRouter>
      {/* One boundary around every route: the portal's standard full-page
          spinner covers the moment a screen's code is being fetched, which on a
          warm cache is imperceptible and on a cold one replaces a blank frame. */}
      <Suspense fallback={<Loading page />}>
        <Routes>
          {/* ── Public routes (no sidebar/header) ── */}
          <Route path="/login"              element={<Login />} />
          <Route path="/forgot-password"    element={<ForgotPassword />} />
          <Route path="/reset-password"     element={<ResetPassword />} />
          <Route path="/set-password"       element={<SetPassword />} />

          <Route path="/subscription-setup" element={<SubscriptionSetup />} />
          {/* ── Stripe return — no sidebar ── */}
          <Route path="/subscription/return" element={<SubscriptionReturn />} />

          {/* ── POS — no sidebar (staff-facing full-viewport screen) ── */}
          <Route path="/pos"                element={<POS />} />

          {/* ── Protected routes (with sidebar/header) ── */}
          <Route element={<Layout />}>
            <Route path="/"                    element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"           element={<Dashboard />} />
            <Route path="/products"            element={<Products />} />
            <Route path="/products/add"        element={<AddProduct />} />
            <Route path="/products/edit/:id"   element={<AddProduct />} />
            <Route path="/inventory"           element={<Inventory />} />
            <Route path="/reservations"        element={<Reservations />} />
            {/* Deep link target for reservation notifications */}
            <Route path="/reservations/:id"    element={<Reservations />} />
            <Route path="/orders"              element={<Orders />} />
            {/* Deep link target for order notifications */}
            <Route path="/orders/:id"          element={<Orders />} />
            {/* WhatsApp-only inbox. Guarded here as well as in the sidebar
                so typing the URL cannot reach a screen the boutique has no
                entitlement for. */}
            <Route path="/messages"            element={isWhatsappEnabled() ? <Messages /> : <Navigate to="/dashboard" replace />} />
            <Route path="/customers"           element={<Customers />} />
            <Route path="/engagement"          element={<Engagement />} />
            <Route path="/discounts"           element={<Discounts />} />
            <Route path="/promotions"          element={<Promotions />} />
            <Route path="/analytics"           element={<Analytics />} />
            <Route path="/financials"          element={<Financials />} />
            <Route path="/markdowns"           element={<Markdowns />} />
            <Route path="/reports"             element={<Reports />} />
            <Route path="/subscription"        element={<Subscription />} />
            <Route path="/store"               element={<StoreProfile />} />
            <Route path="/integrations"        element={<Integrations />} />
            <Route path="/showroom"            element={<Showroom />} />
            <Route path="/notifications"       element={<Notifications />} />
            <Route path="/support"             element={<Support />} />
            <Route path="/void-cil"            element={<VoidCIL />} />
            <Route path="/locations"           element={<Locations />} />
            <Route path="/locations/new"       element={<AddLocation />} />
            <Route path="/oro-points"          element={<OroPoints />} />
            <Route path="/price-tags"          element={<PriceTags />} />
            <Route path="/profile"             element={<ViewProfile />} />
            <Route path="/tryon"               element={<AIModelStudio />} />

          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
