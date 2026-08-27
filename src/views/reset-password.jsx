import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import boutiqueBg from '../assets/pexels-rachel-claire-5531541.jpg'
import PrimoLogo from '../assets/PrimoLogo.svg'
import useLangStore from '../store/langStore'
const API = import.meta.env.VITE_API_URL

export default function ResetPassword() {
  const navigate        = useNavigate()
  const [params]        = useSearchParams()
  const token           = params.get('token')
  const { t } = useTranslation()
  const fetchLoginTranslations = useLangStore(s => s.fetchLoginTranslations)
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [success, setSuccess]     = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => { fetchLoginTranslations() }, [])

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError(t('reset_password.error_min', 'Password must be at least 6 characters.')); return }
    if (password !== confirm) { setError(t('reset_password.error_match', 'Passwords do not match.')); return }
    setLoading(true)
    fetch(`${API}/auth/boutique/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password: password })
    })
      .then(r => r.json())
      .then(res => {
        setLoading(false)
        if (res.success) {
          setSuccess(true)
          setTimeout(() => navigate('/login'), 2500)
        } else {
          setError(res.message ?? t('common.error_generic', 'Something went wrong. Please try again.'))
        }
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

          <h2 className="auth-title">
            {t('reset_password.title', 'Set')} <em className="auth-title-em">{t('reset_password.title_em', 'Password')}</em>
          </h2>
          <p className="auth-subtitle">{t('reset_password.subtitle', 'Choose a secure password for your account')}</p>

          {success && <div className="alert alert-info auth-alert">{t('reset_password.success', 'Password set! Redirecting to login…')}</div>}
          {error && <div className="alert alert-urgent auth-alert">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-lbl">{t('reset_password.new_password', 'New Password')}</label>
              <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder={t('reset_password.new_password_placeholder', 'Min. 6 characters')} />
            </div>
            <div className="form-group">
              <label className="form-lbl">{t('reset_password.confirm_password', 'Confirm Password')}</label>
              <input className="form-input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder={t('reset_password.confirm_placeholder', 'Repeat password')} />
            </div>
            <button className="btn btn-primary auth-submit-btn" type="submit" disabled={loading || success}>
              {loading ? t('common.saving', 'Saving…') : t('reset_password.submit', 'Set Password')}
            </button>
          </form>

          <div className="auth-back-link" onClick={() => navigate('/login')}>
            ← {t('reset_password.back', 'Back to login')}
          </div>
        </div>
      </div>
    </div>
  )
}
