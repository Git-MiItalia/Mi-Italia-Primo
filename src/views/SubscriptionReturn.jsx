import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'
import { getToken } from '../lib/auth'

const BASE_URL = import.meta.env.VITE_API_URL

export default function SubscriptionReturn() {
  const [searchParams] = useSearchParams()
  const navigate        = useNavigate()
  const { t }           = useTranslation()
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
          navigate('/subscription-setup', { replace: true })
        } else {
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
          <div className="sr-title">{t('sub.return.verifying')}</div>
          <div className="sr-sub">{t('sub.return.please_wait')}</div>
        </div>
      )}

      {status === 'success' && (
        <div className="sr-card">
          <div className="sr-icon-wrap success">
            <span className="material-symbols-outlined">check_circle</span>
          </div>
          <div className="sr-title">{t('sub.return.welcome')} <em>{t('sub.plans.pro')}</em></div>
          <div className="sr-sub">
            {t('sub.return.active_redirect')}
          </div>
          <button className="btn btn-primary sr-btn" onClick={() => navigate('/subscription', { replace: true })}>
            {t('sub.return.go_subscription')}
          </button>
        </div>
      )}

      {status === 'failed' && (
        <div className="sr-card">
          <div className="sr-icon-wrap error">
            <span className="material-symbols-outlined">error</span>
          </div>
          <div className="sr-title">{t('sub.return.not_completed')}</div>
          <div className="sr-sub">
            {t('sub.return.expired_or_failed')}
          </div>
          <button className="btn btn-primary sr-btn" onClick={() => navigate('/subscription-setup', { replace: true })}>
            {t('sub.return.back_plans')}
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="sr-card">
          <div className="sr-icon-wrap error">
            <span className="material-symbols-outlined">error</span>
          </div>
          <div className="sr-title">{t('common.error_generic')}</div>
          <div className="sr-sub">
            {t('sub.return.verify_failed')}
          </div>
          <div className="sr-error-actions">
            <button className="btn btn-outline" onClick={() => navigate('/subscription-setup', { replace: true })}>
              {t('sub.return.back_plans')}
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/dashboard', { replace: true })}>
              {t('sub.return.go_dashboard')}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
