import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import boutiqueBg from '../assets/pexels-rachel-claire-5531541.jpg'
import PrimoLogo from '../assets/PrimoLogo.svg'
const API = import.meta.env.VITE_API_URL

export default function ForgotPassword() {
  const navigate      = useNavigate()
  const { t }         = useTranslation()
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!email.trim()) { setError(t('forgot_password.error_required')); return }
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
        else setError(res.message ?? t('common.error_generic'))
      })
      .catch(() => { setLoading(false); setError(t('common.error_network')) })
  }

  return (
    <div className="auth-layout">

      {/* ── Left: image panel ── */}
      <div className="auth-img-panel" style={{ backgroundImage:`url('${boutiqueBg}')` }}>
        <div className="auth-img-overlay" />
      </div>

      {/* ── Right: form panel ── */}
      <div className="auth-form-panel">
        <div className="auth-form-inner">

          {/* Logo */}
          <div className="auth-logo-wrap">
            <img src={PrimoLogo} alt="Primo by Mi Italia" className="auth-logo" />
          </div>

          {!sent ? (
            <>
              <h2 className="auth-title">
                <em className="auth-title-em">Forgot Password?</em>
              </h2>
              <p className="auth-subtitle">Enter your email below to receive reset password</p>

              {error && <div className="alert alert-urgent auth-alert">{error}</div>}

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-lbl">Enter your registered Email</label>
                  <input
                    className="form-input"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Enter your registered Email"
                    autoFocus
                  />
                </div>
                <button className="btn btn-primary auth-submit-btn" type="submit" disabled={loading}>
                  {loading ? 'Sending reset link to your Mail…' : 'Send reset link'}
                </button>
              </form>
            </>
          ) : (
            <div className="modal-success">
              <div className="modal-success-emoji">📧</div>
                <h2 className="auth-title">
                  <em className="auth-title-em">Reset link sent</em>
                </h2>
                <p className="auth-subtitle">Reset link sent successfully</p>
            </div>
          )}

          <div className="auth-back-link" onClick={() => window.location.href = 'https://primodev.revoltution.com/login'}>
            ← Back to login
          </div>
        </div>
      </div>
    </div>
  )
}
