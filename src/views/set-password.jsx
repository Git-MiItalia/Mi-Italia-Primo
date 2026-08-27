import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import boutiqueBg from '../assets/pexels-rachel-claire-5531541.jpg'
import PrimoLogo from '../assets/PrimoLogo.svg'
import useLangStore from '../store/langStore'

const API = import.meta.env.VITE_API_URL

export default function SetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const URL_token = searchParams.get('token')
  const { t } = useTranslation()
  const fetchLoginTranslations = useLangStore(s => s.fetchLoginTranslations)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [showCfm, setShowCfm]   = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState(false)

  useEffect(() => { fetchLoginTranslations() }, [])

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError(t('reset_password.error_min', 'Password must be at least 6 characters.')); return }
    if (password !== confirm)  { setError(t('reset_password.error_match', 'Passwords do not match.')); return }

    fetch(`${API}/auth/boutique/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: URL_token, new_password: password })
    })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setSuccess(true)
          setTimeout(() => navigate('/login'), 2000)
        } else {
          setError(res.message ?? t('common.error_generic', 'Something went wrong. Please try again.'))
        }
      })
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

          {error   && <div className="alert alert-urgent auth-alert">{error}</div>}
          {success && <div className="alert alert-success auth-alert">{t('reset_password.success', 'Password set! Redirecting to login…')}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-lbl">{t('reset_password.new_password', 'New Password')}</label>
              <div className="pw-input-wrap">
                <input className="form-input pw-input" type={showPw ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder={t('reset_password.new_password_placeholder', 'Min. 6 characters')} />
                <span className="pw-eye" onClick={() => setShowPw(v => !v)}>
                  <span className="material-symbols-outlined">{showPw ? 'visibility_off' : 'visibility'}</span>
                </span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-lbl">{t('reset_password.confirm_password', 'Confirm Password')}</label>
              <div className="pw-input-wrap">
                <input className="form-input pw-input" type={showCfm ? 'text' : 'password'}
                  value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder={t('reset_password.confirm_placeholder', 'Repeat password')} />
                <span className="pw-eye" onClick={() => setShowCfm(v => !v)}>
                  <span className="material-symbols-outlined">{showCfm ? 'visibility_off' : 'visibility'}</span>
                </span>
              </div>
            </div>

            <button className="btn btn-primary auth-submit-btn" type="submit">{t('reset_password.submit', 'Set Password')}</button>
          </form>

          <div className="auth-back-link" onClick={() => navigate('/login')}>
            ← {t('reset_password.back', 'Back to login')}
          </div>
        </div>
      </div>
    </div>
  )
}
