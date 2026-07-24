import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { getToken } from '../lib/auth'

const BASE_URL = import.meta.env.VITE_API_URL

export default function SubscriptionReturn() {
  const [searchParams] = useSearchParams()
  const navigate        = useNavigate()
  const sessionId       = searchParams.get('session_id')
  const [status, setStatus] = useState('loading') // loading | success | failed | error

  useEffect(() => {
    if (!getToken())  { navigate('/login');              return }
    if (!sessionId)   { navigate('/subscription-setup'); return }

    apiFetch(`${BASE_URL}/boutique/subscription/checkout-session/${sessionId}`)
      .then(r => r.json())
      .then(data => {
        if (!data.success) { setStatus('error'); return }

        const { status: s, payment_status } = data.data

        if (s === 'complete' && payment_status === 'paid') {
          setStatus('success')
          setTimeout(() => navigate('/subscription', { replace: true }), 2500)
        } else if (s === 'open') {
          // Payment not completed — send back to pick a plan
          navigate('/subscription-setup', { replace: true })
        } else {
          // expired / failed / unknown
          setStatus('failed')
        }
      })
      .catch(() => setStatus('error'))
  }, [sessionId])

  return (
    <div className="sr-wrap">

      {status === 'loading' && (
        <div className="sr-card">
          <span className="material-symbols-outlined sr-spin">sync</span>
          <div className="sr-title">Verifying your payment…</div>
          <div className="sr-sub">Please wait a moment.</div>
        </div>
      )}

      {status === 'success' && (
        <div className="sr-card">
          <div className="sr-icon-wrap success">
            <span className="material-symbols-outlined">check_circle</span>
          </div>
          <div className="sr-title">Welcome to <em>Pro</em></div>
          <div className="sr-sub">
            Your subscription is active. Redirecting you to the dashboard…
          </div>
          <button className="btn btn-primary sr-btn" onClick={() => navigate('/subscription', { replace: true })}>
            Go to Subscription
          </button>
        </div>
      )}

      {status === 'failed' && (
        <div className="sr-card">
          <div className="sr-icon-wrap error">
            <span className="material-symbols-outlined">error</span>
          </div>
          <div className="sr-title">Payment not completed</div>
          <div className="sr-sub">
            Your session expired or the payment was unsuccessful. Please try again.
          </div>
          <button className="btn btn-primary sr-btn" onClick={() => navigate('/subscription-setup', { replace: true })}>
            Back to Plans
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="sr-card">
          <div className="sr-icon-wrap error">
            <span className="material-symbols-outlined">error</span>
          </div>
          <div className="sr-title">Something went wrong</div>
          <div className="sr-sub">
            We couldn't verify your payment. Please contact support.
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'center', marginTop:16 }}>
            <button className="btn btn-outline" onClick={() => navigate('/subscription-setup', { replace: true })}>
              Back to Plans
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/dashboard', { replace: true })}>
              Go to Dashboard
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
