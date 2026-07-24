import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { setToken } from '../lib/auth'
import boutiqueBg from '../assets/pexels-rachel-claire-5531541.jpg'
import PrimoLogo from '../assets/PrimoLogo.svg'

const API = import.meta.env.VITE_API_URL

export default function Login() {
  const navigate  = useNavigate()
  const { t }     = useTranslation()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState('')

  function handleLogin(e) {
    e.preventDefault()
    fetch(`${API}/auth/boutique/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setToken(res.data.token)
          localStorage.setItem('primo_user', JSON.stringify(res.data.staff))
          navigate('/dashboard')
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
            <em className="auth-title-em">Sign In to Your Boutique</em>
          </h2>
          <p className="auth-subtitle">Enter your credentials</p>
          {error && <div className="alert alert-urgent auth-alert">{error}</div>}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-lbl">Email</label>
              <input className="form-input" type="email" value={email}
                onChange={e => setEmail(e.target.value)} />
            </div>

            <div className="form-group">
              <div className="login-pw-row">
                <label className="form-lbl login-pw-lbl">Password</label>
                <span className="login-forgot" onClick={() => navigate('/forgot-password')}>
                  Forgot Password?
                </span>
              </div>
              <div className="pw-input-wrap">
                <input className="form-input pw-input" type={showPw ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)} />
                <span className="pw-eye" onClick={() => setShowPw(v => !v)}>
                  <span className="material-symbols-outlined">
                    {showPw ? 'visibility_off' : 'visibility'}
                  </span>
                </span>
              </div>
            </div>

           <button className="btn btn-primary auth-submit-btn" type="submit">Sign In</button>
          </form>
        </div>
      </div>
    </div>
  )
}
