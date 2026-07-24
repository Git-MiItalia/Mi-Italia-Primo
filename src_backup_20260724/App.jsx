import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Dashboard from './views/Dashboard'
import Products from './views/Products'
import AddProduct from './views/AddProduct'
import Inventory from './views/Inventory'
import Reservations from './views/Reservations'
import Orders from './views/Orders'
import POS from './views/POS'
import Messages from './views/Messages'
import Customers from './views/Customers'
import Marketing from './views/Marketing'
import Discounts from './views/Discounts'
import Analytics from './views/Analytics'
import Financials from './views/Financials'
import Reports from './views/Reports'
import Subscription from './views/Subscription'
import SubscriptionSetup from './views/SubscriptionSetup'
import SubscriptionReturn from './views/SubscriptionReturn'
import StoreProfile from './views/StoreProfile'
import Staff from './views/Staff'
import Showroom from './views/Showroom'
import Notifications from './views/Notifications'
import Login from './views/Login'
import ForgotPassword from './views/forgot-password'
import ResetPassword from './views/reset-password'
import Support from './views/Support'
import VoidCIL from './views/VoidCIL'
import Locations from './views/Locations'
import OroPoints from './views/OroPoints'
import PriceTags from './views/PriceTags'
import ViewProfile from './views/ViewProfile'
import SetPassword from './views/set-password'
import TryOn from './views/TryOn'


function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Public routes (no sidebar/header) ── */}
        <Route path="/login"              element={<Login />} />
        <Route path="/forgot-password"    element={<ForgotPassword />} />
        <Route path="/reset-password"     element={<ResetPassword />} />
        <Route path="/set-password"       element={<SetPassword />} />
      
        <Route path="/subscription-setup" element={<SubscriptionSetup />} />
        {/* ── Stripe return — no sidebar ── */}
        <Route path="/subscription/return" element={<SubscriptionReturn />} />

        {/* ── Protected routes (with sidebar/header) ── */}
        <Route element={<Layout />}>
          <Route path="/"                    element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"           element={<Dashboard />} />
          <Route path="/products"            element={<Products />} />
          <Route path="/products/add"        element={<AddProduct />} />
          <Route path="/products/edit/:id"   element={<AddProduct />} />
          <Route path="/inventory"           element={<Inventory />} />
          <Route path="/reservations"        element={<Reservations />} />
          <Route path="/orders"              element={<Orders />} />
          <Route path="/pos"                 element={<POS />} />
          <Route path="/messages"            element={<Messages />} />
          <Route path="/customers"           element={<Customers />} />
          <Route path="/marketing"           element={<Marketing />} />
          <Route path="/discounts"           element={<Discounts />} />
          <Route path="/analytics"           element={<Analytics />} />
          <Route path="/financials"          element={<Financials />} />
          <Route path="/reports"             element={<Reports />} />
          <Route path="/subscription"        element={<Subscription />} />
          <Route path="/store"               element={<StoreProfile />} />
          <Route path="/staff"               element={<Staff />} />
          <Route path="/showroom"            element={<Showroom />} />
          <Route path="/notifications"       element={<Notifications />} />
          <Route path="/support"             element={<Support />} />
          <Route path="/void-cil"            element={<VoidCIL />} />
          <Route path="/locations"           element={<Locations />} />
          <Route path="/oro-points"          element={<OroPoints />} />
          <Route path="/price-tags"          element={<PriceTags />} />
          <Route path="/profile"             element={<ViewProfile />} />
          <Route path="/tryon"               element={<TryOn />} />

        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
