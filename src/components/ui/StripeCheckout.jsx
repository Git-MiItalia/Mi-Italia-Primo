import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../../lib/api'
import Loading from './Loading'

const BASE_URL = import.meta.env.VITE_API_URL

// Plan names are the product's own — Starter, Connect, Pro — so they are
// capitalised rather than translated, the same as everywhere else in billing.
const planName = (p) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : '')

/* `error` holds either the server's own message (a string) or one of these,
   worded at render. Calling t() inside the effect instead would make the
   translation function a dependency of it, and re-running this effect tears
   down and rebuilds Stripe's embedded checkout — so a language change
   mid-payment would restart the form. */
const ERR_SESSION = { key: 'sco.err_session',      fallback: 'Could not start checkout. Please try again.' }
const ERR_GENERIC = { key: 'common.error_generic', fallback: 'Something went wrong. Please try again.' }

/* No onSuccess callback: this is Stripe's EMBEDDED checkout, which does not
   call back into the page on completion — it redirects the browser to the
   session's return_url, which the backend sets and which lands on
   /subscription/return (views/SubscriptionReturn). Both callers used to pass an
   onSuccess that could therefore never fire; they no longer do. */
export default function StripeCheckout({ plan = 'pro', onClose }) {
  const { t } = useTranslation()
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

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
        if (!data.success) { setError(data.message || ERR_SESSION); setLoading(false); return }

        const { client_secret, publishable_key } = data.data

        // If cleanup already ran (StrictMode double-invoke), abort
        if (destroyed) return

        // 2. Load Stripe.js dynamically
        if (!window.Stripe) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script')
            script.src = 'https://js.stripe.com/v3/'
            script.onload = resolve
            // Rejected with no message so the catch below shows its translated
            // fallback rather than putting "Failed to load Stripe.js" — a
            // sentence for us, not for a boutique — in front of the merchant.
            script.onerror = () => reject(new Error(''))
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

      } catch (err) {
        if (!destroyed) {
          setError(err.message || ERR_GENERIC)
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
          {/* Said "Upgrade to Pro" for every plan, ignoring the `plan` prop —
              so a boutique buying Connect was told it was buying Pro. */}
          <div className="sco-title">
            {t('sco.title_pre', 'Upgrade to')} <em>{planName(plan)}</em>
          </div>
          <button className="sco-close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="sco-body">
          {loading && <Loading className="ld-cell" label={t('sco.preparing', 'Preparing secure checkout') + '…'} />}

          {error && (
            <div className="alert alert-red sco-error">
              <span className="material-symbols-outlined">error</span>
              {typeof error === 'string' ? error : t(error.key, error.fallback)}
            </div>
          )}

          {/* Stripe mounts here */}
          <div id="stripe-checkout-container" style={{ display: loading || error ? 'none' : 'block' }} />
        </div>
      </div>
    </div>
  )
}
