import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import boutiqueBg from '../assets/pexels-rachel-claire-5531541.jpg'
import PrimoLogo from '../assets/PrimoLogo.svg'
import useLangStore from '../store/langStore'
const API = import.meta.env.VITE_API_URL

export default function ForgotPassword() {
  const navigate      = useNavigate()
  const { t } = useTranslation()
  const fetchLoginTranslations = useLangStore(s => s.fetchLoginTranslations)
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => { fetchLoginTranslations() }, [])

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!email.trim()) { setError(t('forgot_password.error_required', 'Please enter your email address.')); return }
    setLoading(true)
    fetch(`${API}/auth/boutique/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    })
      .then(r => r.json())
      .then(res => {
        setLoading(false)
        if (res.success) setSent(true)
        else setError(res.message ?? t('common.error_generic', 'Something went wrong. Please try again.'))
      })
      .catch(() => { setLoading(false); setError(t('common.error_network', 'Network error. Please check your connection.')) })
  }

  return (
    <div className="auth-layout">
      <div className="auth-img-panel" style={{ backgroundImage:`url('${boutiqueBg}')` }}>
        <div className="auth-img-overlay" />
      </div>

      <div className="auth-form-panel">
        <div className="auth-form-inner">
          <div className="auth-logo-wrap">
            <img src={PrimoLogo} alt="Primo by Mi Italia" className="auth-logo" />
          </div>

          {!sent ? (
            <>
              <h2 className="auth-title">
                {t('forgot_password.title', 'Forgot')} <em className="auth-title-em">{t('forgot_password.title_em', 'Password')}</em>
              </h2>
              <p className="auth-subtitle">{t('forgot_password.subtitle', "Enter your account email and we'll send you a link to reset your password.")}</p>

              {error && <div className="alert alert-urgent auth-alert">{error}</div>}

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-lbl">{t('forgot_password.email_label', 'Email')}</label>
                  <input
                    className="form-input"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder={t('forgot_password.email_placeholder', 'your@email.com')}
                    autoFocus
                  />
                </div>
                <button className="btn btn-primary auth-submit-btn" type="submit" disabled={loading}>
                  {loading ? t('forgot_password.sending', 'Sending…') : t('forgot_password.send_btn', 'Send Reset Link')}
                </button>
              </form>
            </>
          ) : (
            <div className="modal-success">
              <div className="modal-success-emoji">📧</div>
              <h2 className="auth-title">
                {t('forgot_password.success_title', 'Check your')} <em className="auth-title-em">{t('forgot_password.success_em', 'email')}</em>
              </h2>
              <p className="auth-subtitle">{t('forgot_password.success_msg', "If {{email}} is registered, you'll receive a reset link shortly.", { email })}</p>
            </div>
          )}

          <div className="auth-back-link" onClick={() => navigate('/login')}>
            {t('forgot_password.back_to_login', '← Back to login')}
          </div>
        </div>
      </div>
    </div>
  )
}
