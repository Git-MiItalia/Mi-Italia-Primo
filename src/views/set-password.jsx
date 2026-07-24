import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import boutiqueBg from '../assets/pexels-rachel-claire-5531541.jpg'
import PrimoLogo from '../assets/PrimoLogo.svg'

const API = import.meta.env.VITE_API_URL

export default function SetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const URL_token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [showCfm, setShowCfm]   = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm)  { setError('Passwords do not match.'); return }

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
          setError(res.message)
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
            Set <em className="auth-title-em">New Password</em>
          </h2>
          <p className="auth-subtitle">Create a password to finish setting things up</p>

          {error   && <div className="alert alert-urgent auth-alert">{error}</div>}
          {success && <div className="alert alert-success auth-alert">Redirecting to login…</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-lbl">Password</label>
              <div className="pw-input-wrap">
                <input className="form-input pw-input" type={showPw ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Password" />
                <span className="pw-eye" onClick={() => setShowPw(v => !v)}>
                  <span className="material-symbols-outlined">{showPw ? 'visibility_off' : 'visibility'}</span>
                </span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-lbl">Confirm Password</label>
              <div className="pw-input-wrap">
                <input className="form-input pw-input" type={showCfm ? 'text' : 'password'}
                  value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="Confirm Password" />
                <span className="pw-eye" onClick={() => setShowCfm(v => !v)}>
                  <span className="material-symbols-outlined">{showCfm ? 'visibility_off' : 'visibility'}</span>
                </span>
              </div>
            </div>

            <button className="btn btn-primary auth-submit-btn" type="submit">Submit</button>
          </form>

          <div className="auth-back-link" onClick={() => window.location.href = 'https://primodev.revoltution.com/login'}>
            ← Back to login
          </div>
        </div>
      </div>
    </div>
  )
}
