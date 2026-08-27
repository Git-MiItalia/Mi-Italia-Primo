import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import boutiqueBg from '../assets/pexels-rachel-claire-5531541.jpg'
import PrimoLogo from '../assets/PrimoLogo.svg'
import { setStaff } from '../lib/auth'
import useLangStore from '../store/langStore'
const API = import.meta.env.VITE_API_URL

export default function Login() {
  const navigate      = useNavigate()
  const { t } = useTranslation()
  const fetchLoginTranslations = useLangStore(s => s.fetchLoginTranslations)
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => { fetchLoginTranslations() }, [])

  function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    fetch(`${API}/auth/boutique/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
      .then(r => r.json())
      .then(res => {
        setLoading(false)
        if (res.success) {
          localStorage.setItem('primo_token', res.data.token)
          setStaff(res.data.staff)
          navigate('/')
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
            <em className="auth-title-em">{t('login.sign_in', 'Sign In')}</em>
          </h2>
          <p className="auth-subtitle">{t('login.subtitle', 'Sign in to your boutique dashboard')}</p>

          {error && <div className="alert alert-urgent auth-alert">{error}</div>}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-lbl">{t('login.email_label', 'Email')}</label>
              <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-lbl">{t('login.password_label', 'Password')}</label>
              <div className="pw-input-wrap">
                <input className="form-input pw-input" type={showPw ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)} />
                <span className="pw-eye" onClick={() => setShowPw(v => !v)}>
                  <span className="material-symbols-outlined">{showPw ? 'visibility_off' : 'visibility'}</span>
                </span>
              </div>
            </div>
            <div className="auth-forgot-link" onClick={() => navigate('/forgot-password')}>
              {t('login.forgot_password', 'Forgot password?')}
            </div>
            <button className="btn btn-primary auth-submit-btn" type="submit" disabled={loading}>
              {loading ? t('common.loading', 'Loading...') : t('login.sign_in', 'Sign In')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
