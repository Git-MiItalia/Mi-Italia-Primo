import { useState, useEffect } from 'react'
import { apiFetch } from '../../lib/api'

const BASE_URL = import.meta.env.VITE_API_URL

export default function StripeCheckout({ plan = 'pro', onClose, onSuccess }) {
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [mounted, setMounted]   = useState(false)

  useEffect(() => {
    let checkout = null
    let destroyed = false

    const init = async () => {
      try {
        // 1. Get session from backend
        const res  = await apiFetch(`${BASE_URL}/boutique/subscription/checkout`, {
          method: 'POST',
          body: JSON.stringify({ plan }),
        })
        const data = await res.json()
        if (!data.success) { setError(data.message || 'Failed to create checkout session.'); setLoading(false); return }

        const { client_secret, publishable_key } = data.data

        // If cleanup already ran (StrictMode double-invoke), abort
        if (destroyed) return

        // 2. Load Stripe.js dynamically
        if (!window.Stripe) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script')
            script.src = 'https://js.stripe.com/v3/'
            script.onload = resolve
            script.onerror = () => reject(new Error('Failed to load Stripe.js'))
            document.head.appendChild(script)
          })
        }

        if (destroyed) return

        const stripe = window.Stripe(publishable_key)

        // 3. Mount embedded checkout
        checkout = await stripe.initEmbeddedCheckout({ clientSecret: client_secret })

        if (destroyed) { checkout.destroy(); return }

        checkout.mount('#stripe-checkout-container')
        setLoading(false)
        setMounted(true)

      } catch (err) {
        if (!destroyed) {
          setError(err.message || 'Something went wrong. Please try again.')
          setLoading(false)
        }
      }
    }

    init()

    return () => {
      destroyed = true
      if (checkout) checkout.destroy()
    }
  }, [plan])

  return (
    <div className="sc-overlay">
      <div className="sco-modal">
        {/* Header */}
        <div className="sco-hdr">
          <div className="sco-title">
            Upgrade to <em>Pro</em>
          </div>
          <button className="sco-close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="sco-body">
          {loading && (
            <div className="sco-loading">
              <span className="material-symbols-outlined sco-spin">sync</span>
              <div>Preparing secure checkout…</div>
            </div>
          )}

          {error && (
            <div className="alert alert-red sco-error">
              <span className="material-symbols-outlined">error</span>{error}
            </div>
          )}

          {/* Stripe mounts here */}
          <div id="stripe-checkout-container" style={{ display: loading || error ? 'none' : 'block' }} />
        </div>
      </div>
    </div>
  )
}
