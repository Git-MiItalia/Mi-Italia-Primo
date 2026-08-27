import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'

const API = import.meta.env.VITE_API_URL
const IMG_BASE = import.meta.env.VITE_IMG_BASE_URL

// Notifies other mounted components (e.g. Sidebar's own avatar) that the
// logged-in user's photo changed, without a shared store or full reload.
const MY_PHOTO_UPDATED_EVENT = 'primo:my-photo-updated'

function ini(name) {
  return (name ?? '').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()
}

export default function ViewProfile() {
  const navigate = useNavigate()
  const fileRef  = useRef(null)

  const [profile, setProfile]               = useState(null)
  const [loading, setLoading]               = useState(true)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoPreview, setPhotoPreview]     = useState(null)
  const [photoError, setPhotoError]         = useState('')

  useEffect(() => {
    apiFetch(`${API}/boutique/profile`)
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setProfile(json.data)
          setPhotoPreview(json.data.my_photo_url ? `${IMG_BASE}${json.data.my_photo_url}` : null)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoError('')

    // Local preview immediately
    const reader = new FileReader()
    reader.onload = ev => setPhotoPreview(ev.target.result)
    reader.readAsDataURL(file)

    setPhotoUploading(true)
    try {
      const form = new FormData()
      form.append('photo', file)
      const res = await apiFetch(`${API}/boutique/profile/founder-photo`, {
        method: 'POST',
        body: form,
      })
      const data = await res.json()
      if (data.success) {
        const url = data.data.my_photo_url ?? data.data.founder_photo_url
        setPhotoPreview(url ? `${IMG_BASE}${url}` : null)
        window.dispatchEvent(new CustomEvent(MY_PHOTO_UPDATED_EVENT, { detail: url }))
      } else {
        setPhotoError(data.message || 'Failed to upload photo.')
      }
    } catch { setPhotoError('Network error. Please try again.') }
    setPhotoUploading(false)
  }

  if (loading) return (
    <div className="vp-loading">
      <span className="material-symbols-outlined">hourglass_empty</span>
      Loading profile…
    </div>
  )

  return (
    <div className="vp-wrap">
      <button className="btn btn-dark btn-sm vp-back" onClick={() => navigate(-1)}>
        <span className="material-symbols-outlined">arrow_back</span>Back
      </button>

      <div className="vp-center-card">
        <div className="card vp-card">

          {/* Photo — hover to change */}
          <div className="vp-avatar-wrap" onClick={() => fileRef.current?.click()}>
            {photoPreview ? (
              <img src={photoPreview} alt={profile?.name} className="vp-avatar-img" />
            ) : (
              <div className="vp-avatar-placeholder">
                <span className="material-symbols-outlined vp-avatar-icon">person</span>
              </div>
            )}

            {/* Hover overlay */}
            <div className="vp-avatar-overlay">
              {photoUploading ? (
                <span className="material-symbols-outlined vp-upload-spin">sync</span>
              ) : (
                <>
                  <span className="material-symbols-outlined vp-camera-icon">photo_camera</span>
                  <span className="vp-overlay-label">
                    {photoPreview ? 'Change Photo' : 'Add Photo'}
                  </span>
                </>
              )}
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*"
            className="vp-file-input" onChange={handlePhotoChange} />

          {photoError && (
            <div className="alert alert-red vp-photo-error">
              <span className="material-symbols-outlined">error</span>{photoError}
            </div>
          )}

          {/* Identity — read only */}
          <div className="vp-name">{profile?.name || '—'}</div>
          <div className="vp-email">{profile?.email || '—'}</div>

          <span className="vp-role-badge">{profile?.role || '—'}</span>

          <div className="vp-divider" />

          {/* Info rows — all read only */}
          {[
            ['Email',  profile?.email || '—'],
            ['Role',   profile?.role  || '—'],
            ['Status', profile?.is_active !== false ? '✓ Active' : '✗ Inactive'],
          ].map(([label, value]) => (
            <div key={label} className="vp-info-row">
              <div className="detail-label">{label}</div>
              <div className={`detail-value${label === 'Status' ? (profile?.is_active !== false ? ' app-enabled' : ' app-disabled') : ''}`}>
                {value}
              </div>
            </div>
          ))}

          <div className="vp-note">
            Your name, email and role are set by the boutique owner in Staff Accounts. To make changes, contact your owner.
          </div>
        </div>
      </div>
    </div>
  )
}
