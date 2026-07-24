import { useState } from 'react'
import { apiFetch } from '../../lib/api'

const BASE_URL = import.meta.env.VITE_API_URL

const TX = {
  title:         'Connect Your',
  title_em:      'Stripe Account',
  body:          'To receive payments from orders and reservations, you need to connect a Stripe account. This takes just a few minutes and keeps your earnings secure.',
  features: [
    'Receive payments from Mi Italia orders',
    'Automatic payouts to your bank account',
    'Powered by Stripe — bank-level security',
  ],
  connect_btn:   'Connect Stripe Account',
  connecting:    'Opening Stripe...',
  refresh_btn:   "I've Connected — Refresh Status",
  checking:      'Checking...',
  skip:          'Skip for now',
  skip_note:     'You can connect Stripe later from the Financials page. Some features will be limited until connected.',
  note:          "You'll be redirected to Stripe in a new tab. Return here and click Refresh when done.",
  err_link:      'Failed to generate Stripe link.',
  err_refresh:   'Failed to refresh Stripe link.',
  err_network:   'Unable to reach server. Please try again.',
  err_pending:   'Stripe not fully connected yet. Complete setup on Stripe then refresh again.',
}

export default function StripeConnect({ onConnected, onSkip }) {
  const [loading, setLoading]           = useState(false)
  const [refreshing, setRefreshing]     = useState(false)
  const [error, setError]               = useState('')
  const [skipConfirm, setSkipConfirm]   = useState(false)

  const getEmail = () => {
    try {
      const raw = localStorage.getItem('primo_user') || localStorage.getItem('user')
      if (raw) return JSON.parse(raw)?.email || ''
    } catch {}
    return ''
  }

  const handleConnect = async () => {
    setLoading(true); setError('')
    try {
      const res  = await apiFetch(`${BASE_URL}/boutique/stripe/onboard`, {
        method: 'POST',
        body: JSON.stringify({ email: getEmail() }),
      })
      const data = await res.json()
      if (data.success) {
        window.open(data.data.onboarding_url, '_blank')
      } else {
        setError(data.message || TX.err_link)
      }
    } catch { setError(TX.err_network) }
    setLoading(false)
  }

  const handleRefresh = async () => {
    setRefreshing(true); setError('')
    try {
      // First check if already connected
      const statusRes  = await apiFetch(`${BASE_URL}/boutique/stripe/status`)
      const statusData = await statusRes.json()

      if (statusData.success && statusData.data.charges_enabled && statusData.data.payouts_enabled) {
        onConnected(); return
      }

      // Not connected yet — refresh the onboard link and open it
      const refreshRes  = await apiFetch(`${BASE_URL}/boutique/stripe/onboard/refresh`)
      const refreshData = await refreshRes.json()

      if (refreshData.success) {
        window.open(refreshData.data.onboarding_url, '_blank')
        setError(TX.err_pending)
      } else {
        setError(refreshData.message || TX.err_refresh)
      }
    } catch { setError(TX.err_network) }
    setRefreshing(false)
  }

  return (
    <div className="sc-overlay">
      <div className="sc-modal">
        <div className="sc-icon-wrap">
          <span className="material-symbols-outlined sc-icon">account_balance</span>
        </div>

        <div className="sc-title">
          {TX.title} <em>{TX.title_em}</em>
        </div>

        <p className="sc-body">{TX.body}</p>

        <div className="sc-features">
          {TX.features.map(feat => (
            <div key={feat} className="sc-feature-row">
              <span className="material-symbols-outlined sc-check">check_circle</span>
              <span>{feat}</span>
            </div>
          ))}
        </div>

        {error && (
          <div className="alert alert-red sc-error">
            <span className="material-symbols-outlined">error</span>{error}
          </div>
        )}

        <div className="sc-actions">
          <button className="btn btn-primary sc-btn-connect" disabled={loading} onClick={handleConnect}>
            <span className="material-symbols-outlined">open_in_new</span>
            {loading ? TX.connecting : TX.connect_btn}
          </button>
          <button className="btn btn-dark sc-btn-refresh" disabled={refreshing} onClick={handleRefresh}>
            <span className="material-symbols-outlined">refresh</span>
            {refreshing ? TX.checking : TX.refresh_btn}
          </button>
        </div>

        <p className="sc-note">{TX.note}</p>

        <div className="sc-skip-wrap">
          {!skipConfirm ? (
            <span className="sc-skip-link" onClick={() => setSkipConfirm(true)}>
              {TX.skip}
            </span>
          ) : (
            <div className="sc-skip-confirm">
              <p className="sc-skip-note">{TX.skip_note}</p>
              <button className="btn btn-dark sc-btn-skip" onClick={onSkip}>
                Continue without Stripe
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
